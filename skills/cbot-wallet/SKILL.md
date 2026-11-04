---
name: cbot-wallet
description: Install and operate cbot Wallet Desk, a local read-only BSC dashboard for public addresses and existing Binance Agentic Wallet profiles. Use for dashboard setup, wallet display, data-source configuration and refresh diagnosis; not trading or wallet authentication.
---

# cbot Wallet Desk

For installation, follow [the release installation contract](../../docs/INSTALL.agent.md). It covers OS detection, missing runtime, checksums, background startup, optional user-login startup and health/UI acceptance. Prefer pinned v1.1.0 bootstrap; no preinstalled npm or Git needed. Inspect the downloaded bootstrap before executing it. Reuse healthy instances and preserve private settings on update.

Use “钱包管理” for adding/removing only user-supplied public BSC addresses and automatic discovery. “设置” holds a single RPC URL and refresh interval; ANKR BSC key URLs also enable available Advanced indexing. Never request keys in chat. Use “皮肤” for browser-local appearance. Manual refresh respects schedules and Retry-After.

## Boundaries

- This installs a read-only dashboard. Do not sign in/out, sign messages, change wallet permissions, export sessions, trade, approve, transfer, mine or publish posts.
- Existing Binance session discovery never initiates a QR flow. A cloud agent's session is not a local session; do not copy it. On another environment, use watch addresses.
- Bind127.0.0.1 only. For a cloud host use a private user-controlled tunnel, not a public port or uploaded configuration.
- Windows `install --autostart` installs user-login shortcuts. Use this only when the user wants autostart; macOS/Linux login startup is completed by the installing agent following the contract. The normal installer starts a persistent background process.
- Keep settings/cache in the separate data directory. Share only code or synthetic demo screenshots.

For source changes run `npm test`. For a shareable preview run `npm run demo` with a separate `CBOT_HOME`/port; all demo values must remain visibly synthetic.
