#!/bin/sh
set -eu
base="${CBOT_BOOTSTRAP_HOME:-$HOME/.local/share/cbot-wallet-bootstrap}"
mkdir -p "$base"
download() { if command -v curl >/dev/null 2>&1; then curl -fLsS "$1" -o "$2"; elif command -v wget >/dev/null 2>&1; then wget -q "$1" -O "$2"; else echo 'curl or wget is required; ask your agent to install it with your OS package manager.' >&2; exit 1; fi; }
node_bin="$(command -v node || true)"
if [ -z "$node_bin" ] || ! "$node_bin" -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a>24||a===24&&b>=5?0:1)'; then
  case "$(uname -s)" in Darwin) os=darwin;; Linux) os=linux;; *) echo 'Unsupported operating system' >&2; exit 1;; esac
  case "$(uname -m)" in x86_64) arch=x64;; arm64|aarch64) arch=arm64;; *) echo 'Unsupported architecture' >&2; exit 1;; esac
  if [ "$os" = linux ] && ldd --version 2>&1 | grep -qi musl; then echo 'musl Linux needs a compatible Node24.5+ package installed by your agent first.' >&2; exit 1; fi
  version=v24.11.0
  file="node-$version-$os-$arch.tar.gz"
  download "https://nodejs.org/dist/$version/SHASUMS256.txt" "$base/SHASUMS256.txt"
  download "https://nodejs.org/dist/$version/$file" "$base/$file"
  expected="$(awk -v name="$file" '$2==name {print $1}' "$base/SHASUMS256.txt")"
  if command -v sha256sum >/dev/null 2>&1; then actual="$(sha256sum "$base/$file" | awk '{print $1}')"; else actual="$(shasum -a 256 "$base/$file" | awk '{print $1}')"; fi
  [ -n "$expected" ] && [ "$expected" = "$actual" ] || { echo 'Runtime checksum mismatch' >&2; exit 1; }
  tar -xzf "$base/$file" -C "$base"
  node_bin="$base/node-$version-$os-$arch/bin/node"
fi
download 'https://github.com/Clorisfj/cbot-wallet/archive/refs/tags/v1.1.2.tar.gz' "$base/source.tar.gz"
tar -xzf "$base/source.tar.gz" -C "$base"
"$node_bin" --use-env-proxy "$base/cbot-wallet-1.1.2/bin/cbot-wallet.mjs" install
port="${CBOT_PORT:-48765}"
download "http://127.0.0.1:$port/api/health" "$base/health.json"
"$node_bin" -e 'const fs=require("node:fs");if(JSON.parse(fs.readFileSync(process.argv[1])).product!=="cbot-wallet")process.exit(1)' "$base/health.json"
echo "Ready: http://127.0.0.1:$port/"
case "$(uname -s)" in Darwin) open "http://127.0.0.1:$port/";; Linux) if [ -n "${DISPLAY:-}${WAYLAND_DISPLAY:-}" ] && command -v xdg-open >/dev/null 2>&1; then xdg-open "http://127.0.0.1:$port/"; fi;; esac
