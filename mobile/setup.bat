@echo off
REM ============================================================================
REM  Nexa Android — ONE-TIME toolchain setup (no Android Studio needed).
REM  Downloads a portable JDK 17, the Android SDK command-line tools, and Gradle
REM  into mobile\.localtools, installs the SDK packages, and accepts licenses.
REM  After this finishes, use build.bat to build the APK.
REM ============================================================================
setlocal enabledelayedexpansion
set ROOT=%~dp0
set TOOLS=%ROOT%.localtools
set SDK=%TOOLS%\android-sdk
if not exist "%TOOLS%" mkdir "%TOOLS%"

REM ---------- 1. JDK 17 ----------
if not exist "%TOOLS%\jdk\bin\java.exe" (
  if not exist "%TOOLS%\jdk.zip" (
    echo [1/4] Downloading JDK 17...
    powershell -Command "Invoke-WebRequest -Uri 'https://api.adoptium.net/v3/binary/latest/17/ga/windows/x64/jdk/hotspot/normal/eclipse?project=jdk' -OutFile '%TOOLS%\jdk.zip'"
  )
  echo [1/4] Extracting JDK...
  powershell -Command "Expand-Archive -Force '%TOOLS%\jdk.zip' '%TOOLS%\jdk-tmp'"
  for /d %%D in ("%TOOLS%\jdk-tmp\jdk*") do move "%%D" "%TOOLS%\jdk" >nul
  rmdir /s /q "%TOOLS%\jdk-tmp"
)
set JAVA_HOME=%TOOLS%\jdk
set PATH=%JAVA_HOME%\bin;%PATH%

REM ---------- 2. Android command-line tools ----------
if not exist "%SDK%\cmdline-tools\latest\bin\sdkmanager.bat" (
  if not exist "%TOOLS%\cmdline-tools.zip" (
    echo [2/4] Downloading Android command-line tools...
    powershell -Command "Invoke-WebRequest -Uri 'https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip' -OutFile '%TOOLS%\cmdline-tools.zip'"
  )
  echo [2/4] Extracting Android tools...
  powershell -Command "Expand-Archive -Force '%TOOLS%\cmdline-tools.zip' '%TOOLS%\cmt-tmp'"
  if not exist "%SDK%\cmdline-tools" mkdir "%SDK%\cmdline-tools"
  move "%TOOLS%\cmt-tmp\cmdline-tools" "%SDK%\cmdline-tools\latest" >nul
  rmdir /s /q "%TOOLS%\cmt-tmp"
)
set ANDROID_HOME=%SDK%
set ANDROID_SDK_ROOT=%SDK%
set SDKMGR=%SDK%\cmdline-tools\latest\bin\sdkmanager.bat

REM ---------- 3. Gradle ----------
if not exist "%TOOLS%\gradle\gradle-8.9\bin\gradle.bat" (
  if not exist "%TOOLS%\gradle.zip" (
    echo [3/4] Downloading Gradle 8.9...
    powershell -Command "Invoke-WebRequest -Uri 'https://services.gradle.org/distributions/gradle-8.9-bin.zip' -OutFile '%TOOLS%\gradle.zip'"
  )
  echo [3/4] Extracting Gradle...
  powershell -Command "Expand-Archive -Force '%TOOLS%\gradle.zip' '%TOOLS%\gradle'"
)

REM ---------- 4. SDK packages + licenses ----------
echo [4/4] Accepting licenses + installing SDK packages (platform 34, build-tools, platform-tools)...
powershell -Command "$y = (('y' + [Environment]::NewLine) * 40); $y | & '%SDKMGR%' --sdk_root='%SDK%' --licenses" >nul
call "%SDKMGR%" --sdk_root="%SDK%" "platform-tools" "platforms;android-34" "build-tools;34.0.0"

REM ---------- local.properties (sdk.dir) ----------
> "%ROOT%local.properties" echo sdk.dir=%SDK:\=\\%
>>"%ROOT%local.properties" echo API_BASE_URL=http://10.0.2.2:4000

echo.
echo ============================================================
echo  SETUP COMPLETE. Now run:  build.bat
echo ============================================================
pause
