@echo off
REM ============================================================================
REM  Nexa Android — build the app WITHOUT Android Studio.
REM  Double-click this after making changes to rebuild the APK.
REM  (Run setup.bat ONCE first to download the toolchain.)
REM ============================================================================
setlocal
REM ROOT keeps the trailing backslash (for building paths like ROOT+app\...).
set "ROOT=%~dp0"
REM PROJDIR has the trailing backslash stripped (safe to quote for gradle).
set "PROJDIR=%~dp0"
if "%PROJDIR:~-1%"=="\" set "PROJDIR=%PROJDIR:~0,-1%"

set "TOOLS=%ROOT%.localtools"
set "JAVA_HOME=%TOOLS%\jdk"
set "ANDROID_HOME=%TOOLS%\android-sdk"
set "ANDROID_SDK_ROOT=%TOOLS%\android-sdk"
set "GRADLE=%TOOLS%\gradle\gradle-8.9\bin\gradle.bat"
set "PATH=%JAVA_HOME%\bin;%PATH%"

REM --- Where your phone should reach the backend ---
REM Default baked into the app = the PERMANENT Render backend, so a fresh install
REM works over any network with no setup. Users can still change it in-app under
REM "Server settings" (e.g. a LAN IP like http://192.168.x.x:4000 for offline mode).
set "API_BASE_URL=https://offline-call-hy4x.onrender.com"

if not exist "%JAVA_HOME%\bin\java.exe" (
  echo [ERROR] Toolchain missing. Run setup.bat first.
  pause
  exit /b 1
)

REM --- Guard: refuse to start if a GRADLE build is already running ---
REM  NOTE: don't just look for any java.exe — an IDE (VS Code / Antigravity) runs
REM  a Java language server that would trigger a false "busy". Match only a real
REM  Gradle CLI process (its command line runs org.gradle.launcher.GradleMain).
powershell -NoProfile -Command "exit @(Get-CimInstance Win32_Process -Filter \"Name='java.exe'\" -ErrorAction SilentlyContinue ^| Where-Object { $_.CommandLine -like '*GradleMain*' }).Count" >NUL 2>&1
if errorlevel 1 (
  echo [BUSY] A Gradle build is already running.
  echo Wait for it to finish, then run build.bat again.
  pause
  exit /b 1
)

echo.
echo === Building Nexa debug APK (API_BASE_URL=%API_BASE_URL%) ===
echo.

REM Run Gradle from inside the project folder (no -p, avoids path-quoting issues).
pushd "%PROJDIR%"
call "%GRADLE%" -PAPI_BASE_URL=%API_BASE_URL% assembleOnlineDebug --no-daemon --console=plain %*
set "RESULT=%errorlevel%"
popd

if not "%RESULT%"=="0" (
  echo.
  echo [BUILD FAILED] Scroll up for the error. Copy it to me and I'll fix it.
  pause
  exit /b 1
)

set "APK=%ROOT%app\build\outputs\apk\online\debug\app-online-debug.apk"
echo.
echo ============================================================
echo  BUILD OK. Your APK:
echo    %APK%
echo.
echo  Install on a USB-connected phone (USB debugging ON):
echo    "%ANDROID_HOME%\platform-tools\adb.exe" install -r "%APK%"
echo  ...or just copy that .apk file to your phone and tap it.
echo ============================================================
pause
