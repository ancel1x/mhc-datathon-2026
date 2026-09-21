"""Step 07: merge the second (independent) analysis pipeline's validated evidence into the bundle.

Reads the map-ready CSVs in data/reference/second_pipeline/ and adds, WITHOUT removing anything the existing
steps wrote:

* bt_facilities.geojson  -> props.evidence  {mta_facility_id, full_year{pct, ci, status, matched days, peak windows},
                                            jan_aug{2025, 2026}, persistence, limitation}
* aq_monitors.geojson    -> props.evidence  {full_year{months, raw, adjusted, class, coverage}, jan_aug{2025, 2026},
                                            persistence, context}, plus the four-class `evidence_class`
* summary.json           -> summary.reconciled  (compact lists the story reads: traffic, air, counts, South Bronx,
                                                 persistence highlights, DOT tiers, method notes)

Definitions and every reconciliation decision are written up in DATA_RECONCILIATION.md at the repo root.
"""
from __future__ import annotations

import csv
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import config as C  # noqa: E402
from pipeline.common import load_geojson, log, read_json, rnd, write_json  # noqa: E402
from pipeline.s02_bt_crossings import FACILITIES  # noqa: E402

REF = C.DATA_DIR / "reference" / "second_pipeline"
NAME_TO_ID = {name: v[0] for name, v in FACILITIES.items()}
SOUTH_BRONX = ["36005NY11534", "36005NY12387", "36005NY11790"]   # Mott Haven, Cross Bronx, Hunts Point
MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
# NYCCAS "Midtown-DOT" is the W 39th St site; the analysis team calls it Midtown West and uses its original
# coordinates (it moved 50 m on 2026-07-23). Display name follows the team; the source name is kept.
DISPLAY_NAMES = {"36061NY09929": "Midtown West"}


# ----------------------------------------------------------------------------- helpers
def num(v):
    if v is None:
        return None
    s = str(v).strip()
    if s == "" or s.lower() in ("nan", "none"):
        return None
    try:
        return float(s)
    except ValueError:
        return None


def r2(v):
    return rnd(num(v), 2)


def months_list(v) -> list[str]:
    s = "" if v is None else str(v).strip()
    if not s or s.lower() == "nan":
        return []
    return [f"{int(float(x)):02d}" for x in s.split(",") if x.strip()]


def month_names(mm: list[str]) -> list[str]:
    return [MONTH_ABBR[int(m) - 1] for m in mm if 1 <= int(m) <= 12]


def status_from_ci(lo, hi, limited=False):
    if limited:
        return "limited"
    if lo is None or hi is None:
        return None
    if lo > 0:
        return "increase"
    if hi < 0:
        return "decrease"
    return "uncertain"


def traffic_status(text: str, coverage: str) -> str:
    t = (text or "").lower()
    if "limited" in (coverage or "").lower() or "selected" in (coverage or "").lower():
        return "limited"
    if t.startswith("increase"):
        return "increase"
    if t.startswith("decrease"):
        return "decrease"
    return "uncertain"


def air_raw_status(text: str) -> str:
    t = (text or "").lower()
    if "not estimated" in t or t == "":
        return "no_baseline"
    if t.startswith("decrease"):
        return "decrease"
    if t.startswith("increase"):
        return "increase"
    return "uncertain"


def air_adj_status(text: str):
    t = (text or "").lower()
    if not t or "not estimated" in t:
        return None
    if "adjusted decrease" in t:
        return "decrease"
    if "adjusted increase" in t:
        return "increase"
    return "uncertain"


def air_evidence_status(text: str):
    """jan_aug file: change_evidence / adjusted_evidence phrasing."""
    t = (text or "").lower()
    if not t or "not estimated" in t:
        return None
    if "no matched baseline" in t:
        return "no_baseline"
    if "below zero" in t or "adjusted decrease" in t:
        return "decrease"
    if "above zero" in t or "adjusted increase" in t:
        return "increase"
    return "uncertain"


def read_csv(name: str) -> list[dict]:
    with open(REF / name, encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


# ----------------------------------------------------------------------------- traffic
def traffic_evidence() -> dict[str, dict]:
    full = read_csv("full_year_2024_2025_traffic.csv")
    ja = read_csv("jan_aug_2024_2025_2026_traffic.csv")
    ja_by = {(r["Facility"], r["comparison_year"]): r for r in ja}
    out = {}
    for r in full:
        fid = NAME_TO_ID.get(r["Facility"])
        if not fid:
            log(f"  WARNING: facility '{r['Facility']}' not in the existing facility list; skipped")
            continue
        limited = "limited" in r["coverage_status"].lower()
        status = traffic_status(r["uncertainty_status"], r["coverage_status"])

        def window(prefix):
            lo, hi = num(r[f"{prefix}_ci_low_pct"]), num(r[f"{prefix}_ci_high_pct"])
            return {"pct": r2(r[f"{prefix}_change_pct"]), "ci_low": rnd(lo, 2), "ci_high": rnd(hi, 2),
                    "status": status_from_ci(lo, hi, limited and prefix == "other_hours"),
                    "n_2024": int(num(r[f"{prefix}_pre_observations"]) or 0), "n_2025": int(num(r[f"{prefix}_post_observations"]) or 0)}

        def jan_aug(year):
            lo, hi = num(r[f"jan_aug_{year}_ci_low_pct"]), num(r[f"jan_aug_{year}_ci_high_pct"])
            row = ja_by.get((r["Facility"], str(year)), {})
            return {"pct": r2(r[f"jan_aug_{year}_change_pct"]), "ci_low": rnd(lo, 2), "ci_high": rnd(hi, 2),
                    "status": status_from_ci(lo, hi, limited), "months": months_list(r[f"jan_aug_{year}_months"]),
                    "days_2024": int(num(row.get("pre_days")) or 0), f"days_{year}": int(num(row.get("post_days")) or 0)}

        out[fid] = {
            "mta_facility_id": int(num(r["Facility ID"]) or 0),
            "source": "second_pipeline/full_year_2024_2025_traffic.csv",
            "full_year": {
                "frame": "Jan 5–Dec 31, 2024 vs 2025",
                "pre_mean": rnd(num(r["pre_mean"]), 0), "post_mean": rnd(num(r["post_mean"]), 0),
                "pct": r2(r["change_pct"]), "ci_low": r2(r["ci_low_pct"]), "ci_high": r2(r["ci_high_pct"]),
                "status": status, "interval_method": r["interval_method"],
                "matched_days_2024": int(num(r["pre_days"]) or 0), "matched_days_2025": int(num(r["post_days"]) or 0),
                "complete_days_2024": int(num(r["complete_days_2024"]) or 0), "complete_days_2025": int(num(r["complete_days_2025"]) or 0),
                "expected_days": int(num(r["expected_days_2024"]) or 0),
                "matched_weekdays": [w.strip() for w in r["matched_weekdays"].split(",") if w.strip()],
                "coverage_status": r["coverage_status"],
                "peak": {"am": window("am_rush"), "pm": window("pm_rush"), "other": window("other_hours")},
                "peak_definition": "weekday AM 07:00–09:59 and PM 16:00–18:59 on complete days; other hours include weekends",
            },
            "jan_aug": {"2025": jan_aug(2025), "2026": jan_aug(2026)},
            "persistence": r["persistence_classification"] or "inconclusive",
            "full_vs_jan_aug": r["full_vs_jan_aug_classification"] or "inconclusive",
            "limitation": r["limitation_flag"],
            "geometry_note": r["notes"],
            "unit": r["metric"],
        }
    return out


# ----------------------------------------------------------------------------- air
def air_evidence() -> dict[str, dict]:
    full = read_csv("full_year_2024_2025_air.csv")
    ja = read_csv("jan_aug_2024_2025_2026_air.csv")
    ja_by = {(r["SiteID"], r["comparison_year"]): r for r in ja}
    out = {}
    for r in full:
        sid = r["SiteID"]
        raw_status = air_raw_status(r["uncertainty_status"])
        adj_status = air_adj_status(r["adjusted_uncertainty_status"])
        cls = "no_baseline" if raw_status == "no_baseline" else (adj_status or raw_status)
        mm = months_list(r["months"])

        def jan_aug(year):
            row = ja_by.get((sid, str(year)))
            if not row:
                return None
            rs = air_evidence_status(row["change_evidence"])
            adj = air_evidence_status(row["adjusted_evidence"])
            months = months_list(row["months"])
            k = "no_baseline" if rs in (None, "no_baseline") or not months else (adj or rs)
            return {
                "months": months, "month_names": month_names(months),
                "pre_mean": r2(row["pre_pm25"]), "post_mean": r2(row["post_pm25"]),
                "delta_raw": r2(row["change_ug_m3"]), "pct_raw": r2(row["change_pct"]),
                "ci_low": r2(row["ci_low"]), "ci_high": r2(row["ci_high"]), "raw_status": rs or "no_baseline",
                "adj_delta": r2(row["adjusted_change_ug_m3"]), "adj_ci_low": r2(row["adjusted_ci_low"]), "adj_ci_high": r2(row["adjusted_ci_high"]),
                "adj_status": adj, "class": k,
                "days_2024": int(num(row["pre_days"]) or 0), f"days_{year}": int(num(row["post_days"]) or 0),
                "note": row["station_comparability"] if "relocation" in (row["station_comparability"] or "") else None,
            }

        out[sid] = {
            "source": "second_pipeline/full_year_2024_2025_air.csv",
            "display_name": DISPLAY_NAMES.get(sid),   # None = keep the existing NYCCAS name
            "second_pipeline_name": r["Location"],
            "geometry": {"lat": num(r["latitude"]), "lon": num(r["longitude"]), "status": r["geometry_status"]},
            "full_year": {
                "frame": "Jan 5–Dec 31, 2024 vs 2025 (eligible matched months)",
                "months": mm, "month_names": month_names(mm), "month_count": len(mm),
                "pre_mean": r2(r["pre_pm25"]), "post_mean": r2(r["post_pm25"]),
                "delta_raw": r2(r["change_ug_m3"]), "pct_raw": r2(r["change_pct"]),
                "ci_low": r2(r["ci_low"]), "ci_high": r2(r["ci_high"]), "raw_status": raw_status,
                "adj_delta": r2(r["adjusted_change_ug_m3"]), "adj_ci_low": r2(r["adjusted_ci_low"]), "adj_ci_high": r2(r["adjusted_ci_high"]),
                "adj_status": adj_status, "q_value": rnd(num(r["q_value_bh"]), 3),
                "class": cls,
                "coverage_status": r["coverage_status"],
                "days_2024": int(num(r["pre_days"]) or 0), "days_2025": int(num(r["post_days"]) or 0),
                "completeness_2024": rnd(num(r["completeness_pct_2024"]), 1), "completeness_2025": rnd(num(r["completeness_pct_2025"]), 1),
                "eligible_months_2024": int(num(r["eligible_month_count_2024"]) or 0), "eligible_months_2025": int(num(r["eligible_month_count_2025"]) or 0),
                "interval_method": r["source_method"],
                "adjustment": "regression on a regional weather proxy; Benjamini–Hochberg across monitors",
            },
            "jan_aug": {"2025": jan_aug(2025), "2026": jan_aug(2026)},
            "persistence": r["persistence_classification"] or "inconclusive",
            "persistence_adjusted": r["adjusted_persistence_classification"] or "inconclusive",
            "full_vs_jan_aug": r["full_vs_jan_aug_classification"] or "inconclusive",
            "limitation": r["limitation_flag"],
            "context": {
                "uhf42_id": r["uhf42_id"], "neighborhood": r["neighborhood"], "nta": r["nta_name"],
                "inside_geofence": r["inside_congestion_geofence"].strip().lower() == "true",
                "poverty_pct": r2(r["poverty_pct"]), "poverty_period": r["poverty_pct_reference_period"],
                "child_asthma_ed": r2(r["child_asthma_ed_rate"]), "adult_asthma_ed": r2(r["adult_asthma_ed_rate"]),
                "asthma_period": r["child_asthma_ed_rate_reference_period"],
                "asthma_unit": "ED visits per 10,000 residents (children ages 5–17; adults age-adjusted)",
                "interpretation": r["exposure_interpretation"],
            },
        }
    return out


# ----------------------------------------------------------------------------- DOT tiers (existing pipeline)
def dot_tiers(dot_fc: dict) -> dict:
    matched = [f["properties"] for f in dot_fc["features"] if f["properties"].get("role") == "matched"]
    same_2024 = [p for p in matched if p.get("comparison_kind") == "same_month" and (p.get("pre_months") or [""])[0].startswith("2024")]
    same_older = [p for p in matched if p.get("comparison_kind") == "same_month" and p not in same_2024]
    other = [p for p in matched if p.get("comparison_kind") != "same_month"]
    row = lambda p: {"id": p["id"], "street": p["street"], "name": p["name"], "boro": p["boro"], "pre_adv": p["pre_adv"],  # noqa: E731
                     "post_adv": p["post_adv"], "pct_change": p["pct_change"], "pre_months": p["pre_months"], "post_months": p["post_months"],
                     "uhf42_name": p.get("uhf42_name"), "dac_designated": p.get("dac_designated")}
    return {
        "strict_result": "The independent matched-month analysis found no eligible repeated street comparisons, so there is no citywide street-level change estimate.",
        "matched_total": len(matched), "on_map": len(dot_fc["features"]),
        "tiers": {
            "same_month_2024": {"label": "same calendar month, 2024 baseline", "rows": sorted((row(p) for p in same_2024), key=lambda x: x["pct_change"])},
            "same_month_older": {"label": "same calendar month, older baseline", "rows": sorted((row(p) for p in same_older), key=lambda x: x["pct_change"])},
            "different_month": {"label": "different months or years", "rows": sorted((row(p) for p in other), key=lambda x: x["pct_change"])},
        },
        "post_only_context": [
            {"id": p["id"], "street": p["street"], "latest_adv": p["latest_adv"], "months": p["months"], "uhf42_name": p.get("uhf42_name")}
            for p in (f["properties"] for f in dot_fc["features"])
            if p.get("role") == "post_only" and any(k in (p.get("street") or "") for k in ("DEEGAN", "BRUCKNER", "MDE NB"))
        ],
        "sampling_note": "NYC DOT automated counts are one-week samples at rotating locations; a pair compares one sample with another.",
    }


# ----------------------------------------------------------------------------- main
def main() -> None:
    B = C.BUNDLE_DIR
    bt_fc = load_geojson(B / "bt_facilities.geojson")
    aq_fc = load_geojson(B / "aq_monitors.geojson")
    dot_fc = load_geojson(B / "dot_segments.geojson")
    summary = read_json(B / "summary.json")

    tev = traffic_evidence()
    aev = air_evidence()

    # ---- facilities
    traffic_rows = []
    for f in bt_fc["features"]:
        p = f["properties"]
        ev = tev.get(p["id"])
        p["evidence"] = ev
        if not ev:
            log(f"  WARNING: no second-pipeline row for facility {p['id']}")
            continue
        fy = ev["full_year"]
        traffic_rows.append({
            "id": p["id"], "name": p["name"], "role": p.get("role"), "dac_designated": p.get("dac_designated"), "uhf42_name": p.get("uhf42_name"),
            "avg_daily_2024": (p["periods"].get("pre_2024") or {}).get("avg_daily"), "avg_daily_2025": (p["periods"].get("post_2025") or {}).get("avg_daily"),
            "pct_existing": p["change"].get("pct_2025_vs_2024"), "pct": fy["pct"], "ci_low": fy["ci_low"], "ci_high": fy["ci_high"], "status": fy["status"],
            "matched_days": [fy["matched_days_2024"], fy["matched_days_2025"]], "matched_weekdays": fy["matched_weekdays"],
            "peak": {k: {"pct": v["pct"], "ci_low": v["ci_low"], "ci_high": v["ci_high"], "status": v["status"]} for k, v in fy["peak"].items()},
            "jan_aug": {y: {"pct": j["pct"], "ci_low": j["ci_low"], "ci_high": j["ci_high"], "status": j["status"]} for y, j in ev["jan_aug"].items()},
            "pct_2026ytd_existing": p["change"].get("pct_2026ytd_vs_2024ytd"),
            "persistence": ev["persistence"], "full_vs_jan_aug": ev["full_vs_jan_aug"],
        })
    joined_t = sum(1 for f in bt_fc["features"] if f["properties"].get("evidence"))

    # ---- monitors
    air_rows = []
    for f in aq_fc["features"]:
        p = f["properties"]
        ev = aev.get(p["site_id"])
        p["evidence"] = ev
        p["source_name"] = p.get("source_name") or p["name"]   # idempotent on re-runs
        p["name"] = p["source_name"]
        if ev:
            if ev["display_name"]:
                p["name"] = ev["display_name"]
            g = ev["geometry"]
            if g["lat"] is not None and g["lon"] is not None and "original" in (g["status"] or ""):
                f["geometry"]["coordinates"] = [g["lon"], g["lat"]]
                p["geometry_note"] = "documented original coordinates (site moved 2026-07-23)"
            p["evidence_class"] = ev["full_year"]["class"]
        else:
            p["evidence_class"] = "no_baseline" if p.get("classification") == "insufficient" else None
            if p["evidence_class"] is None:
                log(f"  WARNING: monitor {p['site_id']} has a comparison but no second-pipeline row")
        c = (p.get("comparisons") or {}).get("post_2025_vs_pre_2024") or {}
        fy = (ev or {}).get("full_year") or {}
        air_rows.append({
            "id": p["id"], "site_id": p["site_id"], "name": p["name"], "crz_status": p.get("crz_status"), "role": p.get("role"),
            "dac_designated": p.get("dac_designated"), "uhf42_name": p.get("uhf42_name"), "uhf42_asthma_ed_children": p.get("uhf42_asthma_ed_children"),
            "uhf42_poverty_pct": p.get("uhf42_poverty_pct"),
            "class": p["evidence_class"], "months": fy.get("months", []), "month_names": fy.get("month_names", []), "month_count": fy.get("month_count", 0),
            "pre_mean": fy.get("pre_mean"), "post_mean": fy.get("post_mean"), "delta_raw": fy.get("delta_raw"), "pct_raw": fy.get("pct_raw"),
            "ci_low": fy.get("ci_low"), "ci_high": fy.get("ci_high"), "raw_status": fy.get("raw_status"),
            "adj_delta": fy.get("adj_delta"), "adj_ci_low": fy.get("adj_ci_low"), "adj_ci_high": fy.get("adj_ci_high"), "adj_status": fy.get("adj_status"),
            "coverage_status": fy.get("coverage_status"),
            "existing": {"pre_mean": c.get("pre_mean"), "post_mean": c.get("post_mean"), "delta_raw": c.get("delta_raw"),
                         "delta_adj_control": c.get("delta_adj_control"), "relative_to_control": c.get("relative_to_control"), "classification": c.get("classification")},
            "jan_aug": {y: ({"class": j["class"], "delta_raw": j["delta_raw"], "adj_delta": j["adj_delta"], "ci_low": j["ci_low"], "ci_high": j["ci_high"],
                             "adj_ci_low": j["adj_ci_low"], "adj_ci_high": j["adj_ci_high"], "pct_raw": j["pct_raw"]} if j else None)
                        for y, j in ((ev or {}).get("jan_aug") or {}).items()},
            "persistence": (ev or {}).get("persistence", "inconclusive"), "persistence_adjusted": (ev or {}).get("persistence_adjusted", "inconclusive"),
            "context": (ev or {}).get("context"),
        })
    joined_a = sum(1 for f in aq_fc["features"] if f["properties"].get("evidence"))

    # ---- summary block
    def count(rows, key, values):
        return {v: sum(1 for r in rows if r.get(key) == v) for v in values}

    order = {"decrease": 0, "uncertain": 1, "increase": 2, "no_baseline": 3, None: 4}
    air_rows.sort(key=lambda r: (order.get(r["class"], 4), r["adj_delta"] if r["adj_delta"] is not None else 0))
    traffic_rows.sort(key=lambda r: -(r["pct"] or 0))
    persistence = []
    for r in traffic_rows:
        if r["persistence"] in ("reversed", "strengthened", "confirmed", "weakened"):
            persistence.append({"kind": "traffic", "id": r["id"], "name": r["name"], "label": r["persistence"],
                                "y2025": r["jan_aug"]["2025"]["pct"], "y2026": r["jan_aug"]["2026"]["pct"], "unit": "%"})
    strong = ("reversed", "strengthened", "confirmed")
    for r in air_rows:
        # the raw classification is the reference label (e.g. Van Wyck "confirmed"); the weather-adjusted one is kept beside it
        use_adj = r["persistence"] not in strong and r["persistence_adjusted"] in strong
        lab = r["persistence_adjusted"] if use_adj else r["persistence"]
        if lab in strong:
            j25, j26 = r["jan_aug"].get("2025") or {}, r["jan_aug"].get("2026") or {}
            persistence.append({"kind": "air", "id": r["id"], "name": r["name"], "label": lab, "basis": "weather-adjusted" if use_adj else "raw",
                                "label_raw": r["persistence"], "label_adjusted": r["persistence_adjusted"],
                                "y2025": j25.get("adj_delta") if use_adj else j25.get("delta_raw"),
                                "y2026": j26.get("adj_delta") if use_adj else j26.get("delta_raw"), "unit": "µg/m³"})

    summary["reconciled"] = {
        "generated": date.today().isoformat(),
        "frames": {
            "primary": {"label": "Jan 5–Dec 31, 2024 vs 2025", "note": "Year One comparison; February 29 excluded"},
            "secondary": {"label": "Jan 5–Aug 31: 2024 vs 2025 vs 2026", "note": "persistence only; 2026 is not a complete year"},
        },
        "traffic": traffic_rows,
        "traffic_counts": count(traffic_rows, "status", ["increase", "decrease", "uncertain", "limited"]),
        "traffic_peak_definition": "weekday AM 07:00–09:59 and PM 16:00–18:59; other hours include weekends",
        "air": air_rows,
        "air_counts": count(air_rows, "class", ["decrease", "uncertain", "increase", "no_baseline"]),
        "air_full_coverage_ids": [r["id"] for r in air_rows if r["month_count"] == 12],
        "south_bronx": [r for sid in SOUTH_BRONX for r in air_rows if r["site_id"] == sid],
        "persistence_highlights": persistence,
        "dot": dot_tiers(dot_fc),
        "methods": {
            "traffic": "standardized vehicles per complete day, equal month × weekday weights; 95% seven-day-cluster bootstrap (200 draws)",
            "air_raw": "equal-weight eligible matched-month means; 95% interval from 400 within-month seven-day block draws",
            "air_adjusted": "regression on a regional weather proxy; Benjamini–Hochberg correction across monitors",
            "air_control": "existing pipeline: difference against DOHMH's Van Wyck control site on shared months (descriptive, no interval)",
            "causal": "all results are associations; none identifies a causal congestion-pricing effect or tracked rerouting",
        },
        "external_context": {
            "headline_22pct": "Cornell University, npj Clean Air (Dec 2025): a modeled 22% drop in daily-maximum PM2.5 inside the zone (Jan–Jun 2025) against a projected no-toll level; MTA reports entry declines against a modeled baseline. Neither is this project's result.",
            "url": "https://news.cornell.edu/stories/2025/12/congestion-pricing-improved-air-quality-nyc-and-suburbs",
        },
    }

    write_json(bt_fc, B / "bt_facilities.geojson")
    write_json(aq_fc, B / "aq_monitors.geojson")
    write_json(summary, B / "summary.json", indent=1)
    C.FRONTEND_DATA_DIR.mkdir(parents=True, exist_ok=True)
    for name in ("bt_facilities.geojson", "aq_monitors.geojson", "summary.json"):
        (C.FRONTEND_DATA_DIR / name).write_bytes((B / name).read_bytes())
    rc = summary["reconciled"]
    log(f"step 07 done: evidence joined to {joined_t}/{len(bt_fc['features'])} facilities and {joined_a}/{len(aq_fc['features'])} monitors; "
        f"traffic {rc['traffic_counts']}, air {rc['air_counts']}, persistence highlights {len(persistence)}")


if __name__ == "__main__":
    main()
