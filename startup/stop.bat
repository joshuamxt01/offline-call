@echo off
REM ============================================================================
REM  Nexa — stop the backend server and free its port.
REM ============================================================================
setlocal enabledelayedexpansion
title Nexa Backend - Stop

set "ROOT=%~dp0.."
set "BACKEND=%ROOT%\backend"

set "PORT=4000"
if exist "%BACKEND%\.env" (
  for /f "usebackq tokens=1,* delims==" %%A in ("%BACKEND%\.env") do (
    if /I "%%A"=="PORT" set "PORT=%%B"
  )
)
set "PORT=%PORT: =%"

echo(
echo ==========================================================
echo   NEXA BACKEND STOP  (port %PORT%)
echo ==========================================================

set "FOUND="
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":%PORT% .*LISTENING"') do (
  set "FOUND=1"
  echo   Stopping PID %%P ...
  taskkill /F /PID %%P >nul 2>&1
)

REM Also close the named backend window if it's still open
taskkill /FI "WINDOWTITLE eq Nexa Backend" /F >nul 2>&1

if defined FOUND (
  echo   Backend stopped. Port %PORT% is now free.
) else (
  echo   Nothing was listening on port %PORT% - already stopped.
)
echo ==========================================================
