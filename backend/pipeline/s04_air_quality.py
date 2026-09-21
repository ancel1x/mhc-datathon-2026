"""Step 04: NYCCAS real-time hourly PM2.5 -> per-site period stats, control-adjusted before/after, hour profiles.

Also extracts the NYCCAS annual neighborhood (UHF42) PM2.5 surface and asthma-ED indicators from NYC Open Data.
"""
from __future__ import annotations

import calendar
import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import config as C  # noqa: E402
from pipeline.common import (crz_zone_geometry, in_period, inside_crz_status, is_peak, log, pct_change,  # noqa: E402
                             period_bounds, read_json, rnd, write_json)

CONTROL_SITE = "36081NY07615"     # Van Wyck Expy (DOHMH's designated control for congestion pricing)
REFERENCE_SITE = "36081NY09285"   # Queens College (long-running reference site)
MIN_HOURS_PER_DAY = 18
MIN_MONTH_COVERAGE = 0.6
MIN_MONTHS = 3
PERIODS = ["pre_2024", "post_2025", "post_2026_ytd", "ytd_2024", "ytd_2025"]
COMPARISONS = {
    "post_2025_vs_pre_2024": ("pre_2024", "post_2025"),
    "post_2026ytd_vs_ytd_2025": ("ytd_2025", "post_2026_ytd"),
    "post_2026ytd_vs_ytd_2024": ("ytd_2024", "post_2026_ytd"),
}
RNG = np.random.default_rng(42)


# ----------------------------------------------------------------------------- load
def load_hourly() -> pd.DataFrame:
    p = C.PROCESSED_DIR / "aq_hourly.parquet"
    if p.exists():
        return pd.read_parquet(p)
    files = sorted(f for f in (C.EXTERNAL_DIR / "nyccas").glob("*.csv") if f.name != "location.csv")
    df = pd.concat([pd.read_csv(f, usecols=["SiteID", "ObservationTimeUTC", "Value"]) for f in files], ignore_index=True)
    df["Value"] = pd.to_numeric(df["Value"], errors="coerce")
    df = df.dropna(subset=["Value"])
    df = df[df["Value"] >= 0]
    ts = pd.to_datetime(df["ObservationTimeUTC"], utc=True).dt.tz_convert(C.NY_TZ).dt.tz_localize(None)
    df = pd.DataFrame({"site_id": df["SiteID"].astype(str), "ts": ts, "value": df["Value"].astype(float)})
    df["date"] = df["ts"].dt.normalize()
    df["hour"] = df["ts"].dt.hour
    df["weekend"] = df["ts"].dt.dayofweek >= 5
    df["peak"] = is_peak(df["hour"], df["weekend"])
    df = df.drop_duplicates(subset=["site_id", "ts"])
    C.PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    df.to_parquet(p, index=False)
    log(f"  {len(df):,} hourly PM2.5 readings from {df['site_id'].nunique()} sites")
    return df


def load_sites() -> pd.DataFrame:
    loc = pd.read_csv(C.EXTERNAL_DIR / "nyccas" / "location.csv")
    loc["StartTime"] = pd.to_datetime(loc["StartTime"])
    loc["EndTime"] = pd.to_datetime(loc["EndTime"])
    rows = []
    for sid, g in loc.groupby("SiteID"):
        g = g.sort_values("StartTime")
        last = g.iloc[-1]
        rows.append({
            "site_id": str(sid), "name": str(last["Location"]), "address": str(last["Address"]),
            "lat": float(last["Latitude"]), "lon": float(last["Longitude"]),
            "active_from": g["StartTime"].min().strftime("%Y-%m-%d"),
            "active_to": g["EndTime"].max().strftime("%Y-%m-%d"),
            "relocated": bool(len(g) > 1),
            "role": "control" if sid == CONTROL_SITE else ("reference" if sid == REFERENCE_SITE else "site"),
        })
    return pd.DataFrame(rows).set_index("site_id")


# ----------------------------------------------------------------------------- stats
def daily_means(h: pd.DataFrame) -> pd.DataFrame:
    d = h.groupby(["site_id", "date"]).agg(mean=("value", "mean"), n=("value", "size")).reset_index()
    return d[d["n"] >= MIN_HOURS_PER_DAY].copy()


def smoke_days(d: pd.DataFrame) -> set:
    med = d.groupby("date")["mean"].median()
    return set(med[med > C.SMOKE_DAY_THRESHOLD].index)


def month_coverage(dd: pd.DataFrame) -> dict[str, float]:
    """{'YYYY-MM': share of days in that month with a valid daily mean}."""
    out = {}
    for ym, g in dd.groupby(dd["date"].dt.strftime("%Y-%m")):
        y, m = int(ym[:4]), int(ym[5:])
        out[ym] = len(g) / calendar.monthrange(y, m)[1]
    return out


def hour_profiles(h: pd.DataFrame) -> tuple[list, list]:
    out = []
    for wk in (False, True):
        sub = h[h["weekend"] == wk]
        if sub.empty:
            out.append([None] * 24)
            continue
        out.append([rnd(v, 2) for v in sub.groupby("hour")["value"].mean().reindex(range(24)).tolist()])
    return out[0], out[1]


def period_stats(dd: pd.DataFrame, hh: pd.DataFrame, pname: str, smoke: set) -> dict | None:
    s, e = period_bounds(pname)
    d = dd[in_period(dd["date"], pname)]
    if d.empty:
        return None
    n_smoke = int(d["date"].isin(smoke).sum())
    d = d[~d["date"].isin(smoke)]
    h = hh[in_period(hh["date"], pname) & ~hh["date"].isin(smoke)]
    if d.empty:
        return None
    hw, he = hour_profiles(h)
    return {
        "mean": rnd(d["mean"].mean(), 2), "median": rnd(d["mean"].median(), 2), "days": int(len(d)),
        "coverage_pct": rnd(len(d) / (e - s).days * 100, 1),
        "peak_mean": rnd(h.loc[h["peak"], "value"].mean(), 2), "overnight_mean": rnd(h.loc[~h["peak"], "value"].mean(), 2),
        "smoke_days_excluded": n_smoke, "hourly_weekday": hw, "hourly_weekend": he,
    }


def valid_months(dd: pd.DataFrame, pname: str) -> set[str]:
    d = dd[in_period(dd["date"], pname)]
    return {ym[-2:] for ym, cov in month_coverage(d).items() if cov >= MIN_MONTH_COVERAGE}


def period_mean_on_months(dd: pd.DataFrame, pname: str, months: list[str]) -> pd.Series:
    d = dd[in_period(dd["date"], pname)]
    return d[d["date"].dt.strftime("%m").isin(months)]["mean"]


def bootstrap_ci(a: pd.Series, b: pd.Series, n: int = 1000) -> tuple[float | None, float | None]:
    if len(a) < 10 or len(b) < 10:
        return None, None
    a, b = a.to_numpy(), b.to_numpy()
    diffs = RNG.choice(b, (n, len(b))).mean(axis=1) - RNG.choice(a, (n, len(a))).mean(axis=1)
    return rnd(np.percentile(diffs, 2.5), 2), rnd(np.percentile(diffs, 97.5), 2)


def classify(delta: float | None) -> str:
    if delta is None:
        return "insufficient"
    if delta > C.AQ_UNCHANGED_BAND:
        return "worsened"
    if delta < -C.AQ_UNCHANGED_BAND:
        return "improved"
    return "unchanged"


def classify_combined(delta_raw: float | None, delta_adj: float | None) -> tuple[str, str | None]:
    """Conservative before/after class using BOTH the site's own change and its change relative to the control.

    improved  = fell by > band AND fell by > band more than the control (not just the regional trend)
    worsened  = rose by > band in absolute terms, or rose >= 2*band relative to the control without falling itself
    unchanged = everything else; 'relative_to_control' records whether it lagged/beat the control
    """
    if delta_raw is None:
        return "insufficient", None
    if delta_adj is None:
        return classify(delta_raw), None
    band = C.AQ_UNCHANGED_BAND
    rel = "lagged control" if delta_adj >= band else ("beat control" if delta_adj <= -band else "tracked control")
    if delta_raw >= band or (delta_adj >= 2 * band and delta_raw > -band):
        return "worsened", rel
    if delta_raw <= -band and delta_adj <= -band:
        return "improved", rel
    return "unchanged", rel


def compare(dd_site: pd.DataFrame, dd_ctrl: pd.DataFrame | None, dd_ref: pd.DataFrame | None,
            pre: str, post: str, smoke: set, sites: pd.DataFrame) -> dict:
    site = dd_site[~dd_site["date"].isin(smoke)]
    months = sorted(valid_months(site, pre) & valid_months(site, post))
    out = {"months_used": months, "pre_mean": None, "post_mean": None, "delta_raw": None, "pct_raw": None,
           "delta_adj_control": None, "control_site": sites.loc[CONTROL_SITE, "name"] if CONTROL_SITE in sites.index else None,
           "delta_adj_reference": None, "reference_site": sites.loc[REFERENCE_SITE, "name"] if REFERENCE_SITE in sites.index else None,
           "ci_low": None, "ci_high": None, "coverage_ok": len(months) >= MIN_MONTHS, "classification": "insufficient"}
    if not out["coverage_ok"]:
        return out
    a, b = period_mean_on_months(site, pre, months), period_mean_on_months(site, post, months)
    pre_mean, post_mean = float(a.mean()), float(b.mean())
    delta = post_mean - pre_mean
    out.update({"pre_mean": rnd(pre_mean), "post_mean": rnd(post_mean), "delta_raw": rnd(delta),
                "pct_raw": pct_change(pre_mean, post_mean)})
    out["ci_low"], out["ci_high"] = bootstrap_ci(a, b)
    # Difference-in-differences against the control / reference site on the months BOTH sites cover
    for key, other in (("delta_adj_control", dd_ctrl), ("delta_adj_reference", dd_ref)):
        if other is None:
            continue
        other = other[~other["date"].isin(smoke)]
        common = sorted(set(months) & valid_months(other, pre) & valid_months(other, post))
        if len(common) < MIN_MONTHS:
            continue
        sa, sb = period_mean_on_months(site, pre, common), period_mean_on_months(site, post, common)
        oa, ob = period_mean_on_months(other, pre, common), period_mean_on_months(other, post, common)
        out[key] = rnd((float(sb.mean()) - float(sa.mean())) - (float(ob.mean()) - float(oa.mean())))
        out[key + "_months"] = common
        if key == "delta_adj_control":
            out["control_pre_mean"], out["control_post_mean"] = rnd(oa.mean()), rnd(ob.mean())
            out["site_delta_on_control_months"] = rnd(float(sb.mean()) - float(sa.mean()))
    out["raw_class"] = classify(out["delta_raw"])
    out["adj_class"] = classify(out["delta_adj_control"])
    out["classification"], out["relative_to_control"] = classify_combined(out["delta_raw"], out["delta_adj_control"])
    out["basis"] = "raw_and_control_adjusted" if out["delta_adj_control"] is not None else "raw_only"
    out["significant"] = (out["ci_low"] is not None and (out["ci_low"] > 0 or out["ci_high"] < 0))
    return out


# ----------------------------------------------------------------------------- neighborhood indicators (NYC Open Data)
def uhf42_indicators() -> dict:
    rows = read_json(C.EXTERNAL_DIR / "nyc_air_quality_c3uy-2p5r.json")
    out: dict[str, dict] = {}
    citywide = {}
    for r in rows:
        name, measure, gt = r["name"], r["measure"], r["geo_type_name"]
        val = float(r["data_value"])
        if name.startswith("Fine particles") and measure == "Annual mean":
            if gt == "Citywide":
                citywide[r["time_period"]] = rnd(val, 2)
            elif gt == "UHF42":
                out.setdefault(r["geo_join_id"], {"name": r["geo_place_name"], "pm25": {}})["pm25"][r["time_period"]] = rnd(val, 2)
        elif name.startswith("Asthma emergency department visits due to PM2.5") and gt == "UHF42":
            key = "asthma_children" if "under" in measure else "asthma_adults"
            rec = out.setdefault(r["geo_join_id"], {"name": r["geo_place_name"], "pm25": {}})
            prev = rec.get("asthma_period")
            if prev is None or r["time_period"] > prev:
                rec["asthma_period"] = r["time_period"]
            rec.setdefault("asthma_by_period", {}).setdefault(r["time_period"], {})[key] = rnd(val, 1)
    for code, rec in out.items():
        p = rec.get("asthma_period")
        if p:
            rec["asthma_children"] = rec["asthma_by_period"][p].get("asthma_children")
            rec["asthma_adults"] = rec["asthma_by_period"][p].get("asthma_adults")
        rec.pop("asthma_by_period", None)
    return {"uhf42": out, "citywide_pm25": citywide}


# ----------------------------------------------------------------------------- main
def main() -> None:
    log("loading NYCCAS hourly data ...")
    h = load_hourly()
    sites = load_sites()
    zone = crz_zone_geometry()
    dm = daily_means(h)
    smoke = smoke_days(dm)
    log(f"  {len(smoke)} regional/smoke days (cross-site median > {C.SMOKE_DAY_THRESHOLD} ug/m3)")

    by_site_d = {sid: g for sid, g in dm.groupby("site_id")}
    by_site_h = {sid: g for sid, g in h.groupby("site_id")}
    ctrl = by_site_d.get(CONTROL_SITE)
    ref = by_site_d.get(REFERENCE_SITE)

    monitors, monthly, daily_out = [], {}, {}
    for sid, dd in by_site_d.items():
        if sid not in sites.index:
            log(f"  WARNING: {sid} has readings but no location row; skipped")
            continue
        s = sites.loc[sid]
        hh = by_site_h[sid]
        periods = {p: period_stats(dd, hh, p, smoke) for p in PERIODS}
        comps = {}
        for cname, (pre, post) in COMPARISONS.items():
            comps[cname] = compare(dd, None if sid == CONTROL_SITE else ctrl, None if sid == REFERENCE_SITE else ref,
                                   pre, post, smoke, sites)
        primary = comps["post_2025_vs_pre_2024"]
        fallback = comps["post_2026ytd_vs_ytd_2024"]
        classification = primary["classification"] if primary["coverage_ok"] else fallback["classification"]
        classification_basis = "post_2025_vs_pre_2024" if primary["coverage_ok"] else "post_2026ytd_vs_ytd_2024"
        monitors.append({
            "id": f"aq_{sid}", "site_id": sid, "name": s["name"], "layer": "aq_monitor", "approx": False,
            "address": s["address"], "lat": s["lat"], "lon": s["lon"], "role": s["role"],
            "crz_status": inside_crz_status(zone, s["lon"], s["lat"]),
            "active_from": s["active_from"], "active_to": s["active_to"], "relocated": s["relocated"],
            "periods": periods, "comparisons": comps,
            "classification": classification, "classification_basis": classification_basis,
        })
        mm = dd[~dd["date"].isin(smoke)].groupby(dd["date"].dt.strftime("%Y-%m")).agg(mean=("mean", "mean"), median=("mean", "median"), days=("mean", "size"))
        monthly[sid] = [{"ym": ym, "mean": rnd(r["mean"]), "median": rnd(r["median"]), "days": int(r["days"])} for ym, r in mm.iterrows()]
        daily_out[sid] = [{"date": d.strftime("%Y-%m-%d"), "mean": rnd(v)} for d, v in zip(dd["date"], dd["mean"])]

    dm.assign(smoke=dm["date"].isin(smoke)).to_parquet(C.PROCESSED_DIR / "aq_daily.parquet", index=False)
    ind = uhf42_indicators()
    out = {
        "monitors": monitors,
        "series": {"monthly": monthly, "daily": daily_out, "smoke_days": sorted(d.strftime("%Y-%m-%d") for d in smoke)},
        "uhf42_indicators": ind["uhf42"], "citywide_pm25": ind["citywide_pm25"],
        "control_site": CONTROL_SITE, "reference_site": REFERENCE_SITE,
    }
    write_json(out, C.PROCESSED_DIR / "air_quality.json")
    cls = pd.Series([m["classification"] for m in monitors]).value_counts().to_dict()
    log(f"step 04 done: {len(monitors)} monitors {cls}")
    for m in monitors:
        c = m["comparisons"]["post_2025_vs_pre_2024"]
        log(f"   {m['name']:<20} {m['crz_status']:<8} {m['classification']:<12} pre {c['pre_mean']} post {c['post_mean']} "
            f"raw {c['delta_raw']} adj {c['delta_adj_control']} months {len(c['months_used'])}")


if __name__ == "__main__":
    main()
