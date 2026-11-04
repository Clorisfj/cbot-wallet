import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { access, readdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const exec = promisify(execFile), root = dirname(fileURLToPath(import.meta.url));
let cliPath;
async function findCli() {
  if (cliPath !== undefined) return cliPath;
  const candidates = [process.env.CBOT_BAW_CLI, process.env.APPDATA && join(process.env.APPDATA, 'npm/node_modules/@binance/agentic-wallet/dist/index.js')].filter(Boolean);
  try { const r = await exec('npm' + (process.platform === 'win32' ? '.cmd' : ''), ['root', '-g'], { timeout: 5000, windowsHide: true }); candidates.push(join(r.stdout.trim(), '@binance/agentic-wallet/dist/index.js')); } catch {}
  for (const p of candidates) try { await access(p); return cliPath = p; } catch {}
  return cliPath = null;
}
export async function walletRead(profile, command) {
  const commands = { status: ['status'], address: ['address'], settings: ['settings'], balance: ['balance', '--binanceChainId', '56', '--hideLowValue', 'false'], history: ['tx-history', '--binanceChainId', '56', '--size', '100'] };
  if (!commands[command]) throw Error('Only read-only wallet commands are allowed');
  const cli = await findCli(); if (!cli || !profile.sessionDir) throw Error('未发现本机钱包CLI配置');
  await access(join(profile.sessionDir, 'session.json'));
  const { stdout } = await exec(process.execPath, ['--use-env-proxy', '--require', join(root, 'wallet-preload.cjs'), cli, 'wallet', ...commands[command], '--json'], {
    timeout: 20000, maxBuffer: 4 * 1024 * 1024, windowsHide: true,
    env: { ...process.env, BINANCE_BAW_DIR: profile.sessionDir, CBOT_CREDENTIAL_ACCOUNT: profile.credentialAccount || '', CBOT_CLI_PATH: cli },
  });
  const result = JSON.parse(stdout); if (!result.success) throw Error('本机钱包查询失败');
  return result.data;
}
export async function discoverWallets() {
  if (!await findCli()) return [];
  const directories = [join(homedir(), '.baw')];
  try { for (const d of await readdir(homedir(), { withFileTypes: true })) if (d.isDirectory() && d.name.startsWith('.baw-')) directories.push(join(homedir(), d.name)); } catch {}
  const found = [];
  for (const sessionDir of directories.slice(0, 20)) {
    try {
      const profile = { sessionDir };
      if ((await walletRead(profile, 'status')).status !== 'CONNECTED') continue;
      const data = await walletRead(profile, 'address');
      const address = data.addresses?.find(a => String(a.binanceChainId) === '56')?.address?.toLowerCase();
      if (/^0x[0-9a-f]{40}$/.test(address) && !found.some(w => w.address === address)) found.push({ ...profile, address, id: address, name: 'Agentic Wallet' });
    } catch { /* Missing/expired profiles are not re-authenticated. */ }
  }
  return found;
}
