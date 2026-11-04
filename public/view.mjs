// Shared display rules. Missing data stays unknown; timestamps belong to each data source.
export function stale(at, now = Date.now(), maxAge = 180000) {
  return !Number.isFinite(Date.parse(at)) || now - Date.parse(at) > maxAge;
}

export function historyStale(wallet, now = Date.now()) {
  return Boolean(wallet.historyError) || !wallet.historyAt || (wallet.historyNextAt ? now > Date.parse(wallet.historyNextAt) + 180000 : stale(wallet.historyAt, now, wallet.historySource === 'public' ? 33 * 60000 : 600000));
}

export function connectionState(wallet, now = Date.now()) {
  if (wallet.connection === 'WATCH_ONLY') return { label: '只读观察', tone: 'muted' };
  if (wallet.connection === 'UNCONNECTED' || (wallet.sessionExpires && Date.parse(wallet.sessionExpires) <= now)) return { label: '登录已失效', tone: 'warn' };
  if (stale(wallet.connectionAt || wallet.checkedAt, now)) return { label: '连接待检查', tone: 'muted' };
  if (wallet.connection === 'CONNECTED') return { label: '已连接', tone: 'good' };
  return { label: '状态暂不可用', tone: 'warn' };
}

export function totalBalance(wallets, symbol) {
  if (!wallets.length) return null;
  const values = wallets.map(w => w.balances?.find(b => symbol === 'BNB' ? b.address === '' && b.symbol === 'BNB' : b.address?.toLowerCase() === '0x55d398326f99059ff775485246999027b3197955')?.balance);
  if (values.some(v => typeof v !== 'string' || !/^\d+(\.\d{1,18})?$/.test(v))) return null;
  const total = values.reduce((sum, v) => { const [whole, fraction = ''] = v.split('.'); return sum + BigInt(whole + fraction.padEnd(18, '0')); }, 0n).toString().padStart(19, '0');
  return `${total.slice(0, -18)}.${total.slice(-18)}`.replace(/\.?0+$/, '');
}

export function matches(query, ...values) {
  return !query || values.filter(v => v != null).join(' ').toLowerCase().includes(query.trim().toLowerCase());
}

export function matchesKind(tx, kind) {
  return kind === 'all' || tx.kind === kind || (kind === 'transfer' && ['send', 'receive'].includes(tx.kind));
}

export function bnbEquivalent(balance, quote) {
  if (typeof balance !== 'string' || !/^\d+(\.\d+)?$/.test(balance) || typeof quote?.price !== 'string' || !/^\d+(\.\d+)?$/.test(quote.price)) return null;
  const amount = Number(balance), price = Number(quote.price), value = amount * price;
  return Number.isFinite(amount) && Number.isFinite(price) && Number.isFinite(value) && price > 0 ? value : null;
}

export function tokenVisible(token, hideSmall = true) {
  if (typeof token.balance !== 'string' || !/^\d+(\.\d+)?$/.test(token.balance)) return true;
  if (!/[1-9]/.test(token.balance)) return false;
  const value = token.price == null || token.price <= 0 ? null : Number(token.balance) * Number(token.price);
  return !hideSmall || value == null || !Number.isFinite(value) || value >= 0.1;
}

// Unknown values always sort last; never treat an unavailable quote as zero.
export function assetValue(asset, nft = false) {
  const raw = nft ? asset.referenceValueUsd : asset.price != null && asset.price > 0 && typeof asset.balance === 'string' && /^\d+(\.\d+)?$/.test(asset.balance) ? Number(asset.balance) * Number(asset.price) : null;
  return raw != null && Number.isFinite(Number(raw)) && Number(raw) >= 0 ? Number(raw) : null;
}
export function acquisitionTime(asset) {
  const acquired = Date.parse(asset.acquiredAt), discovered = Date.parse(asset.firstSeenAt);
  return Number.isFinite(acquired) ? acquired : Number.isFinite(discovered) ? discovered : null;
}
export function sortAssets(rows, order, nft = false) {
  if (order === 'default') return rows;
  const value = a => order.startsWith('value') ? assetValue(a.asset, nft) : acquisitionTime(a.asset);
  const ascending = order.endsWith('asc');
  return [...rows].sort((a,b) => { const av=value(a),bv=value(b); if (av==null || bv==null) return av==null ? bv==null ? 0 : 1 : -1; return ascending ? av-bv : bv-av; });
}
