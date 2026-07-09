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
set "API_BASE_URL=https://offline-call.onrender.com"

if not exist "%JAVA_HOME%\bin\java.exe" (
  echo [ERROR] Toolchain missing. Run setup.bat first.
  pause
  exit /b 1
)

REM --- Guard: refuse to start if a build (java) is already running ---
tasklist /FI "IMAGENAME eq java.exe" 2>NUL | find /I "java.exe" >NUL
if not errorlevel 1 (
  echo [BUSY] A build is already running ^(Java is active^).
  echo Wait for it to finish, then run build.bat again.
  pause
  exit /b 1
)

echo.
echo === Building Nexa debug APK (API_BASE_URL=%API_BASE_URL%) ===
echo.

REM Run Gradle from inside the project folder (no -p, avoids path-quoting issues).
pushd "%PROJDIR%"
call "%GRADLE%" -PAPI_BASE_URL=%API_BASE_URL% assembleDebug --no-daemon --console=plain %*
set "RESULT=%errorlevel%"
popd

if not "%RESULT%"=="0" (
  echo.
  echo [BUILD FAILED] Scroll up for the error. Copy it to me and I'll fix it.
  pause
  exit /b 1
)

set "APK=%ROOT%app\build\outputs\apk\debug\app-debug.apk"
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
