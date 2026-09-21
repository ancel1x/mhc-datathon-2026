"""Run the whole Phase 1 pipeline: downloads -> aggregates -> bundle for the frontend.

Usage:  python backend/pipeline/run_all.py [--from N]   (N = first step to run, default 0)
"""
from __future__ import annotations

import argparse
import importlib
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

STEPS = [
    ("s00_download_external", "download external inputs"),
    ("s01_crz_entries", "CRZ vehicle entries (DuckDB)"),
    ("s02_bt_crossings", "MTA bridges & tunnels"),
    ("s03_dot_counts", "NYC DOT traffic counts"),
    ("s04_air_quality", "NYCCAS PM2.5 + neighborhood indicators"),
    ("s05_equity", "DAC / UHF42 / boundaries"),
    ("s06_bundle", "join + summary + frontend bundle"),
]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--from", dest="start", type=int, default=0)
    args = ap.parse_args()
    t0 = time.time()
    for i, (mod, label) in enumerate(STEPS):
        if i < args.start:
            continue
        print(f"\n=== step {i}: {label} ===", flush=True)
        importlib.import_module(f"pipeline.{mod}").main()
    print(f"\npipeline finished in {time.time() - t0:.0f}s")


if __name__ == "__main__":
    main()
