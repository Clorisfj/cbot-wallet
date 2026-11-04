const key = a => a.address.toLowerCase() + (a.tokenId == null ? '' : ':' + a.tokenId);
export function stampAcquisition(wallet, previous = {}, now = new Date().toISOString()) {
  const old = new Map([...(previous.balances || []), ...(previous.nfts || [])].filter(a => a.address).map(a => [key(a), a]));
  const received = new Map();
  for (const tx of wallet.transactions || []) {
    if (!tx.verified || tx.status !== 'confirmed' || !Number.isFinite(Date.parse(tx.time))) continue;
    for (const d of tx.details || []) if (d.address && d.direction === 'receive') {
      const id = key(d); if (!received.has(id) || Date.parse(tx.time) > Date.parse(received.get(id))) received.set(id, tx.time);
    }
  }
  for (const a of [...(wallet.balances || []), ...(wallet.nfts || [])]) {
    if (!a.address) continue;
    const prior = old.get(key(a)), incoming = received.get(key(a));
    a.firstSeenAt ||= prior?.firstSeenAt || now;
    a.acquiredAt ||= prior?.acquiredAt || null;
    if (incoming && (!a.acquiredAt || Date.parse(incoming) > Date.parse(a.acquiredAt))) a.acquiredAt = incoming;
  }
}
