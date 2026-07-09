# ============================================================================
#  Nexa — expose the app over TRUSTED HTTPS using Cloudflare quick tunnels.
#  Gives you a real https:// URL that works on any device (phone included),
#  with no certificate warnings.
#
#  Run it:  right-click this file -> "Run with PowerShell"
#           ...or in a terminal:
#           powershell -ExecutionPolicy Bypass -File startup\start-https.ps1
#
#  NOTE: while this runs, your backend is reachable from the internet (it is
#  protected by login/JWT). Close this window / run stop-https.ps1 to shut it.
# ============================================================================
$ErrorActionPreference = "Stop"
$root  = Split-Path -Parent $PSScriptRoot
$tools = Join-Path $root ".tools"
New-Item -ItemType Directory -Force $tools | Out-Null
$cf = Join-Path $tools "cloudflared.exe"

# --- 1. Download cloudflared (once) ---
if (-not (Test-Path $cf)) {
  Write-Host "[1/5] Downloading cloudflared (~70MB, one time)..."
  Invoke-WebRequest -Uri "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe" -OutFile $cf
} else {
  Write-Host "[1/5] cloudflared already present."
}

function Start-Tunnel([int]$port, [string]$name) {
  $log = Join-Path $tools "$name.log"
  Remove-Item $log -ErrorAction SilentlyContinue
  Start-Process -FilePath $cf `
    -ArgumentList "tunnel","--no-autoupdate","--url","http://localhost:$port" `
    -RedirectStandardError $log -RedirectStandardOutput (Join-Path $tools "$name.out") `
    -WindowStyle Hidden | Out-Null
  $out = Join-Path $tools "$name.out"
  for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep -Seconds 1
    foreach ($f in @($log, $out)) {
      if (Test-Path $f) {
        $m = Select-String -Path $f -Pattern "https://[a-z0-9-]+\.trycloudflare\.com" -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($m) { return $m.Matches[0].Value }
      }
    }
  }
  return $null
}

Write-Host "[2/5] Opening HTTPS tunnel for the BACKEND (port 4000)..."
$apiUrl = Start-Tunnel 4000 "cf-api"
Write-Host "[3/5] Opening HTTPS tunnel for the WEBSITE (port 3000)..."
$webUrl = Start-Tunnel 3000 "cf-web"

if (-not $apiUrl -or -not $webUrl) {
  Write-Host "ERROR: could not get tunnel URLs. Check your internet and retry." -ForegroundColor Red
  exit 1
}

# --- 4. Rewire config so the HTTPS site talks to the HTTPS backend ---
Write-Host "[4/5] Configuring app for the tunnel URLs..."
Set-Content (Join-Path $root "web\.env.local") "NEXT_PUBLIC_API_URL=$apiUrl" -Encoding Ascii
$envPath = Join-Path $root "backend\.env"
$envTxt  = Get-Content $envPath
$envTxt  = $envTxt -replace '^CORS_ORIGINS=.*', "CORS_ORIGINS=http://localhost:3000,$webUrl"
Set-Content $envPath $envTxt -Encoding Ascii

# --- 5. Restart backend + web on the new config ---
Write-Host "[5/5] Restarting backend + website..."
foreach ($p in 3000,4000) {
  Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue |
    ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
}
Start-Process cmd -ArgumentList "/c","cd /d `"$root\backend`" && npx tsx src/index.ts" -WindowStyle Minimized
Start-Process cmd -ArgumentList "/c","cd /d `"$root\web`" && npx next dev -p 3000"    -WindowStyle Minimized
Start-Sleep -Seconds 8

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "  TRUSTED HTTPS IS LIVE. Open this on ANY device:" -ForegroundColor Green
Write-Host ""
Write-Host "     $webUrl" -ForegroundColor Cyan
Write-Host ""
Write-Host "  (backend tunnel: $apiUrl)"
Write-Host "  Give the website ~20s to finish compiling on first load."
Write-Host "  Camera/mic (calls) now work because it's real HTTPS."
Write-Host ""
Write-Host "  KEEP THIS WINDOW OPEN (minimize it, don't close it)." -ForegroundColor Yellow
Write-Host "  To stop later: run  startup\stop-https.ps1" -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Tunnels are live. This window will keep them running." -ForegroundColor Green

# Keep the tunnels alive. Pressing Enter does NOT stop them anymore.
# If a tunnel process dies, report it. Close the window (or run stop-https.ps1) to stop.
while ($true) {
  Start-Sleep -Seconds 10
  $alive = (Get-Process cloudflared -ErrorAction SilentlyContinue | Measure-Object).Count
  if ($alive -lt 2) {
    Write-Host "[warn] a tunnel dropped ($alive/2 running). Re-run start-https.ps1 to get fresh URLs." -ForegroundColor Yellow
  }
}
