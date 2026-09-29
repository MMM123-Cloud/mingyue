param([string]$Architectures = 'arm64-v8a,x86_64')
$ErrorActionPreference = 'Stop'
$projectDirectory = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectDirectory
if (-not $env:ANDROID_HOME) { $env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA 'Android/Sdk' }
if (-not (Test-Path -LiteralPath $env:ANDROID_HOME)) { throw 'Android SDK not found. Set ANDROID_HOME.' }
if (-not (Test-Path -LiteralPath 'assets/models/llama3tokenizer.gguf')) { throw 'Missing bundled tokenizer; use the complete source archive.' }
& npm ci --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { throw 'npm ci failed' }
& python ./scripts/prepare-release-apk.py --sdk $env:ANDROID_HOME --architectures $Architectures
if ($LASTEXITCODE -ne 0) { throw '16KB vector library preparation failed' }
$env:NODE_ENV = 'production'
$env:APP_VARIANT = 'production'
& npx expo prebuild --platform android --no-install --no-clean
if ($LASTEXITCODE -ne 0) { throw 'Expo prebuild failed' }
$sdkDirectory = $env:ANDROID_HOME.Replace('\', '/')
Set-Content -LiteralPath 'android/local.properties' -Value "sdk.dir=$sdkDirectory"
Push-Location android
$previousJavaOptions = $env:JAVA_TOOL_OPTIONS
try {
    # Bound auxiliary Java tools (Prefab/R8) as well as the Gradle daemon.
    $env:JAVA_TOOL_OPTIONS = "$previousJavaOptions -Xms64m -Xmx768m".Trim()
    & ./gradlew.bat :app:assembleRelease "-PreactNativeArchitectures=$Architectures" --console=plain
    if ($LASTEXITCODE -ne 0) { throw 'Gradle build failed' }
} finally {
    $env:JAVA_TOOL_OPTIONS = $previousJavaOptions
    Pop-Location
}

# Keep signing material outside public source archives. Reuse this directory for updates.
$signingDirectory = Join-Path $projectDirectory '.signing'
New-Item -ItemType Directory -Path $signingDirectory -Force | Out-Null
$metadataPath = Join-Path $signingDirectory 'signing.json'
$keystorePath = Join-Path $signingDirectory 'mingyue-release.jks'
if (-not (Test-Path -LiteralPath $metadataPath)) {
    $passwordBytes = New-Object byte[] 32
    $randomGenerator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $randomGenerator.GetBytes($passwordBytes)
    $randomGenerator.Dispose()
    @{ alias = 'mingyue'; password = [Convert]::ToBase64String($passwordBytes) } |
        ConvertTo-Json | Set-Content -LiteralPath $metadataPath -Encoding utf8
}
$metadata = Get-Content -LiteralPath $metadataPath -Raw | ConvertFrom-Json
$env:MINGYUE_SIGNING_PASSWORD = $metadata.password
try {
    if (-not (Test-Path -LiteralPath $keystorePath)) {
        & keytool -genkeypair -keystore $keystorePath -alias mingyue -storepass:env MINGYUE_SIGNING_PASSWORD -keypass:env MINGYUE_SIGNING_PASSWORD -keyalg RSA -keysize 3072 -validity 10000 -dname 'CN=MingYue Moon Glass,OU=Personal Build,O=MingYue,C=CN'
        if ($LASTEXITCODE -ne 0) { throw 'Key generation failed' }
    }
    $buildTools = Get-ChildItem -LiteralPath (Join-Path $env:ANDROID_HOME 'build-tools') -Directory |
        Where-Object { Test-Path (Join-Path $_.FullName 'apksigner.bat') } |
        Sort-Object { [version]$_.Name } -Descending | Select-Object -First 1
    New-Item -ItemType Directory -Path 'dist' -Force | Out-Null
    $packageVersion = (Get-Content -LiteralPath (Join-Path $projectDirectory 'package.json') -Raw | ConvertFrom-Json).version
    $outputApk = Join-Path $projectDirectory "dist/MingYue-LiquidGlass-$packageVersion.apk"
    $applicationBuildDirectory = if ($env:MINGYUE_APP_BUILD_DIRECTORY) { $env:MINGYUE_APP_BUILD_DIRECTORY } else { Join-Path $projectDirectory 'android/app/build' }
    $unsignedApk = Join-Path $applicationBuildDirectory 'outputs/apk/release/app-release.apk'
    & (Join-Path $buildTools.FullName 'apksigner.bat') sign --ks $keystorePath --ks-key-alias mingyue --ks-pass env:MINGYUE_SIGNING_PASSWORD --key-pass env:MINGYUE_SIGNING_PASSWORD --out $outputApk $unsignedApk
    if ($LASTEXITCODE -ne 0) { throw 'APK signing failed' }
    & (Join-Path $buildTools.FullName 'apksigner.bat') verify $outputApk
    if ($LASTEXITCODE -ne 0) { throw 'Signature verification failed' }
    Write-Output "Installer: $outputApk"
} finally { Remove-Item Env:MINGYUE_SIGNING_PASSWORD -ErrorAction SilentlyContinue }
