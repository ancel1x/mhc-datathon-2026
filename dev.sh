#!/usr/bin/env bash
# Starts the API (port 8000) and the frontend dev server (port 5173) on macOS / Linux. Ctrl+C stops both.
set -e
cd "$(dirname "$0")"
[ -x .venv/bin/python ] || { echo "Run ./setup.sh first"; exit 1; }
[ -f data/processed/bundle/summary.json ] || .venv/bin/python backend/pipeline/run_all.py
.venv/bin/python -m uvicorn backend.api.main:app --reload --port 8000 &
API_PID=$!
trap 'kill $API_PID 2>/dev/null' EXIT
echo "API: http://127.0.0.1:8000/docs   App: http://localhost:5173"
(cd frontend && npm run dev)
