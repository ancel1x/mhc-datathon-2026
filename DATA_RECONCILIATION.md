# Data reconciliation: existing pipeline vs. second (validated) pipeline

*Written 2026-09-21, before any story claim was changed. Every metric that appears in Story Mode is listed here
with the value each pipeline produced, why they differ where they differ, and what the app finally shows.*

**Existing pipeline** = `backend/pipeline/s01–s06` (this repo; outputs in `frontend/public/data/`).
**Second pipeline** = the independently developed analysis delivered as `DR data/` (copied to
`data/reference/second_pipeline/`: `full_year_2024_2025_{traffic,air}.csv`, `jan_aug_2024_2025_2026_{traffic,air}.csv`,
`PHASE1_FINDINGS.{csv,md}`). It is merged into the bundle by `backend/pipeline/s07_reconcile.py`, which adds an
`evidence` block to every facility and monitor and a `reconciled` block to `summary.json`. Nothing the existing
pipeline wrote is deleted or overwritten; the new fields sit beside the old ones.

Frames used everywhere: **primary** = Jan 5–Dec 31, 2024 vs Jan 5–Dec 31, 2025; **secondary** = Jan 5–Aug 31 of
2024 / 2025 / 2026 (persistence only; 2026 is never presented as a complete year).

## 0. Definitions compared first

| Aspect | Existing pipeline | Second pipeline | Consequence |
|---|---|---|---|
| Traffic unit | Vehicles per day: plain mean of daily facility totals (all vehicle classes, both directions) over Jan 5–Dec 31 | "Standardized vehicles per complete supplied-direction day": only complete days, equal month × weekday weights (matched strata), Feb 29 excluded | Same quantity; weighting differs. Agreement within 0.3 points at 9 of 10 facilities. |
| Traffic interval | none | 95% seven-day-cluster bootstrap (200 draws) | New evidence, adopted. |
| Traffic completeness | none (SoQL daily sums; the source is complete at day level for 9 facilities) | ≥ 75% of month-weekday strata; complete days only | Only Hugh L. Carey falls below the threshold (see §1.10). |
| Rush windows | 24-hour weekday profiles (month × weekday × hour aggregates, rescaled to the daily mean) | AM 07:00–09:59 and PM 16:00–18:59 on complete weekdays, other hours incl. weekends; each with an interval | Same windows; point estimates agree within 0.2 points. |
| Jan–Aug frame | 2026: Jan 1–Aug 31 vs 2024: Jan 5–Aug 31 (243 vs 240 days) | Jan 5–Aug 31 in every year | Four extra January days in the existing 2026 figure; differences ≤ 0.3 points. Labelled "Jan–Aug" in both cases. |
| PM2.5 daily value | Mean of hourly readings, days with ≥ 18 hours; regional smoke days removed (cross-site median > 35 µg/m³) | Daily means; eligibility by day coverage per month (`days_75pct`); no explicit smoke rule (weather adjustment absorbs regional days) | Different cleaning; raw deltas still agree within 0.25 µg/m³ wherever the month sets agree. |
| PM2.5 matched months | month used when both years have ≥ 60% of days; ≥ 3 months | eligible matched months (their coverage rule); reported per site | Month sets differ by 0–1 month at 6 sites. Both pipelines report the months; the app shows the second pipeline's list because it carries the intervals. |
| PM2.5 "adjusted" | Difference-in-differences against DOHMH's control site (Van Wyck) on shared months | Regression on a regional weather proxy, then Benjamini–Hochberg across monitors | **Different questions** ("did it beat the citywide trend?" vs "did it fall once weather is accounted for?"). Not merged. Both shown, labelled. |
| PM2.5 classification | improved / unchanged / worsened / insufficient, from a ±0.5 µg/m³ band on raw AND control-adjusted change | raw status from the interval; adjusted status from the interval + BH | Existing labels can read as "no change" for sites whose PM2.5 fell but tracked the control (Broadway/35th, Queensboro, FDR). The app's four map classes now come from the second pipeline (supported decrease / uncertain / supported increase / no eligible baseline); the control reading stays as a separate line. |
| DOT counts | Spot samples paired per segment: latest pre-toll months vs 2025 months, same calendar month when available | Strict repeated matched-month rule | Second pipeline found **no eligible** street comparisons. See §4. |
| Health / EJ context | UHF42 2023 asthma ED rates + ACS 2019–23 poverty (already imported from this same export on 2026-09-21) | identical source table | Identical values: validation. |

## 1. Traffic (MTA bridges & tunnels), primary frame

Existing display = `change.pct_2025_vs_2024` (plain daily mean). Second pipeline = `change_pct` with its 95% interval.

| # | Facility | Existing | Second pipeline (95% interval) | Second-pipeline status | Definition / method difference | Final representation | Reason |
|---|---|---|---|---|---|---|---|
| 1.1 | RFK Bridge, Manhattan span | +2.1% | +2.05% (+1.09 to +3.21) | increase | rounding / weighting | keep existing +2.1%; add interval; **supported increase** | agreement |
| 1.2 | Bronx–Whitestone | +1.9% | +1.90% (+1.20 to +2.65) | increase | none | keep; add interval; supported increase | agreement |
| 1.3 | Marine Parkway | +1.9% | +1.62% (+0.19 to +3.43) | increase | 357 vs 359 complete days; equal strata weights | keep existing +1.9% on the map; inspector shows the matched-day estimate and interval; supported increase | same direction, existing value inside the interval |
| 1.4 | Cross Bay | +1.0% | +0.87% (−0.58 to +2.29) | uncertain | weighting | keep; add interval; **uncertain** (ring on the map, grey flow line) | interval includes zero |
| 1.5 | Henry Hudson | +0.6% | +0.48% (−1.21 to +1.80) | uncertain | weighting | keep; uncertain | interval includes zero |
| 1.6 | Verrazzano–Narrows | +0.5% | +0.47% (−0.17 to +1.24) | uncertain | none | keep; uncertain | interval includes zero |
| 1.7 | RFK Bridge, Bronx span | +0.4% | +0.34% (−0.50 to +1.06) | uncertain | facility 21 combines the Bronx and Queens plazas | keep; uncertain; note on the plaza combination | interval includes zero |
| 1.8 | Throgs Neck | +0.4% | +0.40% (−0.19 to +1.14) | uncertain | none | keep; uncertain | interval includes zero |
| 1.9 | Queens Midtown Tunnel | −1.0% | −1.11% (−2.39 to +0.52) | uncertain | weighting | keep; uncertain (its PM-rush decline is supported, see §2) | interval includes zero |
| 1.10 | Hugh L. Carey Tunnel | −2.5% (all 362 / 361 days; weekdays −1.9%, weekends −4.4%) | −6.05% (−9.12 to −3.36) on **complete Saturdays and Sundays only** (75 / 68 days); weekdays did not meet the completeness rule | decrease, coverage-limited | the second pipeline found only 107 (2024) and 97 (2025) complete days at this facility; its full-day estimate is a selected-day comparison | show the existing all-days −2.5% with a **prominent coverage warning**; inspector shows the strict weekend-only estimate and interval separately; map treats it as **coverage-limited** (ring, grey flow line), never as equivalent to fully covered crossings | the two figures answer different questions (all days vs complete weekend days); neither is a clean full-year estimate |
| 1.11 | All nine crossings together | +0.5% (929,483 → 934,058 vehicles/day) | not computed | — | — | keep, labelled "observed sum, no interval" | existing only; descriptive |
| 1.12 | Truck changes per facility | computed (e.g. Whitestone trucks +3.1%) | not computed | — | — | kept in the inspector / Explore only; removed from the story headline | no interval; not required by the brief's questions |

Consequence for wording: "every bridge around Manhattan got busier" (existing story) is **not supported**. Three
increases are supported, six changes are indistinguishable from zero, one tunnel is coverage-limited. Traffic
counts are crossing events, not tracked trips, so no sentence may say the same vehicles moved from the tunnels
to the bridges.

## 2. Traffic, rush hours (weekday AM 07–09 / PM 16–18 / other hours)

Existing values derived from the 24-hour weekday profiles; second pipeline gives each window an interval.

| Facility | AM existing / second (interval) | PM existing / second (interval) | Other hours, second (interval) | Final |
|---|---|---|---|---|
| Whitestone | +4.7 / +4.73 (+3.11 to +6.36) | +0.1 / +0.08 (−0.69 to +0.86) | +1.78 (+0.93 to +2.52) | AM and other-hours supported increases; PM flat |
| Henry Hudson | +4.0 / +4.02 (+0.41 to +7.33) | −0.2 / −0.19 (−2.04 to +1.41) | −0.03 (−1.55 to +1.24) | AM supported increase while the whole day is uncertain |
| Verrazzano | +1.9 / +1.84 (+0.27 to +3.40) | +0.3 / +0.29 (−0.40 to +0.99) | +0.28 (−0.45 to +0.89) | AM supported increase; whole day uncertain |
| RFK Manhattan | +2.2 / +2.37 (+0.25 to +4.81) | +1.7 / +1.79 (+0.58 to +2.86) | +2.06 (+1.07 to +3.12) | all windows supported increases |
| Throgs Neck | −0.9 / −0.89 (−2.93 to +1.24) | +2.2 / +2.33 (+1.37 to +3.44) | +0.29 (−0.65 to +1.08) | PM supported increase; whole day uncertain |
| Queens Midtown | −0.8 / −0.70 (−3.15 to +1.53) | −1.9 / −1.79 (−3.34 to −0.35) | −1.05 (−2.66 to +0.46) | PM supported decrease; whole day uncertain |
| Cross Bay | +2.0 / +1.95 (−0.49 to +4.84) | +1.5 / +1.60 (−0.46 to +3.51) | +0.52 (−0.97 to +2.12) | uncertain |
| Marine Parkway | +2.1 / +2.03 (−0.57 to +5.06) | +1.0 / +1.03 (−1.30 to +3.34) | +1.62 (+0.13 to +3.55) | other-hours supported; rush windows uncertain |
| RFK Bronx | +0.4 / +0.40 (−1.58 to +2.40) | −0.6 / −0.40 (−1.13 to +0.38) | +0.43 (−0.40 to +1.29) | uncertain |
| Hugh L. Carey | −0.3 / −0.27 (−2.82 to +2.70) | −0.8 / −0.74 (−1.54 to +0.45) | −6.05 (selected days) | uncertain; coverage-limited |

Decision: same metric under the same definition, agreement within 0.2 points → keep the existing hour profiles
(clock glyphs, hour-of-day chart) and **add** the second pipeline's window estimates and intervals as the
"rush hours vs whole day" evidence. This is the material that answers the brief's daily / peak-hour question.

## 3. Traffic, secondary frame (Jan–Aug 2026 vs Jan–Aug 2024) and persistence

| Facility | Existing 2026 vs 2024 | Second pipeline (interval) | Jan–Aug 2025 vs 2024 (second) | Persistence label (second) | Final |
|---|---|---|---|---|---|
| Whitestone | +0.2% | +0.28 (−1.29 to +1.71) | +2.30 (+1.56 to +3.17) | inconclusive (year-one increase weakened) | keep existing; add interval; inconclusive |
| Cross Bay | −3.5% | −3.29 (−5.08 to −1.24) | +2.72 (+0.97 to +4.49) | **reversed** | keep; supported decrease; reversed |
| Henry Hudson | −1.0% | −0.70 (−2.75 to +1.83) | +0.71 | inconclusive | keep; uncertain |
| Hugh L. Carey | −6.1% | −7.75 (−11.36 to −4.39), selected days | −6.28, selected days | inconclusive | coverage warning as in §1.10 |
| Marine Parkway | −0.2% | +0.07 (−2.24 to +2.68) | +2.79 (+0.89 to +4.86) | inconclusive (weakened) | keep; uncertain |
| Queens Midtown | −4.8% | −4.73 (−6.51 to −3.21) | −1.67 (−2.96 to −0.38) | **strengthened** | keep; supported decrease; strengthened |
| RFK Bronx | −1.1% | −0.98 (−2.67 to +0.44) | +0.97 (+0.04 to +1.87) | inconclusive | keep; uncertain |
| RFK Manhattan | −0.2% | +0.01 (−1.63 to +1.47) | +2.54 (+1.60 to +3.57) | inconclusive (weakened) | keep; uncertain |
| Throgs Neck | +0.1% | +0.14 (−1.26 to +1.58) | +1.30 (+0.45 to +2.27) | inconclusive | keep; uncertain |
| Verrazzano | −0.7% | −0.69 (−2.26 to +1.04) | +1.00 (+0.18 to +1.69) | inconclusive | keep; uncertain |
| All nine crossings | −1.3% | — | — | — | keep, observed sum only |

Existing story wording "the rerouting of year one is fading" / "the crossings around the zone are down too" is
replaced by: some patterns persisted (Queens Midtown decline strengthened), one reversed (Cross Bay), and the
year-one supported increases (RFK Manhattan, Whitestone, Marine Parkway) are no longer distinguishable from 2024;
most locations are formally inconclusive.

Zone entries (Jan–Aug 2026 vs Jan–Aug 2025: weekday −4.9%, trucks −7.1%) exist only in the existing pipeline
(the second pipeline records "CRZ: starts in 2025; no pre-policy baseline"). Kept, labelled as 2026 vs 2025 with
no pre-toll baseline.

## 4. NYC DOT counts

| Item | Existing | Second pipeline | Final |
|---|---|---|---|
| Matched before/after locations | 23 (of 316 mapped): 5 same-calendar-month with a 2024 baseline (Williamsburg Bridge approach ×2, West End Ave at 60th, E 58th St, University Heights Bridge; all Oct 2024 → Oct 2025), 2 same-month with an older baseline (Ocean Pkwy 2021, 12th Ave 2022), 16 different-month pairs (baselines 2019–2024) | "No eligible repeated matched street comparisons; no citywide street estimate" | DOT stays on the map and in the story as **sampled matched locations**, tiered by baseline quality, with the strict result stated in the same card. No citywide street-level change is claimed; no DOT figure is used to say traffic rerouted. |
| Post-toll-only counts (Major Deegan at High Bridge 45,904/day one roadway Oct–Nov 2025; Deegan NB entrance at Willis Ave 26,108 Dec 2025; Bruckner Blvd 8,315 Mar 2025) | descriptive | not used | kept as descriptive context in the highway scenario, labelled "counted after the toll only, no before" |

Why the strict pipeline found nothing eligible: it requires the same segment, direction and calendar month with
sufficient complete days in both a 2024 baseline and 2025; the existing pairs either use a different month, an
older year, or one-week samples that fail the day threshold. The existing pairs are therefore evidence about
those spots, not about the city.

## 5. Air quality (NYCCAS), primary frame

Existing = matched-month means, raw Δ, control-adjusted Δ (vs Van Wyck), bootstrap interval on raw Δ,
class from the ±0.5 band. Second = matched-month means, raw Δ with interval, weather-adjusted Δ with interval and BH.

| # | Monitor | Existing 2024 → 2025 (raw Δ; months; class) | Second raw Δ (interval; months) | Second weather-adjusted Δ (interval; status) | Final class on the map | Reason |
|---|---|---|---|---|---|---|
| 5.1 | Williamsburg Bridge | 8.42 → 6.81 (−1.60; 7; improved, beat control) | −1.63 (−2.41 to −0.71; 8: Mar–Jun, Aug–Nov) | −2.55 (−3.42 to −1.67); decrease | **supported decrease** | both pipelines agree; strongest site |
| 5.2 | Manhattan Bridge | 9.20 → 7.82 (−1.38; 10; improved, beat control) | −1.43 (−2.58 to −0.53; 11) | −1.97 (−2.91 to −1.03); decrease | supported decrease | agreement |
| 5.3 | Van Wyck (DOHMH control) | 7.25 → 6.34 (−0.91; 8; improved) | −0.87 (−1.82 to −0.12; 8) | −1.40 (−2.18 to −0.61); decrease | supported decrease | agreement |
| 5.4 | Broadway / 35th St | 8.91 → 8.01 (−0.91; 12; unchanged, tracked control) | −0.92 (−1.62 to −0.25; **12 of 12**) | −1.32 (−2.12 to −0.51); decrease | supported decrease | existing "unchanged" meant "no better than the control"; raw and weather-adjusted intervals both exclude zero, so the plain-English class is a decrease; the control reading is kept as a separate line |
| 5.5 | Queensboro Bridge | 7.52 → 6.57 (−0.95; 10; unchanged, tracked control) | −0.99 (−1.59 to −0.32; 10) | −1.26 (−1.90 to −0.62); decrease | supported decrease | as 5.4 |
| 5.6 | FDR Drive | 7.48 → 6.70 (−0.78; 9; unchanged, tracked control) | −0.73 (−1.48 to +0.04; 9) raw uncertain | −1.11 (−1.92 to −0.31); decrease | supported decrease (weather-adjusted); raw uncertain shown beside it | adjusted interval excludes zero |
| 5.7 | Queens College (reference) | 6.44 → 6.00 (−0.44; 6; unchanged, lagged control) | −0.25 (−0.96 to +0.58; 7) raw uncertain | −0.78 (−1.41 to −0.15); decrease | supported decrease (weather-adjusted) | adjusted interval excludes zero |
| 5.8 | Mott Haven | 7.61 → 7.59 (−0.02; 8; unchanged, **lagged control** by +0.85) | +0.09 (−0.68 to +0.83; 9: Apr–Dec) | −0.36 (−1.23 to +0.51); uncertain | **uncertain** | both intervals include zero; the existing "lagged the control by 0.85" is kept as a descriptive line without an interval |
| 5.9 | Cross Bronx Expressway | 9.26 → 9.02 (−0.24; 9; unchanged, lagged control by +0.87) | −0.19 (−1.31 to +0.78; 9) | −0.65 (−1.71 to +0.41); uncertain | uncertain | as 5.8 |
| 5.10 | Hunts Point | insufficient: offline Sep 2023 – Mar 2025; existing fell back to Jan–Aug 2026 vs 2025 (8.53 → 7.99) | no eligible baseline | not estimated | **no eligible baseline** | agreement; the 2026-vs-2025 reading stays in the inspector only, labelled as not a before/after result |
| 5.11 | BQE (Williamsburg) | 5.45 → 5.61 (+0.16; 4: Sep–Dec; unchanged) | −0.02 (−0.86 to +1.15; 5: Aug–Dec) | −0.33 (−1.07 to +0.41); uncertain | uncertain | month set differs by August; both uncertain |
| 5.12 | Hamilton Bridge (Cross Bronx / Deegan approach) | 6.90 → 9.15 (+2.25; 5; **worsened**; interval +1.15 to +3.41) | +2.17 (+0.82 to +3.32; 5: Jun, Aug–Nov) increase | +1.28 (+0.04 to +2.51); uncertain after BH (q = 0.07) | **uncertain**, flagged "raw increase supported; may have worsened" | raw intervals agree; the weather-adjusted result does not survive multiple-comparison correction. Neither "worsened" nor "no change" is honest alone, so the map says uncertain and the card says both. |
| 5.13 | Staten Island Expressway | 7.11 → 8.00 (+0.89; 4; **worsened** although its own interval −0.27 to +2.04 included zero) | +0.62 (−0.80 to +2.28; 4) | +0.86 (−0.55 to +2.26); uncertain | uncertain | existing label came from the ±0.5 band and ignored the interval; revised |
| 5.14 | Midtown West (W 39th St; source name "Midtown-DOT") | 9.13 → 9.55 (+0.42; 4; unchanged) | +0.06 (−1.11 to +1.44; 5: Aug–Dec) | −0.27 (−1.32 to +0.77); uncertain | uncertain; site relocated 2026-07-23, so no eligible Jan–Aug 2026 comparison | agreement; original coordinates used for the marker |
| 5.15 | Glendale | insufficient (site moved Jul 2024, ended Oct 2025) | no eligible baseline | — | no eligible baseline | agreement |
| 5.16 | Port Richmond | insufficient (May–Aug 2024 only) | not in the second pipeline's 15-site scope | — | no eligible baseline (kept on the map as "not available") | existing feature retained rather than deleted |

Counts (15 monitors in the validated scope + Port Richmond): supported decrease 7, uncertain 6, supported
increase 0, no eligible baseline 3 (Hunts Point, Glendale, Port Richmond). Coverage: only Broadway/35th has all
12 matched months; every other estimate is a partial matched-month window and is labelled as such.

The existing control-relative reading (beat / tracked / lagged the Van Wyck control) is not discarded: it is the
answer to "did the site move more than the citywide trend", which the South Bronx chapter still needs. It is shown
as a descriptive line without an interval, never as the map class.

## 6. Air quality, secondary frame and persistence

| Monitor | Jan–Aug 2025 vs 2024 (second, adjusted where estimated) | Jan–Aug 2026 vs 2024 | Persistence (raw / adjusted) | Final |
|---|---|---|---|---|
| Williamsburg Bridge | −3.27 (−4.47 to −2.07) | −4.23 (−5.25 to −3.21) | strengthened / strengthened | **strengthened** |
| Van Wyck | −2.39 (−3.43 to −1.35) | −2.69 (−3.58 to −1.80) | confirmed / strengthened | **confirmed** (raw), strengthened after adjustment |
| Manhattan Bridge | −3.10 | −2.61 (−4.90 to −0.33) | inconclusive / weakened | inconclusive |
| FDR, Broadway/35th, Queensboro, Queens College | supported decreases in 2025 | 2026 intervals include zero (Broadway, Queensboro) or remain below zero (FDR, Queens College) | inconclusive | inconclusive |
| Mott Haven, Cross Bronx, BQE, SI Expwy, Hamilton | uncertain | uncertain | inconclusive | inconclusive |
| Midtown West | uncertain | no eligible baseline (relocation) | inconclusive | inconclusive |
| Hunts Point, Glendale | — | — | — | no eligible baseline |

The existing pipeline's `post_2026ytd_vs_ytd_2024` comparisons remain in the data; the app's 2026 monitor classes
now come from the second pipeline's Jan–Aug results (adjusted where estimated, raw where not).

## 7. South Bronx (Mott Haven, Cross Bronx, Hunts Point)

Existing story: "the South Bronx did not improve at all … stood still while the rest of the city improved" (based
on lagging the control by ≈ 0.85 µg/m³, not significant). Second pipeline: Mott Haven and Cross Bronx uncertain
after weather adjustment; Hunts Point no eligible baseline. Final wording: *"The available monitor-level evidence
does not show a statistically clear PM2.5 increase or decrease at Mott Haven or Cross Bronx, while Hunts Point lacks
an eligible 2024 baseline."* The control-relative lag is mentioned as a descriptive observation with its
uncertainty stated. Neighborhood context (identical in both pipelines): Hunts Point–Mott Haven poverty 35.8%
(ACS 2019–23), child asthma ED 266.2 and adult 193.5 per 10,000 (2023); Crotona–Tremont 33.9%, 258.9, 171.0.
These are pre-existing indicators, not outcomes of the toll.

## 8. Environmental-justice overlap

Existing claim "3 of the 8 bridges that got busier are in Disadvantaged Communities" depended on treating every
positive change as an increase. With intervals: 1 of the 3 supported increases (RFK Manhattan span, East Harlem)
is in a DAC tract. The existing "worsened monitor in a DAC tract" (Hamilton Bridge) is now "uncertain, raw increase".
Final framing: the supported PM2.5 decreases sit in or beside the priced core (Manhattan Bridge, Williamsburg
Bridge, Broadway/35th, Queensboro, FDR) and at two Queens sites (Van Wyck, Queens College), in neighborhoods with
child asthma ED rates of 24–160 per 10,000; the two highest-burden monitored neighborhoods (259–266) saw no
statistically clear change either way. Historical vulnerability ≠ new harm caused by the policy.

## 9. Highway scenario

Existing: two corridors (Deegan and BQE) reasoned together, with "when a route got costlier, traffic went around it,
not away" as the mechanism. That sentence is an origin–destination claim the counts cannot support. Final: **one**
corridor, the Major Deegan (strongest combination of feeder-crossing evidence, adjacent monitors, DOT snapshots and
environmental-justice burden), labelled "data-grounded scenario reasoning, not a forecast", with no fabricated
diversion shares, PM2.5 reductions or health outcomes. Observed inputs only: Deegan 45,904/day at High Bridge (one
roadway, post-toll only); feeders RFK Bronx 144k/day (+0.4%, uncertain), Henry Hudson 70k (AM rush +4.0%, supported),
Whitestone 139k (+1.9%, supported), Throgs Neck 124k (+0.4%, uncertain); monitors Mott Haven / Cross Bronx uncertain,
Hamilton Bridge raw increase; asthma ED 259–288 per 10,000 along the corridor.

## 10. External context

The "22%" figure (Cornell University, *npj Clean Air*, Dec 2025: modeled daily-maximum PM2.5 drop inside the zone vs a
projected no-toll level, Jan–Jun 2025) and MTA's reported entry decline against a modeled baseline are neither
pipeline's result. Shown once, in the toll chapter, labelled **external context**.

## 11. Things intentionally not carried into Story Mode

KNN / ridge / random-forest model metrics, feature importance, the traffic–PM2.5 regression coefficients and
correlations (second pipeline §C; all associations, and the model does not beat a station-mean baseline), the
2028 / 2031 toll increases, the 2009 → 2024 long-run PM2.5 history beyond one baseline sentence, truck shares per
facility, and the BQE as a second scenario. They stay in the source tables and the inspectors where relevant.

## 12. Geometry and identifiers

Facility IDs: second pipeline MTA IDs 21–30 joined to existing ids by exact facility name (10 / 10 matched).
Monitor IDs: NYCCAS `SiteID` (15 / 15 matched; Port Richmond exists only in the existing data). Existing
approximate facility points are kept (the animated flow routes are drawn from them); the second pipeline's
"representative corridor points" differ by up to ~0.5 km and are recorded in the reference CSVs. Midtown West uses
its documented original coordinates (the site moved 50 m on 2026-07-23). UHF42 joins by `uhf42_id` = `uhf_code`.
