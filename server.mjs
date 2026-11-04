import http from 'node:http';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { loadConfig, saveConfig, settingsForBrowser, mergeBrowserSettings, dataDir, publicInterval } from './lib/config.mjs';
import { collect, loadBnbQuote } from './lib/data.mjs';
import { discoverWallets } from './lib/wallet-cli.mjs';
import { makeNetwork, usage, restoreUsage, usageEstimate, backoffState, restoreBackoff } from './lib/network.mjs';
import { demoState } from './lib/demo.mjs';

const root = dirname(fileURLToPath(import.meta.url));
export async function startServer({ port = Number(process.env.CBOT_PORT || 48765), demo = process.argv.includes('--demo'), loadQuote = loadBnbQuote } = {}) {
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw Error('Invalid port');
  const instance = process.env.CBOT_INSTANCE || randomUUID();
  let config = await loadConfig(), state = { version: 2, wallets: [], refreshing: false, updatedAt: null }, lastAttempt = 0, discovered = [], discoveryAt = 0;
  await mkdir(dataDir, { recursive: true, mode: 0o700 });
  if (!demo) try {
    const saved = JSON.parse(await readFile(join(dataDir, 'cache.json'), 'utf8'));
    if (saved.version === 2 && Array.isArray(saved.wallets)) state = { ...saved, refreshing: false };
    restoreUsage(saved.usage);
    restoreBackoff(saved.backoff);
  } catch { /* first launch */ }
  const profiles = () => {
    const map = new Map();
    for (const p of [...discovered, ...config.wallets]) map.set(p.address, { ...map.get(p.address), ...p });
    return [...map.values()];
  };
  async function persist() {
    const temp = join(dataDir, 'cache-next.json');
    await writeFile(temp, JSON.stringify({ ...state, refreshing: false, usage, backoff: backoffState() }), { mode: 0o600 });
    await rename(temp, join(dataDir, 'cache.json'));
  }
  async function refresh() {
    if (demo) { state = demoState(); return; }
    if (state.refreshing || Date.now() - lastAttempt < 15000) return;
    state.refreshing = true; lastAttempt = Date.now();
    try {
      if (config.autoDiscover && Date.now() - discoveryAt > 300000) {
        discovered = await discoverWallets(); discoveryAt = Date.now();
      } else if (!config.autoDiscover) discovered = [];
      const active = profiles(), network = makeNetwork(config);
      state.wallets = state.wallets.filter(w => active.some(p => p.address === w.address));
      try { state.bnbQuote = await loadQuote(); state.quoteError = null; } catch { state.quoteError = 'BNB 参考报价暂不可用，保留原报价'; }
      // Bound concurrency for RPC providers; Advanced and public indexes have shared rate queues.
      let cursor = 0;
      await Promise.all(Array.from({ length: Math.min(2, active.length) }, async () => {
        while (cursor < active.length) {
          const profile = active[cursor++], previous = state.wallets.find(w => w.address === profile.address) || {};
          const next = await collect(profile, previous, { config, walletCount: active.length, network, bnbQuote: state.bnbQuote });
          state.wallets = [...state.wallets.filter(w => w.address !== profile.address), next].sort((a, b) => active.findIndex(p => p.address === a.address) - active.findIndex(p => p.address === b.address));
        }
      }));
      state.updatedAt = new Date().toISOString(); state.notice = null;
      await persist();
    } catch { state.notice = '刷新未完成，保留原数据；请检查网络和本地配置'; }
    finally { state.refreshing = false; }
  }
  const hosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
  const origins = new Set([`http://127.0.0.1:${port}`, `http://localhost:${port}`]);
  const files = { '/': ['index.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'], '/view.mjs': ['view.mjs', 'text/javascript'], '/style.css': ['style.css', 'text/css'], '/logo.svg': ['logo.svg', 'image/svg+xml'] };
  let saving = false;
  const server = http.createServer(async (req, res) => {
    const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: https:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
      'Cross-Origin-Resource-Policy': 'same-origin' };
    const send = (code, data, type = 'application/json') => { res.writeHead(code, { ...headers, 'Content-Type': type + '; charset=utf-8' }); res.end(type === 'application/json' ? JSON.stringify(data) : data); };
    if (!hosts.has(req.headers.host)) return send(403, { error: 'Local access only' });
    const path = req.url?.split('?')[0];
    if (req.method === 'POST') {
      if (!origins.has(req.headers.origin)) return send(403, { error: 'Same-origin required' });
      if (path === '/api/refresh') { void refresh(); return send(202, { refreshing: state.refreshing }); }
      if (path !== '/api/settings') return send(404, { error: 'Not found' });
      if (demo) return send(403, { error: '演示模式不会保存个人配置' });
      if (saving || state.refreshing) return send(409, { error: '数据刷新中，请稍后再保存' });
      if (!req.headers['content-type']?.startsWith('application/json')) return send(415, { error: 'JSON required' });
      saving = true;
      try {
        let body = ''; for await (const chunk of req) { body += chunk; if (Buffer.byteLength(body) > 32768) throw Error('配置过大'); }
        const next = mergeBrowserSettings(config, JSON.parse(body));
        const changedProvider = next.ankrKey !== config.ankrKey || next.rpcUrl !== config.rpcUrl || next.refreshMinutes !== config.refreshMinutes;
        config = await saveConfig(next);
        if (changedProvider) for (const w of state.wallets) { delete w.assetsNextAt; delete w.historyNextAt; delete w.nftNextAt; }
        state.wallets = state.wallets.filter(w => profiles().some(p => p.address === w.address));
        lastAttempt = 0;
        send(200, { success: true }); void refresh();
      } catch (e) { send(400, { error: ['SyntaxError', 'TypeError'].includes(e.name) ? '配置格式无效' : e.message }); }
      finally { saving = false; }
      return;
    }
    if (req.method !== 'GET') return send(405, { error: 'Read-only dashboard' });
    if (path === '/api/health') return send(200, { app: 'wallet-desk', product: 'cbot-wallet', version: '1.0.0', demo, pid: process.pid, instance });
    if (path === '/api/state') return send(200, { ...state, settings: settingsForBrowser(config, demo ? state.wallets : profiles()), usage: usageEstimate(config, state.wallets.length),
      publicRefreshMinutes: publicInterval(Math.max(1, state.wallets.length)) / 60000, demo });
    if (!files[path]) return send(404, { error: 'Not found' });
    try { const [name, type] = files[path]; send(200, await readFile(join(root, 'public', name)), type); }
    catch { send(500, { error: '页面读取失败' }); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  console.log(`cbot Wallet Desk: http://127.0.0.1:${port}/`);
  void refresh();
  const timer = setInterval(() => void refresh(), 60000); timer.unref();
  server.on('close', () => clearInterval(timer));
  return server;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) startServer().catch(() => { console.error('无法启动：检查端口、Node版本或本地配置。不会输出密钥。'); process.exitCode = 1; });
