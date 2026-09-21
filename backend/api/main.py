"""FastAPI backend: serves the precomputed bundle and two dynamic 'compare any two date ranges' endpoints."""
from __future__ import annotations

import re
import sys
from datetime import date
from pathlib import Path

import duckdb
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import config as C  # noqa: E402

app = FastAPI(title="Map the Real Story API", version="0.1.0",
              description="Congestion pricing x traffic x air quality x equity (CUNY Datathon Phase 1)")
app.add_middleware(GZipMiddleware, minimum_size=1024)
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
                   allow_methods=["GET"], allow_headers=["*"])

NAME_RE = re.compile(r"^[a-z0-9_]+$")
CRZ_DAILY = C.PROCESSED_DIR / "crz_daily_group_class.parquet"
CRZ_HOURLY = C.PROCESSED_DIR / "crz_hourly_group.parquet"
AQ_DAILY = C.PROCESSED_DIR / "aq_daily.parquet"


def _bundle_file(name: str, ext: str) -> Path:
    if not NAME_RE.match(name):
        raise HTTPException(400, "bad name")
    p = C.BUNDLE_DIR / f"{name}.{ext}"
    if not p.exists():
        raise HTTPException(404, f"{name}.{ext} not found; run the pipeline first")
    return p


def _pq(path: Path) -> str:
    return str(path).replace("\\", "/")


def _check_dates(*ds: date) -> None:
    for a, b in zip(ds[::2], ds[1::2]):
        if b < a:
            raise HTTPException(400, "end before start")


@app.get("/api/health")
def health():
    return {"ok": True, "bundle_ready": (C.BUNDLE_DIR / "summary.json").exists()}


@app.get("/api/summary")
def summary():
    return FileResponse(_bundle_file("summary", "json"), media_type="application/json")


@app.get("/api/bundle/{name}")
def bundle(name: str):
    return FileResponse(_bundle_file(name, "json"), media_type="application/json")


@app.get("/api/geo/{layer}")
def geo(layer: str):
    return FileResponse(_bundle_file(layer, "geojson"), media_type="application/geo+json")


@app.get("/api/crz/compare")
def crz_compare(a_start: date, a_end: date, b_start: date, b_end: date,
                group: str | None = Query(None, description="Detection group name, e.g. 'Queensboro Bridge'"),
                vehicle_class: str | None = Query(None, description="e.g. '2 - Single-Unit Trucks'")):
    """Compare zone entries between two date windows (inclusive). Returns totals, daily averages and hourly profiles."""
    _check_dates(a_start, a_end, b_start, b_end)
    if not CRZ_DAILY.exists():
        raise HTTPException(503, "CRZ aggregates missing; run pipeline step 01")
    con = duckdb.connect()
    filt = []
    params = []
    if group:
        filt.append("detection_group = ?")
        params.append(group)
    if vehicle_class:
        filt.append("vehicle_class = ?")
        params.append(vehicle_class)
    where_extra = (" AND " + " AND ".join(filt)) if filt else ""

    def window(s: date, e: date) -> dict:
        q = f"""
            WITH d AS (
              SELECT toll_date, SUM(crz_entries) AS entries, SUM(excluded_entries) AS excluded
              FROM read_parquet('{_pq(CRZ_DAILY)}')
              WHERE toll_date BETWEEN ? AND ? {where_extra}
              GROUP BY toll_date)
            SELECT count(*) AS days, SUM(entries) AS total, AVG(entries) AS avg_daily,
                   AVG(CASE WHEN dayofweek(toll_date) BETWEEN 1 AND 5 THEN entries END) AS avg_weekday,
                   AVG(CASE WHEN dayofweek(toll_date) IN (0,6) THEN entries END) AS avg_weekend,
                   SUM(excluded) AS excluded
            FROM d"""
        row = con.execute(q, [s, e, *params]).fetchone()
        hq = f"""
            WITH h AS (
              SELECT toll_date, hour, SUM(crz_entries) AS entries
              FROM read_parquet('{_pq(CRZ_HOURLY)}')
              WHERE toll_date BETWEEN ? AND ? {"AND detection_group = ?" if group else ""}
              GROUP BY toll_date, hour)
            SELECT hour, AVG(entries) FROM h WHERE dayofweek(toll_date) BETWEEN 1 AND 5 GROUP BY hour ORDER BY hour"""
        hrows = con.execute(hq, [s, e] + ([group] if group else [])).fetchall()
        prof = [None] * 24
        for hh, v in hrows:
            prof[int(hh)] = round(float(v), 1)
        return {"start": s.isoformat(), "end": e.isoformat(), "days": row[0], "total": row[1],
                "avg_daily": round(row[2], 0) if row[2] is not None else None,
                "avg_weekday": round(row[3], 0) if row[3] is not None else None,
                "avg_weekend": round(row[4], 0) if row[4] is not None else None,
                "excluded": row[5], "hourly_weekday": prof}

    a, b = window(a_start, a_end), window(b_start, b_end)
    con.close()
    pct = (round((b["avg_daily"] - a["avg_daily"]) / a["avg_daily"] * 100, 1)
           if a.get("avg_daily") and b.get("avg_daily") else None)
    return {"filters": {"group": group, "vehicle_class": vehicle_class}, "a": a, "b": b, "pct_change_avg_daily": pct}


@app.get("/api/aq/compare")
def aq_compare(a_start: date, a_end: date, b_start: date, b_end: date,
               site: str = Query(..., description="NYCCAS SiteID, e.g. 36005NY11534 (Mott Haven)"),
               exclude_smoke: bool = True):
    """Compare a monitor's daily-mean PM2.5 between two windows, with the Van Wyck control-site adjustment."""
    _check_dates(a_start, a_end, b_start, b_end)
    if not AQ_DAILY.exists():
        raise HTTPException(503, "AQ aggregates missing; run pipeline step 04")
    from pipeline.s04_air_quality import CONTROL_SITE  # noqa: WPS433
    con = duckdb.connect()
    smoke = "AND NOT smoke" if exclude_smoke else ""

    def mean(sid: str, s: date, e: date):
        r = con.execute(f"""SELECT AVG(mean), count(*), MEDIAN(mean) FROM read_parquet('{_pq(AQ_DAILY)}')
                            WHERE site_id = ? AND date BETWEEN ? AND ? {smoke}""", [sid, s, e]).fetchone()
        return (round(r[0], 2) if r[0] is not None else None), r[1], (round(r[2], 2) if r[2] is not None else None)

    a, na, ma = mean(site, a_start, a_end)
    b, nb, mb = mean(site, b_start, b_end)
    ca, _, _ = mean(CONTROL_SITE, a_start, a_end)
    cb, _, _ = mean(CONTROL_SITE, b_start, b_end)
    con.close()
    if a is None or b is None:
        raise HTTPException(404, "no data for that site in one of the windows")
    delta = round(b - a, 2)
    adj = round(delta - (cb - ca), 2) if ca is not None and cb is not None else None
    return {"site": site, "a": {"mean": a, "median": ma, "days": na}, "b": {"mean": b, "median": mb, "days": nb},
            "delta_raw": delta, "pct_raw": round(delta / a * 100, 1) if a else None,
            "control": {"site": CONTROL_SITE, "a_mean": ca, "b_mean": cb}, "delta_adj_control": adj,
            "exclude_smoke": exclude_smoke}


# Serve the built frontend (npm run build) if present, so `uvicorn` alone can demo the app.
DIST = C.ROOT / "frontend" / "dist"
if DIST.exists():
    app.mount("/", StaticFiles(directory=str(DIST), html=True), name="frontend")
