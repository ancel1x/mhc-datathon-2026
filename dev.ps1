# Starts the FastAPI backend (port 8000) and the Vite dev server (port 5173) in two windows.
# Usage: powershell -ExecutionPolicy Bypass -File .\dev.ps1
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$py = Join-Path $root ".venv\Scripts\python.exe"
if (-not (Test-Path $py)) { Write-Host "Run setup.ps1 first:  powershell -ExecutionPolicy Bypass -File .\setup.ps1"; exit 1 }
if (-not (Test-Path (Join-Path $root "data\processed\bundle\summary.json"))) { Write-Host "No data bundle yet - running the pipeline (a few minutes the first time)..."; & $py (Join-Path $root "backend\pipeline\run_all.py") }
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root'; & '$py' -m uvicorn backend.api.main:app --reload --port 8000"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\frontend'; npm run dev"
Write-Host "API: http://127.0.0.1:8000/docs   App: http://localhost:5173"
