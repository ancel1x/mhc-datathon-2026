"""Step 05: geometry prep for the equity layers and boundaries (DAC tracts, UHF42, boroughs, CRZ zone)."""
from __future__ import annotations

import sys
from pathlib import Path

from shapely.geometry import shape, mapping
from shapely.ops import unary_union

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import config as C  # noqa: E402
from pipeline.common import feature_collection, geom_feature, load_geojson, log, read_json, rnd, write_json  # noqa: E402

DAC_SIMPLIFY_DEG = 0.00012   # ~13 m
COORD_DECIMALS = 5


def round_geom(geom_json: dict) -> dict:
    def rec(c):
        if isinstance(c[0], (int, float)):
            return [round(c[0], COORD_DECIMALS), round(c[1], COORD_DECIMALS)]
        return [rec(x) for x in c]
    geom_json["coordinates"] = rec(geom_json["coordinates"])
    return geom_json


def pct01(v):
    """DAC percentile fields are 0-1 already; guard against 0-100 variants."""
    v = rnd(v, 3)
    if v is None:
        return None
    return v / 100.0 if v > 1.0 else v


def build_dac() -> dict:
    gj = load_geojson(C.EXTERNAL_DIR / "dac_nyc.geojson")
    feats = []
    for f in gj["features"]:
        p = f["properties"]
        geom = shape(f["geometry"]).simplify(DAC_SIMPLIFY_DEG, preserve_topology=True)
        if geom.is_empty:
            continue
        pop = p.get("population_count")
        feats.append({"type": "Feature", "geometry": round_geom(mapping(geom)), "properties": {
            "geoid": str(p.get("geoid")),
            "dac": str(p.get("dac_designation", "")).startswith("Designated"),
            "combined_pct": pct01(p.get("percentile_rank_combined")),
            "asthma_pct": pct01(p.get("asthma_ed_rate")),
            "traffic_pct": pct01(p.get("traffic_number_vehicles")),
            "truck_pct": pct01(p.get("traffic_truck_highways")),
            "pm25_pct": pct01(p.get("particulate_matter_25")),
            "county": p.get("county"),
            "population": int(float(pop)) if pop not in (None, "") else None,
        }})
    fc = feature_collection(feats)
    write_json(fc, C.PROCESSED_DIR / "dac_tracts.geojson")
    n_dac = sum(1 for f in feats if f["properties"]["dac"])
    log(f"  DAC: {len(feats)} NYC tracts, {n_dac} designated")
    return fc


HEALTH_CSV = C.DATA_DIR / "reference" / "uhf42_health_context_2023.csv"
HEALTH_NOTE = "Asthma ED visits per 10,000 children ages 5-17, 2023: the newest year published (health data lag about two years)"


def load_health_context() -> dict:
    """UHF42 all-cause asthma ED rates (2023) and poverty (ACS 2019-23) from the NYC Environment & Health Data
    Portal, via the team's analysis export (see data/reference/README.md)."""
    if not HEALTH_CSV.exists():
        log(f"  WARNING: {HEALTH_CSV.name} missing; neighborhoods will have no 2023 asthma rate")
        return {}
    import csv
    with open(HEALTH_CSV, encoding="utf-8") as f:
        return {r["uhf_code"]: r for r in csv.DictReader(f)}


def build_uhf42() -> dict:
    gj = load_geojson(C.EXTERNAL_DIR / "UHF42.geo.json")
    aq = read_json(C.PROCESSED_DIR / "air_quality.json")
    ind = aq["uhf42_indicators"]
    health = load_health_context()
    feats = []
    for f in gj["features"]:
        p = f["properties"]
        code = str(p.get("GEOCODE"))
        if code in ("0", "None"):
            continue
        rec = ind.get(code, {})
        pm = rec.get("pm25", {})
        feats.append({"type": "Feature", "geometry": f["geometry"], "properties": {
            "uhf_code": code, "name": rec.get("name") or p.get("GEONAME"), "borough": p.get("BOROUGH"),
            "pm25_2024": pm.get("2024"), "pm25_2009": pm.get("2009"),
            "pm25_change_pct_2009_2024": (rnd((pm["2024"] - pm["2009"]) / pm["2009"] * 100, 1)
                                          if pm.get("2024") and pm.get("2009") else None),
            "pm25_series": pm,
            "asthma_ed_pm25_children": rec.get("asthma_children"), "asthma_ed_pm25_adults": rec.get("asthma_adults"),
            "asthma_period": rec.get("asthma_period"),
            # all-cause asthma ED visits (the number the map shows) + poverty, both pre-toll context
            "asthma_ed_children": rnd(h.get("child_asthma_ed_rate_2023"), 1) if (h := health.get(code, {})) else None,
            "asthma_ed_adults": rnd(h.get("adult_asthma_ed_rate_2023"), 1) if h else None,
            "poverty_pct": rnd(h.get("poverty_pct_2019_23"), 1) if h else None,
            "health_period": "2023" if h else None,
            "health_note": HEALTH_NOTE if h else None,
        }})
    fc = feature_collection(feats)
    write_json(fc, C.PROCESSED_DIR / "uhf42.geojson")
    n_h = sum(1 for f in feats if f["properties"]["asthma_ed_children"] is not None)
    log(f"  UHF42: {len(feats)} neighborhoods with indicators, {n_h} with 2023 asthma ED rates")
    return fc


def build_boroughs() -> None:
    gj = load_geojson(C.EXTERNAL_DIR / "borough.geo.json")
    feats = []
    for f in gj["features"]:
        p = f["properties"]
        geom = shape(f["geometry"]).simplify(0.0004, preserve_topology=True)
        feats.append(geom_feature(geom, {"boro_name": p.get("BoroName"), "boro_code": p.get("BoroCode")}))
    write_json(feature_collection(feats), C.PROCESSED_DIR / "boroughs.geojson")


def build_zone() -> None:
    gj = load_geojson(C.EXTERNAL_DIR / "crz_geofence.geojson")
    zone = unary_union([shape(f["geometry"]) for f in gj["features"]])
    write_json(feature_collection([geom_feature(zone, {
        "name": "Congestion Relief Zone",
        "source": "MTA Central Business District Geofence (data.ny.gov srxy-5nxn)",
    })]), C.PROCESSED_DIR / "crz_zone.geojson")


def main() -> None:
    log("building equity + boundary layers ...")
    build_dac()
    build_uhf42()
    build_boroughs()
    build_zone()
    log("step 05 done")


if __name__ == "__main__":
    main()
