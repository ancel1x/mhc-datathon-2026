"""Shared helpers for the pipeline: periods, geometry, IO, Socrata paging."""
from __future__ import annotations

import json
import math
import sys
import time
from pathlib import Path
from typing import Iterable

import numpy as np
import pandas as pd
import requests
from pyproj import Transformer
from shapely.geometry import shape, Point, mapping
from shapely.ops import unary_union
from shapely.strtree import STRtree

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import config as C  # noqa: E402

# ----------------------------------------------------------------------------- periods
def period_bounds(name: str) -> tuple[pd.Timestamp, pd.Timestamp]:
    """Return (start, end_exclusive) as naive timestamps in local NY time."""
    s, e = C.PERIODS[name]
    return pd.Timestamp(s), pd.Timestamp(e) + pd.Timedelta(days=1)


def in_period(dates: pd.Series, name: str) -> pd.Series:
    s, e = period_bounds(name)
    d = pd.to_datetime(dates)
    return (d >= s) & (d < e)


def is_weekend(dates: pd.Series) -> pd.Series:
    return pd.to_datetime(dates).dt.dayofweek >= 5


def is_peak(hours, weekend) -> np.ndarray:
    """Toll-schedule peak flag: weekdays 5:00-20:59, weekends 9:00-20:59 local."""
    wd_lo, wd_hi = C.PEAK_HOURS_WEEKDAY
    we_lo, we_hi = C.PEAK_HOURS_WEEKEND
    h = np.asarray(hours).astype(int)
    we = np.asarray(weekend).astype(bool)
    return np.where(we, (h >= we_lo) & (h < we_hi), (h >= wd_lo) & (h < wd_hi))


def matched_months(a: Iterable[str], b: Iterable[str]) -> list[str]:
    """Calendar months (MM) present in both lists of YYYY-MM strings."""
    ma = {m[-2:] for m in a}
    mb = {m[-2:] for m in b}
    return sorted(ma & mb)


def pct_change(before, after):
    try:
        if before is None or after is None:
            return None
        before, after = float(before), float(after)
        if before == 0 or math.isnan(before) or math.isnan(after):
            return None
        return round((after - before) / before * 100.0, 1)
    except (TypeError, ValueError):
        return None


def rnd(x, nd=2):
    if x is None:
        return None
    try:
        v = float(x)
        if math.isnan(v) or math.isinf(v):
            return None
        return round(v, nd) if nd else int(round(v))
    except (TypeError, ValueError):
        return None


# ----------------------------------------------------------------------------- geometry
_T2263 = Transformer.from_crs("EPSG:2263", "EPSG:4326", always_xy=True)


def nysp_to_wgs84(x: float, y: float) -> tuple[float, float]:
    """NY State Plane Long Island (US ft) -> (lon, lat)."""
    lon, lat = _T2263.transform(x, y)
    return round(lon, 6), round(lat, 6)


def parse_wkt_point(wkt) -> tuple[float, float] | None:
    if not isinstance(wkt, str) or not wkt.startswith("POINT"):
        return None
    inner = wkt[wkt.find("(") + 1: wkt.find(")")].split()
    try:
        return float(inner[0]), float(inner[1])
    except (ValueError, IndexError):
        return None


class PolygonLocator:
    """Point-in-polygon lookup over GeoJSON features using an STRtree."""

    def __init__(self, features: list[dict]):
        self.props = [f.get("properties", {}) for f in features]
        self.geoms = [shape(f["geometry"]) for f in features]
        self.tree = STRtree(self.geoms)

    def locate(self, lon: float, lat: float) -> dict | None:
        pt = Point(lon, lat)
        hits = self.tree.query(pt, predicate="within")
        if len(hits):
            return self.props[int(hits[0])]
        return None


def load_geojson(path: Path) -> dict:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def crz_zone_geometry():
    """Dissolved CRZ polygon (shapely) from the MTA geofence."""
    gj = load_geojson(C.EXTERNAL_DIR / "crz_geofence.geojson")
    return unary_union([shape(f["geometry"]) for f in gj["features"]])


def inside_crz_status(zone, lon: float, lat: float, boundary_m: float = 150.0) -> str:
    """inside | boundary | outside. Boundary = within ~boundary_m of the zone edge."""
    pt = Point(lon, lat)
    deg = boundary_m / 111_000.0
    if zone.boundary.distance(pt) <= deg:
        return "boundary"
    return "inside" if zone.contains(pt) else "outside"


# ----------------------------------------------------------------------------- IO
def _json_default(o):
    if isinstance(o, np.integer):
        return int(o)
    if isinstance(o, np.floating):
        return None if math.isnan(o) else float(o)
    if isinstance(o, np.bool_):
        return bool(o)
    if isinstance(o, pd.Timestamp):
        return o.isoformat()
    if isinstance(o, np.ndarray):
        return o.tolist()
    if isinstance(o, set):
        return sorted(o)
    if o is pd.NA or o is pd.NaT:
        return None
    raise TypeError(f"not serializable: {type(o)}")


def write_json(obj, path: Path, indent: int | None = None) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=indent, default=_json_default)


def read_json(path: Path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def feature(lon: float, lat: float, props: dict) -> dict:
    return {"type": "Feature", "geometry": {"type": "Point", "coordinates": [lon, lat]}, "properties": props}


def feature_collection(features: list[dict]) -> dict:
    return {"type": "FeatureCollection", "features": features}


def geom_feature(geom, props: dict) -> dict:
    return {"type": "Feature", "geometry": mapping(geom), "properties": props}


def log(msg: str) -> None:
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


# ----------------------------------------------------------------------------- HTTP
_SESSION = requests.Session()
_SESSION.headers.update({"User-Agent": "cuny-datathon-phase1/0.1 (student project)"})


def fetch(url: str, dest: Path, force: bool = False, retries: int = 4, timeout: int = 180) -> Path:
    """Download url to dest unless it already exists (idempotent)."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists() and dest.stat().st_size > 0 and not force:
        return dest
    last = None
    for attempt in range(retries):
        try:
            r = _SESSION.get(url, timeout=timeout)
            r.raise_for_status()
            dest.write_bytes(r.content)
            return dest
        except Exception as exc:  # noqa: BLE001
            last = exc
            time.sleep(2 * (attempt + 1))
    raise RuntimeError(f"failed to download {url}: {last}")


def socrata_fetch_all(base_url: str, params: dict, page: int = 50000, max_pages: int = 80) -> pd.DataFrame:
    """Page through a SoQL query (requires $order for stable paging)."""
    frames = []
    for i in range(max_pages):
        p = dict(params)
        p["$limit"] = page
        p["$offset"] = i * page
        rows = None
        for attempt in range(4):
            try:
                r = _SESSION.get(base_url, params=p, timeout=300)
                r.raise_for_status()
                rows = r.json()
                break
            except Exception:  # noqa: BLE001
                if attempt == 3:
                    raise
                time.sleep(3 * (attempt + 1))
        if not rows:
            break
        frames.append(pd.DataFrame(rows))
        log(f"  page {i + 1}: {len(rows)} rows")
        if len(rows) < page:
            break
    return pd.concat(frames, ignore_index=True) if frames else pd.DataFrame()
