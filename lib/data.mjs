import { walletRead } from './wallet-cli.mjs';
import { makeNetwork } from './network.mjs';
import { publicInterval } from './config.mjs';
import { loadAssets, loadIndexedHistory, loadNfts } from './indexes.mjs';
const ADDRESS = /^0x[0-9a-f]{40}$/i;
const HASH = /^0x[0-9a-f]{64}$/i;
const TRANSFER = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const APPROVAL = '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925';
export const USDT = '0x55d398326f99059ff775485246999027b3197955';
const REGISTRY = '0x60b9262456de011f7d15a54cdd8c48baaa8b022f';
const pad = value => value.replace(/^0x/, '').padStart(64, '0');
const text = value => typeof value === 'string' ? value.slice(0, 160) : '';
export function units(value, decimals = 18) {
  const n = BigInt(value), sign = n < 0n ? '-' : '', digits = (n < 0n ? -n : n).toString().padStart(decimals + 1, '0');
  return sign + (decimals ? `${digits.slice(0, -decimals)}.${digits.slice(-decimals)}`.replace(/\.?0+$/, '') : digits);
}
function decodeString(hex) {
  const b = Buffer.from(hex.slice(2), 'hex');
  const offset = Number(BigInt('0x' + b.subarray(0, 32).toString('hex')));
  const length = Number(BigInt('0x' + b.subarray(offset, offset + 32).toString('hex')));
  if (length > 250000) throw Error('Metadata too large');
  return b.subarray(offset + 32, offset + 32 + length).toString('utf8');
}
export function safeMetadata(uri) {
  const empty = { name: '', image: '', traits: [], metadataUrl: /^https:\/\//.test(uri) ? uri : '' };
  if (!uri.startsWith('data:application/json;base64,') || uri.length > 350000) return empty;
  try {
    const m = JSON.parse(Buffer.from(uri.split(',')[1], 'base64').toString('utf8'));
    let image = typeof m.image === 'string' ? m.image : '';
    if (image.startsWith('data:image/svg+xml;base64,')) {
      const svg = Buffer.from(image.split(',')[1], 'base64').toString('utf8');
      if (/<script|<foreignObject|\bon\w+\s*=|javascript:|(?:href|src)\s*=\s*["']?(?:https?:|\/\/)/i.test(svg)) image = '';
    } else if (!/^https:\/\//.test(image)) image = '';
    return { ...empty, name: text(m.name), image, traits: Array.isArray(m.attributes) ? m.attributes.slice(0, 15).map(a => ({ type: text(a.trait_type), value: text(String(a.value ?? '')) })) : [] };
  } catch { return empty; }
}

export function groupHistory(rows = []) {
  const groups = new Map();
  for (const row of rows) {
    if (!HASH.test(row.txHash)) continue;
    const hash = row.txHash.toLowerCase();
    if (!groups.has(hash)) groups.set(hash, { hash, time: text(row.txTime), kind: text(row.txType), status: text(row.status), details: [], fee: null });
    const tx = groups.get(hash);
    const source = row.txHashList?.find(x => x.txHash?.toLowerCase() === hash);
    if (source?.networkFee?.feeValue != null && tx.fee === null) {
      try { tx.fee = units(source.networkFee.feeValue); } catch { /* no fabricated fee */ }
    }
    for (const direction of ['send', 'receive']) for (const item of source?.instructions?.[direction] || []) {
      const token = item.tokenInfo || {}, address = token.contractAddress;
      if (!ADDRESS.test(address)) continue;
      const detail = { direction, symbol: text(token.symbol), amount: text(String(item.amount ?? '')), address: address.toLowerCase(), tokenId: token.tokenId == null ? null : text(String(token.tokenId)) };
      if (!tx.details.some(d => JSON.stringify(d) === JSON.stringify(detail))) tx.details.push(detail);
    }
  }
  return [...groups.values()].sort((a, b) => (Date.parse(b.time) || 0) - (Date.parse(a.time) || 0)).slice(0, 20);
}
export function isApprovalCall(transaction, wallet) {
  return transaction.from?.toLowerCase() === wallet && ['0x095ea7b3', '0xa22cb465'].includes(transaction.input?.slice(0, 10));
}
export async function enrichTransaction(tx, wallet, network) {
  const { rpc, call } = network;
  const receipt = await rpc('eth_getTransactionReceipt', [tx.hash]);
  if (!receipt) return { ...tx, status: 'pending' };
  const transaction = await rpc('eth_getTransactionByHash', [tx.hash]);
  if (!transaction) throw Error('Transaction not available');
  if (receipt.status !== '0x1') return { ...tx, status: 'failed', verified: true, enrichmentVersion: 2, details: [], fee: units(BigInt(receipt.gasUsed) * BigInt(receipt.effectiveGasPrice)) };
  const details = [];
  const tokenNames = new Map([...Object.entries(tx.tokenSymbols || {}), ...tx.details.map(d => [d.address, d.symbol])]);
  if (BigInt(transaction.value) > 0n && [transaction.from?.toLowerCase(), transaction.to?.toLowerCase()].includes(wallet)) {
    details.push({ direction: transaction.from.toLowerCase() === wallet ? 'send' : 'receive', symbol: 'BNB', address: '', amount: units(transaction.value), tokenId: null });
  }
  let minted = false, nftSent = false, usdtReceived = false, approval = false;
  for (const log of receipt.logs || []) {
    if (log.topics[0] === APPROVAL && log.address.toLowerCase() === transaction.to?.toLowerCase() && isApprovalCall(transaction, wallet)) approval = true;
    if (log.topics[0] !== TRANSFER || log.topics.length < 3) continue;
    const from = '0x' + log.topics[1].slice(-40), to = '0x' + log.topics[2].slice(-40), address = log.address.toLowerCase();
    if (from !== wallet && to !== wallet) continue;
    const direction = to === wallet ? 'receive' : 'send';
    if (log.topics.length === 4) {
      const tokenId = BigInt(log.topics[3]).toString();
      details.push({ direction, address, tokenId, amount: '1', symbol: tokenNames.get(address) || 'NFT' });
      minted ||= /^0x0{40}$/.test(from) && to === wallet;
      nftSent ||= from === wallet;
    } else {
      const decimals = address === USDT ? 18 : Number(BigInt(await call(address, '0x313ce567')));
      if (!Number.isInteger(decimals) || decimals > 36) continue;
      details.push({ direction, address, tokenId: null, amount: units(log.data, decimals), symbol: address === USDT ? 'USDT' : tokenNames.get(address) || address.slice(0, 8) });
      usdtReceived ||= address === USDT && to === wallet;
    }
  }
  const swapped = details.some(d => !d.tokenId && d.direction === 'send') && details.some(d => !d.tokenId && d.direction === 'receive');
  const transferred = ['0x', '0xa9059cbb', '0x23b872dd', '0x42842e0e', '0xb88d4fde'].includes(transaction.input?.length === 2 ? transaction.input : transaction.input?.slice(0, 10));
  return { ...tx, status: receipt.status === '0x1' ? 'confirmed' : 'failed', kind: minted ? 'mint' : nftSent && usdtReceived ? 'sale' : swapped ? 'swap' : approval ? 'approve' : transferred ? 'transfer' : tx.kind === 'approve' ? 'contract_call' : tx.kind,
    fee: units(BigInt(receipt.gasUsed) * BigInt(receipt.effectiveGasPrice)), details, verified: true, enrichmentVersion: 2 };
}

export function nftCandidates(previous = [], transactions = []) {
  const candidates = new Map();
  // Keep discovered non-enumerable collections even after their mint leaves recent history.
  for (const n of [...previous, ...transactions.flatMap(tx => tx.details || [])]) {
    if (ADDRESS.test(n.address) && /^\d+$/.test(n.tokenId ?? '')) {
      const address = n.address.toLowerCase(), tokenId = String(n.tokenId);
      candidates.set(`${address}:${tokenId}`, { address, tokenId, symbol: n.symbol });
    }
  }
  return candidates;
}

export async function loadBnbQuote() {
  const response = await fetch('https://data-api.binance.vision/api/v3/ticker/price?symbol=BNBUSDT', { signal: AbortSignal.timeout(6500) });
  if (!response.ok) throw Error('BNB/USDT 报价暂不可用');
  const data = await response.json();
  if (data.symbol !== 'BNBUSDT' || typeof data.price !== 'string' || !/^\d+(\.\d+)?$/.test(data.price) || !Number.isFinite(Number(data.price)) || Number(data.price) <= 0) throw Error('BNB/USDT 报价无效');
  return { price: data.price, at: new Date().toISOString(), source: 'Binance · BNB/USDT' };
}

async function hydrateHistory(rows, previous, address, network) {
  const merged = new Map((previous || []).map(tx => [tx.hash, tx]));
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(4, rows.length) }, async () => {
    while (cursor < rows.length) {
      const tx = rows[cursor++], cached = merged.get(tx.hash);
      if (cached?.verified && cached.enrichmentVersion === 2 && ['confirmed', 'failed'].includes(cached.status)) continue;
      try { merged.set(tx.hash, await enrichTransaction(tx, address, network)); }
      catch { merged.set(tx.hash, { ...tx, verified: false }); }
    }
  }));
  return [...merged.values()].sort((a, b) => Date.parse(b.time) - Date.parse(a.time)).slice(0, 20);
}

export async function collect(profile, previous = {}, context) {
  const { config, walletCount } = context, network = context.network || makeNetwork(config);
  const now = Date.now(), iso = () => new Date().toISOString();
  const out = { ...previous, id: profile.address, name: profile.name, address: profile.address, errors: [], connection: profile.sessionDir ? previous.connection || 'UNKNOWN' : 'WATCH_ONLY', checkedAt: iso() };
  let connected = false;
  if (profile.sessionDir) {
    try {
      const status = await walletRead(profile, 'status');
      out.connection = status.status; out.connectionAt = iso();
      if (status.status === 'CONNECTED') {
        const data = await walletRead(profile, 'address');
        if (data.addresses?.find(a => String(a.binanceChainId) === '56')?.address?.toLowerCase() !== profile.address) throw Error('Identity mismatch');
        connected = true;
      }
    } catch { out.connection = 'UNKNOWN'; out.errors.push('本机登录不可用；公开地址查询不受影响，不会自动重新登录'); }
  }
  if (!out.balanceNextAt || now >= Date.parse(out.balanceNextAt)) {
  out.balanceNextAt = new Date(now + config.refreshMinutes * 60000).toISOString();
  try {
    const [bnb, usdt] = await Promise.all([network.rpc('eth_getBalance', [profile.address, 'latest']), network.call(USDT, '0x70a08231' + pad(profile.address))]);
    const price = context.bnbQuote?.price ? Number(context.bnbQuote.price) : null;
    const previousUsdt = previous.balances?.find(b => b.address === USDT);
    const core = [{ symbol: 'BNB', address: '', balance: units(bnb), price, at: iso(), priceAt: context.bnbQuote?.at }, { symbol: 'USDT', address: USDT, balance: units(usdt), price: previousUsdt?.price ?? null, priceAt: previousUsdt?.priceAt, at: iso() }];
    out.balances = [...core, ...(previous.balances || []).filter(b => b.address && b.address !== USDT)];
    out.balanceAt = iso();
  } catch { out.errors.push('基础余额更新失败，保留原数据'); }
  }
  if (!out.handle || now - Date.parse(out.handleAt) > 86400000) {
    try { out.handle = decodeString(await network.call(REGISTRY, '0xc50a1514' + pad(profile.address))); out.handleAt = iso(); } catch { /* Agent ID is optional for a watch address. */ }
  }
  const interval = Math.max(config.refreshMinutes * 60000, network.hasAnkr ? 0 : publicInterval(walletCount));
  const candidates = new Map((out.balances || []).filter(b => b.address).map(b => [b.address, b]));
  let indexed = null;
  if (!out.assetsNextAt || now >= Date.parse(out.assetsNextAt)) {
    out.assetsNextAt = new Date(now + interval).toISOString();
    try {
      indexed = await loadAssets(profile.address, network, walletCount);
      for (const b of indexed.tokens) candidates.set(b.address, { ...candidates.get(b.address), ...b });
      out.tokenSource = indexed.source; out.tokensPartial = indexed.partial; out.tokenError = null;
    } catch (e) {
      out.assetsNextAt = new Date(Math.max(now + interval, e.retryAt || 0)).toISOString();
      out.tokenError = '代币发现更新失败，已知代币仍按计划查询余额';
    }
  }
  // Known holdings do not need to wait for the slower public discovery quota.
  if (indexed || !out.tokenBalancesNextAt || now >= Date.parse(out.tokenBalancesNextAt)) {
    out.tokenBalancesNextAt = new Date(now + config.refreshMinutes * 60000).toISOString();
    const tokens = [], entries = [...candidates.values()];
    let failures = 0;
    for (let i = 0; i < entries.length; i += 6) {
      await Promise.all(entries.slice(i, i + 6).map(async b => {
        try {
          const decimals = Number.isInteger(b.decimals) ? b.decimals : Number(BigInt(await network.call(b.address, '0x313ce567')));
          if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) throw Error('Bad decimals');
          const balance = units(await network.call(b.address, '0x70a08231' + pad(profile.address)), decimals);
          const priceAt = indexed?.tokens.some(t => t.address === b.address) ? iso() : b.priceAt;
          tokens.push({ ...b, decimals, balance, at: iso(), verificationFailed: false, priceAt });
        } catch (e) {
          failures++;
          out.tokenBalancesNextAt = new Date(Math.max(Date.parse(out.tokenBalancesNextAt), e.retryAt || 0)).toISOString();
          const old = previous.balances?.find(t => t.address === b.address);
          if (old) tokens.push({ ...old, verificationFailed: true });
          else if (b.balance != null) tokens.push({ ...b, at: iso(), indexed: true, verificationFailed: true });
          else tokens.push({ ...b, balance: null, verificationFailed: true });
        }
      }));
    }
    out.balances = [...(out.balances || []).filter(b => !b.address), ...tokens].sort((a, b) => a.address.localeCompare(b.address));
    if (!failures) out.otherBalanceAt = iso();
    out.tokenBalanceError = failures ? failures + ' 项代币余额更新失败，保留原值' : null;
  }
  if (out.tokenError) out.errors.push(out.tokenError);
  if (out.tokenBalanceError) out.errors.push(out.tokenBalanceError);
  const historyInterval = connected ? config.refreshMinutes * 60000 : interval;
  if (!out.historyNextAt || now >= Date.parse(out.historyNextAt)) {
    out.historyNextAt = new Date(now + historyInterval).toISOString();
    try {
      let rows, source;
      if (connected) try { const data = await walletRead(profile, 'history'); if (!Array.isArray(data.transactions)) throw Error('Invalid history'); rows = groupHistory(data.transactions); source = 'wallet'; } catch {}
      if (!rows) { rows = await loadIndexedHistory(profile.address, network, walletCount); source = network.hasAnkr ? 'ankr' : 'public'; }
      out.transactions = await hydrateHistory(rows, previous.transactions, profile.address, network);
      out.historyAt = iso(); out.historySource = source; out.historyError = null;
    } catch (e) {
      out.historyNextAt = new Date(Math.max(now + interval, e.retryAt || 0)).toISOString();
      out.historyError = '交易更新失败，当前保留缓存；请查看数据源和下次查询时间';
    }
  }
  if (out.historyError) out.errors.push(out.historyError);
  const nftInterval = interval;
  if (!out.nftNextAt || now >= Date.parse(out.nftNextAt)) {
    out.nftNextAt = new Date(now + nftInterval).toISOString();
    try { Object.assign(out, await loadNfts(profile.address, previous, out.transactions, network)); out.nftError = null; }
    catch (e) { out.nftNextAt = new Date(Math.max(now + nftInterval, e.retryAt || 0)).toISOString(); out.nftError = 'NFT 索引更新失败，保留上次持仓'; }
  }
  if (out.nftError) out.errors.push(out.nftError);
  out.checkedAt = iso();
  return out;
}

