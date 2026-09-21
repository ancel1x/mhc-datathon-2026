# Second pipeline (independent analysis), delivered 2026-09-21

These files are the map-ready outputs of an independently developed analysis of the same sources
(MTA Bridges & Tunnels hourly crossings, NYCCAS real-time PM2.5, UHF42 health context). They are **not** regenerated
by this repo's pipeline; they are read by `backend/pipeline/s07_reconcile.py`, which merges the intervals,
eligibility, rush-window and persistence fields into the frontend bundle without replacing anything the existing
pipeline computed. The reconciliation of the two is documented in `DATA_RECONCILIATION.md` at the repo root.

| file | what it holds |
|---|---|
| `full_year_2024_2025_traffic.csv` | one row per MTA facility: Jan 5–Dec 31 2024 vs 2025 standardized vehicles per complete day, 95% bootstrap interval, matched days / weekdays, AM (07–09) / PM (16–18) / other-hours changes with intervals, Jan–Aug 2025 and 2026 changes vs 2024, persistence classification |
| `jan_aug_2024_2025_2026_traffic.csv` | the Jan 5–Aug 31 comparisons (2025 vs 2024, 2026 vs 2024) with day counts |
| `full_year_2024_2025_air.csv` | one row per NYCCAS monitor: eligible matched months, raw change with interval, weather-adjusted change with interval and BH q-value, completeness, persistence, UHF42 context (poverty, asthma ED) |
| `jan_aug_2024_2025_2026_air.csv` | the Jan 5–Aug 31 monitor comparisons, raw and adjusted |
| `PHASE1_FINDINGS.csv` / `.md` | the analysis team's own findings tables and write-up (includes model diagnostics that the app does not use) |

Method notes (from the files themselves): traffic intervals are 95% seven-day-cluster exponential-weight bootstraps
(200 draws) over month × weekday strata with at least 75% of strata present; monitor intervals are 400 within-month
seven-day block draws over equal-weight eligible months; the weather adjustment uses a regional weather proxy and
Benjamini–Hochberg correction across monitors. All results are associations, not identified policy effects.
