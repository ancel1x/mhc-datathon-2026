#!/usr/bin/env bash
# One-time setup on macOS / Linux: Python virtual environment + packages, then npm packages.
# Run from the repo root:  ./setup.sh
set -e
cd "$(dirname "$0")"
[ -d .venv ] || python3 -m venv .venv
.venv/bin/python -m pip install --upgrade pip
.venv/bin/python -m pip install -r backend/requirements.txt
(cd frontend && npm install)
echo
echo "Setup done. Start the app with:  ./dev.sh"
