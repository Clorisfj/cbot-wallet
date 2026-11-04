# cbot Wallet Desk

**Your local, read-only BSC wallet desk. One address or a whole portfolio.**

No wallet connection, signature or private key is needed for watch addresses. Default public data sources, optional ANKR Advanced API, exact token balances and transparent refresh timestamps. MIT licensed. Not affiliated with Binance or Ankr.

![Synthetic demo — not real balances](docs/media/dashboard-demo.png)

## Start in one command

Install **Node.js 24.5+**, then run:

```sh
npx --yes --package=https://github.com/Clorisfj/cbot-wallet/archive/refs/tags/v1.0.0.tar.gz cbot-wallet install
```

Open **http://127.0.0.1:48765/** → **钱包与数据源** → add a name and a public BSC address per line. Bookmark the URL. Closing the browser does not stop the background server.

Windows login autostart + desktop shortcut: append `--autostart` to the installation command. macOS/Linux use the same background installer; login autostart is a manual OS setup, not installed automatically. The computer must remain on. A cloud agent's localhost is on its cloud machine: open through a private SSH tunnel, never expose the service to the public internet.

Already cloned the repository? `npm start` runs in the foreground; `node bin/cbot-wallet.mjs install` installs a persistent local copy and starts it. No runtime npm dependencies or build step.

## Ask your AI agent

Send it this repository URL with:

> Install cbot Wallet Desk following `skills/cbot-wallet/SKILL.md`. Keep it local and read-only. Add the public BSC addresses I provide. Do not sign in, sign out, request keys, or expose a public port.

Agents supporting the Skills installer can also use:

```sh
npx skills add Clorisfj/cbot-wallet --skill cbot-wallet
```

The skill is plain Markdown and works as guidance for Codex, Claude Code, OpenClaw and other agents with terminal access; a tool-specific plugin is not required. The install command above is the direct application installer.

## What you get

- Any configured wallet count (up to 100), adaptive cards, filters, recent transactions and discovered NFTs.
- Zero token balances hidden. A persistent **hide holdings below 0.1 USDT reference value** switch. Unpriced assets stay visible.
- Token discovery independent of Binance login, with on-chain balance checks. No guarantee of every chain asset or spam token.
- Optional existing Binance Agentic Wallet detection. Sessions are never exported; the dashboard does not initiate login/signout or change trade permissions.
- Public BSC RPC and Binplorer by default; optional HTTPS BSC RPC and ANKR token configured locally.
- Per-source freshness, cached-data warnings, RPC-verified transaction receipts and estimated ANKR credit usage.

## Data and privacy

Public indexing is best effort. Two wallets use a roughly **30-minute** public-index interval; more wallets automatically increase it to respect the shared free quota. Base BNB/USDT balances update about every minute. With ANKR, the index interval defaults to **5 minutes**. Manual refresh respects source schedules and Retry-After.

ANKR's official Freemium plan currently includes 200M credits/month. Two wallets, four Advanced calls each every five minutes, continuously for 30 days: **48.384M credits, about 24.2%** before pagination, RPC and retries. Ordinary RPC alone cannot enumerate every token. See [data sources and costs](docs/DATA-SOURCES.md).

Local settings and cache live in `~/.cbot-wallet/` (or `CBOT_HOME`). API tokens are stored locally with owner-only file permissions where supported, are not encrypted by this application, and are never returned through its state API. Protect the OS account and backups. API providers receive queried public addresses and your IP. NFT images may load from third-party HTTPS hosts in your browser. Do not commit your data directory.

This is a localhost application, not a hosted portfolio service or trading bot. No send, approve, swap, signing, telemetry or arbitrary RPC proxy endpoints. It is **not a complete accounting ledger**, and reference prices are not executable sell quotes. Public NFT discovery is partial; ANKR uses up to five indexed pages and marks remaining pages as partial. Internal BNB transfers are not fully covered.

## Guides

- [精简中文教程](docs/QUICKSTART.zh-CN.md)
- [Install, update and stop](docs/INSTALL.md)
- [Sources, refresh budgets and ANKR math](docs/DATA-SOURCES.md)
- [Agent skill](skills/cbot-wallet/SKILL.md)
- [Sharing copy](docs/SHARE.zh-CN.md)

## Development

```sh
npm test
npm run demo
```

Demo mode uses synthetic addresses and amounts and does not call wallet providers. Windows has local deployment and test evidence. A Node24 Windows/macOS/Linux CI template is provided in docs/CI.example.yml; enable it through your own GitHub workflow setup. macOS/Linux deployment still needs a real target-host smoke test. Contributions are welcome. **MIT** covers the code; it does not grant an endorsement or ownership of the cbot name.
