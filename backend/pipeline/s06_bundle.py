"""Step 06: join equity context onto every point layer, compute headline numbers, write the frontend bundle."""
from __future__ import annotations

import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import config as C  # noqa: E402
from pipeline.common import PolygonLocator, feature, feature_collection, load_geojson, log, read_json, rnd, write_json  # noqa: E402

PERIOD_LABELS = {
    "pre_2023": "2023", "pre_2024": "2024 (baseline)", "post_2025": "2025 (year one)",
    "post_2026_ytd": "2026 Jan–Aug", "ytd_2024": "2024 Jan 5–Aug 31", "ytd_2025": "2025 Jan 5–Aug 31",
}
SOUTH_BRONX_SITES = {"36005NY11534", "36005NY11790", "36005NY12387"}   # Mott Haven, Hunts Point, Cross Bronx

SOURCES = [
    {"name": "MTA Congestion Relief Zone Vehicle Entries: Beginning 2025", "publisher": "MTA",
     "portal": "NY State Open Data", "dataset_id": "t6yz-b64h",
     "url": "https://data.ny.gov/Transportation/MTA-Congestion-Relief-Zone-Vehicle-Entries-Beginni/t6yz-b64h",
     "used_for": "Entries into the zone by crossing, vehicle class and 10-minute interval (Jan 5 2025 onward)"},
    {"name": "Automated Traffic Volume Counts", "publisher": "NYC DOT", "portal": "NYC Open Data", "dataset_id": "7ym2-wayt",
     "url": "https://data.cityofnewyork.us/Transportation/Automated-Traffic-Volume-Counts/7ym2-wayt",
     "used_for": "15-minute street and bridge counts; matched before/after locations"},
    {"name": "MTA Bridges and Tunnels Hourly Crossings: Beginning 2019", "publisher": "MTA Bridges & Tunnels",
     "portal": "NY State Open Data", "dataset_id": "ebfx-2m7v",
     "url": "https://data.ny.gov/Transportation/MTA-Bridges-and-Tunnels-Hourly-Crossings-Beginning/ebfx-2m7v",
     "used_for": "Hourly crossings at the nine tolled MTA bridges and tunnels, 2023–2026"},
    {"name": "MTA Central Business District Geofence", "publisher": "MTA", "portal": "NY State Open Data", "dataset_id": "srxy-5nxn",
     "url": "https://data.ny.gov/Transportation/MTA-Central-Business-District-Geofence-Beginning-J/srxy-5nxn",
     "used_for": "Official zone boundary polygon"},
    {"name": "NYCCAS Real-Time PM2.5 (hourly street-level monitors)", "publisher": "NYC Dept. of Health & Mental Hygiene + Queens College",
     "portal": "NYC DOHMH open archive (github.com/nychealth/nyccas-data)", "dataset_id": "nyccas-data",
     "url": "https://github.com/nychealth/nyccas-data",
     "used_for": "Hourly PM2.5 at ~16 monitors inside and outside the zone, 2023–2026"},
    {"name": "Air Quality (NYCCAS annual neighborhood indicators)", "publisher": "NYC DOHMH", "portal": "NYC Open Data", "dataset_id": "c3uy-2p5r",
     "url": "https://data.cityofnewyork.us/Environment/Air-Quality/c3uy-2p5r",
     "used_for": "Annual PM2.5 by neighborhood 2009–2024; asthma ED visits attributable to PM2.5"},
    {"name": "Asthma emergency department visits (children 5–17, 2023) and poverty (ACS 2019–23) by neighborhood",
     "publisher": "NYC DOHMH", "portal": "NYC Environment & Health Data Portal", "dataset_id": "asthma / poverty indicators (UHF42)",
     "url": "https://a816-dohbesp.nyc.gov/IndicatorPublic/data-explorer/asthma/",
     "used_for": "Neighborhood asthma burden before the toll; 2023 is the newest year published (health data lag ~2 years)"},
    {"name": "Final Disadvantaged Communities (DAC) 2023", "publisher": "NYS Climate Justice Working Group / NYSERDA",
     "portal": "NY State Open Data", "dataset_id": "2e6c-s6fp",
     "url": "https://data.ny.gov/Energy-Environment/Final-Disadvantaged-Communities-DAC-2023/2e6c-s6fp",
     "used_for": "Census-tract environmental-justice designation and burden percentiles"},
    {"name": "NYC geography (UHF42, boroughs)", "publisher": "NYC DOHMH Environmental Health", "portal": "github.com/nycehs/NYC_geography",
     "dataset_id": "NYC_geography", "url": "https://github.com/nycehs/NYC_geography", "used_for": "Neighborhood and borough boundaries"},
    {"name": "Congestion Relief Zone toll rates", "publisher": "MTA", "portal": "mta.info", "dataset_id": "-",
     "url": C.TOLLS["source"], "used_for": "Toll structure, peak/overnight schedule, crossing credits"},
]


class Context:
    def __init__(self):
        self.dac = PolygonLocator(load_geojson(C.PROCESSED_DIR / "dac_tracts.geojson")["features"])
        self.uhf = PolygonLocator(load_geojson(C.PROCESSED_DIR / "uhf42.geojson")["features"])

    def enrich(self, lon, lat) -> dict:
        d = self.dac.locate(lon, lat) if lon is not None else None
        u = self.uhf.locate(lon, lat) if lon is not None else None
        return {
            "dac_designated": d["dac"] if d else None,
            "dac_combined_pct": d["combined_pct"] if d else None,
            "dac_asthma_pct": d["asthma_pct"] if d else None,
            "uhf42_code": u["uhf_code"] if u else None,
            "uhf42_name": u["name"] if u else None,
            "uhf42_asthma_ed_pm25_children": u["asthma_ed_pm25_children"] if u else None,
            "uhf42_asthma_ed_children": u.get("asthma_ed_children") if u else None,
            "uhf42_poverty_pct": u.get("poverty_pct") if u else None,
            "uhf42_pm25_2024": u["pm25_2024"] if u else None,
        }


def to_point_fc(items: list[dict], ctx: Context) -> dict:
    feats = []
    for it in items:
        lon, lat = it.get("lon"), it.get("lat")
        if lon is None or lat is None:
            continue
        props = {k: v for k, v in it.items() if k not in ("lon", "lat")}
        props.update(ctx.enrich(lon, lat))
        feats.append(feature(lon, lat, props))
    return feature_collection(feats)


def top_n(items, key, n=5, reverse=True):
    vals = [i for i in items if key(i) is not None]
    return sorted(vals, key=key, reverse=reverse)[:n]


def main() -> None:
    ctx = Context()
    crz = read_json(C.PROCESSED_DIR / "crz_entries.json")
    bt = read_json(C.PROCESSED_DIR / "bt_crossings.json")
    dot = read_json(C.PROCESSED_DIR / "dot_counts.json")
    aq = read_json(C.PROCESSED_DIR / "air_quality.json")
    B = C.BUNDLE_DIR
    B.mkdir(parents=True, exist_ok=True)

    # ---- point layers with equity context
    crz_fc = to_point_fc(crz["points"], ctx)
    bt_fc = to_point_fc(bt["facilities"], ctx)
    aq_fc = to_point_fc(aq["monitors"], ctx)
    dot_feats = []
    for f in dot["features"]:
        lon, lat = f["geometry"]["coordinates"]
        f["properties"].update(ctx.enrich(lon, lat))
        dot_feats.append(f)
    dot_fc = feature_collection(dot_feats)
    dot_matched = []
    for m in dot["matched"]:
        m.update(ctx.enrich(m["lon"], m["lat"]))
        dot_matched.append(m)

    write_json(crz_fc, B / "crz_entry_points.geojson")
    write_json(crz["series"], B / "crz_series.json")
    write_json(bt_fc, B / "bt_facilities.geojson")
    write_json(bt["series"], B / "bt_series.json")
    write_json(dot_fc, B / "dot_segments.geojson")
    write_json(dot_matched, B / "dot_matched.json")
    write_json(aq_fc, B / "aq_monitors.geojson")
    write_json(aq["series"], B / "aq_series.json")
    for name in ("dac_tracts.geojson", "uhf42.geojson", "boroughs.geojson", "crz_zone.geojson"):
        shutil.copyfile(C.PROCESSED_DIR / name, B / name)
    write_json(C.TOLLS, B / "tolls.json", indent=1)
    write_json(SOURCES, B / "sources.json", indent=1)

    # ---- summary numbers -------------------------------------------------------------
    sp = crz["system"]["periods"]
    p25, p26, y25 = sp.get("post_2025") or {}, sp.get("post_2026_ytd") or {}, sp.get("ytd_2025") or {}
    entry_pts = [f["properties"] for f in crz_fc["features"]]
    total_wd = sum((e["periods"].get("post_2025") or {}).get("avg_weekday_entries") or 0 for e in entry_pts) or 1
    top_pts = top_n(entry_pts, lambda e: (e["periods"].get("post_2025") or {}).get("avg_weekday_entries"), 5)
    crz_summary = {
        "first_date": crz["first_date"], "last_date": crz["last_date"], "days_covered": crz["days_covered"],
        "avg_weekday_entries_2025": p25.get("avg_weekday_entries"), "avg_weekday_entries_2026ytd": p26.get("avg_weekday_entries"),
        "avg_weekend_entries_2025": p25.get("avg_weekend_entries"),
        "yoy_weekday_pct": crz["system"]["change"].get("weekday_pct_2026ytd_vs_2025ytd"),
        "yoy_pct": crz["system"]["change"].get("pct_2026ytd_vs_2025ytd"),
        "peak_share_2025": p25.get("peak_share"),
        "overnight_share_2025": rnd(1 - p25["peak_share"], 4) if p25.get("peak_share") is not None else None,
        "excluded_share_2025": p25.get("excluded_share"), "class_mix_2025": p25.get("class_mix"),
        "trucks_avg_daily_2025": p25.get("trucks_avg_daily"),
        "trucks_yoy_pct": crz["system"]["change"].get("trucks_pct_2026ytd_vs_2025ytd"),
        "hourly_weekday_2025": p25.get("hourly_weekday"), "hourly_weekday_2026ytd": p26.get("hourly_weekday"),
        "hourly_weekend_2025": p25.get("hourly_weekend"),
        "top_entry_points_2025": [{"id": e["id"], "name": e["name"],
                                   "avg_weekday_entries": e["periods"]["post_2025"]["avg_weekday_entries"],
                                   "share": rnd(e["periods"]["post_2025"]["avg_weekday_entries"] / total_wd, 3)} for e in top_pts],
    }

    fac = [f["properties"] for f in bt_fc["features"]]
    bsp = bt["system"]["periods"]
    ups = [f for f in fac if (f["change"].get("pct_2025_vs_2024") or 0) > 0]
    downs = [f for f in fac if (f["change"].get("pct_2025_vs_2024") or 0) < 0]
    fmt_f = lambda f: {"id": f["id"], "name": f["name"], "pct_2025_vs_2024": f["change"].get("pct_2025_vs_2024"),  # noqa: E731
                       "trucks_pct_2025_vs_2024": f["change"].get("trucks_pct_2025_vs_2024"), "role": f["role"],
                       "dac_designated": f.get("dac_designated"), "avg_daily_2025": (f["periods"].get("post_2025") or {}).get("avg_daily")}
    bt_summary = {
        "first_date": bt["first_date"], "last_date": bt["last_date"],
        "system_avg_daily_2024": (bsp.get("pre_2024") or {}).get("avg_daily"),
        "system_avg_daily_2025": (bsp.get("post_2025") or {}).get("avg_daily"),
        "system_pct_2025_vs_2024": bt["system"]["change"].get("pct_2025_vs_2024"),
        "system_pct_2026ytd_vs_2024ytd": bt["system"]["change"].get("pct_2026ytd_vs_2024ytd"),
        "trucks_pct_2025_vs_2024": bt["system"]["change"].get("trucks_pct_2025_vs_2024"),
        "trucks_pct_2026ytd_vs_2024ytd": bt["system"]["change"].get("trucks_pct_2026ytd_vs_2024ytd"),
        "facilities_up": [fmt_f(f) for f in sorted(ups, key=lambda f: -f["change"]["pct_2025_vs_2024"])],
        "facilities_down": [fmt_f(f) for f in sorted(downs, key=lambda f: f["change"]["pct_2025_vs_2024"])],
        "facilities_trucks_up": [fmt_f(f) for f in fac if (f["change"].get("trucks_pct_2025_vs_2024") or 0) > 0],
        "facilities_up_in_dac": sum(1 for f in ups if f.get("dac_designated")),
        "facilities_up_total": len(ups), "facilities_total": len(fac),
    }

    matched = [m for m in dot_matched if m.get("pct_change") is not None]
    dot_summary = {
        "segments_on_map": len(dot_feats),
        "matched_segments": len(matched),
        "post_only_segments": sum(1 for f in dot_feats if f["properties"]["role"] == "post_only"),
        "pre_only_segments": sum(1 for f in dot_feats if f["properties"]["role"] == "pre_only"),
        "matched_up": sum(1 for m in matched if m["pct_change"] > 0),
        "matched_down": sum(1 for m in matched if m["pct_change"] < 0),
        "matched_same_month": sum(1 for m in matched if m["comparison_kind"] == "same_month"),
        "highlights": [{k: m.get(k) for k in ("segment_id", "id", "street", "name", "boro", "pre_adv", "post_adv", "pct_change",
                                                "pre_months", "post_months", "comparison_kind", "dac_designated", "uhf42_name")}
                       for m in sorted(matched, key=lambda m: -abs(m["pct_change"]))],
    }

    mons = [f["properties"] for f in aq_fc["features"]]
    def bucket(sel):
        out = {"improved": 0, "unchanged": 0, "worsened": 0, "insufficient": 0}
        for m in sel:
            out[m["classification"]] = out.get(m["classification"], 0) + 1
        return out
    def site_row(m):
        # before/after CP if possible; otherwise the year-2 vs year-1 trend (no pre-CP baseline, e.g. Hunts Point)
        basis = "post_2025_vs_pre_2024"
        c = m["comparisons"][basis]
        for alt in ("post_2026ytd_vs_ytd_2024", "post_2026ytd_vs_ytd_2025"):
            if c["coverage_ok"]:
                break
            basis, c = alt, m["comparisons"][alt]
        return {"site_id": m["site_id"], "id": m["id"], "name": m["name"], "crz_status": m["crz_status"], "role": m["role"],
                "pre_mean": c["pre_mean"], "post_mean": c["post_mean"], "delta_raw": c["delta_raw"], "pct_raw": c["pct_raw"],
                "delta_adj_control": c["delta_adj_control"], "ci_low": c["ci_low"], "ci_high": c["ci_high"],
                "classification": m["classification"], "months_used": c["months_used"], "basis": basis,
                "relative_to_control": c.get("relative_to_control"), "significant": c.get("significant"),
                "dac_designated": m.get("dac_designated"), "uhf42_name": m.get("uhf42_name"),
                "uhf42_asthma_ed_pm25_children": m.get("uhf42_asthma_ed_pm25_children"),
                "uhf42_asthma_ed_children": m.get("uhf42_asthma_ed_children")}
    ctrl = next((m for m in mons if m["role"] == "control"), None)
    inside = [m for m in mons if m["crz_status"] in ("inside", "boundary")]
    outside = [m for m in mons if m["crz_status"] == "outside"]
    worsened = [m for m in mons if m["classification"] == "worsened"]
    smoke = aq["series"]["smoke_days"]
    def smoke_in(pname):
        s, e = C.PERIODS[pname]
        return sum(1 for d in smoke if s <= d <= e)
    aq_summary = {
        "sites_total": len(mons),
        "sites_with_comparison": sum(1 for m in mons if m["classification"] != "insufficient"),
        "inside": bucket(inside), "outside": bucket(outside),
        "control": site_row(ctrl) if ctrl else None,
        "south_bronx": [site_row(m) for m in mons if m["site_id"] in SOUTH_BRONX_SITES],
        "inside_sites": [site_row(m) for m in inside],
        "outside_sites": [site_row(m) for m in outside],
        "all_sites": [site_row(m) for m in mons],
        "smoke_days_excluded": {p: smoke_in(p) for p in ("pre_2024", "post_2025", "post_2026_ytd")},
        "smoke_days_total": len(smoke),
        "sites_worsened_in_dac": sum(1 for m in worsened if m.get("dac_designated")),
        "sites_worsened_total": len(worsened),
        "citywide_pm25_2009": aq["citywide_pm25"].get("2009"), "citywide_pm25_2024": aq["citywide_pm25"].get("2024"),
        "citywide_pm25_series": aq["citywide_pm25"],
    }

    dac = load_geojson(C.PROCESSED_DIR / "dac_tracts.geojson")["features"]
    pop = sum(f["properties"]["population"] or 0 for f in dac)
    pop_dac = sum(f["properties"]["population"] or 0 for f in dac if f["properties"]["dac"])
    equity = {"nyc_tracts": len(dac), "dac_designated_tracts": sum(1 for f in dac if f["properties"]["dac"]),
              "dac_share": rnd(sum(1 for f in dac if f["properties"]["dac"]) / len(dac), 3),
              "dac_population_share": rnd(pop_dac / pop, 3) if pop else None}

    summary = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "cp_start": C.CP_START,
        "periods": {k: {"label": PERIOD_LABELS.get(k, k), "start": v[0], "end": v[1]} for k, v in C.PERIODS.items()},
        "crz": crz_summary, "bt": bt_summary, "dot": dot_summary, "aq": aq_summary, "equity": equity,
    }
    write_json(summary, B / "summary.json", indent=1)

    # ---- mirror to the frontend
    C.FRONTEND_DATA_DIR.mkdir(parents=True, exist_ok=True)
    for f in B.iterdir():
        shutil.copyfile(f, C.FRONTEND_DATA_DIR / f.name)
    sizes = {f.name: round(f.stat().st_size / 1e6, 2) for f in B.iterdir()}
    log(f"step 06 done: bundle written to {B} and mirrored to {C.FRONTEND_DATA_DIR}; MB = {sizes}")


if __name__ == "__main__":
    main()
