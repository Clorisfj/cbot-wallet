// Synthetic display-only data. Never uses a real participant's wallet or cache.
export function demoState() {
  const at = new Date().toISOString();
  const wallets = [1, 2, 3].map((n, i) => ({ id: '0x' + String(n).repeat(40), address: '0x' + String(n).repeat(40), name: ['Research', 'Genesis', 'Long term'][i],
    connection: 'WATCH_ONLY', checkedAt: at, balanceAt: at, otherBalanceAt: at, historyAt: at, historySource: 'public', nftAt: at, nftPartial: true, tokenSource: 'public', tokensPartial: true,
    balances: [{ address: '', symbol: 'BNB', balance: ['0.42', '0.18', '1.24'][i], price: 700, at, priceAt: at },
      { address: '0x55d398326f99059ff775485246999027b3197955', symbol: 'USDT', balance: ['128.50', '42.25', '260'][i], price: 1, at, priceAt: at },
      { address: '0x' + 'a'.repeat(40), symbol: 'CBOT DEMO', balance: '1024', price: 0.04, at, priceAt: at },
      { address: '0x' + 'b'.repeat(40), symbol: 'DUST', balance: '1', price: 0.002, at, priceAt: at },
      { address: '0x' + 'c'.repeat(40), symbol: 'UNPRICED', balance: '12', price: null, at }, { address: '0x' + 'd'.repeat(40), symbol: 'ZERO', balance: '0', price: 1, at }],
    transactions: [{ hash: '0x' + String(n).repeat(64), time: at, kind: 'swap', status: 'confirmed', verified: true, fee: '0.0000042', details: [{ direction: 'send', amount: '0.01', symbol: 'BNB', address: '' }, { direction: 'receive', amount: '6.99', symbol: 'USDT', address: '0x55d398326f99059ff775485246999027b3197955' }] }], nfts: [], errors: [] }));
  return { version: 2, demo: true, wallets, updatedAt: at, refreshing: false, bnbQuote: { at, source: 'Synthetic demo', price: '700' } };
}
