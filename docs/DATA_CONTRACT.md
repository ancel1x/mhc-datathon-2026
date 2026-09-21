# Data contract: files in `frontend/public/data/` (also served by FastAPI at `/api/bundle/{name}` and `/api/geo/{layer}`)

All numbers may be `null` when a comparison is not possible; the UI must render defensively.
Periods used everywhere (local NY time): `pre_2023` (2023), `pre_2024` (2024-01-05→2024-12-31, the baseline),
`post_2025` (2025-01-05→2025-12-31), `post_2026_ytd` (2026-01-01→2026-08-31), `ytd_2024` / `ytd_2025` (Jan 5→Aug 31 of that year, for like-for-like YTD comparisons).
Congestion pricing started **2025-01-05**. Hourly arrays are always length 24, index = local hour 0–23, weekday = Mon–Fri.

## Common point properties (every point layer)
`id`, `name`, `layer` ("crz_entry" | "bt_facility" | "dot_segment" | "aq_monitor"), `approx` (bool: coordinates are approximate),
`dac_designated` (bool|null), `dac_combined_pct` (0–1: the tract's **NY State percentile rank** on the combined DAC score|null),
`dac_asthma_pct` (0–1: statewide percentile rank of the asthma ED-visit rate — a rank, **not** a rate; 0.99 means the 99th percentile|null),
`uhf42_code`, `uhf42_name`, `uhf42_asthma_ed_pm25_children` (per 100k), `uhf42_pm25_2024` (µg/m³).

## summary.json
```
{ generated_at, cp_start,
  periods: { <period>: {label, start, end} },
  crz: { first_date, last_date, days_covered,
         avg_weekday_entries_2025, avg_weekday_entries_2026ytd, avg_weekend_entries_2025, yoy_weekday_pct,
         peak_share_2025, overnight_share_2025, excluded_share_2025, class_mix_2025: {cars, trucks_single, trucks_multi, buses, motorcycles, taxi_fhv},
         trucks_yoy_pct, hourly_weekday_2025:[24], hourly_weekday_2026ytd:[24],
         top_entry_points_2025: [{id, name, avg_weekday_entries, share}] },
  bt:  { system_avg_daily_2024, system_avg_daily_2025, system_pct_2025_vs_2024, system_pct_2026ytd_vs_2024ytd,
         trucks_pct_2025_vs_2024, facilities_up: [{id,name,pct_2025_vs_2024,role,dac_designated}], facilities_down: [...],
         facilities_up_in_dac, facilities_up_total },
  dot: { matched_segments, post_only_segments, matched_up, matched_down,
         highlights: [{segment_id, street, boro, pre_adv, post_adv, pct_change, pre_months, post_months, comparison_kind}] },
  aq:  { sites_total, sites_with_comparison,
         inside:  {improved, unchanged, worsened, insufficient},
         outside: {improved, unchanged, worsened, insufficient},
         control: {site_id, name, pre_mean, post_mean, delta_raw, pct_raw},
         south_bronx: [{site_id, name, pre_mean, post_mean, delta_raw, delta_adj_control, pct_raw, classification, months_used}],
         inside_sites: [same shape], smoke_days_excluded: {pre_2024, post_2025, post_2026_ytd},
         sites_worsened_in_dac, sites_worsened_total, citywide_pm25_2009, citywide_pm25_2024 },
  equity: { nyc_tracts, dac_designated_tracts, dac_share } }
```

## crz_zone.geojson
FeatureCollection, one dissolved Polygon/MultiPolygon, props `{name: "Congestion Relief Zone", source}`.

## crz_entry_points.geojson (12 points; Manhattan-side gantry locations, approx)
props: common + `region`, 
`periods: { post_2025 | post_2026_ytd | ytd_2025 : { total_entries, excluded_entries, excluded_share, days, avg_daily_entries, avg_weekday_entries, avg_weekend_entries, peak_share, class_mix:{...shares}, hourly_weekday:[24], hourly_weekend:[24] } }`,
`change: { pct_2026ytd_vs_2025ytd, weekday_pct_2026ytd_vs_2025ytd, trucks_pct_2026ytd_vs_2025ytd }`.
Glyph rings for this layer: grey = `ytd_2025.hourly_weekday`, colored = `post_2026_ytd.hourly_weekday` (no pre-CP data exists at these detectors).

## crz_series.json
`{ daily_total: [{date, entries, excluded, cars, trucks, taxi_fhv, buses, motorcycles}], daily_by_point: { <id>: [{date, entries}] }, weekly_total: [{week_start, entries, weekday_avg}] }`

## bt_facilities.geojson (10 MTA bridges/tunnels, approx coordinates)
props: common + `role`, `directions:[...]`,
`periods: { pre_2023|pre_2024|post_2025|post_2026_ytd|ytd_2024|ytd_2025 : { total, days, avg_daily, avg_weekday, avg_weekend, trucks_total, trucks_avg_daily, truck_share, peak_share, hourly_weekday:[24], hourly_weekend:[24] } }`,
`change: { pct_2025_vs_2024, pct_2025_vs_2023, pct_2026ytd_vs_2025ytd, pct_2026ytd_vs_2024ytd, trucks_pct_2025_vs_2024, trucks_pct_2026ytd_vs_2024ytd, peak_share_delta_2025_vs_2024 }`,
`by_direction: { <direction>: { avg_daily_2024, avg_daily_2025, pct_2025_vs_2024, trucks_pct_2025_vs_2024 } }`.
Glyph rings: grey = `pre_2024.hourly_weekday`, colored = selected period's `hourly_weekday`. Hour profiles come from month × day-of-week × hour aggregates and are rescaled so each one sums to that period's `avg_weekday` / `avg_weekend` from the daily table.

## bt_series.json
`{ monthly: { <id>: [{ym, total, cars, trucks, buses, motorcycles}] }, daily: { <id>: [{date, total}] }, system_monthly: [{ym, total, trucks}] }`

## dot_segments.geojson (NYC DOT count locations, 2023+ plus any older location re-counted after CP)
props: common + `segment_id, street, from_st, to_st, boro, directions:[...], months:[...], first_month, last_month, latest_adv, role ("matched"|"post_only"|"pre_only"|"unpaired" = counted before and after but never in the same direction, so no comparison), has_pre_post, pre_adv, post_adv, pct_change, pre_months:[...], post_months:[...], comparison_kind ("same_month"|"any_month"|null), baseline_long_adv, baseline_years:[...]`

## dot_matched.json
`[{ ...same props as matched features, hourly_weekday_pre:[24], hourly_weekday_post:[24], by_direction: { <dir>: {pre_adv, post_adv, pct_change} } }]`

## aq_monitors.geojson (NYCCAS real-time PM2.5 sites)
props: common + `site_id, address, role ("site"|"control"|"reference"), crz_status ("inside"|"boundary"|"outside"), active_from, active_to, relocated`,
`periods: { pre_2024|post_2025|post_2026_ytd|ytd_2024|ytd_2025 : { mean, median, days, coverage_pct, peak_mean, overnight_mean, smoke_days_excluded, hourly_weekday:[24], hourly_weekend:[24] } }`,
`comparisons: { post_2025_vs_pre_2024 | post_2026ytd_vs_ytd_2025 | post_2026ytd_vs_ytd_2024 : { months_used:["01",...], pre_mean, post_mean, delta_raw, pct_raw, delta_adj_control, delta_adj_control_months, control_site, control_pre_mean, control_post_mean, site_delta_on_control_months, delta_adj_reference, delta_adj_reference_months, reference_site, ci_low, ci_high, significant (bool), coverage_ok, raw_class, adj_class, classification, relative_to_control ("lagged control"|"tracked control"|"beat control"|null), basis ("raw_and_control_adjusted"|"raw_only") } }`,
Classification rule (conservative): improved = fell > 0.5 µg/m³ AND fell > 0.5 more than the control; worsened = rose > 0.5 in absolute terms, or rose ≥ 1.0 relative to the control without falling itself; unchanged = everything else. Smoke/regional days (cross-site median daily PM2.5 > 35) are excluded; months are used only when both periods have ≥ 60% daily coverage and at least 3 months overlap.
`classification` ("improved"|"unchanged"|"worsened"|"insufficient") — from `post_2025_vs_pre_2024`, else `post_2026ytd_vs_ytd_2024`; `classification_basis` names which one. Sites with no pre-CP data at all (e.g. Hunts Point, offline Sep 2023–Mar 2025) stay "insufficient" on the map, but `summary.aq.*_sites` rows fall back to the `post_2026ytd_vs_ytd_2025` trend with `basis` set accordingly.
Glyph rings: grey = `pre_2024.hourly_weekday` (or `ytd_2025` when no 2024 data), colored = selected period's `hourly_weekday`.

## aq_series.json
`{ monthly: { <site_id>: [{ym, mean, median, days}] }, daily: { <site_id>: [{date, mean}] }, smoke_days: ["YYYY-MM-DD", ...] }` (daily includes smoke days; shade them using `smoke_days`)

## dac_tracts.geojson (NYS Disadvantaged Communities 2023, NYC tracts, simplified)
props: `geoid, dac (bool), combined_pct, asthma_pct, traffic_pct, truck_pct, pm25_pct, county, population`.
All `*_pct` fields are NY State percentile ranks (0–1) from the DAC dataset, not shares or rates: `asthma_pct: 0.97` = the tract ranks at the 97th percentile statewide for asthma ED visits. Display them as ordinals ("97th percentile").

## uhf42.geojson (42 neighborhoods)
props: `uhf_code, name, borough, pm25_2024, pm25_2009, pm25_change_pct_2009_2024, pm25_series, asthma_ed_children, asthma_ed_adults, poverty_pct, health_period, health_note, asthma_ed_pm25_children, asthma_ed_pm25_adults, asthma_period`.
`asthma_ed_children` (the number the map shows) = asthma ED visits per 10,000 residents ages 5–17 in 2023, NYC DOHMH Environment & Health Data Portal, the newest year published (health data lag ~2 years). `asthma_ed_pm25_children` is the older PM2.5-attributable estimate (per 100,000, 2017–2019), kept for reference only. Source table: `data/reference/uhf42_health_context_2023.csv`.

## boroughs.geojson — props `boro_name`, `boro_code`
## tolls.json — the MTA toll table (see backend/config.py `TOLLS`)
## sources.json — `[{name, publisher, portal, dataset_id, url, used_for}]`

## Reconciled evidence (step 07, `backend/pipeline/s07_reconcile.py`)

Added beside the existing fields, never replacing them. Source: `data/reference/second_pipeline/*.csv`
(the independent analysis); decisions in `DATA_RECONCILIATION.md`. Missing values stay `null`.

### bt_facilities.geojson → `evidence`
`{ mta_facility_id, full_year: { frame, pre_mean, post_mean, pct, ci_low, ci_high, status ("increase"|"decrease"|"uncertain"|"limited"),
matched_days_2024, matched_days_2025, complete_days_2024, complete_days_2025, expected_days, matched_weekdays:[...], coverage_status,
peak: { am|pm|other: { pct, ci_low, ci_high, status, n_2024, n_2025 } }, peak_definition },
jan_aug: { "2025"|"2026": { pct, ci_low, ci_high, status, months:[...], days_2024, days_<year> } },
persistence ("reversed"|"strengthened"|"confirmed"|"weakened"|"inconclusive"), full_vs_jan_aug, limitation, unit }`.
`status = "limited"` marks the coverage-limited full-day estimate (Hugh L. Carey: complete weekend days only). The map draws
uncertain / limited crossings as rings and their flow lines in neutral grey when the metric is "change".

### aq_monitors.geojson → `evidence`, `evidence_class`, `source_name`, `geometry_note`
`evidence = { display_name|null, second_pipeline_name, geometry:{lat, lon, status},
full_year: { frame, months:["04",...], month_names, month_count, pre_mean, post_mean, delta_raw, pct_raw, ci_low, ci_high,
raw_status ("decrease"|"increase"|"uncertain"|"no_baseline"), adj_delta, adj_ci_low, adj_ci_high, adj_status (same set or null), q_value,
class ("decrease"|"uncertain"|"increase"|"no_baseline"), coverage_status, days_2024, days_2025, completeness_2024, completeness_2025,
eligible_months_2024, eligible_months_2025, interval_method, adjustment },
jan_aug: { "2025"|"2026": { months, month_names, pre_mean, post_mean, delta_raw, pct_raw, ci_low, ci_high, raw_status, adj_delta, adj_ci_low,
adj_ci_high, adj_status, class, days_2024, days_<year>, note } | null },
persistence, persistence_adjusted, full_vs_jan_aug, limitation,
context: { uhf42_id, neighborhood, nta, inside_geofence, poverty_pct, poverty_period, child_asthma_ed, adult_asthma_ed, asthma_period, asthma_unit, interpretation } }`.
`evidence_class` = `evidence.full_year.class`, or `"no_baseline"` for a site outside the validated set (Port Richmond).
`class` = `no_baseline` when there is no eligible baseline, else the weather-adjusted status, else the raw status.
Midtown West (`36061NY09929`, source name "Midtown-DOT") uses its documented original coordinates; `geometry_note` records the 2026-07-23 move.
The existing `comparisons` block (control-site method) is unchanged and is shown as "Against the citywide trend".

### summary.json → `reconciled`
`{ generated, frames:{primary, secondary}, traffic:[{ id, name, role, dac_designated, uhf42_name, avg_daily_2024, avg_daily_2025, pct_existing, pct,
ci_low, ci_high, status, matched_days, matched_weekdays, peak:{am,pm,other}, jan_aug:{"2025","2026"}, pct_2026ytd_existing, persistence, full_vs_jan_aug }],
traffic_counts:{increase, decrease, uncertain, limited}, traffic_peak_definition,
air:[{ id, site_id, name, crz_status, role, dac_designated, uhf42_name, uhf42_asthma_ed_children, uhf42_poverty_pct, class, months, month_names, month_count,
pre_mean, post_mean, delta_raw, pct_raw, ci_low, ci_high, raw_status, adj_delta, adj_ci_low, adj_ci_high, adj_status, coverage_status,
existing:{pre_mean, post_mean, delta_raw, delta_adj_control, relative_to_control, classification}, jan_aug:{...}, persistence, persistence_adjusted, context }],
air_counts:{decrease, uncertain, increase, no_baseline}, air_full_coverage_ids:[...], south_bronx:[3 air rows],
persistence_highlights:[{kind ("traffic"|"air"), id, name, label, basis?, y2025, y2026, unit}],
dot:{ strict_result, matched_total, on_map, tiers:{ same_month_2024|same_month_older|different_month: {label, rows:[{id, street, name, boro, pre_adv, post_adv, pct_change, pre_months, post_months, uhf42_name, dac_designated}]} }, post_only_context:[...], sampling_note },
methods:{traffic, air_raw, air_adjusted, air_control, causal}, external_context:{headline_22pct, url} }`.
The story (`frontend/src/content/story.js`) and the guided tour read this block; the inspectors read the per-feature `evidence`.

### uhf42.geojson (unchanged fields, now selectable)
Clicking a neighborhood polygon selects `{ layer: "uhf42", id: uhf_code }` and opens the community context card
(poverty_pct, asthma_ed_children, asthma_ed_adults, health_period, pm25_2024) with the monitors and crossings inside it.
