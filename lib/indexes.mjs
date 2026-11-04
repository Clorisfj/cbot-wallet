import { units, nftCandidates } from './data.mjs';
import { publicQuery } from './network.mjs';
import { publicHistoryRows } from './history.mjs';
const ADDRESS = /^0x[0-9a-f]{40}$/i;
const text = v => typeof v === 'string' ? v.slice(0, 160) : '';
const safeNumber = v => v != null && v !== '' && Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : null;

export function normalizedAsset(row, source) {
  const info = source === 'ankr' ? row : row.tokenInfo;
  const address = source === 'ankr' ? row.contractAddress : info?.address;
  const decimals = Number(source === 'ankr' ? row.tokenDecimals : info?.decimals);
  if (!ADDRESS.test(address) || !Number.isInteger(decimals) || decimals < 0 || decimals > 36) return null;
  const raw = source === 'ankr' ? row.balanceRawInteger : row.rawBalance;
  let balance = null;
  if (typeof raw === 'string' && /^\d+$/.test(raw) || typeof raw === 'number' && Number.isSafeInteger(raw) && raw >= 0) balance = units(raw, decimals);
  else if (source === 'ankr' && /^\d+(\.\d+)?$/.test(row.balance)) balance = row.balance;
  return { address: address.toLowerCase(), symbol: text(source === 'ankr' ? row.tokenSymbol : info?.symbol) || address.slice(0, 8), decimals, balance,
    price: safeNumber(source === 'ankr' ? row.tokenPrice : info?.price?.rate) };
}

async function pages(network, method, params, field, max = 5) {
  const rows = []; let pageToken = '', partial = false;
  for (let page = 0; page < max; page++) {
    const data = await network.advanced(method, { ...params, ...(pageToken ? { pageToken } : {}) });
    if (!Array.isArray(data[field])) throw Error('ANKR 索引格式无效');
    rows.push(...data[field]);
    if (!data.nextPageToken) return { rows, partial: false };
    if (data.nextPageToken === pageToken) throw Error('ANKR 返回重复分页游标');
    pageToken = data.nextPageToken; partial = true;
  }
  return { rows, partial };
}
export async function loadAssets(address, network, walletCount) {
  if (network.hasAnkr) {
    const result = await pages(network, 'ankr_getAccountBalance', { walletAddress: address, blockchain: ['bsc'], onlyWhitelisted: false, pageSize: 100 }, 'assets');
    return { tokens: result.rows.filter(r => r.blockchain === 'bsc' && r.tokenType !== 'NATIVE').map(r => normalizedAsset(r, 'ankr')).filter(Boolean), partial: result.partial, source: 'ankr' };
  }
  const data = await publicQuery('getAddressInfo', address, walletCount);
  if (data.address?.toLowerCase() !== address || !Array.isArray(data.tokens || [])) throw Error('公开代币索引地址或格式不匹配');
  return { tokens: (data.tokens || []).map(r => normalizedAsset(r, 'public')).filter(Boolean), partial: true, source: 'public' };
}

export async function loadIndexedHistory(address, network, walletCount) {
  if (!network.hasAnkr) {
    const native = await publicQuery('getAddressTransactions', address, walletCount);
    const tokens = await publicQuery('getAddressHistory', address, walletCount);
    return publicHistoryRows(native, tokens, address);
  }
  const txs = await network.advanced('ankr_getTransactionsByAddress', { address, blockchain: ['bsc'], descOrder: true, pageSize: 100, includeLogs: false });
  const transfers = await network.advanced('ankr_getTokenTransfers', { address: [address], blockchain: ['bsc'], descOrder: true, pageSize: 100 });
  if (!Array.isArray(txs.transactions) || !Array.isArray(transfers.transfers)) throw Error('ANKR 交易格式无效');
  const timestamp = r => Number(r.timestamp ?? r.blockTimestamp);
  return publicHistoryRows(txs.transactions.filter(r => r.blockchain === 'bsc').map(r => ({ ...r, timestamp: timestamp(r) })), {
    operations: transfers.transfers.filter(r => r.blockchain === 'bsc').map(r => ({ ...r, from: r.fromAddress || r.from, to: r.toAddress || r.to, timestamp: timestamp(r), transactionHash: r.transactionHash || r.hash,
      tokenInfo: { address: r.contractAddress, symbol: r.tokenSymbol } })),
  }, address).map(tx => ({ ...tx, source: 'ankr' }));
}

export async function loadNfts(address, previous, transactions, network) {
  const at = new Date().toISOString();
  if (network.hasAnkr) {
    const indexed = await pages(network, 'ankr_getNFTsByOwner', { walletAddress: address, blockchain: ['bsc'], pageSize: 50 }, 'assets');
    return { nfts: indexed.rows.filter(n => n.blockchain === 'bsc' && ADDRESS.test(n.contractAddress) && /^\d+$/.test(n.tokenId)).map(n => ({ address: n.contractAddress.toLowerCase(), tokenId: n.tokenId,
      symbol: text(n.symbol) || 'NFT', name: text(n.name) || `NFT #${n.tokenId}`, image: /^https:\/\//.test(n.imageUrl || '') ? n.imageUrl : '', metadataUrl: /^https:\/\//.test(n.tokenUrl || '') ? n.tokenUrl : '',
      traits: (n.traits || []).slice(0, 20).map(t => ({ type: text(t.trait_type), value: text(String(t.value ?? '')) })), indexedAt: at, verificationFailed: false, source: 'ankr' })), nftAt: at, nftPartial: indexed.partial, nftSource: 'ankr' };
  }
  // Rotate a small slice; avoid rechecking hundreds of spam NFTs every minute.
  const candidates = [...nftCandidates(previous.nfts, transactions).values()];
  const merged = new Map((previous.nfts || []).map(n => [`${n.address}:${n.tokenId}`, n]));
  const offset = previous.nftCursor || 0, batch = candidates.slice(offset, offset + 12);
  let failures = 0;
  for (const n of batch) {
    const key = `${n.address}:${n.tokenId}`;
    try {
      const owner = '0x' + (await network.call(n.address, '0x6352211e' + BigInt(n.tokenId).toString(16).padStart(64, '0'))).slice(-40);
      if (owner !== address) { merged.delete(key); continue; }
      const old = merged.get(key) || {};
      merged.set(key, { ...old, ...n, name: old.name || `${n.symbol || 'NFT'} #${n.tokenId}`, verifiedAt: at, verificationFailed: false });
    } catch { failures++; if (merged.has(key)) merged.set(key, { ...merged.get(key), verificationFailed: true }); }
  }
  return { nfts: [...merged.values()], nftCursor: offset + 12 >= candidates.length ? 0 : offset + 12, nftAt: at, nftPartial: true, nftSource: 'public-rpc', nftFailures: failures };
}
