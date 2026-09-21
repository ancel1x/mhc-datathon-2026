"""Central configuration for the Phase 1 data pipeline and API."""
from __future__ import annotations

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
EXTERNAL_DIR = DATA_DIR / "external"
PROCESSED_DIR = DATA_DIR / "processed"
BUNDLE_DIR = PROCESSED_DIR / "bundle"
FRONTEND_DATA_DIR = ROOT / "frontend" / "public" / "data"

# The two large raw CSVs stay where they were downloaded. Override with env vars if moved.
DOWNLOADS = Path(os.environ.get("USERPROFILE", str(Path.home()))) / "Downloads"
RAW_CRZ_CSV = Path(os.environ.get(
    "RAW_CRZ_CSV",
    DOWNLOADS / "MTA_Congestion_Relief_Zone_Vehicle_Entries__Beginning_2025_20260920.csv",
))
RAW_ATVC_CSV = Path(os.environ.get(
    "RAW_ATVC_CSV",
    DOWNLOADS / "Automated_Traffic_Volume_Counts_20260920.csv",
))

CP_START = "2025-01-05"          # congestion pricing launch day
NY_TZ = "America/New_York"

# Analysis periods (inclusive dates, local NY time)
PERIODS = {
    "pre_2023":      ("2023-01-01", "2023-12-31"),
    "pre_2024":      ("2024-01-05", "2024-12-31"),
    "post_2025":     ("2025-01-05", "2025-12-31"),
    "post_2026_ytd": ("2026-01-01", "2026-08-31"),
    # same calendar windows for YTD comparisons
    "ytd_2024":      ("2024-01-05", "2024-08-31"),
    "ytd_2025":      ("2025-01-05", "2025-08-31"),
}
# The three periods the UI lets the viewer pick (baseline + after)
UI_PERIODS = ["pre_2024", "post_2025", "post_2026_ytd"]

# Air quality thresholds
SMOKE_DAY_THRESHOLD = 35.0       # µg/m³ cross-site median daily mean above which a day is a regional event
AQ_UNCHANGED_BAND = 0.5          # µg/m³ ±band for "unchanged"
MIN_COVERAGE_PCT = 60.0          # below this a comparison is flagged insufficient

# Peak/overnight schedule mirrors the toll schedule
PEAK_HOURS_WEEKDAY = (5, 21)     # 5:00–20:59 local
PEAK_HOURS_WEEKEND = (9, 21)     # 9:00–20:59 local

# External sources -----------------------------------------------------------------
NYCCAS_RAW_BASE = "https://raw.githubusercontent.com/nychealth/nyccas-data/main/hist/csv"
NYCCAS_YEARS_MONTHS = [(y, m) for y in (2023, 2024, 2025, 2026) for m in range(1, 13)
                       if not (y == 2026 and m > 9)]
NYC_AIR_QUALITY_JSON = "https://data.cityofnewyork.us/resource/c3uy-2p5r.json?$limit=50000"
NYC_GEO_BASE = "https://raw.githubusercontent.com/nycehs/NYC_geography/master"
CRZ_GEOFENCE_GEOJSON = "https://data.ny.gov/api/geospatial/srxy-5nxn?method=export&format=GeoJSON"
DAC_GEOJSON = ("https://data.ny.gov/resource/2e6c-s6fp.geojson"
               "?$where=county in('Bronx','Kings','New York','Queens','Richmond')&$limit=3000")
BT_SOQL = "https://data.ny.gov/resource/ebfx-2m7v.json"
BT_START_DATE = "2023-01-01"

# Toll structure (MTA, current as of Sept 2026) --------------------------------------
TOLLS = {
    "effective": "2025-01-05",
    "peak_hours": {"weekday": "5:00 AM – 9:00 PM", "weekend": "9:00 AM – 9:00 PM"},
    "overnight_discount": "75% off peak",
    "ezpass_rates": [
        {"class": "Passenger & small commercial vehicles", "peak": 9.00, "overnight": 2.25, "crossing_credit": 3.00},
        {"class": "Motorcycles", "peak": 4.50, "overnight": 1.05, "crossing_credit": 1.50},
        {"class": "Small trucks & charter buses", "peak": 14.40, "overnight": 3.60, "crossing_credit": 7.20},
        {"class": "Large trucks & tour buses", "peak": 21.60, "overnight": 5.40, "crossing_credit": 12.00},
    ],
    "per_trip": [
        {"class": "Taxis, green cabs, black cars", "fee": 0.75},
        {"class": "High-volume for-hire vehicles (Uber/Lyft)", "fee": 1.50},
    ],
    "crossing_credit_tunnels": ["Lincoln Tunnel", "Holland Tunnel", "Queens-Midtown Tunnel", "Hugh L. Carey Tunnel"],
    "excluded_roadways": ["FDR Drive", "West Side Highway / Route 9A", "Battery Park Underpass",
                          "Hugh L. Carey Tunnel surface connection to West St"],
    "scheduled_increases": [{"year": 2028, "peak_car": 12.00}, {"year": 2031, "peak_car": 15.00}],
    "source": "https://www.mta.info/fares-tolls/tolls/congestion-relief-zone/about",
}
