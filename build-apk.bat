@echo off
setlocal enabledelayedexpansion

set JAVA_HOME=C:\tools\jdk-17\jdk-17.0.19+10
set ANDROID_HOME=C:\tools\android-sdk
set PATH=%JAVA_HOME%\bin;%ANDROID_HOME%\cmdline-tools\latest\bin;%PATH%

echo === Environment ===
echo JAVA_HOME=%JAVA_HOME%
echo ANDROID_HOME=%ANDROID_HOME%
echo.
java -version
echo.

%1 %2 %3 %4 %5
