@echo off
setlocal enabledelayedexpansion

set JAVA_HOME=C:\tools\jdk-17\jdk-17.0.19+10
set ANDROID_HOME=C:\tools\android-sdk
set PATH=%JAVA_HOME%\bin;%ANDROID_HOME%\cmdline-tools\latest\bin;%PATH%

echo === Build Environment ===
echo JAVA_HOME=%JAVA_HOME%
echo ANDROID_HOME=%ANDROID_HOME%
echo.

java -version
echo.

cd /d "%~dp0android"

echo === Building APK ===
echo Running gradlew assembleDebug...
call gradlew.bat assembleDebug --no-daemon 2>&1

echo.
echo === Build Complete ===
if exist "app\build\outputs\apk\debug\" (
    echo APK generated:
    dir "app\build\outputs\apk\debug\"
)
