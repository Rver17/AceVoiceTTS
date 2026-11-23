# Build a portable Windows x64 folder from a clean Python 3.11 environment.
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path "$PSScriptRoot/..").Path
Push-Location $root
try {
    npm.cmd run build
    if ($LASTEXITCODE) { throw 'Desktop build failed' }
    $py = Join-Path $root 'services/tts/.venv/Scripts/python.exe'
    $base = & $py -c "import sys; assert sys.version_info[:2] == (3,11); print(sys.base_prefix)"
    if ($LASTEXITCODE -or !(Test-Path "$base/python311.dll")) { throw 'Install the Python 3.11 x64 service first.' }
    $meta = Get-Content -Raw package.json | ConvertFrom-Json
    $folder = "AceVoice-$($meta.version)"
    $output = Join-Path $root "release/$folder"
    if (Test-Path $output) { throw "Move the existing portable build before rebuilding: $output" }
    $stage = Join-Path $root ('release/staging-' + [guid]::NewGuid())
    New-Item -Type Directory -Force $stage | Out-Null
    Copy-Item 'node_modules/electron/dist/*' $stage -Recurse
    Rename-Item -LiteralPath "$stage/electron.exe" -NewName 'AceVoice.exe'
    node scripts/stamp-exe.mjs "$stage/AceVoice.exe"
    if ($LASTEXITCODE) { throw 'Windows metadata update failed' }
    $appDir = "$stage/resources/app"
    $service = "$appDir/services/tts"
    New-Item -Type Directory -Force $service | Out-Null
    Copy-Item dist,dist-shell,package.json,package-lock.json $appDir -Recurse
    Copy-Item services/tts/app.py,services/tts/server.py,services/tts/personal.py $service
    Copy-Item README.md,docs,public $appDir -Recurse
    Push-Location $appDir
    try {
        npm.cmd ci --omit=dev --ignore-scripts
        if ($LASTEXITCODE) { throw 'Production dependency installation failed' }
    } finally { Pop-Location }
    $runtime = "$service/runtime"
    New-Item -Type Directory -Force "$runtime/Lib" | Out-Null
    Get-ChildItem -LiteralPath $base -File | Where-Object { $_.Extension -in '.dll','.exe','.txt' -or $_.Name -match '^LICENSE' } | Copy-Item -Destination $runtime
    foreach ($directory in 'DLLs','licenses','tcl') {
        if (Test-Path "$base/$directory") { Copy-Item "$base/$directory" $runtime -Recurse }
    }
    Get-ChildItem -LiteralPath "$base/Lib" | Where-Object Name -notin 'site-packages','__pycache__','test' | Copy-Item -Destination "$runtime/Lib" -Recurse
    Copy-Item services/tts/.venv/Lib/site-packages "$runtime/Lib" -Recurse
    & "$runtime/python.exe" -I -c "import kokoro_onnx, fastapi, uvicorn, soundfile"
    if ($LASTEXITCODE) { throw 'Portable Python validation failed' }
    Rename-Item -LiteralPath $stage -NewName $folder
    Write-Host "Portable app: $output/AceVoice.exe"
} finally { Pop-Location }



