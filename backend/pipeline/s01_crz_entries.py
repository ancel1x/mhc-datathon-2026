"""Step 01: MTA Congestion Relief Zone vehicle entries (1 GB CSV) -> compact aggregates via DuckDB."""
from __future__ import annotations

import sys
from pathlib import Path

import duckdb
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import config as C  # noqa: E402
from pipeline.common import in_period, is_weekend, log, pct_change, rnd, write_json  # noqa: E402

CLASS_KEY = {
    "1 - Cars, Pickups and Vans": "cars",
    "2 - Single-Unit Trucks": "trucks_single",
    "3 - Multi-Unit Trucks": "trucks_multi",
    "4 - Buses": "buses",
    "5 - Motorcycles": "motorcycles",
    "TLC Taxi/FHV": "taxi_fhv",
}
TRUCK_CLASSES = ["2 - Single-Unit Trucks", "3 - Multi-Unit Trucks"]
# Approximate Manhattan-side gantry locations for each detection group
ENTRY_POINTS = {
    "Brooklyn Bridge":              ("brooklyn_bridge", 40.7087, -74.0040),
    "Manhattan Bridge":             ("manhattan_bridge", 40.7139, -73.9930),
    "Williamsburg Bridge":          ("williamsburg_bridge", 40.7175, -73.9850),
    "Queensboro Bridge":            ("queensboro_bridge", 40.7583, -73.9635),
    "Queens Midtown Tunnel":        ("queens_midtown_tunnel", 40.7455, -73.9715),
    "Hugh L. Carey Tunnel":         ("hugh_carey_tunnel", 40.7028, -74.0138),
    "Holland Tunnel":               ("holland_tunnel", 40.7262, -74.0105),
    "Lincoln Tunnel":               ("lincoln_tunnel", 40.7606, -73.9998),
    "East 60th St":                 ("east_60th", 40.7628, -73.9660),
    "West 60th St":                 ("west_60th", 40.7710, -73.9855),
    "FDR Drive at 60th St":         ("fdr_60th", 40.7592, -73.9592),
    "West Side Highway at 60th St": ("wsh_60th", 40.7735, -73.9925),
}
PERIODS = ["post_2025", "post_2026_ytd", "ytd_2025"]


def load_aggregates() -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    p_daily = C.PROCESSED_DIR / "crz_daily_group_class.parquet"
    p_hourly = C.PROCESSED_DIR / "crz_hourly_group.parquet"
    p_period = C.PROCESSED_DIR / "crz_daily_group_timeperiod.parquet"
    if all(p.exists() for p in (p_daily, p_hourly, p_period)):
        return pd.read_parquet(p_daily), pd.read_parquet(p_hourly), pd.read_parquet(p_period)

    src = str(C.RAW_CRZ_CSV).replace("\\", "/")
    log(f"DuckDB reading {src} ...")
    con = duckdb.connect()
    con.execute(f"""
        CREATE TABLE crz AS
        SELECT strptime("Toll Date", '%m/%d/%Y')::DATE            AS toll_date,
               CAST("Hour of Day" AS INTEGER)                      AS hour,
               "Time Period"                                       AS time_period,
               "Vehicle Class"                                     AS vehicle_class,
               "Detection Group"                                   AS detection_group,
               "Detection Region"                                  AS detection_region,
               CAST("CRZ Entries" AS INTEGER)                      AS crz_entries,
               CAST("Excluded Roadway Entries" AS INTEGER)         AS excluded_entries
        FROM read_csv('{src}', header=true, all_varchar=true)
    """)
    n = con.execute("SELECT count(*) FROM crz").fetchone()[0]
    log(f"  {n:,} rows loaded")
    daily = con.execute("""
        SELECT toll_date, detection_group, vehicle_class,
               SUM(crz_entries) AS crz_entries, SUM(excluded_entries) AS excluded_entries
        FROM crz GROUP BY 1,2,3 ORDER BY 1,2,3""").df()
    hourly = con.execute("""
        SELECT toll_date, hour, detection_group,
               SUM(crz_entries) AS crz_entries, SUM(excluded_entries) AS excluded_entries
        FROM crz GROUP BY 1,2,3 ORDER BY 1,2,3""").df()
    period = con.execute("""
        SELECT toll_date, detection_group, time_period, SUM(crz_entries) AS crz_entries
        FROM crz GROUP BY 1,2,3 ORDER BY 1,2,3""").df()
    con.close()
    C.PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    daily.to_parquet(p_daily, index=False)
    hourly.to_parquet(p_hourly, index=False)
    period.to_parquet(p_period, index=False)
    log(f"  daily {len(daily):,} rows, hourly {len(hourly):,} rows, timeperiod {len(period):,} rows")
    return daily, hourly, period


def hourly_profile(h: pd.DataFrame) -> tuple[list, list]:
    """Average entries per hour for weekdays and weekends from a (toll_date, hour, crz_entries, weekend) frame."""
    out = []
    for wk in (False, True):
        sub = h[h["weekend"] == wk]
        if sub.empty:
            out.append([None] * 24)
            continue
        per_day = sub.groupby(["toll_date", "hour"])["crz_entries"].sum().reset_index()
        prof = per_day.groupby("hour")["crz_entries"].mean().reindex(range(24))
        out.append([rnd(v, 1) for v in prof.tolist()])
    return out[0], out[1]


def period_stats(daily: pd.DataFrame, hourly: pd.DataFrame, period_df: pd.DataFrame, pname: str) -> dict | None:
    d = daily[in_period(daily["toll_date"], pname)]
    if d.empty:
        return None
    h = hourly[in_period(hourly["toll_date"], pname)]
    p = period_df[in_period(period_df["toll_date"], pname)]
    by_day = d.groupby("toll_date")[["crz_entries", "excluded_entries"]].sum()
    by_day["weekend"] = is_weekend(pd.Series(by_day.index)).values
    total = float(by_day["crz_entries"].sum())
    excl = float(by_day["excluded_entries"].sum())
    mix = d.groupby("vehicle_class")["crz_entries"].sum()
    mix = {CLASS_KEY.get(k, k): rnd(v / total, 4) for k, v in mix.items()} if total else {}
    peak = p.groupby("time_period")["crz_entries"].sum()
    hw, he = hourly_profile(h)
    trucks = d[d["vehicle_class"].isin(TRUCK_CLASSES)].groupby("toll_date")["crz_entries"].sum()
    return {
        "total_entries": int(total),
        "excluded_entries": int(excl),
        "excluded_share": rnd(excl / (total + excl), 4) if total + excl else None,
        "days": int(len(by_day)),
        "avg_daily_entries": rnd(by_day["crz_entries"].mean(), 0),
        "avg_weekday_entries": rnd(by_day.loc[~by_day["weekend"], "crz_entries"].mean(), 0),
        "avg_weekend_entries": rnd(by_day.loc[by_day["weekend"], "crz_entries"].mean(), 0),
        "peak_share": rnd(peak.get("Peak", 0) / peak.sum(), 4) if peak.sum() else None,
        "class_mix": mix,
        "trucks_avg_daily": rnd(trucks.mean(), 0) if len(trucks) else None,
        "hourly_weekday": hw,
        "hourly_weekend": he,
    }


def change_block(a: dict | None, b: dict | None) -> dict:
    g = lambda s, k: (s or {}).get(k)  # noqa: E731
    return {
        "pct_2026ytd_vs_2025ytd": pct_change(g(a, "avg_daily_entries"), g(b, "avg_daily_entries")),
        "weekday_pct_2026ytd_vs_2025ytd": pct_change(g(a, "avg_weekday_entries"), g(b, "avg_weekday_entries")),
        "trucks_pct_2026ytd_vs_2025ytd": pct_change(g(a, "trucks_avg_daily"), g(b, "trucks_avg_daily")),
    }


def main() -> None:
    daily, hourly, period_df = load_aggregates()
    for df in (daily, hourly, period_df):
        df["toll_date"] = pd.to_datetime(df["toll_date"])
    hourly["weekend"] = is_weekend(hourly["toll_date"]).values

    points = []
    groups = sorted(daily["detection_group"].unique())
    for g in groups:
        pid, lat, lon = ENTRY_POINTS.get(g, (g.lower().replace(" ", "_"), None, None))
        dg = daily[daily["detection_group"] == g]
        stats = {p: period_stats(dg, hourly[hourly["detection_group"] == g],
                                 period_df[period_df["detection_group"] == g], p) for p in PERIODS}
        points.append({
            "id": pid, "name": g, "layer": "crz_entry", "approx": True, "lat": lat, "lon": lon,
            "region": str(dg["detection_region"].iloc[0]) if "detection_region" in dg else None,
            "periods": stats, "change": change_block(stats.get("ytd_2025"), stats.get("post_2026_ytd")),
        })

    system = {p: period_stats(daily, hourly, period_df, p) for p in PERIODS}
    system_change = change_block(system.get("ytd_2025"), system.get("post_2026_ytd"))

    # series
    daily["cls"] = daily["vehicle_class"].map(CLASS_KEY)
    piv = daily.pivot_table(index="toll_date", columns="cls", values="crz_entries", aggfunc="sum").fillna(0)
    for col in ("cars", "trucks_single", "trucks_multi", "taxi_fhv", "buses", "motorcycles"):
        if col not in piv:
            piv[col] = 0
    piv["trucks"] = piv["trucks_single"] + piv["trucks_multi"]
    tot = daily.groupby("toll_date")[["crz_entries", "excluded_entries"]].sum()
    daily_total = [
        {"date": d.strftime("%Y-%m-%d"), "entries": int(tot.loc[d, "crz_entries"]),
         "excluded": int(tot.loc[d, "excluded_entries"]),
         "cars": int(piv.loc[d, "cars"]), "trucks": int(piv.loc[d, "trucks"]),
         "taxi_fhv": int(piv.loc[d, "taxi_fhv"]), "buses": int(piv.loc[d, "buses"]),
         "motorcycles": int(piv.loc[d, "motorcycles"])}
        for d in tot.index
    ]
    by_point = {}
    for g in groups:
        pid = ENTRY_POINTS.get(g, (g,))[0]
        s = daily[daily["detection_group"] == g].groupby("toll_date")["crz_entries"].sum()
        by_point[pid] = [{"date": d.strftime("%Y-%m-%d"), "entries": int(v)} for d, v in s.items()]
    wk = tot.copy()
    wk["weekend"] = is_weekend(pd.Series(wk.index)).values
    wk["week_start"] = (wk.index - pd.to_timedelta(wk.index.dayofweek, unit="D")).strftime("%Y-%m-%d")
    weekly = []
    for ws, grp in wk.groupby("week_start"):
        weekly.append({"week_start": ws, "entries": int(grp["crz_entries"].sum()),
                       "weekday_avg": rnd(grp.loc[~grp["weekend"], "crz_entries"].mean(), 0), "days": int(len(grp))})

    out = {
        "first_date": tot.index.min().strftime("%Y-%m-%d"),
        "last_date": tot.index.max().strftime("%Y-%m-%d"),
        "days_covered": int(len(tot)),
        "system": {"periods": system, "change": system_change},
        "points": points,
        "series": {"daily_total": daily_total, "daily_by_point": by_point, "weekly_total": weekly},
    }
    C.PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    write_json(out, C.PROCESSED_DIR / "crz_entries.json")
    log(f"step 01 done: {len(points)} entry points, {len(daily_total)} days "
        f"(avg weekday 2025 = {system['post_2025']['avg_weekday_entries']:,})")


if __name__ == "__main__":
    main()
