param([string]$SourcePath = '', [switch]$ForcePortableRuntime, [switch]$NoAutostart)
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$base = if ($env:CBOT_BOOTSTRAP_HOME) { $env:CBOT_BOOTSTRAP_HOME } else { Join-Path $env:LOCALAPPDATA 'cbot-wallet' }
New-Item -ItemType Directory -Force -Path $base | Out-Null
$node = (Get-Command node -ErrorAction SilentlyContinue).Source
$usable = $false
if ($node -and !$ForcePortableRuntime) {
  & $node -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit(a>24||a===24&&b>=5?0:1)"
  $usable = $LASTEXITCODE -eq 0
}
if (!$usable) {
  $arch = switch ([System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture.ToString()) { 'X64' {'x64'} 'Arm64' {'arm64'} default { throw 'Requires Windows x64 or ARM64' } }
  $version = 'v24.11.0'
  $file = "node-$version-win-$arch.zip"
  $dist = "https://nodejs.org/dist/$version"
  $sums = (Invoke-WebRequest -UseBasicParsing "$dist/SHASUMS256.txt").Content
  $line = ($sums -split "`n" | Where-Object { $_.Trim().EndsWith("  $file") })
  if (!$line) { throw 'Official runtime checksum missing' }
  $zip = Join-Path $base $file
  Invoke-WebRequest -UseBasicParsing "$dist/$file" -OutFile $zip
  if ((Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash.ToLowerInvariant() -ne ($line -split '\s+')[0]) { throw 'Runtime checksum mismatch; stopped' }
  Expand-Archive -LiteralPath $zip -DestinationPath $base -Force
  $node = Join-Path $base "node-$version-win-$arch/node.exe"
}
if (!$SourcePath) {
  $archive = Join-Path $base 'cbot-wallet-v1.1.1.zip'
  Invoke-WebRequest -UseBasicParsing 'https://github.com/Clorisfj/cbot-wallet/archive/refs/tags/v1.1.1.zip' -OutFile $archive
  Expand-Archive -LiteralPath $archive -DestinationPath $base -Force
  $SourcePath = Join-Path $base 'cbot-wallet-1.1.1'
}
$installArgs = @('--use-env-proxy', (Join-Path $SourcePath 'bin/cbot-wallet.mjs'), 'install')
if (!$NoAutostart) { $installArgs += '--autostart' }
& $node @installArgs
if ($LASTEXITCODE -ne 0) { throw 'Dashboard installation failed' }
$port = if ($env:CBOT_PORT) { $env:CBOT_PORT } else { '48765' }
$url = "http://127.0.0.1:$port/"
$health = Invoke-RestMethod ($url + 'api/health')
if ($health.product -ne 'cbot-wallet') { throw 'Dashboard health check failed' }
Write-Output "Ready: $url"
if (!$NoAutostart) { Start-Process $url }
