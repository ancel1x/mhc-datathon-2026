"""Step 03: NYC DOT Automated Traffic Volume Counts -> per-segment daily volumes, matched pre/post comparisons."""
from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import config as C  # noqa: E402
from pipeline.common import log, nysp_to_wgs84, parse_wkt_point, pct_change, rnd, write_json  # noqa: E402

MIN_BINS_PER_DAY = 80          # of 96 fifteen-minute bins
PRE_YEARS = [2024, 2023, 2022, 2021, 2019]   # preference order for a baseline (2020 excluded: pandemic)
POST_START = "2025-01"
MAP_FROM = "2023-01"           # segments shown on the map: counted since 2023, plus any older one re-counted post-CP


def load_daily() -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    p = C.PROCESSED_DIR / "dot_daily.parquet"
    pm = C.PROCESSED_DIR / "dot_segment_meta.parquet"
    ph = C.PROCESSED_DIR / "dot_hourly.parquet"
    if p.exists() and pm.exists() and ph.exists():
        return pd.read_parquet(p), pd.read_parquet(pm), pd.read_parquet(ph)
    log(f"reading {C.RAW_ATVC_CSV.name} ...")
    usecols = ["Boro", "Yr", "M", "D", "HH", "MM", "Vol", "SegmentID", "WktGeom", "street", "fromSt", "toSt", "Direction"]
    df = pd.read_csv(C.RAW_ATVC_CSV, usecols=usecols,
                     dtype={"Vol": "string", "SegmentID": "string", "WktGeom": "string", "street": "string",
                            "fromSt": "string", "toSt": "string", "Direction": "string", "Boro": "string"})
    df = df[df["Yr"] >= 2019].copy()
    df["Vol"] = pd.to_numeric(df["Vol"].str.replace(",", "", regex=False), errors="coerce")
    df = df.dropna(subset=["Vol"])
    df["date"] = pd.to_datetime(dict(year=df["Yr"], month=df["M"], day=df["D"]), errors="coerce")
    df = df.dropna(subset=["date"])
    log(f"  {len(df):,} 15-min rows since 2019")

    meta = (df.sort_values("date").groupby("SegmentID")
            .agg(boro=("Boro", "last"), street=("street", "last"), from_st=("fromSt", "last"),
                 to_st=("toSt", "last"), wkt=("WktGeom", "last")).reset_index())
    lonlat = []
    for w in meta["wkt"]:
        xy = parse_wkt_point(w)
        lonlat.append(nysp_to_wgs84(*xy) if xy else (None, None))
    meta["lon"] = [a for a, _ in lonlat]
    meta["lat"] = [b for _, b in lonlat]

    hourly = (df.groupby(["SegmentID", "Direction", "date", "HH"])
              .agg(vol=("Vol", "sum"), bins=("Vol", "size")).reset_index())
    daily = (hourly.groupby(["SegmentID", "Direction", "date"])
             .agg(vol=("vol", "sum"), bins=("bins", "sum")).reset_index())
    daily = daily[daily["bins"] >= MIN_BINS_PER_DAY].copy()
    daily["ym"] = daily["date"].dt.strftime("%Y-%m")
    daily["weekend"] = daily["date"].dt.dayofweek >= 5
    hourly = hourly.merge(daily[["SegmentID", "Direction", "date"]], on=["SegmentID", "Direction", "date"])
    hourly["weekend"] = hourly["date"].dt.dayofweek >= 5
    C.PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    daily.to_parquet(p, index=False)
    meta.to_parquet(pm, index=False)
    hourly.to_parquet(ph, index=False)
    log(f"  {len(daily):,} complete segment-direction-days, {len(meta):,} segments")
    return daily, meta, hourly


def choose_baseline(pre_months: list[str], post_months: list[str]) -> tuple[list[str], str]:
    """Baseline months: same calendar months as post in the most recent pre year, else that year's months."""
    post_mm = {m[-2:] for m in post_months}
    for y in PRE_YEARS:
        ys = [m for m in pre_months if m.startswith(str(y))]
        if not ys:
            continue
        same = [m for m in ys if m[-2:] in post_mm]
        if same:
            return same, "same_month"
        return ys, "any_month"
    return [], "none"


def hour_profile(sub: pd.DataFrame) -> list:
    if sub.empty:
        return [None] * 24
    per = sub.groupby(["date", "HH"])["vol"].sum().reset_index()
    return [rnd(v, 0) for v in per.groupby("HH")["vol"].mean().reindex(range(24)).tolist()]


def main() -> None:
    daily, meta, hourly = load_daily()
    meta = meta.set_index("SegmentID")
    weekday = daily[~daily["weekend"]]
    adv = (daily.groupby(["SegmentID", "Direction", "ym"]).agg(adv=("vol", "mean"), days=("vol", "size")).reset_index())
    adv_wd = (weekday.groupby(["SegmentID", "Direction", "ym"]).agg(adv_weekday=("vol", "mean")).reset_index())
    adv = adv.merge(adv_wd, on=["SegmentID", "Direction", "ym"], how="left")

    features, matched = [], []
    for seg, g in adv.groupby("SegmentID"):
        months = sorted(g["ym"].unique())
        pre_months = [m for m in months if m < POST_START and not m.startswith("2020")]
        post_months = [m for m in months if m >= POST_START]
        m = meta.loc[seg]
        if m["lon"] is None or pd.isna(m["lon"]):
            continue
        show = months[-1] >= MAP_FROM or (pre_months and post_months)
        if not show:
            continue
        role = "matched" if (pre_months and post_months) else ("post_only" if post_months else "pre_only")
        latest = g[g["ym"] == months[-1]]
        props = {
            "id": f"dot_{seg}", "segment_id": str(seg),
            "name": f"{m['street']} ({m['from_st']} to {m['to_st']})",
            "layer": "dot_segment", "approx": False,
            "street": str(m["street"]), "from_st": str(m["from_st"]), "to_st": str(m["to_st"]), "boro": str(m["boro"]),
            "directions": sorted(g["Direction"].unique()), "months": months,
            "first_month": months[0], "last_month": months[-1],
            "latest_adv": rnd(latest.groupby("Direction")["adv"].mean().sum(), 0),
            "role": role, "has_pre_post": role == "matched",
            "pre_adv": None, "post_adv": None, "pct_change": None, "pre_months": [], "post_months": post_months,
            "comparison_kind": None, "baseline_long_adv": None, "baseline_years": [],
        }
        if role == "matched":
            base_months, kind = choose_baseline(pre_months, post_months)
            pre = g[g["ym"].isin(base_months)]
            post = g[g["ym"].isin(post_months)]
            dirs = sorted(set(pre["Direction"]) & set(post["Direction"]))
            if not (dirs and base_months):
                # counted before and after the toll, but never in the same direction: nothing to compare
                props.update({"role": "unpaired", "has_pre_post": False})
            if dirs and base_months:
                pre_d = pre[pre["Direction"].isin(dirs)].groupby("Direction")["adv"].mean()
                post_d = post[post["Direction"].isin(dirs)].groupby("Direction")["adv"].mean()
                pre_adv, post_adv = float(pre_d.sum()), float(post_d.sum())
                post_mm = {mm[-2:] for mm in post_months}
                longb = g[(g["ym"] < POST_START) & (~g["ym"].str.startswith("2020")) &
                          (g["ym"].str[-2:].isin(post_mm)) & (g["Direction"].isin(dirs))]
                years = sorted({mm[:4] for mm in longb["ym"]})
                long_adv = None
                if len(longb):
                    long_adv = float(longb.groupby(["ym", "Direction"])["adv"].mean().groupby("Direction").mean().sum())
                props.update({
                    "pre_adv": rnd(pre_adv, 0), "post_adv": rnd(post_adv, 0),
                    "pct_change": pct_change(pre_adv, post_adv), "pre_months": base_months,
                    "comparison_kind": kind, "baseline_long_adv": rnd(long_adv, 0), "baseline_years": years,
                    "directions_compared": dirs,
                })
                hs = hourly[(hourly["SegmentID"] == seg) & (hourly["Direction"].isin(dirs)) & (~hourly["weekend"])]
                hs = hs.assign(ym=hs["date"].dt.strftime("%Y-%m"))
                by_dir = {d_: {"pre_adv": rnd(pre_d[d_], 0), "post_adv": rnd(post_d[d_], 0),
                               "pct_change": pct_change(float(pre_d[d_]), float(post_d[d_]))} for d_ in dirs}
                matched.append({**props, "lon": float(m["lon"]), "lat": float(m["lat"]),
                                "hourly_weekday_pre": hour_profile(hs[hs["ym"].isin(base_months)]),
                                "hourly_weekday_post": hour_profile(hs[hs["ym"].isin(post_months)]),
                                "by_direction": by_dir})
        features.append({"type": "Feature", "geometry": {"type": "Point", "coordinates": [float(m["lon"]), float(m["lat"])]},
                         "properties": props})

    write_json({"features": features, "matched": matched}, C.PROCESSED_DIR / "dot_counts.json")
    roles = pd.Series([f["properties"]["role"] for f in features]).value_counts().to_dict()
    log(f"step 03 done: {len(features)} segments on map {roles}; {len(matched)} matched comparisons")


if __name__ == "__main__":
    main()
