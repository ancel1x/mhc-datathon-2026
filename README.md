# 🗽 The real story of congestion pricing

An interactive map of New York City: what happened to traffic and fine-particle air pollution (PM2.5) after the
$9 toll started on January 5, 2025, where it changed, and who lives there.

Built for the MHC Datathon 2026, Phase 1. All data is official (MTA, NYC DOT, NYC Health Department, NY State).

![Crossings step: which bridges and tunnels changed, with 95% intervals](docs/screenshots/04-crossings.png)

## 🚀 Quick start

Needs Node.js 22 or newer. The processed data is already in the repo, so there is nothing else to install.

```bash
git clone https://github.com/ancel1x/mhc-datathon-2026.git
cd mhc-datathon-2026/frontend
npm install
npm run dev
```

Open http://localhost:5173.

## 🗺️ What you'll see

The map tells the story in 11 steps along a timeline, then lets you explore.

| | Step | What it answers |
|---|---|---|
| 🏙️ | Before the toll | The 2024 baseline for the nine MTA crossings and the air monitors |
| 💵 | The toll begins | The zone boundary and the toll structure |
| 🚗 | Inside the zone | How many vehicles still enter, and when |
| 🌉 | Crossings | Which bridges and tunnels changed in 2025, and how rush hours differ from the whole day |
| 🛣️ | Street level | What NYC DOT's sampled street counts add, and what they cannot say |
| 🌬️ | Air | Which monitors got cleaner, which are uncertain, which have no baseline |
| 🏘️ | The South Bronx | Mott Haven, Cross Bronx and Hunts Point read on their own |
| ⚖️ | Who was already carrying the most | The results laid over the state's Disadvantaged Communities |
| 📅 | 2026 so far | Whether the year-one patterns persisted in January to August 2026 |
| 🔮 | If the Major Deegan came down | One highway scenario, reasoned from the data and labelled as such |
| ⚠️ | What this can't say | Caveats and sources |

Then:

- 🖱️ **Click anything** (a crossing, a monitor, a street counter, a neighborhood) to open its evidence: before and after values, the 95% interval, matched months, rush-hour windows, monthly series, 2026 status.
- 🔢 **Every number is explained.** The stat keeps its unit and gets a plain reading next to it, like "+1.9% means about 2 more vehicles for every 100 in 2024".
- ▶️ **Play the story** runs a guided tour with callouts on the map. Press Next on a callout, or the arrow keys, to skip ahead.
- 🧭 **Explore** at the end: pick the year, toggle layers, zoom past level 11 for 24-hour clock glyphs.

## 🧰 Tech stack

- **Map:** MapLibre GL 5 (react-map-gl), OpenFreeMap vector tiles, a custom dark style, a canvas overlay for the animated traffic flow
- **App:** React 19, Vite 7, plain JavaScript, Recharts and d3 for charts and glyphs
- **Data pipeline:** Python 3.12, pandas, DuckDB, shapely, pyproj
- **API (optional):** FastAPI
- **Tests:** pytest

## ⚙️ How it works

1. 🐍 `backend/pipeline/s00` to `s06` download the public inputs, aggregate the raw counts and readings for 2024, 2025 and Jan to Aug 2026, join every point to its neighborhood, and write a bundle of JSON and GeoJSON.
2. 🔁 `s07_reconcile.py` merges a second, independent analysis of the same sources into that bundle: 95% intervals, matched-month coverage, rush-hour windows, persistence labels. Existing fields are kept, not replaced.
3. 📦 The bundle is copied to `frontend/public/data/`, so the app runs on its own.
4. 🖥️ The frontend reads the bundle, writes the story text from the numbers in it, and renders the map, the story panel, the timeline and the inspector.

More detail: [DATA_RECONCILIATION.md](DATA_RECONCILIATION.md) (how the two analyses were compared),
[docs/PHASE1_FINDINGS.md](docs/PHASE1_FINDINGS.md) (the findings), [docs/DATA_CONTRACT.md](docs/DATA_CONTRACT.md)
(file formats), [PHASE1_COVERAGE_CHECK.md](PHASE1_COVERAGE_CHECK.md) (checklist against the datathon requirements).

## 🔬 How the numbers are made

- 📆 **Frames.** Jan 5 to Dec 31, 2024 vs 2025 is the main comparison. Jan 5 to Aug 31 of 2024, 2025 and 2026 checks whether patterns persisted. 2026 is never shown as a full year.
- 🌉 **Traffic.** Vehicles per day at each MTA crossing, with a 95% interval. A change is "supported" only when the whole interval sits on one side of zero. Zone entries have no pre-toll baseline. DOT counts are one-week samples, shown as matched locations, never as a citywide estimate.
- 🌬️ **Air.** Hourly PM2.5 at street-level monitors, compared on months with enough data in both years. Each monitor gets a raw change, a weather-adjusted change with an interval, and a comparison against the Health Department's control site. The map verdict: supported decrease, uncertain, supported increase, or no eligible baseline.
- 🏘️ **Neighborhoods.** Every point is joined to its census tract (state Disadvantaged Community designation) and neighborhood (asthma ER visits in 2023 and poverty, the newest published).
- 🚫 **Not proof of cause.** Association is not cause, counts are crossings not tracked trips, and most monitors have partial coverage.

## 🐍 Optional: pipeline and API

Only needed to recompute the numbers or use the date-range endpoints. Needs Python 3.12 or newer.

```bash
# Windows
powershell -ExecutionPolicy Bypass -File .\setup.ps1     # once: .venv + packages
powershell -ExecutionPolicy Bypass -File .\dev.ps1       # API on :8000 + app on :5173

# Mac / Linux
chmod +x setup.sh dev.sh
./setup.sh
./dev.sh
```

- Recompute everything: `python backend/pipeline/run_all.py` (use the `.venv` interpreter). Downloads about 30 MB.
- Re-run only the merge step: `python backend/pipeline/s07_reconcile.py`
- The two large raw files (zone entries, 1 GB; DOT counts, 275 MB) are not required; their intermediates are in `data/processed/`.
- Tests: `python -m pytest backend/tests -q`

## 📁 Repository layout

```
frontend/                 the app (frontend/README.md describes the UI)
frontend/public/data/     processed data the app reads (about 3 MB)
backend/pipeline/         Python steps s00 to s07
backend/api/              FastAPI server
backend/tests/            pytest checks
data/processed/           pipeline intermediates and the bundle
data/reference/           partner tables: 2023 health context, second analysis pipeline
docs/                     findings, data contract, screenshots
```

## 📊 Data sources

| Dataset | Publisher | Where |
|---|---|---|
| Congestion Relief Zone vehicle entries | MTA | NY State Open Data `t6yz-b64h` |
| Bridges and Tunnels hourly crossings | MTA | NY State Open Data `ebfx-2m7v` |
| Congestion Relief Zone boundary | MTA | NY State Open Data `srxy-5nxn` |
| Automated traffic volume counts | NYC DOT | NYC Open Data `7ym2-wayt` |
| Street-level PM2.5 monitors (NYCCAS) | NYC DOHMH, Queens College | github.com/nychealth/nyccas-data |
| Annual neighborhood air quality (NYCCAS) | NYC DOHMH | NYC Open Data `c3uy-2p5r` |
| Asthma ER visits and poverty by neighborhood | NYC DOHMH | Environment & Health Data Portal |
| Disadvantaged Communities 2023 | NYS Climate Justice Working Group | NY State Open Data `2e6c-s6fp` |
| Neighborhood and borough boundaries | NYC DOHMH | github.com/nycehs/NYC_geography |
| Toll rates | MTA | mta.info |

Basemap: OpenMapTiles and OpenStreetMap contributors, tiles by OpenFreeMap.
