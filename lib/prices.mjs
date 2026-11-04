import { retryAt } from './network.mjs';
const ADDRESS = /^0x[0-9a-f]{40}$/i;
const QUOTES = new Set(['0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c', '0x55d398326f99059ff775485246999027b3197955', '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d', '0xe9e7cea3dedca5984780bafc599bd69add087d56']);
// priceUsd describes baseToken only. Never apply it to a matching quoteToken.
export function selectPrices(pairs, addresses, at = new Date().toISOString()) {
  const wanted = new Set(addresses.map(a => a.toLowerCase())), found = {};
  for (const p of pairs) {
    const address = p.baseToken?.address?.toLowerCase(), price = Number(p.priceUsd), liquidity = Number(p.liquidity?.usd);
    if (p.chainId !== 'bsc' || !wanted.has(address) || !QUOTES.has(p.quoteToken?.address?.toLowerCase()) || !ADDRESS.test(p.pairAddress) || !Number.isFinite(price) || price <= 0 || !Number.isFinite(liquidity) || liquidity < 1000) continue;
    if (!found[address] || liquidity > found[address].priceLiquidityUsd) found[address] = { price, priceAt: at, priceSource: 'DexScreener', pricePair: p.pairAddress.toLowerCase(), priceLiquidityUsd: liquidity };
  }
  return found;
}
export async function updatePrices(wallets, previous = {}, minutes = 30, request = fetch) {
  const now = Date.now(), tokens = [...new Set(wallets.flatMap(w => (w.balances || []).filter(b => ADDRESS.test(b.address) && /[1-9]/.test(b.balance || '')).map(b => b.address.toLowerCase())))];
  const quotes = { ...(previous.quotes || {}) };
  let nextAt = previous.nextAt, error = previous.error || null;
  if (!nextAt || now >= Date.parse(nextAt)) {
    nextAt = new Date(now + minutes * 60000).toISOString(); error = null;
    for (let i = 0; i < tokens.length; i += 30) {
      const chunk = tokens.slice(i, i + 30);
      try {
        const response = await request('https://api.dexscreener.com/tokens/v1/bsc/' + chunk.join(','), { signal: AbortSignal.timeout(12000) });
        if (response.status === 429) {
          nextAt = new Date(Math.max(Date.parse(nextAt), retryAt(response.headers.get('retry-after'), now))).toISOString();
          throw Error('429');
        }
        if (!response.ok) throw Error('Price endpoint failed');
        const pairs = await response.json(); if (!Array.isArray(pairs)) throw Error('Invalid prices');
        const found = selectPrices(pairs, chunk);
        for (const address of chunk) delete quotes[address];
        Object.assign(quotes, found);
      } catch { error = '公共报价部分未更新，保留可用缓存'; break; }
      // At most one batch/250ms; requests contain public contracts, never wallet addresses.
      if (i + 30 < tokens.length) await new Promise(r => setTimeout(r, 250));
    }
  }
  for (const address of Object.keys(quotes)) if (!tokens.includes(address)) delete quotes[address];
  return { quotes, nextAt, error };
}
export function applyPrices(wallets, prices) {
  for (const w of wallets) for (const b of w.balances || []) {
    const quote = prices.quotes?.[b.address];
    if (quote && (b.price == null || !b.priceAt || Date.parse(quote.priceAt) >= Date.parse(b.priceAt))) Object.assign(b, quote);
    else if (!quote && b.priceSource === 'DexScreener' && !prices.error) {
      b.price = null; delete b.priceAt; delete b.priceSource; delete b.pricePair; delete b.priceLiquidityUsd;
    }
  }
}
