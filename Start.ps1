$ErrorActionPreference = 'Stop'
& node --use-env-proxy (Join-Path $PSScriptRoot 'bin/cbot-wallet.mjs') install --autostart
if ($LASTEXITCODE -eq 0) { Start-Process 'http://127.0.0.1:48765/' }
