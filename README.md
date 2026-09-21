# The real story of congestion pricing

An interactive map of New York City showing what happened to traffic and fine-particle air pollution (PM2.5)
after the Congestion Relief Zone toll started on January 5, 2025, and whether the changes overlap neighborhoods
that already carry the highest asthma and poverty burden. Built for the MHC Datathon 2026, Phase 1.

Everything on the map comes from official public data: MTA bridge and tunnel crossings, MTA zone entries,
NYC DOT street counts, NYCCAS street-level PM2.5 monitors, NYC Health Department neighborhood health indicators
and the New York State Disadvantaged Communities map.

## What it shows

The app plays as a story along a timeline, one step at a time, then opens up for exploring:

1. **Before the toll**: the 2024 baseline for the nine MTA crossings and the air monitors.
2. **The toll begins**: the zone boundary and the toll structure.
3. **Inside the zone**: how many vehicles still enter, and when.
4. **Crossings**: which bridges and tunnels changed in 2025, with 95% intervals, and how rush hours differ from the whole day.
5. **Street level**: what NYC DOT's sampled street counts add, and what they cannot say.
6. **Air**: which monitors show a supported decrease in PM2.5 after weather adjustment, which are uncertain, and which have no baseline.
7. **The South Bronx**: Mott Haven, Cross Bronx and Hunts Point read on their own, next to the neighborhood's pre-existing asthma and poverty burden.
8. **Who was already carrying the most**: the traffic and air results laid over the state's Disadvantaged Communities.
9. **2026 so far**: whether the year-one patterns persisted in January to August 2026.
10. **If the Major Deegan came down**: one highway scenario, reasoned from the observed data and labelled as such.
11. **What this can't say**: the caveats, and the sources.

Every number keeps its unit and gets a plain-English reading next to it. Click any crossing, monitor, street
counter or neighborhood to open its evidence: before and after values, the 95% interval, matched-month coverage,
rush-hour windows, monthly series with the toll-start marker, hour-of-day profiles and the 2026 status.
"Play the story" runs a guided tour with callouts on the map; the arrow keys or the Next button on a callout skip
ahead without waiting.

Two independent analyses of the same sources were reconciled to produce the numbers. The comparison of the two,
metric by metric, is in [DATA_RECONCILIATION.md](DATA_RECONCILIATION.md); the findings are in
[docs/PHASE1_FINDINGS.md](docs/PHASE1_FINDINGS.md); the checklist against the datathon requirements is in
[PHASE1_COVERAGE_CHECK.md](PHASE1_COVERAGE_CHECK.md).

## Tech stack

| Layer | What |
|---|---|
| Map | MapLibre GL 5 via react-map-gl, OpenFreeMap vector tiles with a custom dark style, a 2D canvas overlay for the animated traffic flow |
| App | React 19, Vite 7, plain JavaScript and JSX, Recharts 3 and d3-shape / d3-scale for the charts and clock glyphs |
| Data pipeline | Python 3.12, pandas, DuckDB (for the 1 GB zone-entry file), shapely, pyproj |
| API (optional) | FastAPI serving the same files plus two "compare any two date ranges" endpoints |
| Tests | pytest on the pipeline helpers and the generated data |

## How it works

1. `backend/pipeline/s00` to `s06` download the small public inputs, read the two large raw CSVs (or their
   saved intermediates), aggregate them into per-facility, per-monitor and per-segment statistics for 2024, 2025
   and January to August 2026, join every point to its census tract and neighborhood, and write a bundle of JSON
   and GeoJSON files.
2. `backend/pipeline/s07_reconcile.py` merges a second, independent analysis (in `data/reference/second_pipeline/`)
   into that bundle: 95% intervals, matched-month eligibility, rush-hour windows and persistence labels are added
   beside the existing fields, never in place of them.
3. The bundle is copied into `frontend/public/data/`, so the app runs without the pipeline or the API.
4. The frontend loads the bundle, builds the story text from the numbers in it (`frontend/src/content/story.js`),
   and renders the map, the story panel, the timeline and the detail inspector. The file formats are described in
   [docs/DATA_CONTRACT.md](docs/DATA_CONTRACT.md).

## Setup

You need Node.js 22 or newer. All processed data is already in the repo.

```bash
git clone https://github.com/ancel1x/mhc-datathon-2026.git
cd mhc-datathon-2026/frontend
npm install
npm run dev
```

Open http://localhost:5173. On Windows use backslashes in the `cd` path; everything else is the same.

`npm run build` makes the production build in `frontend/dist/`; `npm run preview` serves it on port 4173.

### Optional: pipeline and API

Only needed to recompute the numbers or use the date-range endpoints. Requires Python 3.12 or newer.

```bash
# Windows
powershell -ExecutionPolicy Bypass -File .\setup.ps1     # creates .venv, installs Python and npm packages
powershell -ExecutionPolicy Bypass -File .\dev.ps1       # starts the API (port 8000) and the app (port 5173)

# Mac / Linux
chmod +x setup.sh dev.sh
./setup.sh
./dev.sh
```

Rebuild the data with `python backend/pipeline/run_all.py` (use the `.venv` interpreter). It downloads about
30 MB of public inputs and rewrites `frontend/public/data/`. The two large raw files (MTA zone entries, about
1 GB, and NYC DOT counts, about 275 MB) are not required because their compact intermediates are in
`data/processed/`; to re-read them, download them from the links below into your Downloads folder or point
`RAW_CRZ_CSV` / `RAW_ATVC_CSV` at them. To re-run only the merge step: `python backend/pipeline/s07_reconcile.py`.

Tests: `python -m pytest backend/tests -q`.

## Repository layout

```
frontend/                 React + Vite + MapLibre app (frontend/README.md describes the UI)
frontend/public/data/     the processed data the app reads (about 3 MB)
backend/pipeline/         Python steps s00 to s07
backend/api/              FastAPI server
backend/tests/            pytest checks
data/processed/           pipeline intermediates and the data bundle
data/reference/           tracked tables from partners: 2023 asthma and poverty by neighborhood, and the
                          second analysis pipeline's outputs
docs/                     findings, data contract, screenshots
DATA_RECONCILIATION.md    how the two analyses were compared and what the app shows
PHASE1_COVERAGE_CHECK.md  checklist against the datathon requirements
setup.ps1 / setup.sh      one-time setup
dev.ps1 / dev.sh          start API and app
```

## How the numbers are made

- **Frames.** The main comparison is January 5 to December 31, 2024 against the same window of 2025. January 5 to
  August 31 of 2024, 2025 and 2026 is used only to check whether the 2025 patterns persisted; 2026 is never shown
  as a complete year.
- **Traffic.** Average vehicles per day at each MTA bridge and tunnel, with a 95% interval, matched-day counts and
  AM / PM / other-hours windows from the second analysis. A change is called supported only when the whole interval
  sits on one side of zero; the Hugh L. Carey Tunnel is flagged as coverage-limited. Entries into the zone by gate
  and vehicle class have no pre-toll baseline. NYC DOT street counts are one-week samples, shown as matched
  locations tiered by how comparable the before and after samples are, with no citywide estimate.
- **Air.** Hourly PM2.5 from the street-level monitors, compared on months with enough data in both years. Each
  monitor has a raw change, a weather-adjusted change with a 95% interval, and a difference against the Health
  Department's control site on the Van Wyck Expressway. The map class comes from the weather-adjusted result:
  supported decrease, uncertain, supported increase, or no eligible baseline.
- **Neighborhoods.** Every point is joined to its census tract (state Disadvantaged Community designation) and its
  neighborhood (child and adult asthma ER visits in 2023 and poverty from ACS 2019 to 2023, the newest published).

Association is not cause. Counts are crossing events, not tracked trips. Most monitors have partial matched-month
coverage. The zone-entry detectors have no "before". DOT counts are one-week samples.

## Data sources

| Dataset | Publisher | Where |
|---|---|---|
| Congestion Relief Zone vehicle entries | MTA | NY State Open Data `t6yz-b64h` |
| Bridges and Tunnels hourly crossings | MTA | NY State Open Data `ebfx-2m7v` |
| Congestion Relief Zone boundary (geofence) | MTA | NY State Open Data `srxy-5nxn` |
| Automated traffic volume counts | NYC DOT | NYC Open Data `7ym2-wayt` |
| Real-time street-level PM2.5 (NYCCAS) | NYC DOHMH and Queens College | github.com/nychealth/nyccas-data |
| Annual neighborhood air quality (NYCCAS) | NYC DOHMH | NYC Open Data `c3uy-2p5r` |
| Asthma ER visits (children and adults, 2023) and poverty (ACS 2019 to 2023) by neighborhood | NYC DOHMH | Environment & Health Data Portal |
| Disadvantaged Communities 2023 | NYS Climate Justice Working Group | NY State Open Data `2e6c-s6fp` |
| Neighborhood and borough boundaries | NYC DOHMH | github.com/nycehs/NYC_geography |
| Toll rates | MTA | mta.info |

Basemap: OpenMapTiles and OpenStreetMap contributors, tiles by OpenFreeMap.
