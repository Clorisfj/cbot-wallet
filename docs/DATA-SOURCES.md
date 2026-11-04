# Sources and cost budget

Checked 2026-11-04. Providers can change plans, indexing coverage and limits. Confirm against your account dashboard.

| Mode | Token discovery | Transaction discovery | Verification |
|---|---|---|---|
| Public default | Binplorer `getAddressInfo` | Binplorer native/zero-value calls + token operations | BSC public RPC |
| Optional ANKR | `ankr_getAccountBalance`, with `onlyWhitelisted:false` | `ankr_getTransactionsByAddress` + `ankr_getTokenTransfers` | Public or explicitly configured BSC RPC |
| Existing Binance session | Public/ANKR assets | Official read-only CLI history, when connected | BSC RPC |

Indexing and direct RPC solve different problems. RPC reads a known token balance; an index discovers which contracts to ask. This app combines them. No provider guarantees every token, NFT standard or internal transfer. Recent history stores the latest20 discovered hashes per wallet. Failed sources preserve old data and show timestamps.

## Public sources

[Binplorer/Ethplorer official documentation](https://github.com/EverexIO/Ethplorer/wiki/Ethplorer-API) allows its public development `freekey`: 2 requests/sec, 20/min, 100/hour, 1000/day, 3000/week. It is not recommended by the provider for production. The app spaces requests by at least650ms, schedules at most roughly2400/week for its three per-wallet calls, and honors429 Retry-After. Two wallets use30-minute indexing; more wallets automatically reduce frequency. This budget cannot account for other applications on the same IP/key.

BNB/USDT RPC balances follow the selected5/10/15/30/60-minute interval (default30). Public NFT ownership checks rotate at most12 discovered ERC721 candidates per effective index cycle rather than scanning every NFT every minute. Discovery is partial; a full first-party NFT index requires a configured provider.

## ANKR Freemium

[Official service plans](https://www.ankr.com/docs/rpc-service/service-plans/) list **200M Credits/month**, Advanced API **50 requests/minute**, ordinary EVM RPC **200 Credits/request**, Advanced API **700 Credits/request**. The app spaces Advanced requests by at least1.3s. It estimates its own credits and stops starting Advanced calls at its200M estimate; it cannot see other clients' usage or enforce an account-wide spending limit. API tokens never authorize an on-chain spend, but a funded provider account can still have API charges. No top-up is performed by this app.

Base assumption: each wallet makes four Advanced calls per index cycle — assets, normal transactions, token transfers and first NFT page.

`monthly credits ≈ wallet count × 4 × (43,200 / interval_minutes) × 700`

| Two wallets, continuous30 days | Requests | Credits | Share of200M |
|---|---:|---:|---:|
| 5-minute cycle | 69,120 | 48,384,000 | 24.2% |
| 10-minute cycle | 34,560 | 24,192,000 | 12.1% |
| 15-minute cycle | 23,040 | 16,128,000 | 8.1% |

Pagination, additional retries and configured ANKR RPC calls add to these figures. Asset and NFT queries follow up to five pages and mark incomplete pages; NFTs with many pages can substantially raise usage. Ten wallets at5minutes already estimate121% of the free quota **before** extras. Increase the interval. Closing browser tabs does not stop the background schedule.

The dashboard shows a locally counted estimate, retained in its cache, not the official provider invoice. Rates above are estimates from published docs; they are not a guarantee that a particular user's key has all methods enabled. ANKR integration is fixture-tested; live acceptance requires that user's private key configuration and provider response.

Reference prices are USD-based and displayed as approximately USDT. Unpriced tokens remain visible and are excluded from reference valuations. Cached prices are marked. The UI does not imply that an asset is safe, liquid or sellable.

## v1.1 settings estimates

The settings table is provider-aware: per30 days, core RPC calls ≈ wallets ×2 ×43200/selected minutes; token verification and public NFT calls ≈ (2 × known ERC20 records +12 × wallets) ×43200/effective index minutes. Index calls ≈ wallets ×(4 with ANKR,3 public) ×43200/effective index minutes. Public index interval is max(selected, wallet-count quota floor). ANKR RPC requests use200 credits and Advanced700; other providers display request counts without inventing a credit allowance. ERC20 decimals caching can reduce actual calls; pagination, receipt reads, chain checks, first scans and retries can increase them. This is a planning estimate, not a hard upper bound. The old Advanced-only examples above exclude RPC verification and must not be treated as total use when ANKR also supplies RPC.

A single authenticated `https://rpc.ankr.com/bsc/YOUR_KEY` URL configures BSC RPC and derives the same key for Advanced indexing. Arbitrary RPC URLs cannot supply indexing. Old private `ankrKey` / ANKR_API_KEY configurations remain compatible; replacing/clearing the saved source removes the legacy stored key, while an environment variable must be cleared in its launching environment.

## v1.1.2 balance freshness

Token discovery and known-token balance reads are independent. BNB/USDT and already discovered ERC20 balances follow the selected refresh interval (plus up to one minute of scheduler granularity); public discovery still respects the wallet-count quota floor and Retry-After. Newly issued tokens may still wait for index discovery. Successful zero balances are hidden; failed reads retain cached values and timestamps. Missing reference prices do not hide nonzero holdings.

Updated estimate: core RPC + known-token verification ≈ (2 × wallets +2 × known ERC20 records) ×43200/selected minutes; public NFT rotation ≈12 ×wallets ×43200/effective index minutes. Cached decimals often reduce actual calls. The settings table uses this updated schedule.

## v1.2 public market prices and acquisition order

[DexScreener API](https://docs.dexscreener.com/api/reference) supplements missing ERC20 USD prices via `/tokens/v1/bsc/{addresses}`, up to30 unique contracts per request. Only exact base-token matches on BSC, WBNB/USDT/USDC/BUSD quote contracts, finite positive prices and >=$1000 reported liquidity qualify; deepest qualifying pool wins. This is a screening rule, not a security audit or executable quote. Reported liquidity/prices can still be manipulated. No arbitrary chain/token URL from API data is executed.

Quotes are cached across wallets; refresh uses the selected interval, roughly ceil(unique nonzero ERC20s/30) requests per cycle, minimum250ms between batches. At100 unique contracts and5minutes: about34,560 requests/30days, no ANKR Credits. Failures retain quote timestamps; HTTP429 Retry-After survives server restart via cached nextAt. If a successful scan no longer has a qualifying pool, a prior DexScreener quote is withdrawn. Native BNB keeps its Binance reference quote. Providers receive public contract addresses and the server IP. No new API key required.

The app does not discover token prices through generic balance RPC. A pool-aware adapter could read reserve ratios from RPC, but it first needs pool routing, decimals and a USD anchor. A price feed solves that gap. Current NFT sources do not provide reliable USD appraisals; the UI leaves those unknown, including when sorting by value. No purchase-price or mint-cost substitution.

Acquisition metadata records the latest verified incoming transfer in the already discovered confirmed history; otherwise immutable firstSeenAt is used and labelled as discovery. It is not a full-chain first-purchase reconstruction. Sorting never uses balance refresh time. Previously owned assets may have no historical acquisition record; dates become available only from observed history. History remains limited as documented.
