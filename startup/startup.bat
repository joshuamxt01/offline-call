@echo off
REM ============================================================================
REM  Nexa — start the backend server (Windows dev convenience).
REM  - Frees the backend port if something is already using it
REM  - Starts the backend (reads PORT from backend\.env, default 4000)
REM  - Waits until /health responds, then reports success
REM
REM  NOTE: In this project the BACKEND runs on 4000 and the WEBSITE on 3000.
REM        This script manages the backend. To also run the site: cd web ^&^& npm run dev
REM ============================================================================
setlocal enabledelayedexpansion
title Nexa Backend

set "ROOT=%~dp0.."
set "BACKEND=%ROOT%\backend"

REM --- Read PORT from backend\.env (fallback 4000) ---
set "PORT=4000"
if exist "%BACKEND%\.env" (
  for /f "usebackq tokens=1,* delims==" %%A in ("%BACKEND%\.env") do (
    if /I "%%A"=="PORT" set "PORT=%%B"
  )
)
REM strip stray spaces
set "PORT=%PORT: =%"

echo(
echo ==========================================================
echo   NEXA BACKEND STARTUP
echo   Port: %PORT%
echo ==========================================================
echo(

REM --- 1. Is the port already in use? Free it. ---
echo [1/3] Checking port %PORT% ...
set "PID="
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":%PORT% .*LISTENING"') do set "PID=%%P"

if defined PID (
  echo       Port %PORT% is in use by PID !PID! - stopping it...
  taskkill /F /PID !PID! >nul 2>&1
  if errorlevel 1 (
    echo       [ERROR] Could not stop PID !PID!. Close it manually and retry.
    pause
    exit /b 1
  )
  echo       Freed port %PORT%.
) else (
  echo       Port %PORT% is free.
)

REM --- 2. Start the backend ---
echo [2/3] Starting backend...
if not exist "%BACKEND%\node_modules" (
  echo       [ERROR] backend\node_modules missing. Run: npm install
  pause
  exit /b 1
)
pushd "%BACKEND%"
start "Nexa Backend" cmd /c "npm run dev"
popd

REM --- 3. Wait for /health ---
echo [3/3] Waiting for http://localhost:%PORT%/health ...
set "OK="
for /l %%i in (1,1,30) do (
  if not defined OK (
    powershell -NoProfile -Command "try { (Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 http://localhost:%PORT%/health) ^| Out-Null; exit 0 } catch { exit 1 }" >nul 2>&1
    if not errorlevel 1 set "OK=1"
    if not defined OK (
      <nul set /p "=."
      timeout /t 1 /nobreak >nul
    )
  )
)
echo(
if defined OK (
  echo ==========================================================
  echo   SUCCESS - backend is up on http://localhost:%PORT%
  echo   Health: http://localhost:%PORT%/health
  echo   A separate "Nexa Backend" window shows the live logs.
  echo   Stop it anytime with: stop.bat
  echo ==========================================================
) else (
  echo ==========================================================
  echo   [ERROR] Backend did not respond on port %PORT% within 30s.
  echo   Check the "Nexa Backend" window for the error, then retry.
  echo ==========================================================
  pause
  exit /b 1
)
