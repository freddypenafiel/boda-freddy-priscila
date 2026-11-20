$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$env:JAVA_HOME = "C:\Users\fredd\.bubblewrap\jdk\jdk-17.0.11+9"
$env:ANDROID_HOME = "C:\Users\fredd\.bubblewrap\android_sdk"
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$env:PATH = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:PATH"

Set-Location $root
node tools/prepare-capacitor.mjs
npx cap copy android
Set-Location (Join-Path $root "android")
& .\gradlew.bat assembleDebug --no-daemon
if ($LASTEXITCODE -ne 0) { throw "Gradle build failed with exit code $LASTEXITCODE" }

$srcApk = Join-Path $root "android\app\build\outputs\apk\debug\app-debug.apk"
$dstApk = Join-Path $root "Boda_Freddy_y_Priscila_v4.0.apk"
if (Test-Path $srcApk) {
  Copy-Item $srcApk $dstApk -Force
  Write-Host "APK listo: $dstApk"
} else {
  throw "No se encontró el APK generado en $srcApk"
}
