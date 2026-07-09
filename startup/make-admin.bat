@echo off
REM ============================================================================
REM  Nexa - make a user an admin (or demote back to a normal user).
REM  Type the username when asked. The account must LOG OUT and LOG IN again
REM  afterwards for the Admin panel to show up.
REM ============================================================================
setlocal
title Nexa - Make Admin

set "UNAME="
set /p "UNAME=Username to make ADMIN: "
if "%UNAME%"=="" (
  echo No username entered. Cancelled.
  pause
  exit /b 0
)

node "%~dp0make-admin.mjs" "%UNAME%"
echo(
pause
