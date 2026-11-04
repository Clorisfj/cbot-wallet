# cbot-wallet development

- Local, read-only BSC dashboard. No signing, trading, auth flows, arbitrary RPC proxy or public bind address.
- Keep configuration/cache outside the repository (`CBOT_HOME`, default `~/.cbot-wallet`). Do not hardcode participant wallet addresses, private paths, credential aliases or API keys. Browser state must never contain a provider URL token or session directory.
- `lib/network.mjs` is the provider read allowlist and quota boundary; `lib/wallet-cli.mjs` is the official-CLI read allowlist. Validate chain56 for a custom RPC before reading balances.
- Zero balances hidden, unpriced balances visible. Preserve exact decimal strings; never represent a failed read as zero.
- Settings POSTs require same-origin JSON; static files are explicitly allowlisted. Do not expose local files or widen networking to solve deployment errors.
- Public indexes scale to wallet count. Preserve scheduled next-at times and Retry-After across restart. API credit usage is an estimate, not a bill.
- `npm test` verifies display semantics, discovery, precision, configuration privacy, read-only calls and HTTP boundaries. Use synthetic `npm run demo` for public screenshots. Check actual provider acceptance separately before claiming live integration.
- Update CURRENT_TASK.md and CHANGELOG.md after meaningful changes. Install/usage instructions belong in README and docs; agent installation entrypoint is skills/cbot-wallet/SKILL.md.
