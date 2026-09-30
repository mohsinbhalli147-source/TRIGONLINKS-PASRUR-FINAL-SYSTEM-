# Builds the Play Store bundle (.aab) or a debug APK.
#
#   powershell -File scripts\build-android.ps1
#
# Sets JAVA_HOME explicitly: the machine-level JAVA_HOME points at a directory
# that no longer exists, which makes Gradle fail with a confusing error.
param(
    [ValidateSet('aab-release', 'aab-debug', 'apk-debug')]
    [string]$Target = 'aab-release'
)

$ErrorActionPreference = 'Stop'

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$androidDir = Join-Path $projectRoot 'android'

# Prefer a JDK 21 that actually exists. Capacitor's Android library is compiled
# with `source release 21`, so JDK 17 fails with "invalid source release: 21".
$jdkCandidates = @(
    'C:\Program Files\Java\jdk-21.0.12.1',
    'C:\Program Files\Eclipse Adoptium\jdk-21',
    $env:JAVA_HOME
)
$jdk = $jdkCandidates | Where-Object { $_ -and (Test-Path (Join-Path $_ 'bin\javac.exe')) } | Select-Object -First 1
if (-not $jdk) { throw 'No JDK 21+ found. Capacitor requires JDK 21.' }
$env:JAVA_HOME = $jdk

$sdk = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { 'D:\Android\Sdk' }
if (-not (Test-Path $sdk)) { throw "ANDROID_HOME not found: $sdk" }

Write-Host "JDK  : $jdk"
Write-Host "SDK  : $sdk"
Write-Host "Mode : $Target"
Write-Host ''

# local.properties is how Gradle finds the SDK; it is gitignored.
$localProps = Join-Path $androidDir 'local.properties'
Set-Content -LiteralPath $localProps -Value "sdk.dir=$($sdk -replace '\\', '\\')" -Encoding UTF8
Write-Host "wrote local.properties"

$gradlew = Join-Path $androidDir 'gradlew.bat'

switch ($Target) {
    'aab-release' { $task = 'bundleRelease' }
    'aab-debug'   { $task = 'bundleDebug' }
    'apk-debug'   { $task = 'assembleDebug' }
}

Push-Location $androidDir
try {
    Write-Host "running: gradlew.bat $task"
    & $gradlew $task '--no-daemon' '--stacktrace'
    if ($LASTEXITCODE -ne 0) { throw "gradle $task failed with exit code $LASTEXITCODE" }
} finally {
    Pop-Location
}

$outputs = switch ($Target) {
    'apk-debug'   { @(Get-ChildItem (Join-Path $androidDir 'app\build\outputs\apk\debug') -Filter *.apk -ErrorAction SilentlyContinue) }
    default       { @(Get-ChildItem (Join-Path $androidDir 'app\build\outputs\bundle') -Recurse -Filter *.aab -ErrorAction SilentlyContinue) }
}

if ($outputs.Count -eq 0) {
    throw 'Build reported success but produced no artefact. Check app\build\outputs.'
}

Write-Host ''
Write-Host 'Artefacts:'
foreach ($file in $outputs) {
    Write-Host ("  {0}  ({1:N0} KB)" -f $file.FullName, ($file.Length / 1KB))
}

if ($Target -eq 'aab-release') {
    $keystore = Join-Path $androidDir 'keystore.properties'
    if (-not (Test-Path $keystore)) {
        Write-Host ''
        Write-Warning 'No keystore.properties found, so this bundle is signed with the debug key.'
        Write-Warning 'Play Console will reject it. See android\SIGNING.md.'
    } else {
        Write-Host ''
        Write-Host 'Release-signed bundle ready for the Play Console.'
    }
}
