// Public index candidates are verified independently through BSC RPC.
const ADDRESS = /^0x[0-9a-f]{40}$/i, HASH = /^0x[0-9a-f]{64}$/i;
export function publicHistoryRows(native, tokenHistory, wallet) {
  if (!Array.isArray(native) || !Array.isArray(tokenHistory?.operations)) throw Error('公共索引格式不符');
  const rows = new Map();
  const add = (row, hash) => {
    const timestamp = Number(row.timestamp), time = timestamp * 1000;
    if (!HASH.test(hash) || !Number.isFinite(time) || time <= 0 || time > Date.now() + 300000) return null;
    if (![row.from?.toLowerCase(), row.to?.toLowerCase()].includes(wallet)) return null;
    hash = hash.toLowerCase();
    if (!rows.has(hash)) rows.set(hash, { hash, time: new Date(time).toISOString(), kind: 'contract_call', status: 'unknown', details: [], fee: null, tokenSymbols: {}, source: 'public' });
    return rows.get(hash);
  };
  for (const row of native) {
    const tx = add(row, row.hash);
    if (tx && row.input === '0x') tx.kind = 'transfer';
  }
  for (const row of tokenHistory.operations) {
    const tx = add(row, row.transactionHash), token = row.tokenInfo;
    if (tx && ADDRESS.test(token?.address) && typeof token.symbol === 'string') tx.tokenSymbols[token.address.toLowerCase()] = token.symbol.slice(0, 160);
  }
  if ((native.length || tokenHistory.operations.length) && !rows.size) throw Error('公共索引未返回有效地址记录');
  return [...rows.values()].sort((a, b) => Date.parse(b.time) - Date.parse(a.time)).slice(0, 20);
}

