# Release preparation

Scope: BSC-only read-only open-source1.0.0; configurable wallets, token discovery/filtering, optional ANKR/custom RPC, responsive UI, install/agent entrypoints, docs and sharing assets.

Local unit/integration checks currently pass12 tests. Three-wallet synthetic browser preview confirms small holdings switch (12→15 visible), zero tokens always hidden, unpriced tokens retained and settings dialog available. A Windows/macOS/Linux CI template is supplied; it is not enabled remotely. ANKR paths have fixture coverage; no user's token has been supplied for live acceptance.

Completed locally: privacy scan (no participant addresses/paths/keys), two-wallet migration with independent public token discovery, packed npm installer start/status/stop smoke test, synthetic screenshot and sharing artwork. Remaining: GitHub authentication/publication and remote CI verification. Do not claim GitHub published until the actual remote URL and committed contents are verified.
