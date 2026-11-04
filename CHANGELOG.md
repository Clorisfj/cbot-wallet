## 2026-11-04 — v1.2.0 sharing materials

- Rewrote Chinese/English launch copy and installation/data-boundary reply for current features.
- Regenerated the landscape cover with the original CBOT logo and exact requested Chinese headline.
- Validated headline, logo, version, repository link and synthetic-demo/non-official labels visually. No application behavior changed.

## v1.2.0 — Public prices and asset sorting

- Added deduplicated, batched DexScreener pricing with exact chain/base contract matching, quote-asset and liquidity screening; timestamps, fallback cache and persistent429 deferral.
- Token and NFT views independently sort by reference holding value or acquisition/discovery time; unknown values always last, preferences persist.
- Acquisition uses verified confirmed incoming history, with an explicitly labelled immutable first-discovery fallback. NFT default appraisals remain unknown where no reliable data exists.
- Source prices keep provider timestamps. Updated docs, synthetic demo and README screenshot.
- Validation: 19 tests passed; live public price probe and two-wallet integration yielded24 supplementary contracts; synthetic UI verified token value ordering and NFT ascending value/earliest acquisition ordering. No GMGN key needed or collected.

## v1.1.2 — Known token balance freshness

- Decoupled direct RPC balance checks of known ERC20s from the slower token discovery/index schedule.
- Known holdings follow the selected refresh interval; sold-to-zero holdings disappear after successful verification. Failed reads retain prior values and Retry-After.
- Token freshness warnings now inspect actual per-token timestamps; adjusted provider cost estimates to reflect the independent RPC schedule.
- Regression verifies discovery-not-due, sold holdings, no duplicate reads, cached values on failure and 429 deferral. No personal addresses or project tokens hardcoded.

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
