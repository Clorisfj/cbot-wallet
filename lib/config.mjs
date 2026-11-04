import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const ADDRESS = /^0x[0-9a-f]{40}$/i;
export const dataDir = process.env.CBOT_HOME || join(homedir(), '.cbot-wallet');
export const defaults = { wallets: [], excludedAddresses: [], autoDiscover: true, rpcUrl: '', ankrKey: '', refreshMinutes: 30, monthlyCredits: 200000000 };
export function providerKey(config) {
  const url = config.rpcUrl ? new URL(config.rpcUrl) : null;
  const match = url?.hostname === 'rpc.ankr.com' && url.pathname.match(/^\/bsc\/([A-Za-z0-9_-]{10,256})\/?$/);
  return match?.[1] || config.ankrKey || process.env.ANKR_API_KEY || '';
}
export function validUrl(value) {
  if (!value) return '';
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || /^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|\[|172\.(1[6-9]|2\d|3[01])\.)/i.test(url.hostname)) throw Error('RPC 必须是公网 HTTPS 地址');
  return url.href;
}
export function validateConfig(input) {
  if (!Array.isArray(input.wallets) || input.wallets.length > 100) throw Error('钱包列表无效（最多100个）');
  const seen = new Set();
  const wallets = input.wallets.map((w, i) => {
    if (!ADDRESS.test(w.address)) throw Error(`第 ${i + 1} 个钱包地址无效`);
    const address = w.address.toLowerCase();
    if (seen.has(address)) throw Error('钱包地址重复'); seen.add(address);
    return { id: address, address, name: String(w.name || `Wallet ${i + 1}`).slice(0, 60), ...(w.sessionDir ? { sessionDir: String(w.sessionDir), credentialAccount: String(w.credentialAccount || '') } : {}) };
  });
  const refreshMinutes = Number(input.refreshMinutes ?? 30);
  if (![5, 10, 15, 30, 60].includes(refreshMinutes)) throw Error('刷新间隔请选择5、10、15、30或60分钟');
  const ankrKey = String(input.ankrKey || '').trim();
  if (ankrKey && !/^[A-Za-z0-9_-]{10,256}$/.test(ankrKey)) throw Error('ANKR Token 格式无效，请填Token本身而非完整URL');
  const excludedAddresses = [...new Set((input.excludedAddresses || []).filter(a => ADDRESS.test(a)).map(a => a.toLowerCase()))];
  return { ...defaults, wallets, excludedAddresses, autoDiscover: input.autoDiscover !== false, rpcUrl: validUrl(input.rpcUrl || ''), ankrKey, refreshMinutes, monthlyCredits: 200000000 };
}
export async function loadConfig() {
  try { return validateConfig(JSON.parse(await readFile(join(dataDir, 'settings.json'), 'utf8'))); }
  catch (e) { if (e.code === 'ENOENT') return { ...defaults }; throw Error('本地配置格式无效，请先备份并检查 settings.json'); }
}
export async function saveConfig(config) {
  const validated = validateConfig(config);
  await mkdir(dataDir, { recursive: true, mode: 0o700 });
  await writeFile(join(dataDir, 'settings.json'), JSON.stringify(validated, null, 2), { mode: 0o600 });
  return validated;
}
export function settingsForBrowser(config, profiles = []) {
  return { wallets: profiles.map(({ address, name, sessionDir }) => ({ address, name, connectedProfile: Boolean(sessionDir) })), autoDiscover: config.autoDiscover,
    rpcConfigured: Boolean(config.rpcUrl), rpcHost: config.rpcUrl ? new URL(config.rpcUrl).hostname : '', ankrConfigured: Boolean(providerKey(config)), refreshMinutes: config.refreshMinutes };
}
export function mergeBrowserSettings(current, input) {
  return validateConfig({ ...current, refreshMinutes: input.refreshMinutes ?? current.refreshMinutes,
    rpcUrl: input.clearRpc ? '' : input.rpcUrl || current.rpcUrl,
    ankrKey: input.clearRpc || input.clearAnkr || input.rpcUrl ? '' : current.ankrKey });
}
export function mergeWalletSettings(current, input, profiles = []) {
  if (!Array.isArray(input.wallets)) throw Error('钱包列表无效');
  const wallets = input.wallets.map(w => ({ ...current.wallets.find(old => old.address === w.address?.toLowerCase()), address: w.address, name: w.name }));
  const included = new Set(wallets.map(w => w.address?.toLowerCase()));
  const excludedAddresses = [...new Set([...(current.excludedAddresses || []), ...profiles.filter(p => !included.has(p.address)).map(p => p.address)])].filter(a => !included.has(a));
  return validateConfig({ ...current, wallets, excludedAddresses, autoDiscover: input.autoDiscover !== false });
}
export function publicInterval(walletCount) {
  // Three public-index requests per wallet per cycle; reserve headroom below 3000/week.
  return Math.max(30, Math.ceil(Math.max(1, walletCount) * 3 * 10080 / 2400 / 5) * 5) * 60000;
}
