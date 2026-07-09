# Stop the Cloudflare tunnels and revert the app back to localhost.
$root = Split-Path -Parent $PSScriptRoot

Write-Host "Stopping tunnels..."
Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

Write-Host "Reverting config to localhost..."
Set-Content (Join-Path $root "web\.env.local") "NEXT_PUBLIC_API_URL=http://localhost:4000" -Encoding Ascii
$envPath = Join-Path $root "backend\.env"
$envTxt  = Get-Content $envPath
$envTxt  = $envTxt -replace '^CORS_ORIGINS=.*', "CORS_ORIGINS=http://localhost:3000"
Set-Content $envPath $envTxt -Encoding Ascii

Write-Host "Restarting backend + website on localhost..."
foreach ($p in 3000,4000) {
  Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue |
    ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
}
Start-Process cmd -ArgumentList "/c","cd /d `"$root\backend`" && npx tsx src/index.ts" -WindowStyle Minimized
Start-Process cmd -ArgumentList "/c","cd /d `"$root\web`" && npx next dev -p 3000"    -WindowStyle Minimized
Write-Host "Done. Back to http://localhost:3000"
