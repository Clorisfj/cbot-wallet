import { stale, historyStale, connectionState, totalBalance, matches, matchesKind, bnbEquivalent, tokenVisible } from './view.mjs';

const $ = id => document.getElementById(id);
let state = { wallets: [] }, tab = 'history', polling = false, page = 0, lastPayload = '', offline = false, requesting = false, toastTimer;
const pageSize = 10;
let hideSmall = localStorage.getItem('cbot.hideSmall') !== 'false';
const publicMinutes = () => state.publicRefreshMinutes || 30;
const short = value => value ? value.slice(0, 6) + '…' + value.slice(-4) : '—';
const number = (value, digits = 8) => {
  if (value == null || value === '' || !Number.isFinite(Number(value))) return '—';
  const n = Number(value);
  return n !== 0 && Math.abs(n) < 10 ** -digits ? n.toPrecision(3) : n.toLocaleString('en-US', { maximumFractionDigits: digits });
};
const time = value => Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }) : '尚未获取';
const relative = value => {
  if (!Number.isFinite(Date.parse(value))) return '待获取';
  const seconds = Math.max(0, Math.floor((Date.now() - Date.parse(value)) / 1000));
  if (seconds < 60) return '刚刚';
  if (seconds < 3600) return Math.floor(seconds / 60) + ' 分钟前';
  if (seconds < 86400) return Math.floor(seconds / 3600) + ' 小时前';
  return Math.floor(seconds / 86400) + ' 天前';
};
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
function link(label, href, title = '') { const a = el('a', '', label); a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.title = title; return a; }
const badge = (label, tone) => el('span', 'badge ' + tone, label);
const handle = w => w.handle ? w.handle.replace(/\.ai$/, '') + '.ai' : w.name;
const balance = (w, symbol) => w.balances?.find(b => symbol === 'BNB' ? b.address === '' && b.symbol === symbol : b.address?.toLowerCase() === '0x55d398326f99059ff775485246999027b3197955')?.balance;
const selected = () => state.wallets.filter(w => $('wallet-filter').value === 'all' || w.id === $('wallet-filter').value);
const kinds = { sale: '出售 NFT', mint: '铸造', approve: '授权', transfer: '收付款', send: '转出', receive: '转入', swap: '兑换', contract_call: '合约交互' };
const icons = { sale: '↗', mint: '+', approve: '✓', transfer: '⇄', send: '↗', receive: '↙', swap: '⇄' };

function toast(message) {
  clearTimeout(toastTimer); $('toast').textContent = message; $('toast').hidden = false;
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, 2400);
}
function equivalent(amount, balanceAt) {
  const value = bnbEquivalent(amount, state.bnbQuote), cached = stale(state.bnbQuote?.at) || stale(balanceAt);
  const node = el('span', 'bnb-equivalent' + (cached && value != null ? ' cached-value' : ''), value == null ? '暂无 USDT 报价' : '≈ ' + (value > 0 && value < .01 ? value.toPrecision(3) : value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })) + ' USDT' + (cached ? ' · 缓存' : ''));
  node.title = value == null ? 'BNB/USDT 报价暂不可用' : '1 BNB ≈ ' + number(state.bnbQuote.price, 4) + ' USDT\n' + state.bnbQuote.source + '\n报价更新：' + time(state.bnbQuote.at) + '（北京时间）\n余额更新：' + time(balanceAt);
  return node;
}
function clearFilters() {
  $('search').value = ''; $('wallet-filter').value = 'all'; $('type-filter').value = 'all'; page = 0; renderDetail();
}
function empty(message, filtered = false) {
  const box = el('div', 'empty'); box.append(el('strong', '', filtered ? '没有匹配的结果' : '暂无可显示的数据'), el('div', '', message));
  if (filtered) { const button = el('button', 'secondary', '清除筛选'); button.addEventListener('click', clearFilters); box.append(button); }
  return box;
}
function source(label, at, partial = false, maxAge = 180000) {
  const node = el('span', stale(at, Date.now(), maxAge) || partial ? 'old' : '', label + ' · ' + (partial ? '部分待核验' : relative(at)));
  node.title = label + '最后成功更新：' + time(at) + '（北京时间）'; return node;
}
function renderWallets() {
  const container = $('wallets'); container.replaceChildren();
  for (const [index, w] of state.wallets.entries()) {
    w.themeClass = 'wallet-' + (index % 4 + 1);
    const card = el('article', 'wallet-card ' + w.themeClass), top = el('div', 'wallet-top'), identity = el('div', 'wallet-identity'), title = el('div');
    const status = connectionState(w);
    title.append(el('div', 'wallet-name', handle(w)), el('small', '', w.name + ' / BSC'));
    identity.append(el('span', 'avatar', String(index + 1).padStart(2, '0')), title);
    top.append(identity, badge(status.label, status.tone));
    const address = el('div', 'address'), copy = el('button', 'copy', '复制');
    copy.setAttribute('aria-label', '复制' + w.name + '地址');
    copy.addEventListener('click', async () => { try { await navigator.clipboard.writeText(w.address); toast(w.name + '地址已复制'); } catch { toast('复制不可用，可选择完整地址手动复制'); } });
    address.append(link(w.address, 'https://bscscan.com/address/' + w.address), copy);
    const amounts = el('div', 'card-balances');
    for (const symbol of ['USDT', 'BNB']) {
      const value = balance(w, symbol), block = el('div'), amount = el('strong', stale(w.balanceAt) && value != null ? 'cached-value' : '', number(value, symbol === 'BNB' ? 8 : 6));
      amount.title = value == null ? '余额尚未获取' : value + ' ' + symbol;
      block.append(el('small', '', symbol));
      const row = el('div', 'amount-row'); row.append(amount); if (symbol === 'BNB') row.append(equivalent(value, w.balanceAt));
      block.append(row); amounts.append(block);
    }
    const bottom = el('div', 'wallet-bottom'), inspect = el('button', '', '查看明细 ↗');
    inspect.addEventListener('click', () => { $('wallet-filter').value = w.id; page = 0; renderDetail(); $('assets').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' }); });
    bottom.append(el('span', '', (w.nftAt ? (w.nfts?.length || 0) + ' 项 NFT' : 'NFT 待获取') + ' · ' + (w.transactions?.length || 0) + ' 笔近期交易'), inspect);
    const sources = el('div', 'source-status');
    sources.append(source('余额', w.balanceAt), source(w.historySource === 'public' ? '交易 · 公开索引' : '交易', w.historyAt, false, w.historySource === 'public' ? (publicMinutes() + 3) * 60000 : 10 * 60000), source('NFT', w.nftAt, w.nftPartial));
    card.append(top, address, amounts, bottom, sources);
    if (w.historySource === 'public') {
      const info = el('div', 'session-info');
      info.append(link('Binplorer 公开交易索引', 'https://binplorer.com/address/' + w.address), document.createTextNode(' · 约' + publicMinutes() + '分钟更新，无需钱包登录'));
      info.title = '最近20笔已发现交易，非完整账本；下次公开索引查询不早于 ' + time(w.historyNextAt);
      card.append(info);
    }
    if (w.historyNotice) card.append(el('div', 'session-info expiring', w.historyNotice));
    if (w.tokenSource) card.append(el('div', 'session-info', '代币发现 · ' + (w.tokenSource === 'ankr' ? 'ANKR' : 'Binplorer') + (w.tokensPartial ? ' · 范围有限，未报价资产保留' : ' · 索引持仓')));
    if (w.historySource === 'ankr') card.append(el('div', 'session-info', 'ANKR 交易索引 · 已按RPC回执核验 · 索引可能延迟'));
    if (w.sessionExpires && w.connection !== 'WATCH_ONLY') {
      const remaining = Date.parse(w.sessionExpires) - Date.now(), expired = remaining <= 0;
      card.append(el('div', 'session-info' + (remaining < 10800000 ? ' expiring' : ''), (expired ? '登录已于 ' : '登录到期 ') + time(w.sessionExpires) + (expired ? ' 失效' : '')));
    }
    const warnings = [...(w.errors || [])];
    if (balance(w, 'BNB') != null && Number(balance(w, 'BNB')) < .0001) warnings.push('BNB 较少，后续链上操作前请确认网络费余额。');
    if (warnings.length) {
      const errors = el('details', 'wallet-errors'); errors.dataset.key = w.id + '-errors';
      const list = el('ul'); warnings.forEach(warning => list.append(el('li', '', warning)));
      errors.append(el('summary', '', warnings.length + ' 项数据提示 · 展开查看'), list); card.append(errors);
    }
    container.append(card);
  }
  if (!state.wallets.length) container.append(el('div', 'loading', state.refreshing ? '首次查询中，保留页面即可自动更新…' : '点击右上角“钱包与数据源”添加地址；无需连接钱包或签名。'));
}
function assetLine(d) {
  const token = d.tokenId?.length > 14 ? d.tokenId.slice(0, 6) + '…' + d.tokenId.slice(-6) : d.tokenId;
  const line = el('div', 'asset-line ' + (d.direction === 'receive' ? 'in' : 'out'), (d.direction === 'receive' ? '+' : '−') + ' ' + (d.tokenId ? '1 ' + (d.symbol || 'NFT') + ' #' + token : number(d.amount) + ' ' + d.symbol));
  line.title = (d.address || '原生 BNB') + (d.tokenId ? '\nToken ID: ' + d.tokenId : '\n精确数量: ' + d.amount);
  return line;
}
function renderHistory(wallets, query) {
  const body = $('history-rows'); body.replaceChildren();
  const rows = wallets.flatMap(w => (w.transactions || []).map(tx => ({ ...tx, wallet: w })))
    .filter(tx => matchesKind(tx, $('type-filter').value) && matches(query, tx.hash, tx.wallet.name, handle(tx.wallet), kinds[tx.kind], ...(tx.details || []).flatMap(d => [d.symbol, d.address, d.tokenId])))
    .sort((a, b) => (Date.parse(b.time) || 0) - (Date.parse(a.time) || 0));
  page = Math.min(page, Math.max(0, Math.ceil(rows.length / pageSize) - 1));
  for (const tx of rows.slice(page * pageSize, (page + 1) * pageSize)) {
    const tr = el('tr'), when = el('td', '', time(tx.time)); when.append(el('small', 'wallet-tag ' + tx.wallet.themeClass, handle(tx.wallet)));
    const kind = el('td'), kindLine = el('div', 'kind-label');
    kindLine.append(el('span', 'tx-icon', icons[tx.kind] || '↗'), el('span', '', kinds[tx.kind] || '合约交互')); kind.append(kindLine);
    const changes = el('td'), details = tx.details || [];
    details.slice(0, 2).forEach(d => changes.append(assetLine(d)));
    if (details.length > 2) {
      const more = el('details', 'more-assets'); more.dataset.key = tx.wallet.id + tx.hash;
      more.append(el('summary', '', '另 ' + (details.length - 2) + ' 项变动')); details.slice(2).forEach(d => more.append(assetLine(d))); changes.append(more);
    }
    if (!details.length) changes.textContent = tx.kind === 'approve' ? '权限变更' : tx.status === 'failed' ? '交易未执行' : '—';
    const gas = el('td', 'gas', number(tx.fee, 12)); gas.title = tx.fee == null ? '尚无手续费数据' : tx.fee + ' BNB · 整笔交易网络费';
    const status = el('td');
    status.append(badge(tx.status === 'confirmed' ? '已确认' : tx.status === 'failed' ? '失败' : tx.status === 'pending' ? '处理中' : '待核验', tx.status === 'confirmed' ? 'good' : tx.status === 'failed' ? 'bad' : 'warn'));
    status.append(el('small', '', tx.verified ? '回执已核验' : (tx.source === 'public' ? '公开索引' : '钱包记录') + ' · 回执未核验'));
    const hash = el('td'), anchor = link(short(tx.hash) + ' ↗', 'https://bscscan.com/tx/' + tx.hash, tx.hash); anchor.className = 'hash-link'; hash.append(anchor);
    tr.append(when, kind, changes, gas, status, hash); body.append(tr);
  }
  if (!rows.length) { const tr = el('tr'), cell = el('td'); cell.colSpan = 6; cell.append(empty('可调整搜索条件；接口不可用时会保留上次交易记录。', hasFilters())); tr.append(cell); body.append(tr); }
  $('pagination').hidden = rows.length <= pageSize;
  $('page-info').textContent = (page * pageSize + 1) + '–' + Math.min((page + 1) * pageSize, rows.length) + ' / ' + rows.length + ' 笔';
  $('previous-page').disabled = page === 0; $('next-page').disabled = (page + 1) * pageSize >= rows.length;
  return rows.length;
}
function renderBalances(wallets, query) {
  const body = $('balance-rows'); body.replaceChildren(); let count = 0;
  for (const w of wallets) for (const b of w.balances || []) {
    if (!tokenVisible(b, hideSmall) || !matches(query, b.symbol, b.address, w.name, handle(w))) continue; count++;
    const tr = el('tr'), token = el('td'), label = el('div', 'token-label'), info = el('div');
    info.append(el('strong', '', b.symbol));
    if (b.address) {
      const details = el('details', 'contract-detail'); details.dataset.key = w.id + b.address;
      details.append(el('summary', '', short(b.address)), link(b.address + ' ↗', 'https://bscscan.com/token/' + b.address)); info.append(details);
    } else info.append(el('small', '', 'BNB Chain 原生币'));
    label.append(el('span', 'token-icon', b.symbol === 'BNB' ? '◇' : b.symbol === 'USDT' ? '₮' : (b.symbol || '?').slice(0, 1)), info); token.append(label);
    const wallet = el('td', 'wallet-tag ' + w.themeClass, handle(w));
    const at = b.at || (b.address === '' || b.address?.toLowerCase() === '0x55d398326f99059ff775485246999027b3197955' ? w.balanceAt : w.otherBalanceAt);
    wallet.append(el('small', '', '数量更新 · ' + relative(at)));
    const amount = el('td', 'exact-balance' + (stale(at) ? ' cached-value' : ''), b.balance);
    if (b.address === '' && b.symbol === 'BNB') amount.append(equivalent(b.balance, w.balanceAt));
    const value = b.price == null ? null : Number(b.balance) * b.price;
    const price = el('td', '', value == null || !Number.isFinite(value) ? '未报价 · 不计入估值' : '$' + (value > 0 && value < .01 ? value.toPrecision(3) : value.toFixed(2)));
    if (value != null) price.append(el('small', '', (stale(b.priceAt || w.otherBalanceAt) ? '缓存报价 · ' : '报价更新 · ') + relative(b.priceAt || w.otherBalanceAt)));
    tr.append(token, wallet, amount, price); body.append(tr);
  }
  if (!count) { const tr = el('tr'), cell = el('td'); cell.colSpan = 4; cell.append(empty('尚未取得代币数据，或当前筛选没有结果。', hasFilters())); tr.append(cell); body.append(tr); }
  return count;
}
function renderNfts(wallets, query) {
  const grid = $('nft-grid'); grid.replaceChildren(); let count = 0;
  for (const w of wallets) for (const n of w.nfts || []) {
    if (!matches(query, n.name, n.symbol, n.tokenId, n.address, w.name, handle(w))) continue; count++;
    const card = el('article', 'nft-card'), image = el('div', 'nft-image');
    const placeholder = () => { const p = el('div', 'nft-placeholder', n.symbol || 'NFT'); p.append(el('small', '', '#' + n.tokenId)); return p; };
    if (n.image) { const img = el('img'); img.src = n.image; img.alt = n.name; img.loading = 'lazy'; img.referrerPolicy = 'no-referrer'; img.addEventListener('error', () => img.replaceWith(placeholder())); image.append(img); }
    else image.append(placeholder());
    image.append(el('span', 'nft-owner ' + w.themeClass, handle(w)));
    const info = el('div', 'nft-info'), verifiedAt = n.verifiedAt || n.indexedAt || w.nftAt, old = stale(verifiedAt) || n.verificationFailed;
    info.append(el('strong', '', n.name), el('small', old ? 'old' : '', (old ? '缓存持仓 · ' : n.source === 'ankr' ? '索引持仓 · ' : '归属核验 · ') + relative(verifiedAt)));
    info.append(link('链上详情 ↗', 'https://bscscan.com/token/' + n.address + '?a=' + n.tokenId));
    const details = el('details'); details.dataset.key = w.id + n.address + n.tokenId;
    details.append(el('summary', '', '合约与属性'), link(n.address, 'https://bscscan.com/token/' + n.address), el('p', '', 'Token ID · ' + n.tokenId));
    for (const trait of n.traits || []) details.append(el('p', '', trait.type + ' · ' + trait.value));
    if (n.metadataUrl) details.append(link('查看元数据 ↗', n.metadataUrl));
    info.append(details); card.append(image, info); grid.append(card);
  }
  if (!count) grid.append(empty(wallets.some(w => !w.nftAt) ? '持仓尚未核验，查询失败不会显示为零持仓。' : '未发现匹配的 NFT；当前视图不覆盖全部链上藏品。', hasFilters()));
  return count;
}
function hasFilters() { return !!$('search').value.trim() || $('wallet-filter').value !== 'all' || (tab === 'history' && $('type-filter').value !== 'all'); }
function renderDetail() {
  const opened = new Set([...document.querySelectorAll('#assets details[open]')].map(d => d.dataset.key));
  const wallets = selected(), query = $('search').value.trim(), counts = {};
  for (const id of ['history', 'balances', 'nfts']) {
    const visible = id === tab; $(id).hidden = !visible;
    const button = $('tab-' + id); button.classList.toggle('active', visible); button.setAttribute('aria-selected', String(visible)); button.tabIndex = visible ? 0 : -1;
  }
  $('small-toggle').hidden = tab !== 'balances';
  $('type-filter').hidden = tab !== 'history'; $('clear-filters').hidden = !hasFilters();
  $('history-count').textContent = wallets.reduce((sum, w) => sum + (w.transactions?.length || 0), 0);
  $('balance-count').textContent = wallets.reduce((sum, w) => sum + (w.balances || []).filter(b => tokenVisible(b, hideSmall)).length, 0);
  $('nft-count').textContent = wallets.reduce((sum, w) => sum + (w.nfts?.length || 0), 0);
  if (tab === 'history') counts.history = renderHistory(wallets, query);
  if (tab === 'balances') counts.balances = renderBalances(wallets, query);
  if (tab === 'nfts') counts.nfts = renderNfts(wallets, query);
  $('result-count').textContent = (hasFilters() ? '筛选结果 · ' : '全部记录 · ') + counts[tab] + (tab === 'history' ? ' 笔交易' : tab === 'balances' ? ' 项代币' : ' 项 NFT');
  const key = tab === 'history' ? 'historyAt' : tab === 'balances' ? 'balanceAt' : 'nftAt';
  $('data-age').textContent = wallets.some(w => (tab === 'history' ? historyStale(w) : stale(w[key])) || (tab === 'nfts' && w.nftPartial)) ? '含缓存或待核验数据 · 以各项时间为准' : tab === 'history' && wallets.some(w => w.historySource === 'public') ? '公开索引约' + publicMinutes() + '分钟更新 · 非完整历史账本' : '北京时间 · 链上数据可能存在延迟';
  for (const details of document.querySelectorAll('#assets details')) if (opened.has(details.dataset.key)) details.open = true;
}
function render() {
  const select = $('wallet-filter'), selectedWallet = select.value;
  const optionsKey = state.wallets.map(w => w.id + w.name).join('|');
  if (select.dataset.optionsKey !== optionsKey) {
    select.replaceChildren(new Option('全部钱包', 'all'), ...state.wallets.map(w => new Option(handle(w), w.id)));
    select.value = state.wallets.some(w => w.id === selectedWallet) ? selectedWallet : 'all'; select.dataset.optionsKey = optionsKey;
  }
  $('wallet-count').textContent = state.wallets.length + ' 个钱包 · 本机只读';
  $('demo-banner').hidden = !state.demo;
  $('small-balances').checked = hideSmall;
  for (const symbol of ['USDT', 'BNB']) {
    const total = totalBalance(state.wallets, symbol), node = $('total-' + symbol.toLowerCase());
    node.textContent = number(total, symbol === 'BNB' ? 8 : 6); node.title = total ?? '等待所选钱包余额';
    const cached = state.wallets.some(w => stale(w.balanceAt));
    node.classList.toggle('cached-value', cached && total != null);
    $(symbol.toLowerCase() === 'usdt' ? 'usdt-note' : 'bnb-note').textContent = total == null ? '等待钱包余额' : cached ? '含缓存数据 · 查看分项更新时间' : symbol === 'BNB' ? state.wallets.length + ' 个钱包 · 网络费储备' : state.wallets.length + ' 个钱包 · 代币数量';
  }
  const oldestBalanceAt = state.wallets.map(w => w.balanceAt).sort((a, b) => (Date.parse(a) || 0) - (Date.parse(b) || 0))[0];
  $('total-bnb-equivalent').replaceChildren(equivalent(totalBalance(state.wallets, 'BNB'), oldestBalanceAt));
  const nftReady = state.wallets.length > 0 && state.wallets.every(w => w.nftAt);
  $('total-nfts').textContent = nftReady ? state.wallets.reduce((sum, w) => sum + (w.nfts?.length || 0), 0) : '—';
  const oldNft = state.wallets.some(w => stale(w.nftAt) || w.nftPartial);
  $('total-nfts').classList.toggle('cached-value', oldNft && nftReady);
  $('nft-note').textContent = oldNft ? '含缓存或待核验持仓 · 非全链枚举' : '已发现并核验 · 非全链枚举';
  const connected = state.wallets.filter(w => connectionState(w).tone === 'good').length;
  $('total-connected').replaceChildren(document.createTextNode(state.wallets.length ? String(connected) : '—'), el('em', '', ' / ' + state.wallets.filter(w => w.connection !== 'WATCH_ONLY').length));
  $('connected-note').textContent = !state.wallets.length ? '等待会话状态' : !state.wallets.some(w => w.connection !== 'WATCH_ONLY') ? '只读观察模式 · 无需登录' : '本机已连接 / 已配置登录钱包';
  const busy = state.refreshing || requesting;
  $('refresh').disabled = busy; $('refresh-icon').classList.toggle('spinning', busy);
  $('refresh-label').textContent = busy ? '正在刷新' : '刷新数据';
  $('updated').textContent = offline ? '本地服务未连接' : state.refreshing ? '刷新中 · 保留上次可用数据' : '最近检查 · ' + relative(state.updatedAt);
  $('updated').title = time(state.updatedAt) + '（北京时间）';
  const messages = [];
  if (offline) messages.push('本地服务未连接，已保留页面数据。请通过桌面看板快捷方式重新启动。');
  if (state.notice) messages.push(state.notice);
  if (state.quoteError) messages.push(state.bnbQuote ? 'BNB 换算报价未更新，保留缓存报价。' : 'BNB/USDT 报价暂不可用，链上 BNB 数量正常显示。');
  if (state.wallets.some(w => stale(w.balanceAt) || historyStale(w) || stale(w.nftAt))) messages.push('部分数据较旧，黄色数值及分项时间可供核对；刷新成功后会自动更新。');
  $('notice').hidden = !messages.length; $('notice').textContent = messages.join(' ');
  $('source-plan').textContent = state.settings?.ankrConfigured ? 'ANKR · ' + state.settings.refreshMinutes + '分钟索引 / RPC余额约60秒' : '公共索引约' + publicMinutes() + '分钟 / RPC余额约60秒';
  const opened = new Set([...document.querySelectorAll('#wallets details[open]')].map(d => d.dataset.key));
  renderWallets(); renderDetail();
  for (const details of document.querySelectorAll('#wallets details')) if (opened.has(details.dataset.key)) details.open = true;
}
async function poll() {
  if (polling) return; polling = true;
  try {
    const response = await fetch('/api/state', { signal: AbortSignal.timeout(8000) }); if (!response.ok) throw Error('State unavailable');
    const payload = await response.text(), next = JSON.parse(payload); if (!Array.isArray(next.wallets)) throw Error('Invalid state');
    const changed = payload !== lastPayload || offline; state = next; lastPayload = payload; offline = false; if (changed) render();
  } catch { offline = true; render(); }
  finally { polling = false; }
}
$('refresh').addEventListener('click', async () => {
  requesting = true; render();
  try {
    const response = await fetch('/api/refresh', { method: 'POST', signal: AbortSignal.timeout(8000) }); if (!response.ok) throw Error('Refresh failed');
    const result = await response.json(); toast(result.refreshing ? '已开始刷新，数据将自动更新' : '刚刚检查过，请稍后再刷新');
  } catch { offline = true; toast('刷新失败，请检查本地服务'); }
  finally { requesting = false; await poll(); render(); }
});
const tabs = [...document.querySelectorAll('.tab')];
for (const button of tabs) {
  button.addEventListener('click', () => { tab = button.dataset.tab; page = 0; renderDetail(); });
  button.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault(); const index = tabs.indexOf(button);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowLeft' ? -1 : 1) + tabs.length) % tabs.length;
    tabs[next].click(); tabs[next].focus();
  });
}
$('search').addEventListener('input', () => { page = 0; renderDetail(); });
for (const id of ['wallet-filter', 'type-filter']) $(id).addEventListener('change', () => { page = 0; renderDetail(); });
$('clear-filters').addEventListener('click', clearFilters);
$('previous-page').addEventListener('click', () => { page--; renderDetail(); });
$('next-page').addEventListener('click', () => { page++; renderDetail(); });
await poll();
setInterval(() => { if (!document.hidden) void poll(); }, 5000);
setInterval(() => { if (!document.hidden) render(); }, 30000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) void poll(); });

$('small-balances').addEventListener('change', () => { hideSmall = $('small-balances').checked; localStorage.setItem('cbot.hideSmall', String(hideSmall)); renderDetail(); });
$('settings-open').addEventListener('click', () => {
  const settings = state.settings || {};
  $('wallet-config').value = (settings.wallets || []).map(w => w.name + ' | ' + w.address).join('\n');
  $('auto-discover').checked = settings.autoDiscover !== false;
  $('refresh-minutes').value = String(settings.refreshMinutes || 5);
  $('ankr-token').value = ''; $('rpc-url').value = '';
  $('clear-ankr').checked = $('clear-rpc').checked = false;
  $('provider-status').textContent = (settings.ankrConfigured ? 'ANKR已配置（不回显Token）' : '当前未配置ANKR') + (settings.rpcConfigured ? ' · RPC: ' + settings.rpcHost : ' · 使用公共RPC');
  const u = state.usage || {};
  $('usage-summary').textContent = '本机本月估计消耗 ' + number(u.credits || 0, 0) + ' / 200,000,000 Credits；当前钱包数/间隔对应基础估算约 ' + number(u.estimatedPercent || 0, 1) + '%/月。分页、RPC和重试另计；不是账户账单。';
  $('settings-error').textContent = ''; $('settings-dialog').showModal();
});
$('settings-close').addEventListener('click', () => $('settings-dialog').close());
$('settings-form').addEventListener('submit', async event => {
  event.preventDefault(); $('settings-save').disabled = true; $('settings-error').textContent = '';
  try {
    const wallets = $('wallet-config').value.split('\n').map(s => s.trim()).filter(Boolean).map(line => {
      const parts = line.split('|').map(s => s.trim()); return { name: parts.length > 1 ? parts[0] : '', address: parts.at(-1) };
    });
    const response = await fetch('/api/settings', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ wallets,
      autoDiscover: $('auto-discover').checked, refreshMinutes: Number($('refresh-minutes').value), ankrKey: $('ankr-token').value.trim(), rpcUrl: $('rpc-url').value.trim(),
      clearAnkr: $('clear-ankr').checked, clearRpc: $('clear-rpc').checked }) });
    const result = await response.json(); if (!response.ok) throw Error(result.error || '保存失败');
    $('ankr-token').value = ''; $('rpc-url').value = ''; $('settings-dialog').close(); toast('已保存，数据将自动更新'); await poll();
  } catch (e) { $('settings-error').textContent = e.message; }
  finally { $('settings-save').disabled = false; }
});
