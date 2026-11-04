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

Public BNB/USDT RPC balances update around60s. Public NFT ownership checks rotate at most12 discovered ERC721 candidates per30-minute cycle rather than scanning every NFT every minute. Discovery is partial; a full first-party NFT index requires a configured provider.

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
