# The real story of congestion pricing — MHC Datathon, Phase 1

An interactive map of New York City that shows what happened to traffic and fine-particle air pollution (PM2.5)
after the Congestion Relief Zone toll started on January 5, 2025, and whether the patterns overlap neighborhoods
that were already carrying the most. Everything is built from official public data (MTA, NYC DOT, NYC Health
Department, NY State). The map tells the story in eleven steps along a timeline, then opens up for exploring.

Findings are written up in [docs/PHASE1_FINDINGS.md](docs/PHASE1_FINDINGS.md). Two independent analysis pipelines
were reconciled to produce the final numbers; every decision is recorded in
[DATA_RECONCILIATION.md](DATA_RECONCILIATION.md), and the brief-by-brief audit is
[PHASE1_COVERAGE_CHECK.md](PHASE1_COVERAGE_CHECK.md).

## What the brief asked, and where the map answers it

The Phase 1 brief requires three things on one map: air quality (NYCCAS monitors, before/after PM2.5), traffic
volumes (MTA bridge and tunnel counts, NYC DOT counts) and the congestion pricing zone boundary with its toll
structure, with an overlay showing whether the patterns fall on historically vulnerable communities. All are
layers in the app. The brief's four questions, and the step that answers each:

| Question from the brief | Step | Short answer |
|---|---|---|
| Has congestion pricing reduced pollution and traffic, or has the 22% headline hidden a more mixed daily / peak-hour picture? | 2, 3, 4, 6 | Mixed. The 22% is a modeled figure (external context). Measured: about 502k vehicles still enter on a weekday, 77% in tolled hours; around the zone three crossings show supported increases and six are uncertain, and the morning rush rose at Whitestone (+4.7%), Henry Hudson (+4.0%) and the Verrazzano even where whole days are uncertain; seven monitors show supported PM2.5 decreases, six are uncertain. |
| Is pollution and traffic being eliminated, or shifted to other parts of the five boroughs? Are those areas already vulnerable? | 4, 8 | Partly both; counts cannot show which vehicles moved. Entries into the core fell; three surrounding crossings rose with intervals above zero (RFK Manhattan +2.1%, Whitestone +1.9%, Marine Parkway +1.9%), the nine together were +0.5%. One of the three (RFK Manhattan, East Harlem) is in a state Disadvantaged Community; the supported air improvements sit in and beside the priced core, in lower-burden neighborhoods. |
| If traffic is diverting into the South Bronx, what do the monitor-level data show in Mott Haven, Cross Bronx and Hunts Point, separate from the citywide average? | 7 | No statistically clear PM2.5 increase or decrease at Mott Haven (−0.36 µg/m³, −1.23 to +0.51) or Cross Bronx (−0.65, −1.71 to +0.41) after weather adjustment; Hunts Point has no eligible 2024 baseline. Those neighborhoods carry the highest pre-existing burden (child asthma ED 266 and 259 per 10,000, 2023). |
| What would happen to traffic, air and equity if a major highway like the BQE or the Major Deegan were removed or repurposed? | 10 | One corridor, the Major Deegan, reasoned from observed counts, monitors and burden and labelled "data-grounded scenario reasoning, not a forecast": a local exhaust source removed and land freed, against the risk that the same volumes move onto Bruckner, the Grand Concourse and Third Avenue in the same tracts. No percentage or outcome is invented. |

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

Then open http://localhost:5173 in your browser. That's it. (`npm run build` then `npm run preview` serves the
production build on http://localhost:4173.)

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
Mac: `.venv/bin/python`). It downloads the small public inputs (about 30 MB), rebuilds `frontend/public/data/`
and, as its last step (`s07_reconcile.py`), merges the second pipeline's intervals and eligibility fields from
`data/reference/second_pipeline/`. To re-run only that merge: `python backend/pipeline/s07_reconcile.py`.
The two large raw files (MTA zone entries, about 1 GB, and NYC DOT counts, about 275 MB) are **not** required:
their compact intermediates are in `data/processed/`. If you do want to re-read them, download them from the links
in the sources table into your Downloads folder, or point `RAW_CRZ_CSV` / `RAW_ATVC_CSV` at them.

Tests: `python -m pytest backend/tests -q`. Production build: `cd frontend && npm run build`.

## What's in the repo

```
frontend/                 React + Vite + MapLibre app (see frontend/README.md for the UI structure)
frontend/public/data/     the processed data the app reads (JSON / GeoJSON, about 3 MB)
backend/pipeline/         Python steps s00–s07 that turn the raw sources into that data
backend/api/              FastAPI server: serves the data and two live comparison endpoints
backend/tests/            pytest checks on helpers and on the generated data
data/processed/           pipeline intermediates (small parquet files) and the data bundle
data/reference/           tracked tables from partners' work: 2023 asthma rates by neighborhood, and the
                          second (independent) analysis pipeline's map-ready outputs
docs/                     findings write-up, data contract, screenshots
DATA_RECONCILIATION.md    how the two analysis pipelines were compared and what the app finally shows
PHASE1_COVERAGE_CHECK.md  audit of the app against the organizer's Phase 1 brief
setup.ps1 / setup.sh      one-time setup (Windows / Mac)
dev.ps1 / dev.sh          start API + app (Windows / Mac)
```

## How the numbers are made (short version)

- **Frames.** Primary: Jan 5–Dec 31, 2024 vs 2025 (Year One). Secondary: Jan 5–Aug 31 of 2024 / 2025 / 2026,
  used only to ask whether Year One patterns persisted; 2026 is never shown as a complete year.
- **Traffic.** Average vehicles per day at each MTA bridge and tunnel (our pipeline), with the independent
  analysis's 95% intervals, matched-day counts, AM / PM / other-hours windows and persistence labels attached.
  A change is "supported" only when its interval stays on one side of zero; Hugh L. Carey is coverage-limited.
  Entries into the zone by gate and vehicle class (no pre-toll baseline). NYC DOT street counters as sampled
  matched locations, tiered by how comparable the before and after samples are; no citywide street estimate.
- **Air.** Hourly PM2.5 from the city's street-level monitors, compared on eligible matched months. Two readings
  per monitor: our control-site difference (against the Health Department's Van Wyck site, descriptive) and the
  independent analysis's raw and weather-adjusted changes with intervals. The map class comes from the latter:
  supported decrease / uncertain / supported increase / no eligible baseline.
- **Who bears it.** Every point is joined to its census tract (New York State Disadvantaged Community
  designation) and its neighborhood (child and adult asthma ER visits and poverty, 2023 / ACS 2019–23, the newest
  published, since health data lag about two years).

Caveats we state up front: association is not cause; counts are crossing events, not tracked trips; most monitors
have partial matched-month coverage; the zone-entry detectors have no "before"; DOT counts are one-week samples.

## Data sources (all official)

| Dataset | Publisher | Where |
|---|---|---|
| Congestion Relief Zone vehicle entries | MTA | NY State Open Data `t6yz-b64h` |
| Bridges and Tunnels hourly crossings | MTA | NY State Open Data `ebfx-2m7v` |
| Congestion Relief Zone boundary (geofence) | MTA | NY State Open Data `srxy-5nxn` |
| Automated traffic volume counts | NYC DOT | NYC Open Data `7ym2-wayt` |
| Real-time street-level PM2.5 (NYCCAS) | NYC DOHMH + Queens College | github.com/nychealth/nyccas-data |
| Annual neighborhood air quality (NYCCAS) | NYC DOHMH | NYC Open Data `c3uy-2p5r` |
| Asthma ER visits (children and adults, 2023) and poverty (ACS 2019–23) by neighborhood | NYC DOHMH | Environment & Health Data Portal |
| Disadvantaged Communities 2023 | NYS Climate Justice Working Group | NY State Open Data `2e6c-s6fp` |
| Neighborhood and borough boundaries | NYC DOHMH | github.com/nycehs/NYC_geography |
| Toll rates | MTA | mta.info |

Basemap: © OpenMapTiles © OpenStreetMap contributors, tiles by OpenFreeMap.
