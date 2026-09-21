"""Step 00: download every external input (idempotent)."""
from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import config as C  # noqa: E402
from pipeline.common import fetch, log, socrata_fetch_all  # noqa: E402


def download_nyccas() -> None:
    out = C.EXTERNAL_DIR / "nyccas"
    fetch(f"{C.NYCCAS_RAW_BASE}/location.csv", out / "location.csv")
    for y, m in C.NYCCAS_YEARS_MONTHS:
        fetch(f"{C.NYCCAS_RAW_BASE}/{y}/{m}.csv", out / f"{y}-{m:02d}.csv")
    log(f"NYCCAS: {len(list(out.glob('*.csv')))} files")


def download_geography() -> None:
    for name in ("UHF42", "CD", "borough"):
        fetch(f"{C.NYC_GEO_BASE}/{name}.geo.json", C.EXTERNAL_DIR / f"{name}.geo.json")
    fetch(C.CRZ_GEOFENCE_GEOJSON, C.EXTERNAL_DIR / "crz_geofence.geojson")
    fetch(C.DAC_GEOJSON, C.EXTERNAL_DIR / "dac_nyc.geojson")
    fetch(C.NYC_AIR_QUALITY_JSON, C.EXTERNAL_DIR / "nyc_air_quality_c3uy-2p5r.json")
    log("geography + air quality indicators downloaded")


def download_bt() -> None:
    daily_p = C.EXTERNAL_DIR / "bt_daily.parquet"
    hourly_p = C.EXTERNAL_DIR / "bt_month_dow_hour.parquet"
    where = f"date>='{C.BT_START_DATE}T00:00:00'"
    if not daily_p.exists():
        log("B&T daily aggregate (SoQL) ...")
        df = socrata_fetch_all(C.BT_SOQL, {
            "$select": "date,facility,direction,vehicle_class_category,sum(traffic_count) as traffic",
            "$where": where,
            "$group": "date,facility,direction,vehicle_class_category",
            "$order": "date,facility,direction,vehicle_class_category",
        })
        df["traffic"] = pd.to_numeric(df["traffic"])
        df["date"] = pd.to_datetime(df["date"]).dt.strftime("%Y-%m-%d")
        df.to_parquet(daily_p, index=False)
        log(f"  saved {len(df)} rows")
    if not hourly_p.exists():
        log("B&T month x dow x hour aggregate (SoQL) ...")
        df = socrata_fetch_all(C.BT_SOQL, {
            "$select": ("date_trunc_ym(date) as ym,date_extract_dow(date) as dow,hour,facility,direction,"
                        "sum(traffic_count) as traffic"),
            "$where": where,
            "$group": "ym,dow,hour,facility,direction",
            "$order": "ym,dow,hour,facility,direction",
        })
        for c in ("dow", "hour", "traffic"):
            df[c] = pd.to_numeric(df[c])
        df["ym"] = pd.to_datetime(df["ym"]).dt.strftime("%Y-%m")
        df.to_parquet(hourly_p, index=False)
        log(f"  saved {len(df)} rows")


def main() -> None:
    C.EXTERNAL_DIR.mkdir(parents=True, exist_ok=True)
    download_geography()
    download_nyccas()
    download_bt()
    log("step 00 done")


if __name__ == "__main__":
    main()
