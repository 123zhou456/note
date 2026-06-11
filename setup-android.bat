@echo off
setlocal enabledelayedexpansion

set JAVA_HOME=C:\tools\jdk-17\jdk-17.0.19+10
set ANDROID_HOME=C:\tools\android-sdk

echo === Using JDK ===
"%JAVA_HOME%\bin\java" -version

echo.
echo === Installing Android SDK components ===
echo This may take a few minutes...

"%JAVA_HOME%\bin\java" -Dcom.android.sdklib.toolsdir="%ANDROID_HOME%\cmdline-tools\latest" -classpath "%ANDROID_HOME%\cmdline-tools\latest\lib\sdkmanager-classpath.jar" com.android.sdklib.tool.sdkmanager.SdkManagerCli --sdk_root="%ANDROID_HOME%" "platforms;android-36" "build-tools;36.0.0"

echo.
echo === Done ===
dir "%ANDROID_HOME%\platforms\" 2>nul
dir "%ANDROID_HOME%\build-tools\" 2>nul
