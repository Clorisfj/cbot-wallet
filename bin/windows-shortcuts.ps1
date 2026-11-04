param([Parameter(Mandatory=$true)][string]$NodePath,[Parameter(Mandatory=$true)][string]$AppPath,[Parameter(Mandatory=$true)][string]$DataPath)
$ErrorActionPreference = 'Stop'
# Persistent launcher uses only paths, never an API token.
$launcher = Join-Path $DataPath 'launch.ps1'
$nodeLiteral = $NodePath.Replace("'", "''")
$entryLiteral = (Join-Path $AppPath 'bin\cbot-wallet.mjs').Replace("'", "''")
$dataLiteral = $DataPath.Replace("'", "''")
@"
`$env:CBOT_HOME = '$dataLiteral'
& '$nodeLiteral' '$entryLiteral' start --background
if (`$args -contains '-OpenBrowser') { Start-Process 'http://127.0.0.1:48765/' }
"@ | Set-Content -LiteralPath $launcher -Encoding UTF8
$shell = New-Object -ComObject WScript.Shell
foreach ($folder in @('Startup','Desktop')) {
    $path = Join-Path ([Environment]::GetFolderPath($folder)) 'cbot Wallet Desk.lnk'
    $link = $shell.CreateShortcut($path)
    $link.TargetPath = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
    $link.Arguments = '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $launcher + '"'
    if ($folder -eq 'Desktop') { $link.Arguments += ' -OpenBrowser' }
    $link.WorkingDirectory = $AppPath
    $link.WindowStyle = 7
    $link.Description = 'cbot local read-only wallet dashboard'
    $link.Save()
}
