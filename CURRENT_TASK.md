# cbot Wallet Desk 1.0.0

BSC-only read-only dashboard: configurable wallets, login-independent token discovery/filtering, optional ANKR/custom RPC, adaptive cbot UI, install/agent entrypoints, tutorials and synthetic sharing assets.

Verified locally: 12 unit/integration tests; 3-wallet demo small-token switch (12 to15 visible), exact-zero exclusion and unpriced-token retention; real public-address token discovery; packed npm installer start/status/stop; privacy scan excluding participant addresses, local paths, credentials and runtime files. The existing local launcher remains usable with private configuration outside the repository.

The CI template is supplied in docs/CI.example.yml and is not automatically enabled. Windows deployment has direct local evidence; macOS/Linux need target-host smoke tests. ANKR methods are checked against official schemas and fixture-tested; no provider key was supplied for live acceptance. Public indexing is best effort and rate-limited, not a full ledger. Sharing artwork uses synthetic data and makes no profit claims.
