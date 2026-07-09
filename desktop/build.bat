@echo off
REM ============================================================================
REM  Nexa Windows app — build Nexa.exe WITHOUT Visual Studio.
REM  Downloads a local .NET 8 SDK on first run, then builds a single
REM  self-contained .exe (no .NET install needed to RUN it).
REM  Double-click this file, or run it in a terminal.
REM ============================================================================
setlocal
set "ROOT=%~dp0"
set "DOTNET=%ROOT%.dotnet"
set "DOTNET_EXE=%DOTNET%\dotnet.exe"

REM --- 1. Local .NET 8 SDK (once) ---
if not exist "%DOTNET_EXE%" (
  echo [1/2] Downloading .NET 8 SDK ^(one time, ~200MB^)...
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Invoke-WebRequest -Uri 'https://dot.net/v1/dotnet-install.ps1' -OutFile '%TEMP%\dotnet-install.ps1'; & '%TEMP%\dotnet-install.ps1' -Channel 8.0 -Quality GA -InstallDir '%DOTNET%'"
)
if not exist "%DOTNET_EXE%" (
  echo [ERROR] .NET SDK install failed. Check your internet and retry.
  pause
  exit /b 1
)

set "DOTNET_ROOT=%DOTNET%"
set "PATH=%DOTNET%;%PATH%"
set "DOTNET_CLI_TELEMETRY_OPTOUT=1"
set "DOTNET_NOLOGO=1"

REM --- 2. Build the single-file .exe ---
echo [2/2] Building Nexa.exe (this pulls WebView2 + the runtime on first build)...
"%DOTNET_EXE%" publish "%ROOT%Nexa.csproj" -c Release -o "%ROOT%publish" --nologo
if errorlevel 1 (
  echo.
  echo [BUILD FAILED] Copy the error above and send it to me.
  pause
  exit /b 1
)

echo.
echo ============================================================
echo  BUILD OK. Your Windows app:
echo    %ROOT%publish\Nexa.exe
echo.
echo  Double-click Nexa.exe, then enter your server address
echo  (the PC running startup.bat), e.g.  http://192.168.1.50:3000
echo  Camera/mic work over the LAN with no HTTPS needed.
echo ============================================================
pause
