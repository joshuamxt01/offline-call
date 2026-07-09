@echo off
REM ============================================================================
REM  Nexa — WIPE ALL USER ACCOUNTS from the database.
REM  Removes every account + its data (messages, calls, contacts, devices) so
REM  everyone must register fresh. Network-lock settings are kept.
REM  IRREVERSIBLE. A confirmation is required.
REM ============================================================================
setlocal
title Nexa - Clear Accounts

echo(
echo ==========================================================
echo   WARNING  -  This DELETES ALL user accounts and their
echo   data (messages, calls, contacts, devices). Everyone will
echo   have to sign up again. This CANNOT be undone.
echo ==========================================================
echo(
set "CONFIRM="
set /p "CONFIRM=Type  WIPE  (in capitals) then Enter to proceed: "
if /I not "%CONFIRM%"=="WIPE" (
  echo(
  echo Cancelled. Nothing was changed.
  pause
  exit /b 0
)

echo(
echo Wiping...
node "%~dp0clear-accounts.mjs"
if errorlevel 1 (
  echo(
  echo [ERROR] Could not clear accounts. Is the database reachable?
)
echo(
pause
