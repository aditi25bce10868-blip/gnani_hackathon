@echo off
REM Parly — Dev environment setup
REM Run this before any npx react-native command

if exist "C:\Program Files\Eclipse Adoptium\jdk-17.0.21.9-hotspot" (
  set "JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-17.0.21.9-hotspot"
) else (
  set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
)
set ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk
set PATH=%JAVA_HOME%\bin;%ANDROID_HOME%\platform-tools;%ANDROID_HOME%\emulator;%PATH%

echo Java:   && java -version
echo ADB:    && adb version 2>&1 | findstr "Version"
echo.

if "%1"=="" (
  echo Usage: dev.bat [start / run-android / build-apk / reverse / emulator / shell]
  echo.
  echo   dev.bat start        - Port forward & start Metro bundler
  echo   dev.bat run-android  - Build and run on device/emulator
  echo   dev.bat build-apk    - Build standalone release APK (no laptop needed!)
  echo   dev.bat reverse      - Forward port 8081 via adb
  echo   dev.bat emulator     - Launch emulator
  echo   dev.bat shell        - Open dev shell with env set
) else if "%1"=="start" (
  taskkill /F /IM node.exe >nul 2>&1
  adb reverse tcp:8081 tcp:8081
  npx react-native start --reset-cache
) else if "%1"=="reverse" (
  adb reverse tcp:8081 tcp:8081
) else if "%1"=="build-apk" (
  cd android && gradlew.bat assembleRelease && cd ..
  echo.
  echo Standalone APK generated at:
  echo android\app\build\outputs\apk\release\app-release.apk
) else if "%1"=="emulator" (
  start "" "%ANDROID_HOME%\emulator\emulator.exe" -avd Medium_Phone_API_36.1
) else if "%1"=="run-android" (
  adb reverse tcp:8081 tcp:8081
  npx react-native run-android
) else if "%1"=="shell" (
  cmd /k
)
