#!/usr/bin/env node
import { mkdir, readFile, writeFile, cp, access } from 'node:fs/promises';
import { openSync, closeSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { dataDir, loadConfig, saveConfig, ADDRESS } from '../lib/config.mjs';
const exec = promisify(execFile), root = dirname(dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2), command = args[0] || 'start';
const port = Number(process.env.CBOT_PORT || 48765), url = `http://127.0.0.1:${port}`;
const value = flag => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : undefined; };
async function health() {
  try { const response = await fetch(url + '/api/health', { signal: AbortSignal.timeout(1000) }); const h = await response.json(); return h.product === 'cbot-wallet' ? h : null; } catch { return null; }
}
async function background(appRoot) {
  if (await health()) { console.log(url); return; }
  await mkdir(dataDir, { recursive: true, mode: 0o700 });
  const out = openSync(join(dataDir, 'server.log'), 'a', 0o600), err = openSync(join(dataDir, 'server-error.log'), 'a', 0o600), instance = randomUUID();
  const child = spawn(process.execPath, ['--use-env-proxy', join(appRoot, 'server.mjs')], { cwd: appRoot, detached: true, windowsHide: true, stdio: ['ignore', out, err], env: { ...process.env, CBOT_INSTANCE: instance } });
  child.unref(); closeSync(out); closeSync(err);
  await writeFile(join(dataDir, 'process.json'), JSON.stringify({ pid: child.pid, instance }), { mode: 0o600 });
  for (let i = 0; i < 30; i++) { await new Promise(r => setTimeout(r, 200)); if (await health()) { console.log(url); return; } }
  throw Error('后台未启动，请查看本地 server-error.log');
}
async function install(appRoot) {
  const target = resolve(process.env.CBOT_INSTALL_DIR || join(homedir(), '.local', 'share', 'cbot-wallet-app'));
  await mkdir(target, { recursive: true });
  if (resolve(target) !== resolve(appRoot)) {
    for (const name of ['bin', 'lib', 'public', 'server.mjs', 'package.json', 'skills', 'README.md', 'LICENSE', 'docs']) {
      try { await access(join(appRoot, name)); await cp(join(appRoot, name), join(target, name), { recursive: true }); } catch (e) { if (e.code !== 'ENOENT') throw e; }
    }
  }
  if (args.includes('--autostart')) {
    if (process.platform === 'win32') {
      await exec('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', join(target, 'bin', 'windows-shortcuts.ps1'), '-NodePath', process.execPath, '-AppPath', target, '-DataPath', dataDir], { windowsHide: true });
    } else console.log('已安装；macOS/Linux 登录自启请按 docs/INSTALL.md 手动配置。');
  }
  await background(target);
}
try {
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major < 24 || major === 24 && minor < 5) throw Error('需要 Node.js 24.5+');
  if (command === 'start') {
    if (args.includes('--background')) await background(root);
    else { const { startServer } = await import('../server.mjs'); await startServer({ port, demo: args.includes('--demo') }); }
  } else if (command === 'install') await install(root);
  else if (command === 'status') console.log(JSON.stringify(await health() || { running: false }));
  else if (command === 'add') {
    const address = args[1]?.toLowerCase(); if (!ADDRESS.test(address)) throw Error('用法：cbot-wallet add 0x地址 --name 名称');
    const config = await loadConfig();
    config.wallets = [...config.wallets.filter(w => w.address !== address), { address, name: value('--name') || 'Wallet' }];
    await saveConfig(config); console.log('已添加观察地址，服务下次启动将读取；运行中请用网页设置添加。');
  } else if (command === 'stop') {
    const record = JSON.parse(await readFile(join(dataDir, 'process.json'), 'utf8')), h = await health();
    if (!h || h.instance !== record.instance || h.pid !== record.pid) throw Error('进程身份无法核验，未停止任何程序');
    process.kill(record.pid, 'SIGTERM'); console.log('已停止本工具后台。');
  } else if (command === 'help' || args.includes('--help')) console.log('cbot-wallet start [--background|--demo] | install [--autostart] | add 0xADDRESS --name NAME | status | stop');
  else throw Error('未知命令，运行 cbot-wallet help');
} catch (e) { console.error(e.message.includes('http') ? '操作失败，请检查本地配置和网络（连接地址已隐藏）' : e.message); process.exitCode = 1; }
