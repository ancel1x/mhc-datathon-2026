# The real story of congestion pricing — MHC Datathon, Phase 1

An interactive map of New York City that shows what happened to traffic and fine-particle air pollution (PM2.5)
after the Congestion Relief Zone toll started on January 5, 2025, and whether the burdens landed on neighborhoods
that were already carrying the most. Everything is built from official public data (MTA, NYC DOT, NYC Health
Department, NY State). The map tells the story in nine steps along a timeline, then opens up for exploring.

Findings and caveats are written up in [docs/PHASE1_FINDINGS.md](docs/PHASE1_FINDINGS.md).

## What the brief asked, and where the map answers it

The Phase 1 brief requires three things on one map: air quality (NYCCAS monitors, before/after PM2.5), traffic
volumes (MTA bridge and tunnel counts, NYC DOT counts) and the congestion pricing zone boundary with its toll
structure, with an overlay showing whether the patterns fall on historically vulnerable communities. All four are
layers in the app. The brief's four questions, and the step that answers each:

| Question from the brief | Step | Short answer |
|---|---|---|
| Has congestion pricing reduced pollution and traffic, or has the 22 % headline hidden a more mixed daily / peak-hour picture? | 3, 5, 7 | Mixed. About 502k vehicles still enter on a weekday, three quarters in the tolled peak. The 22 % is a modeled estimate against a projected no-toll year; at monitor level only the two bridge-approach sites inside the zone beat the citywide trend (by about 0.8 µg/m³). Entries did fall in year two (−4.9 % weekday, trucks −7.1 %). |
| Is pollution and traffic being eliminated, or shifted to other parts of the five boroughs? Are those areas already vulnerable? | 4, 6 | Shifted, in year one. The two tunnels into the zone lost traffic, all eight bridges around it gained (+0.4 to +2.1 %), and the nine crossings together were +0.5 %. Three of the busier bridges and both South Bronx monitors are in state-designated Disadvantaged Communities. |
| If traffic is diverting into the South Bronx, what does that mean for "Asthma Alley", and what do the monitor-level data show, separate from the citywide average? | 5 | The Mott Haven and Cross Bronx monitors did not improve (7.6 → 7.6, 9.3 → 9.0 µg/m³) while the control site fell 0.9, so they lagged the city by about 0.85 µg/m³, in neighborhoods with 266 and 259 child asthma ER visits per 10,000 (2023). The zone-entry data do not cover Bronx roadways, so diversion there is inferred from the bridges beside them. |
| What would happen to traffic, air and equity if a major highway like the BQE or the Major Deegan were removed or repurposed? | 8 | Reasoned, not modeled. Year one shows traffic goes around a costlier route rather than away, so removal without a charge would push the Deegan's and BQE's volumes onto local streets in the same high-asthma neighborhoods; year two shows trips do disappear when a charge persists. |

## Run the app (2 minutes, no data work)

All the processed data is already in the repo, so the map runs on its own. You only need **Node.js 22 or newer**
(check with `node --version`; download from https://nodejs.org if missing).

**Windows** (PowerShell or Command Prompt):

```powershell
git clone https://github.com/ancel1x/mhc-datathon-2026.git
cd mhc-datathon-2026\frontend
npm install
npm run dev
```

**Mac** (Terminal): same commands, with forward slashes. If you don't have Node, install it first with
`brew install node` (or from nodejs.org).

```bash
git clone https://github.com/ancel1x/mhc-datathon-2026.git
cd mhc-datathon-2026/frontend
npm install
npm run dev
```

Then open http://localhost:5173 in your browser. That's it.

## Full setup: API and data pipeline (optional)

Only needed if you want to change how the numbers are computed, or use the API's "compare any two date ranges"
endpoints. Requires **Python 3.12 or newer** (`python --version` on Windows, `python3 --version` on Mac;
Mac users can `brew install python@3.12`).

**Windows** (from the repo root):

```powershell
powershell -ExecutionPolicy Bypass -File .\setup.ps1     # once: creates .venv, installs Python + npm packages
powershell -ExecutionPolicy Bypass -File .\dev.ps1       # starts the API (port 8000) and the app (port 5173)
```

**Mac** (from the repo root):

```bash
chmod +x setup.sh dev.sh   # first time only
./setup.sh                 # once: creates .venv, installs Python + npm packages
./dev.sh                   # starts the API (port 8000) and the app (port 5173); Ctrl+C stops both
```

To recompute the data from scratch: `python backend/pipeline/run_all.py` (Windows: `.venv\Scripts\python.exe`,
Mac: `.venv/bin/python`). It downloads the small public inputs (about 30 MB) and rebuilds `frontend/public/data/`.
The two large raw files (MTA zone entries, about 1 GB, and NYC DOT counts, about 275 MB) are **not** required:
their compact intermediates are in `data/processed/`. If you do want to re-read them, download them from the links
in the sources table into your Downloads folder, or point `RAW_CRZ_CSV` / `RAW_ATVC_CSV` at them.

Tests: `python -m pytest backend/tests -q`. Production build: `cd frontend && npm run build`.

## What's in the repo

```
frontend/              React + Vite + MapLibre app (see frontend/README.md for the UI structure)
frontend/public/data/  the processed data the app reads (JSON / GeoJSON, about 3 MB)
backend/pipeline/      Python steps s00–s06 that turn the raw sources into that data
backend/api/           FastAPI server: serves the data and two live comparison endpoints
backend/tests/         pytest checks on helpers and on the generated data
data/processed/        pipeline intermediates (small parquet files) and the data bundle
data/reference/        small tracked tables from partners' work (2023 asthma rates by neighborhood)
docs/                  findings write-up, data contract, screenshots
setup.ps1 / setup.sh   one-time setup (Windows / Mac)
dev.ps1 / dev.sh       start API + app (Windows / Mac)
```

## How the numbers are made (short version)

- **Periods.** 2024 (Jan 5–Dec 31) is the baseline, 2025 is year one, and Jan–Aug 2026 is year two so far,
  always compared with the same months of the earlier year.
- **Traffic.** Average vehicles per day at each MTA bridge and tunnel, entries into the zone by gate and vehicle
  class, and NYC DOT street counters where the same spot was counted before and after the toll.
- **Air.** Hourly PM2.5 from the city's street-level monitors, turned into daily means, with wildfire-smoke days
  removed. A monitor only counts as "improved" or "worsened" if it moved more than 0.5 µg/m³ beyond the Health
  Department's control site on the Van Wyck Expressway, which captures the citywide trend.
- **Who bears it.** Every point is joined to its census tract (New York State Disadvantaged Community
  designation) and its neighborhood (child asthma ER visits in 2023, the newest year published, since health
  data lag about two years).

Caveats we state up front: the zone-entry detectors only exist since the toll started, so they have no "before";
DOT counts are one-week samples; PM2.5 depends mostly on weather and regional smoke, so this is a careful
before-and-after comparison, not proof of cause.

## Data sources (all official)

| Dataset | Publisher | Where |
|---|---|---|
| Congestion Relief Zone vehicle entries | MTA | NY State Open Data `t6yz-b64h` |
| Bridges and Tunnels hourly crossings | MTA | NY State Open Data `ebfx-2m7v` |
| Congestion Relief Zone boundary (geofence) | MTA | NY State Open Data `srxy-5nxn` |
| Automated traffic volume counts | NYC DOT | NYC Open Data `7ym2-wayt` |
| Real-time street-level PM2.5 (NYCCAS) | NYC DOHMH + Queens College | github.com/nychealth/nyccas-data |
| Annual neighborhood air quality (NYCCAS) | NYC DOHMH | NYC Open Data `c3uy-2p5r` |
| Child asthma ER visits by neighborhood, 2023 | NYC DOHMH | Environment & Health Data Portal |
| Disadvantaged Communities 2023 | NYS Climate Justice Working Group | NY State Open Data `2e6c-s6fp` |
| Neighborhood and borough boundaries | NYC DOHMH | github.com/nycehs/NYC_geography |
| Toll rates | MTA | mta.info |

Basemap: © OpenMapTiles © OpenStreetMap contributors, tiles by OpenFreeMap.
