"""Step 02: MTA Bridges & Tunnels hourly crossings (server-side SoQL aggregates) -> pre/post facility stats."""
from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import config as C  # noqa: E402
from pipeline.common import in_period, is_peak, is_weekend, log, pct_change, period_bounds, rnd, write_json  # noqa: E402

# id, role, lat, lon (approximate plaza / mid-span locations)
FACILITIES = {
    "Robert F. Kennedy Bridge Bronx":     ("rfk_bronx", "Bronx-Randalls Island span (Mott Haven / Port Morris approach)", 40.8005, -73.9215),
    "Robert F. Kennedy Bridge Manhattan": ("rfk_manhattan", "Manhattan span (East Harlem, 125th St approach)", 40.7975, -73.9305),
    "Bronx - Whitestone Bridge":          ("whitestone", "Bronx-Queens bypass (Hutchinson River Pkwy / Cross Bronx corridor)", 40.8012, -73.8292),
    "Throgs Neck Bridge":                 ("throgs_neck", "Bronx-Queens bypass (Cross Bronx / Clearview corridor)", 40.8005, -73.7930),
    "Henry Hudson Bridge":                ("henry_hudson", "Bronx-Manhattan north (Henry Hudson Pkwy)", 40.8774, -73.9221),
    "Queens Midtown Tunnel":              ("qmt", "Into the zone from Queens (crossing credit applies)", 40.7438, -73.9635),
    "Hugh L. Carey Tunnel":               ("hlc", "Into the zone from Brooklyn (crossing credit applies)", 40.6980, -74.0150),
    "Verrazzano - Narrows Bridge":        ("verrazzano", "Staten Island-Brooklyn (Gowanus / BQE corridor)", 40.6066, -74.0447),
    "Cross Bay Bridge":                   ("cross_bay", "Rockaways (far from the zone; quasi-control)", 40.5935, -73.8205),
    "Marine Parkway Bridge":              ("marine_parkway", "Rockaways (far from the zone; quasi-control)", 40.5735, -73.8850),
}
PERIODS = ["pre_2023", "pre_2024", "post_2025", "post_2026_ytd", "ytd_2024", "ytd_2025"]


def load() -> tuple[pd.DataFrame, pd.DataFrame]:
    daily = pd.read_parquet(C.EXTERNAL_DIR / "bt_daily.parquet")
    hourly = pd.read_parquet(C.EXTERNAL_DIR / "bt_month_dow_hour.parquet")
    daily["date"] = pd.to_datetime(daily["date"])
    daily["weekend"] = is_weekend(daily["date"]).values
    daily["is_truck"] = daily["vehicle_class_category"].str.lower().eq("truck")
    hourly["weekend"] = hourly["dow"].isin([0, 6])          # SoQL date_extract_dow: 0=Sunday .. 6=Saturday
    hourly["peak"] = is_peak(hourly["hour"], hourly["weekend"])
    return daily, hourly


def months_of(pname: str) -> list[str]:
    s, e = period_bounds(pname)
    return [d.strftime("%Y-%m") for d in pd.date_range(s, e - pd.Timedelta(days=1), freq="MS")] + \
           ([s.strftime("%Y-%m")] if s.day != 1 else [])


def hourly_profiles(h: pd.DataFrame, day_counts: dict) -> tuple[list, list, float | None]:
    """h = month x dow x hour rows for one facility within a period. day_counts = {False: n_weekdays, True: n_weekend_days}."""
    out = []
    for wk in (False, True):
        sub = h[h["weekend"] == wk]
        n = day_counts.get(wk, 0)
        if sub.empty or not n:
            out.append([None] * 24)
            continue
        prof = sub.groupby("hour")["traffic"].sum().reindex(range(24)).fillna(0) / n
        out.append([rnd(v, 0) for v in prof.tolist()])
    tot = h["traffic"].sum()
    peak_share = rnd(h.loc[h["peak"], "traffic"].sum() / tot, 4) if tot else None
    return out[0], out[1], peak_share


def scale_profile(prof: list, target) -> list:
    """Rescale a 24-hour profile so it sums to the exact daily average from the daily table.

    The hour profiles come from month x day-of-week x hour aggregates, which cannot leave out the first days
    of a month (Jan 1-4) that fall outside a period; the daily table can. Shape from the aggregates, level
    from the days, so the clock rings agree with the daily-average tiles.
    """
    if target is None or not prof or not any(v is not None for v in prof):
        return prof
    total = sum(v for v in prof if v is not None)
    if total <= 0:
        return prof
    k = float(target) / total
    return [rnd(v * k, 0) if v is not None else None for v in prof]


def period_stats(d: pd.DataFrame, h: pd.DataFrame, pname: str) -> dict | None:
    dp = d[in_period(d["date"], pname)]
    if dp.empty:
        return None
    by_day = dp.groupby("date").agg(total=("traffic", "sum")).join(
        dp[dp["is_truck"]].groupby("date")["traffic"].sum().rename("trucks")).fillna(0)
    by_day["weekend"] = is_weekend(pd.Series(by_day.index)).values
    hp = h[h["ym"].isin(months_of(pname))]
    day_counts = by_day["weekend"].value_counts().to_dict()
    hw, he, peak_share = hourly_profiles(hp, day_counts)
    avg_weekday = rnd(by_day.loc[~by_day["weekend"], "total"].mean(), 0)
    avg_weekend = rnd(by_day.loc[by_day["weekend"], "total"].mean(), 0)
    hw, he = scale_profile(hw, avg_weekday), scale_profile(he, avg_weekend)
    total = float(by_day["total"].sum())
    trucks = float(by_day["trucks"].sum())
    return {
        "total": int(total), "days": int(len(by_day)),
        "avg_daily": rnd(by_day["total"].mean(), 0),
        "avg_weekday": avg_weekday,
        "avg_weekend": avg_weekend,
        "trucks_total": int(trucks), "trucks_avg_daily": rnd(by_day["trucks"].mean(), 0),
        "truck_share": rnd(trucks / total, 4) if total else None,
        "peak_share": peak_share, "hourly_weekday": hw, "hourly_weekend": he,
    }


def change_block(p: dict) -> dict:
    g = lambda a, k: (p.get(a) or {}).get(k)  # noqa: E731
    return {
        "pct_2025_vs_2024": pct_change(g("pre_2024", "avg_daily"), g("post_2025", "avg_daily")),
        "pct_2025_vs_2023": pct_change(g("pre_2023", "avg_daily"), g("post_2025", "avg_daily")),
        "pct_2026ytd_vs_2025ytd": pct_change(g("ytd_2025", "avg_daily"), g("post_2026_ytd", "avg_daily")),
        "pct_2026ytd_vs_2024ytd": pct_change(g("ytd_2024", "avg_daily"), g("post_2026_ytd", "avg_daily")),
        "trucks_pct_2025_vs_2024": pct_change(g("pre_2024", "trucks_avg_daily"), g("post_2025", "trucks_avg_daily")),
        "trucks_pct_2026ytd_vs_2024ytd": pct_change(g("ytd_2024", "trucks_avg_daily"), g("post_2026_ytd", "trucks_avg_daily")),
        "peak_share_delta_2025_vs_2024": (rnd(g("post_2025", "peak_share") - g("pre_2024", "peak_share"), 4)
                                          if g("post_2025", "peak_share") is not None and g("pre_2024", "peak_share") is not None else None),
    }


def main() -> None:
    daily, hourly = load()
    facilities = []
    monthly, daily_series = {}, {}
    for name, g in daily.groupby("facility"):
        fid, role, lat, lon = FACILITIES.get(name, (name.lower().replace(" ", "_"), "", None, None))
        h = hourly[hourly["facility"] == name]
        periods = {p: period_stats(g, h, p) for p in PERIODS}
        by_dir = {}
        for d_, gd in g.groupby("direction"):
            a = period_stats(gd, h[h["direction"] == d_], "pre_2024")
            b = period_stats(gd, h[h["direction"] == d_], "post_2025")
            by_dir[d_] = {
                "avg_daily_2024": a and a["avg_daily"], "avg_daily_2025": b and b["avg_daily"],
                "pct_2025_vs_2024": pct_change(a and a["avg_daily"], b and b["avg_daily"]),
                "trucks_pct_2025_vs_2024": pct_change(a and a["trucks_avg_daily"], b and b["trucks_avg_daily"]),
            }
        facilities.append({
            "id": fid, "name": name, "layer": "bt_facility", "approx": True, "lat": lat, "lon": lon, "role": role,
            "directions": sorted(g["direction"].unique()), "periods": periods, "change": change_block(periods),
            "by_direction": by_dir,
        })
        g = g.assign(ym=g["date"].dt.strftime("%Y-%m"), cls=g["vehicle_class_category"].str.lower())
        piv = g.pivot_table(index="ym", columns="cls", values="traffic", aggfunc="sum").fillna(0)
        for col in ("car", "truck", "bus", "motorcycle"):
            if col not in piv:
                piv[col] = 0
        monthly[fid] = [{"ym": ym, "total": int(r.sum()), "cars": int(r["car"]), "trucks": int(r["truck"]),
                         "buses": int(r["bus"]), "motorcycles": int(r["motorcycle"])} for ym, r in piv.iterrows()]
        ds = g.groupby("date")["traffic"].sum()
        daily_series[fid] = [{"date": d.strftime("%Y-%m-%d"), "total": int(v)} for d, v in ds.items()]

    system_periods = {p: period_stats(daily, hourly, p) for p in PERIODS}
    sys_m = daily.assign(ym=daily["date"].dt.strftime("%Y-%m"))
    system_monthly = [{"ym": ym, "total": int(r["traffic"].sum()), "trucks": int(r.loc[r["is_truck"], "traffic"].sum())}
                      for ym, r in sys_m.groupby("ym")]
    out = {
        "facilities": facilities,
        "system": {"periods": system_periods, "change": change_block(system_periods)},
        "series": {"monthly": monthly, "daily": daily_series, "system_monthly": system_monthly},
        "first_date": daily["date"].min().strftime("%Y-%m-%d"), "last_date": daily["date"].max().strftime("%Y-%m-%d"),
    }
    write_json(out, C.PROCESSED_DIR / "bt_crossings.json")
    ch = out["system"]["change"]
    log(f"step 02 done: {len(facilities)} facilities; system 2025 vs 2024 = {ch['pct_2025_vs_2024']}%, "
        f"trucks {ch['trucks_pct_2025_vs_2024']}%")


if __name__ == "__main__":
    main()
