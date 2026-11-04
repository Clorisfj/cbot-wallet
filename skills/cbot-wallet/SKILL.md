---
name: cbot-wallet
description: Install and operate cbot Wallet Desk, a local read-only BSC dashboard for public addresses and existing Binance Agentic Wallet profiles. Use for dashboard setup, wallet display, data-source configuration and refresh diagnosis; not trading or wallet authentication.
---

# cbot Wallet Desk

Use Node24.5+ and the repository's own installer. No runtime npm dependencies.

1. Read the repository README and `docs/INSTALL.md`. Inspect the installer when installing a newly supplied version.
2. Prefer a released version: `npx --yes --package=https://github.com/Clorisfj/cbot-wallet/archive/refs/tags/v1.0.0.tar.gz cbot-wallet install`. From a clone: `node --use-env-proxy bin/cbot-wallet.mjs install`.
3. Check `http://127.0.0.1:48765/api/health` first. Reuse a healthy cbot instance; do not start a duplicate. Open the URL for the user and add only public addresses they provided in “钱包与数据源”. A no-wallet first launch should show onboarding, not invented balances.
4. Default to public sources. ANKR/custom RPC are optional: the user enters tokens locally or sets `ANKR_API_KEY`; never request a token in chat or print a URL containing one. See `docs/DATA-SOURCES.md` for quotas. Ordinary RPC cannot enumerate all assets.
5. Verify page, wallet count and source timestamps. Respect persisted provider schedules and Retry-After; manual refresh is not a quota bypass.

## Boundaries

- This installs a read-only dashboard. Do not sign in/out, sign messages, change wallet permissions, export sessions, trade, approve, transfer, mine or publish posts.
- Existing Binance session discovery never initiates a QR flow. A cloud agent's session is not a local session; do not copy it. On another environment, use watch addresses.
- Bind127.0.0.1 only. For a cloud host use a private user-controlled tunnel, not a public port or uploaded configuration.
- Windows `install --autostart` installs user-login shortcuts. Use this only when the user wants autostart; macOS/Linux login startup is manual. The normal installer starts a persistent background process.
- Keep settings/cache in the separate data directory. Share only code or synthetic demo screenshots.

For source changes run `npm test`. For a shareable preview run `npm run demo` with a separate `CBOT_HOME`/port; all demo values must remain visibly synthetic.
