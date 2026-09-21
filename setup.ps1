# One-time setup on Windows: Python virtual environment + packages, then npm packages.
# Run from the repo root:  powershell -ExecutionPolicy Bypass -File .\setup.ps1
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not (Test-Path "$root\.venv")) { python -m venv "$root\.venv" }
& "$root\.venv\Scripts\python.exe" -m pip install --upgrade pip
& "$root\.venv\Scripts\python.exe" -m pip install -r "$root\backend\requirements.txt"
Push-Location "$root\frontend"
npm install
Pop-Location
Write-Host ""
Write-Host "Setup done. Start the app with:  powershell -ExecutionPolicy Bypass -File .\dev.ps1"
