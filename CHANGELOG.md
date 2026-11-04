## v1.1.1 — 2026-11-04 — Original CBOT branding and clearer actions

- Reused the original CBOT orange/white logo for header and favicon.
- Added accent-tinted fills and stronger outlines to actionable controls across skins; primary text adapts to accent contrast.
- Updated the GitHub synthetic dashboard screenshot. Validation: 14 tests passed; default and light skins visually checked using synthetic data; logo matches the original source file.

# v1.1.0 — 2026-11-04

- Added agent bootstrap instructions and checksum-verified portable Node setup; no npm/Git prerequisites.
- Split wallet management from settings, persisted exclusions for removed auto-detected wallets.
- Unified ANKR key URL input, selectable refresh schedule and provider-aware consumption estimates.
- Added three skins and custom accent, compact cards with collapsed data status.
- Updated tutorials, source limitations and README benefits.
- Validation: 14 tests passed; JS syntax and shell syntax checked; Windows portable Node download/checksum/install/health passed in isolated directories; synthetic UI checked for wallet manager, settings and light skin; existing two-wallet deployment reports v1.1.0. macOS/Linux execution and user ANKR credentials not live-tested.

# Changelog

## 1.0.0 — 2026-11-04

- Extract a clean local-first BSC dashboard with configurable0–100 wallets and optional existing Binance session detection.
- Discover tokens without wallet login. Hide zero balances and add a persistent0.1 USDT reference-value filter, retaining unpriced assets.
- Add local settings for public/custom RPC and optional ANKR Advanced API, pagination, quota estimates and rate-aware refresh.
- Rotate public NFT ownership reads in small batches; retain explicit partial-coverage labels.
- Add adaptive cbot interface, synthetic demo, cross-platform Node installer, Windows user-login autostart, concise tutorials and agent skill.
- Keep all participant data, provider tokens and credential profiles outside the public repository. MIT license.
