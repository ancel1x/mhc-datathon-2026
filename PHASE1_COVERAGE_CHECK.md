# Phase 1 coverage check

*Audit of the final story map against the organizer's Phase 1 brief, 2026-09-21. Step numbers refer to the
timeline in the app (`?chapter=N`); "inspector" = the right-hand detail panel that opens when a map feature is
clicked; "Explore" = the free mode after the last step.*

## Required layers

| | Requirement | Answer | Where in the app |
|---|---|---|---|
| A | NYCCAS before/after PM2.5 data integrated? | **YES** | Step 6 (Air) maps all 16 monitors with the four classes (supported decrease / uncertain / supported increase / no eligible baseline), a supported-decreases table on the card and an every-monitor table under Details. The monitor inspector shows 2024 and 2025 matched-month means, raw Δ and %, weather-adjusted Δ, both 95% intervals, matched-month chips (n / 12), valid days, the control-site reading, the monthly PM2.5 series with the Jan 5 2025 marker, hour-of-day profiles and the Jan–Aug 2025 / 2026 persistence. Steps 1, 7, 8, 9 reuse the layer. |
| B | MTA bridge/tunnel volumes integrated? | **YES** | Step 4 (Crossings) maps all 10 facility IDs with supported / uncertain / coverage-limited status; the card carries the three supported increases, the uncertain count, the system sum and a rush-hours-vs-whole-day table; Details holds every crossing's interval bars. The crossing inspector shows 2024 / 2025 vehicles per day, % change, 95% interval, status, matched days and weekdays, AM / PM / other-hours intervals, monthly series with toll marker, weekday / weekend profiles, direction split and Jan–Aug 2025 / 2026 persistence. Hugh L. Carey carries a red coverage warning. Steps 1, 7, 8, 9, 10 reuse the layer. |
| C | DOT traffic counts integrated honestly? | **NO — removed by choice** | The DOT street-counter layer and its dedicated step were removed from the app. The matched one-week samples never produced an eligible same-month pair, so they supported no citywide street-level estimate, and presenting them risked implying evidence of rerouting that the sampling design cannot give. One DOT-derived figure is retained as labelled context: the Major Deegan post-toll snapshot (45,904 vehicles a day on one roadway, no "before") in Chapters 6 and 8. The processed DOT files remain in the repo and the pipeline still builds them. |
| D | Congestion Relief Zone boundary visible? | **YES** | The official MTA geofence polygon (white outline) is on from step 2 onward and in Explore; step 2 zooms to the 60th Street line. |
| E | Toll structure visible? | **YES** | Step 2: car daytime $9.00, overnight $2.25, largest trucks $21.60 and the tunnel credit on the card; the full E-ZPass table (four vehicle classes, peak / overnight / credit, per-trip taxi and app-ride fees, peak hours, excluded roadways) under Details. Scheduled future increases are intentionally not shown. |
| F | Can the viewer tell where PM2.5 improved / stayed uncertain / may have worsened / lacks a baseline? | **YES** | Step 6 map: green disc = supported decrease (7), grey disc = uncertain (6), red disc = supported increase (0), hollow ring = no eligible baseline (3). "May have worsened" is explicit: Hamilton Bridge's raw rise (+2.17 µg/m³, interval above zero) is named on the card and in Details, classed uncertain because the weather-adjusted result does not survive correction. The key on the right spells out the four classes. |
| G | Can the viewer see overlap with historically vulnerable communities? | **YES** | Step 8 (Burden) overlays the state Disadvantaged Community tracts (switchable to the burden-score percentile or the 2023 child-asthma choropleth) on the traffic and monitor verdicts; step 7 uses the asthma choropleth around the South Bronx monitors; clicking any neighborhood opens a context card (poverty %, child and adult asthma ED rates with period, unit and source, and the verdicts of the monitors and crossings inside it) that states the figures are pre-existing, not policy outcomes. |

## The four questions

| | Question | Answer | Which step / visual answers it |
|---|---|---|---|
| Q1 | Does the map address whether the optimistic headline masks a mixed daily / peak-hour picture? | **YES** | Step 2 labels the "22%" as external context (a modeled figure); step 3 shows what was actually measured in the priced core (≈502k weekday entries, 77% in tolled hours, busiest hour 8 AM); step 4's "Rush hours vs the whole day" table and every crossing's AM / PM / other-hours interval bars show that the morning rush rose at Whitestone (+4.7%), Henry Hudson (+4.0%) and the Verrazzano (+1.8%) even where whole-day changes are uncertain, while the Queens Midtown evening rush fell (−1.8%). Step 6 shows the air picture is also mixed: 7 supported decreases, 6 uncertain, 3 without a baseline. |
| Q2 | Does it address whether traffic / pollution appears eliminated vs redistributed, and whether those places are vulnerable? | **YES** | Steps 4 and 8. What the evidence supports: entries into the priced core fell in official reporting and again in year two (−4.9% weekday, 2026 vs 2025); outside it, three crossings show supported increases (RFK Manhattan span +2.1%, Whitestone +1.9%, Marine Parkway +1.9%), six are uncertain and the nine crossings together were +0.5%, an observed sum. That is consistent with partial redistribution and partial elimination; the counts cannot show that the same vehicles moved. One of the three supported increases (RFK Manhattan, East Harlem) is in a Disadvantaged Community; the supported PM2.5 decreases sit in and beside the priced core, in neighborhoods with 24–160 child asthma ED visits per 10,000, while the South Bronx monitors (259–266) show no clear change. |
| Q3 | Does it show the South Bronx monitor-level results separately from citywide patterns? | **YES** | Step 7 is only Mott Haven, Cross Bronx Expressway and Hunts Point, each with its own weather-adjusted estimate and interval (−0.36, −1.23 to +0.51; −0.65, −1.71 to +0.41; no eligible baseline), a pre-existing-burden table (poverty 35.8% / 33.9%, child asthma ED 266.2 / 258.9, adult 193.5 / 171.0, with periods and units) and, under Details, the raw readings, the control-site comparison (descriptive, not supported) and the Bronx crossings. The wording never asserts harm or improvement. |
| Q4 | Does it provide one defensible highway removal / repurposing scenario, clearly labelled? | **YES** | Step 10 reasons through one corridor, the Major Deegan, under a red badge "Data-grounded scenario reasoning · not a forecast": existing burden (45.9k vehicles/day on one roadway, post-toll only), feeder crossings (RFK Bronx uncertain; Henry Hudson AM rush +4.0% supported), adjacent monitors (uncertain; Hamilton Bridge raw rise), pre-existing asthma burden (259–288 per 10,000), the possible benefit and the redistribution risk. No percentage reduction, diversion path, PM2.5 change or health outcome is stated; Details explains why it is reasoning, not a model, and why the BQE was not chosen. |

## Other acceptance criteria

| Criterion | Status |
|---|---|
| Existing map architecture intact (React + MapLibre, left card, right inspector, timeline, guided tour, flow layer, camera moves, Explore) | Yes; no component was removed. |
| Both pipelines reconciled rather than one replacing the other | Yes: `DATA_RECONCILIATION.md`; step 07 adds fields beside the existing ones. |
| Uncertainty represented; strong findings prominent; weak findings qualified | Yes: interval bars, four classes, rings for uncertain crossings, coverage warnings, matched-month chips. |
| Air raw / weather-adjusted inspectable | Yes: monitor inspector and both air tables. |
| 2026 clearly partial-year | Yes: every 2026 label reads "Jan–Aug"; the 2026 step's lede says so. |
| Sources and limitations available | Step 11 (nine caveats) + the Sources view. |
| No ML / regression clutter in Story Mode | Yes; model diagnostics remain only in the reference CSVs. |
| App builds; runs from a direct link; no console errors | `npm run build` clean; headless captures of every step, the tour and four inspectors reported no console errors or exceptions. |

**Result: every required answer is YES. Phase 1 coverage is complete.**
