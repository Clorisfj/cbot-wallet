import { publicInterval } from './config.mjs';
const RPC_READS = new Set(['eth_chainId', 'eth_getBalance', 'eth_call', 'eth_getTransactionReceipt', 'eth_getTransactionByHash', 'eth_getBlockByNumber']);
const ANKR_READS = new Set(['ankr_getAccountBalance', 'ankr_getTransactionsByAddress', 'ankr_getTokenTransfers', 'ankr_getNFTsByOwner']);
let publicQueue = Promise.resolve(), publicNext = 0, publicBlocked = 0;
let advancedQueue = Promise.resolve(), advancedNext = 0, advancedBlocked = 0;
let rpcBlocked = 0;
export const usage = { month: new Date().toISOString().slice(0, 7), rpc: 0, advanced: 0, credits: 0 };
function resetMonth() {
  const month = new Date().toISOString().slice(0, 7);
  if (month !== usage.month) Object.assign(usage, { month, rpc: 0, advanced: 0, credits: 0 });
}
export function retryAt(value, now = Date.now()) {
  if (!value) return now;
  return /^\d+(\.\d+)?$/.test(value) ? now + Number(value) * 1000 : Math.max(now, Date.parse(value) || now);
}
function charged(kind) {
  resetMonth();
  usage[kind]++; usage.credits += kind === 'advanced' ? 700 : 200;
}
export function restoreUsage(saved) {
  if (saved?.month === usage.month && ['rpc', 'advanced', 'credits'].every(k => Number.isSafeInteger(saved[k]) && saved[k] >= 0)) Object.assign(usage, saved);
}
export function backoffState() { return { rpcBlocked, advancedBlocked, publicBlocked }; }
export function restoreBackoff(saved) {
  if (!saved) return;
  const future = key => Number.isFinite(saved[key]) ? Math.max(0, saved[key]) : 0;
  rpcBlocked = future('rpcBlocked'); advancedBlocked = future('advancedBlocked'); publicBlocked = future('publicBlocked');
}
export function usageEstimate(config, count) {
  resetMonth();
  const requests = count * 4 * 43200 / config.refreshMinutes, credits = requests * 700;
  return { ...usage, quota: 200000000, estimatedMonthlyCredits: credits, estimatedPercent: credits / 2000000,
    note: '估算按每钱包每轮4次Advanced请求、30天持续运行；分页/RPC/重试额外计入。用量为本机估计，不是ANKR账户账单。' };
}
export function makeNetwork(config) {
  const key = config.ankrKey || process.env.ANKR_API_KEY || '';
  let id = 0, verifiedChain = false;
  const jsonRpc = async (url, method, params, kind) => {
    resetMonth();
    if (kind && usage.credits + (kind === 'advanced' ? 700 : 200) > 200000000) throw Error('本机估计已达每月ANKR预算');
    if (kind !== 'advanced' && Date.now() < rpcBlocked) throw Object.assign(Error('RPC限流退避中'), { retryAt: rpcBlocked });
    let response;
    try { response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params }), signal: AbortSignal.timeout(10000) }); }
    catch { throw Error('数据源连接失败'); }
    if (response.status === 429) {
      const until = Math.max(Date.now() + 60000, retryAt(response.headers.get('retry-after')));
      if (kind !== 'advanced') rpcBlocked = until;
      throw Object.assign(Error('数据源限流'), { retryAt: until });
    }
    if (kind) charged(kind);
    if (!response.ok) throw Error(`数据源 HTTP ${response.status}`);
    let data; try { data = await response.json(); } catch { throw Error('数据源返回格式无效'); }
    if (data.error || !Object.hasOwn(data, 'result')) throw Error('数据源拒绝查询，请检查套餐或配置');
    return data.result;
  };
  const rpc = async (method, params) => {
    if (!RPC_READS.has(method)) throw Error('Only read-only RPC methods are allowed');
    const endpoints = config.rpcUrl ? [config.rpcUrl] : ['https://bsc-dataseed.binance.org/', 'https://bsc-rpc.publicnode.com'];
    let last;
    for (const endpoint of endpoints) {
      try {
        if (!verifiedChain) {
          if (BigInt(await jsonRpc(endpoint, 'eth_chainId', [], new URL(endpoint).hostname === 'rpc.ankr.com' ? 'rpc' : null)) !== 56n) throw Object.assign(Error('RPC chainId 必须是56，已停止使用该配置'), { wrongChain: true });
          verifiedChain = true;
        }
        return await jsonRpc(endpoint, method, params, new URL(endpoint).hostname === 'rpc.ankr.com' ? 'rpc' : null);
      } catch (e) { if (e.retryAt || e.wrongChain) throw e; last = e; verifiedChain = false; }
    }
    throw last || Error('BSC 查询失败');
  };
  const advanced = async (method, params) => {
    if (!key || !ANKR_READS.has(method)) throw Error('ANKR Advanced API 未配置或方法不允许');
    const task = advancedQueue.catch(() => {}).then(async () => {
      resetMonth();
      if (Date.now() < advancedBlocked) throw Object.assign(Error('ANKR 限流退避中'), { retryAt: advancedBlocked });
      if (usage.credits + 700 > 200000000) throw Error('本机估计已达每月2亿Credits预算，已暂停ANKR查询');
      const delay = Math.max(0, advancedNext - Date.now());
      if (delay) await new Promise(resolve => setTimeout(resolve, delay));
      advancedNext = Date.now() + 1300;
      try { return await jsonRpc(`https://rpc.ankr.com/multichain/${key}`, method, params, 'advanced'); }
      catch (e) { if (e.retryAt) advancedBlocked = e.retryAt; throw e; }
    });
    advancedQueue = task;
    return task;
  };
  return { rpc, advanced, hasAnkr: Boolean(key), call: (to, data) => rpc('eth_call', [{ to, data }, 'latest']) };
}
export function publicQuery(method, address, walletCount = 1) {
  if (!['getAddressInfo', 'getAddressTransactions', 'getAddressHistory'].includes(method) || !/^0x[0-9a-f]{40}$/i.test(address)) throw Error('Invalid public read');
  const task = publicQueue.catch(() => {}).then(async () => {
    if (Date.now() < publicBlocked) throw Object.assign(Error('公共索引退避中'), { retryAt: publicBlocked });
    const delay = Math.max(0, publicNext - Date.now());
    if (delay) await new Promise(resolve => setTimeout(resolve, delay));
    publicNext = Date.now() + 650;
    let response;
    try { response = await fetch(`https://api.binplorer.com/${method}/${address}?apiKey=freekey&limit=100&showZeroValues=true`, { signal: AbortSignal.timeout(12000) }); }
    catch { throw Error('公共索引连接失败'); }
    if (response.status === 429) {
      publicBlocked = Math.max(Date.now() + publicInterval(walletCount), retryAt(response.headers.get('retry-after')));
      throw Object.assign(Error('公共索引限流'), { retryAt: publicBlocked });
    }
    let data; try { data = await response.json(); } catch { throw Error('公共索引返回格式无效'); }
    if (!response.ok || data?.error) throw Error('公共索引查询失败');
    return data;
  });
  publicQueue = task;
  return task;
}
