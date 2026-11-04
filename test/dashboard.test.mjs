import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import http from 'node:http';
const temp = await mkdtemp(join(tmpdir(), 'cbot-wallet-test-'));
process.env.CBOT_HOME = temp;
const { validateConfig, mergeBrowserSettings, mergeWalletSettings, providerKey, settingsForBrowser, publicInterval, saveConfig } = await import('../lib/config.mjs');
const { makeNetwork, usageEstimate, retryAt, restoreBackoff } = await import('../lib/network.mjs');
const { tokenVisible, totalBalance, connectionState, sortAssets, assetValue } = await import('../public/view.mjs');
const { units, collect, USDT, safeMetadata, isApprovalCall } = await import('../lib/data.mjs');
const { normalizedAsset, loadAssets, loadIndexedHistory } = await import('../lib/indexes.mjs');
const { publicHistoryRows } = await import('../lib/history.mjs');
const { startServer } = await import('../server.mjs');
const a = '0x' + '1'.repeat(40), b = '0x' + '2'.repeat(40), token = '0x' + '3'.repeat(40), hash = '0x' + '4'.repeat(64);

const {selectPrices,updatePrices,applyPrices}=await import('../lib/prices.mjs');
const {stampAcquisition}=await import('../lib/acquisition.mjs');
test('public price selection checks chain, base contract, trusted quote and liquidity', () => {
  const good={chainId:'bsc',baseToken:{address:token},quoteToken:{address:'0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c'},pairAddress:a,priceUsd:'2',liquidity:{usd:2000}};
  const rows=[good,{...good,priceUsd:'999',chainId:'ethereum'},{...good,priceUsd:'999',baseToken:{address:b}},{...good,priceUsd:'999',quoteToken:{address:b}},{...good,priceUsd:'999',liquidity:{usd:10}},{...good,priceUsd:'3',liquidity:{usd:3000}}];
  assert.equal(selectPrices(rows,[token])[token].price,3);
  assert.deepEqual(selectPrices([{...good,baseToken:{address:b},quoteToken:{address:token}}],[token]),{});
});
test('public prices batch and deduplicate, persist Retry-After and keep original timestamps on failure', async () => {
  const wallets=[{balances:[{address:token,balance:'1',price:null}]}];let calls=0;
  const request=async()=>{calls++;return new Response('[]',{status:429,headers:{'retry-after':'3600'}});};
  const previous={quotes:{[token]:{price:2,priceAt:'2026-01-01T00:00:00Z',priceSource:'DexScreener'}}};
  const next=await updatePrices([...wallets,...wallets],previous,5,request);
  assert.equal(calls,1);assert.ok(Date.parse(next.nextAt)>Date.now()+3500000);applyPrices(wallets,next);assert.equal(wallets[0].balances[0].priceAt,'2026-01-01T00:00:00Z');
  await updatePrices(wallets,next,5,request);assert.equal(calls,1);
});
test('asset sorts keep unknowns last in both directions and distinguish value from quantity', () => {
  const rows=[{asset:{balance:'999',price:null}},{asset:{balance:'2',price:3}},{asset:{balance:'1',price:8}}];
  assert.equal(sortAssets(rows,'value-desc')[0].asset.price,8);assert.equal(sortAssets(rows,'value-asc')[0].asset.price,3);assert.equal(sortAssets(rows,'value-asc')[2].asset.price,null);
  assert.equal(assetValue({referenceValueUsd:null},true),null);assert.equal(assetValue({referenceValueUsd:0},true),0);
  const timed=[{asset:{}},{asset:{firstSeenAt:'2026-01-02'}},{asset:{acquiredAt:'2026-01-01'}}];
  assert.equal(sortAssets(timed,'time-asc')[0].asset.acquiredAt,'2026-01-01');assert.deepEqual(sortAssets(timed,'time-desc')[2].asset,{});
});
test('acquisition uses verified incoming history, preserves first seen and excludes outgoing/unverified', () => {
  const asset={address:token,balance:'2'}, old={balances:[{...asset,firstSeenAt:'2026-01-01'}]};
  const wallet={balances:[asset],transactions:[{verified:true,status:'confirmed',time:'2026-02-01',details:[{address:token,direction:'receive'}]},{verified:false,status:'confirmed',time:'2026-03-01',details:[{address:token,direction:'receive'}]},{verified:true,status:'confirmed',time:'2026-04-01',details:[{address:token,direction:'send'}]}]};
  stampAcquisition(wallet,old);assert.equal(asset.firstSeenAt,'2026-01-01');assert.equal(asset.acquiredAt,'2026-02-01');
  wallet.transactions=[];stampAcquisition(wallet,wallet,'2026-05-01');assert.equal(asset.firstSeenAt,'2026-01-01');assert.equal(asset.acquiredAt,'2026-02-01');
});

test('small toggle hides exact zero always, keeps unpriced, and respects 0.1 threshold', () => {
  for (const balance of ['0', '0.000', '000.000']) assert.equal(tokenVisible({ balance, price: null }, false), false);
  assert.equal(tokenVisible({ balance: '1', price: 0.099 }, true), false);
  assert.equal(tokenVisible({ balance: '1', price: 0.1 }, true), true);
  assert.equal(tokenVisible({ balance: '0.000000000000000001', price: null }, true), true);
  assert.equal(tokenVisible({ balance: 'unknown', price: 0.01 }, true), true);
  assert.equal(tokenVisible({ balance: '1', price: 0.001 }, false), true);
});
test('zero, one, and many wallets aggregate exact decimal values without fabricated zero', () => {
  assert.equal(totalBalance([], 'BNB'), null);
  const w = { balances: [{ address: '', symbol: 'BNB', balance: '0.000000000000000001' }] };
  assert.equal(totalBalance([w], 'BNB'), '0.000000000000000001');
  assert.equal(totalBalance([w,w,w], 'BNB'), '0.000000000000000003');
  assert.equal(totalBalance([w,{}], 'BNB'), null);
  assert.equal(connectionState({ connection: 'WATCH_ONLY', sessionExpires: '2000-01-01' }).label, '只读观察');
});
test('configuration supports multiple addresses; credentials never appear in browser settings', () => {
  const config = validateConfig({ wallets: [{ address: a, name: 'A', sessionDir: '/private/profile', credentialAccount: 'private-alias' }, { address: b }], ankrKey: 'a'.repeat(64), rpcUrl: 'https://rpc.ankr.com/bsc/private-test-key' });
  const publicText = JSON.stringify(settingsForBrowser(config, config.wallets));
  for (const secret of ['a'.repeat(64), '/private/profile', 'private-alias', 'private-test-key']) assert.equal(publicText.includes(secret), false);
  assert.equal(mergeBrowserSettings(config, { wallets: [{ address: a }], ankrKey: '' }).wallets[0].sessionDir, '/private/profile');
  assert.equal(mergeBrowserSettings(config, { clearAnkr: true }).ankrKey, '');
  assert.throws(() => validateConfig({ wallets: [{ address: a }, { address: a }] }));
  for (const rpcUrl of ['http://example.com', 'https://127.0.0.1', 'https://user:password@example.com']) assert.throws(() => validateConfig({ wallets: [], rpcUrl }));
});
test('wallet management preserves profiles, persists discovered exclusions and isolates settings', () => {
  const config = validateConfig({wallets:[{address:a,sessionDir:'/private'}]});
  const removed = mergeWalletSettings(config,{wallets:[],autoDiscover:true},[{address:a},{address:b}]);
  assert.deepEqual(removed.excludedAddresses,[a,b]);
  const restored = mergeWalletSettings(removed,{wallets:[{address:b,name:'Back'}]},[]);
  assert.deepEqual(restored.excludedAddresses,[a]);
  const settings = mergeBrowserSettings(config,{wallets:[],autoDiscover:false,excludedAddresses:[a],refreshMinutes:10});
  assert.equal(settings.wallets.length,1); assert.equal(settings.autoDiscover,true); assert.deepEqual(settings.excludedAddresses,[]);
  assert.equal(mergeWalletSettings(config,{wallets:[{address:a,name:'New'}]},[]).wallets[0].sessionDir,'/private');
});
test('ANKR BSC URL derives key privately; cost follows provider and holdings', () => {
  const key='x'.repeat(64), config=validateConfig({wallets:[],rpcUrl:'https://rpc.ankr.com/bsc/'+key});
  assert.equal(providerKey(config),key); assert.equal(settingsForBrowser(config).ankrConfigured,true);
  assert.equal(JSON.stringify(settingsForBrowser(config)).includes(key),false);
  assert.equal(providerKey({...config,rpcUrl:'https://example.com/bsc/'+key}), '');
  const rows=usageEstimate(config,2,100).intervals;
  assert.ok(rows[0].credits>rows[4].credits); assert.ok(rows[0].credits>usageEstimate(config,2,2).intervals[0].credits);
  assert.equal(usageEstimate({refreshMinutes:30},2).intervals[0].credits,0);
});

test('public refresh scales within budget; ANKR monthly estimate includes wallet count', () => {
  for (const count of [1,2,10,100]) assert.ok(count * 3 * 10080 / (publicInterval(count) / 60000) <= 2400);
  assert.equal(usageEstimate({ refreshMinutes: 5 }, 2).estimatedMonthlyCredits, 48384000);
  assert.equal(usageEstimate({ refreshMinutes: 5 }, 10).estimatedPercent, 120.96);
  assert.equal(retryAt('3600', 0), 3600000);
});
test('indexed token normalization preserves huge raw amounts and includes unlisted assets', () => {
  const raw = '12345678901234567890123456789';
  const result = normalizedAsset({ contractAddress: token, balanceRawInteger: raw, tokenDecimals: 18, tokenSymbol: 'TEST', tokenPrice: '' }, 'ankr');
  assert.equal(result.balance, units(raw)); assert.equal(result.price, null);
  assert.equal(normalizedAsset({ tokenInfo: { address: token, decimals: 18, symbol: 'T' }, rawBalance: 1e30 }, 'public').balance, null);
});
test('ANKR asset discovery requests all tokens and follows pagination', async () => {
  const requests = [];
  const result = await loadAssets(a, { hasAnkr: true, advanced: async (method, params) => {
    requests.push(params);
    return { assets: [{ blockchain: 'bsc', contractAddress: token, tokenDecimals: 18, tokenSymbol: 'NEW', balanceRawInteger: '1000000000000000000' }], nextPageToken: requests.length === 1 ? 'page-two' : '' };
  } }, 1);
  assert.equal(requests[0].onlyWhitelisted, false); assert.equal(requests[1].pageToken, 'page-two');
  assert.equal(result.tokens.length, 2); assert.equal(result.partial, false);
});
test('RPC write methods and wrong-chain endpoints fail closed', async () => {
  const original = globalThis.fetch; let calls = [];
  globalThis.fetch = async (_url, options) => { calls.push(JSON.parse(options.body).method); return Response.json({ result: '0x1' }); };
  try {
    const network = makeNetwork({ rpcUrl: 'https://example.com', ankrKey: '' });
    await assert.rejects(network.rpc('eth_sendRawTransaction', ['0x']));
    await assert.rejects(network.rpc('eth_getBalance', [a, 'latest']), /chainId/);
    assert.deepEqual(calls, ['eth_chainId']);
  } finally { globalThis.fetch = original; }
});
test('watch-only wallet updates new tokens, exact balances, history and NFT index without signing', async () => {
  let coreReads = 0;
  const methods = [], at = Math.floor(Date.now() / 1000);
  const network = { hasAnkr: true,
    advanced: async (method, params) => { methods.push(method);
      if (method === 'ankr_getAccountBalance') return { assets: [{ blockchain: 'bsc', contractAddress: token, tokenDecimals: 18, tokenSymbol: 'NEW', balanceRawInteger: '1000000000000000000', tokenPrice: '0.01' }] };
      if (method === 'ankr_getTransactionsByAddress') return { transactions: [{ blockchain: 'bsc', from: a, to: b, hash, timestamp: '0x' + at.toString(16) }] };
      if (method === 'ankr_getTokenTransfers') return { transfers: [] };
      if (method === 'ankr_getNFTsByOwner') return { assets: [] };
      assert.fail('Unexpected method');
    }, rpc: async method => {
      if (method === 'eth_getBalance') coreReads++;
      if (method === 'eth_getBalance') return '0xde0b6b3a7640000';
      if (method === 'eth_getTransactionReceipt') return { status: '0x1', gasUsed: '0x5208', effectiveGasPrice: '0x1', logs: [] };
      if (method === 'eth_getTransactionByHash') return { from: a, to: b, input: '0x', value: '0x1' };
      assert.fail(method);
    }, call: async (to, data) => {
      if (data.startsWith('0xc50a1514')) throw Error('No Agent ID');
      if (data.startsWith('0x313ce567')) return '0x12';
      return to === token ? '0xde0b6b3a7640000' : '0x0';
    } };
  const result = await collect({ address: a, name: 'Watch' }, {}, { config: { refreshMinutes: 5 }, walletCount: 1, network });
  assert.equal(result.connection, 'WATCH_ONLY'); assert.equal(result.balances.find(t => t.address === token).balance, '1');
  assert.equal(result.transactions[0].verified, true); assert.equal(result.historySource, 'ankr');
  assert.equal(methods.length, 4);
  const rpcBefore = result.balanceAt;
  const again = await collect({ address: a, name: 'Watch' }, result, { config: { refreshMinutes: 5 }, walletCount: 1, network });
  assert.equal(coreReads,1); assert.equal(again.balanceAt,rpcBefore); assert.equal(methods.length, 4); assert.equal(again.historyAt, result.historyAt);
});
test('known token balances update before discovery is due, remove sold holdings and retain failures', async () => {
  const at = new Date().toISOString(), future = new Date(Date.now()+3600000).toISOString();
  const previous = { balanceAt:at,balanceNextAt:future,assetsNextAt:future,historyNextAt:future,nftNextAt:future,handle:'Known',handleAt:at,
    otherBalanceAt:at,balances:[{address:token,symbol:'FRESH',decimals:18,balance:'12',at,price:2,priceAt:at}] };
  let reads=0;
  const network={hasAnkr:false,call:async(to,data)=>{assert.equal(to,token);assert.ok(data.startsWith('0x70a08231'));reads++;return '0x0';},rpc:async()=>assert.fail('Unscheduled core call')};
  const result=await collect({address:a,name:'Watch'},previous,{config:{refreshMinutes:5},walletCount:1,network});
  assert.equal(reads,1);assert.equal(result.assetsNextAt,future);assert.equal(result.balances[0].balance,'0');assert.equal(tokenVisible(result.balances[0],false),false);
  const again=await collect({address:a,name:'Watch'},result,{config:{refreshMinutes:5},walletCount:1,network});
  assert.equal(reads,1);
  const failed=await collect({address:a,name:'Watch'},previous,{config:{refreshMinutes:5},walletCount:1,network:{...network,call:async()=>{throw Object.assign(Error('429'),{retryAt:Date.now()+3600000});}}});
  assert.equal(failed.balances[0].balance,'12');assert.equal(failed.balances[0].at,at);assert.equal(failed.balances[0].verificationFailed,true);
  assert.ok(Date.parse(failed.tokenBalancesNextAt)>Date.now()+3500000);
});

test('duplicate public hashes merge and unsafe NFT metadata stays inert', () => {
  const row = { from: a, to: b, timestamp: Math.floor(Date.now() / 1000), hash };
  assert.equal(publicHistoryRows([row,row], { operations: [] }, a).length, 1);
  const image = 'data:image/svg+xml;base64,' + Buffer.from('<svg><script>x()</script></svg>').toString('base64');
  const uri = 'data:application/json;base64,' + Buffer.from(JSON.stringify({ image })).toString('base64');
  assert.equal(safeMetadata(uri).image, '');
  assert.equal(isApprovalCall({ from: a, input: '0x38ed1739' }, a), false);
});
test('ANKR incoming token transfers use documented fromAddress/toAddress fields', async () => {
  const rows = await loadIndexedHistory(a, { hasAnkr: true, advanced: async method => method === 'ankr_getTransactionsByAddress' ? { transactions: [] } : { transfers: [{ blockchain: 'bsc', fromAddress: b, toAddress: a, transactionHash: hash, timestamp: Math.floor(Date.now() / 1000), contractAddress: token, tokenSymbol: 'INCOMING' }] } }, 1);
  assert.equal(rows.length, 1); assert.equal(rows[0].tokenSymbols[token], 'INCOMING');
});
test('RPC429 with HTML respects Retry-After even when network client is recreated', async () => {
  const original = globalThis.fetch; let calls = 0;
  globalThis.fetch = async () => { calls++; return new Response('<html>limit</html>', { status: 429, headers: { 'retry-after': '3600' } }); };
  try {
    await assert.rejects(makeNetwork({}).rpc('eth_getBalance', [a,'latest']), e => e.retryAt > Date.now() + 3590000);
    await assert.rejects(makeNetwork({}).rpc('eth_getBalance', [a,'latest']));
    assert.equal(calls, 1);
  } finally { globalThis.fetch = original; restoreBackoff({}); }
});
test('HTTP serves only local data, blocks CSRF, redacts secrets, and persists configuration', async () => {
  await saveConfig({ wallets: [], autoDiscover: false, ankrKey: 's'.repeat(64) });
  const server = await startServer({ port: 49873, loadQuote: async () => ({ price: '700', at: new Date().toISOString(), source: 'Test' }) });
  const base = 'http://127.0.0.1:49873';
  try {
    const state = await (await fetch(base + '/api/state')).json();
    assert.equal(JSON.stringify(state).includes('s'.repeat(64)), false);
    assert.equal((await fetch(base + '/.local/settings.json')).status, 404);
    assert.equal((await fetch(base + '/api/settings', { method: 'POST', headers: { origin: 'https://evil.example', 'content-type': 'application/json' }, body: '{}' })).status, 403);
    assert.equal((await fetch(base + '/api/refresh', { method: 'POST' })).status, 403);
    const hostileHost = await new Promise((resolve, reject) => {
      const req = http.get(base + '/', { headers: { host: 'evil.example' } }, res => { res.resume(); resolve(res.statusCode); }); req.on('error', reject);
    });
    assert.equal(hostileHost, 403);
    assert.equal((await fetch(base + '/api/health')).status, 200);
    await new Promise(r => setTimeout(r, 30));
    const posted = await fetch(base+'/api/settings',{method:'POST',headers:{origin:base,'content-type':'application/json'},body:JSON.stringify({wallets:[{address:a}],autoDiscover:true,refreshMinutes:60})});
    assert.equal(posted.status,200);
    const after = await (await fetch(base+'/api/state')).json();
    assert.equal(after.settings.wallets.length,0); assert.equal(after.settings.autoDiscover,false); assert.equal(after.settings.refreshMinutes,60);
    await new Promise(r => setTimeout(r, 30));
    const bad = await fetch(base+'/api/wallets',{method:'POST',headers:{origin:base,'content-type':'application/json'},body:JSON.stringify({wallets:[{address:'invalid'}]})});
    assert.equal(bad.status,400);

    assert.equal(JSON.parse(await readFile(join(temp, 'settings.json'), 'utf8')).ankrKey, 's'.repeat(64));
  } finally { await new Promise(r => server.close(r)); }
});
test.after(async () => { await rm(temp, { recursive: true, force: true }); });
