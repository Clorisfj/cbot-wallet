# Installation and operations

Node.js **24.5+** and npm are required. No database, bundler or runtime npm dependencies.

## Install

Use the one-command installer in README. It copies only application source to `~/.local/share/cbot-wallet-app/` and starts a detached local process. User settings/cache are separate, in `~/.cbot-wallet/`. Keep both directories when updating.

From a clone:

```sh
node --use-env-proxy bin/cbot-wallet.mjs install
```

Windows: append `--autostart`, or run `Start.ps1`. This creates user Startup and Desktop shortcuts, no administrator service. macOS/Linux: `sh Start.sh`; background start is supported, but login autostart needs your OS service manager. These platform-specific paths require a real deployment check on the target OS.

Use `HTTP_PROXY` / `HTTPS_PROXY` / `NO_PROXY` if required. No proxy address is built into this project. Avoid logging URLs containing API tokens.

## Start / stop / update

```sh
node ~/.local/share/cbot-wallet-app/bin/cbot-wallet.mjs status
node ~/.local/share/cbot-wallet-app/bin/cbot-wallet.mjs start --background
node ~/.local/share/cbot-wallet-app/bin/cbot-wallet.mjs stop
```

On Windows replace `~` with your user home path, or use its Desktop shortcut. `stop` verifies the recorded PID and instance ID against the live application before stopping anything. Foreground `npm start` stops with Ctrl+C.

Update: stop the current background instance, run the new version's installer, then reopen the same bookmark. Upgrades preserve the separate settings directory. The app does not automatically download or execute updates.

## Private local settings

`CBOT_HOME` overrides the settings directory. `CBOT_PORT` overrides port48765. `ANKR_API_KEY` provides the optional Advanced API token. `CBOT_BAW_CLI` can point to an already-installed official `@binance/agentic-wallet/dist/index.js`.

The browser settings panel handles public addresses, RPC and ANKR configuration. For an existing custom Binance session profile, locally add optional `sessionDir` and `credentialAccount` fields to a wallet entry in `settings.json`; do not publish that file. Never copy a session from another device. The credential account is only an existing OS credential alias, not a token. Normal watch users do not need these fields.

Only the official wallet's read commands are available to the adapter. It never runs auth/sign/send/approve/swap or arbitrary commands. Detection is best effort and does not install or log into Binance Wallet for you.

## Remote AI agents

An agent running on a cloud machine installs the server on that cloud machine. Its `127.0.0.1` is not your laptop. To view it, use a private tunnel such as:

```sh
ssh -L 48765:127.0.0.1:48765 your-own-host
```

Do not change the bind address to `0.0.0.0`, expose a public port, or upload user settings to a hosted demo. Shared screenshots should use `npm run demo`, not your real cache.

## Remove

Stop the verified application first. Remove only the installation's own shortcuts and application directory. Back up the local settings directory before removing it. The project never removes an official Binance wallet or signs out a session during uninstall.
