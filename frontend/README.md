# Map the Real Story — frontend

Paged map story of what happened to New York City traffic and PM2.5 since the Congestion Relief Zone toll
began on 5 January 2025, and whether the burdens overlap historically vulnerable neighborhoods.

React 19 + Vite 7, MapLibre GL 5 via `react-map-gl/maplibre`, Recharts 3, d3-shape/d3-scale for the clock glyphs.
Plain JavaScript / JSX, no TypeScript.

## Run

```bash
npm install
node scripts/make-mock-data.mjs   # only needed when public/data/ is empty; never overwrites existing files
npm run dev                       # http://localhost:5173, proxies /api -> http://127.0.0.1:8000
npm run build && npm run preview  # production build
npm test                        # bundle loading, fallback and cache regressions
npm run test:browser             # Chrome interaction/performance checks against preview on :4173
node scripts/screenshot.mjs "http://localhost:4173/?chapter=3" out.png 18000 [width] [height]   # headless Chrome capture
```

Deep links: `?chapter=1..11` starts on that step, `?chapter=explore` on the explore step, `?intro=0` skips the title card, `?play=N`
starts the guided tour from step N, `?feature=<layer>:<id>` opens a feature's detail (e.g. `bt_facility:whitestone`,
`aq_monitor:aq_36005NY11534`, `uhf42:107` for a neighborhood card), `?controls=1` opens the controls sheet on phones, `?controls=collapsed` starts with the control panel collapsed,
`?theme=light|dark` forces a theme. During the guided tour, the Next button on a callout, the skip buttons in the
timeline bar, `→` or `Enter` jump to the next callout without waiting for its bar; `←` goes back; `Space` pauses; `Esc` exits.

## Where the data comes from

`src/lib/api.js#loadJson(name)` reads the bundled files in `public/data/` directly
(`/data/<name>.json`, `/data/<layer>.geojson`), so standalone startup does not wait for the optional API.
To prefer the API, set `VITE_API_BASE=/api` in `frontend/.env.local` (or an API URL), then restart Vite/rebuild.
This uses `<base>/bundle/<name>` and `<base>/geo/<layer>`, falling back to the bundled files on an error
or after a 2.5-second API timeout. Concurrent requests share a cached promise; failed requests can be retried.
The file shapes are specified in `../docs/DATA_CONTRACT.md`.

`scripts/make-mock-data.mjs` writes contract-shaped placeholder files with real NYC coordinates and realistic magnitudes.
It skips every file that already exists and stamps `"_mock": true` on every JSON object it writes; the UI shows a small
"demo data" badge in the story header when `summary.json` carries that flag. The real pipeline output simply replaces the files.

Core files are loaded at startup (`src/lib/data.jsx`, thin progress line); the series files
(`aq_series`, `bt_series`, `crz_series`, `dot_matched`) are loaded lazily when a feature detail opens.
The detail panel and Recharts code also load on demand, alongside the selected feature's series.

The traffic canvas caches projected route geometry until the map moves or the layout changes. It stops
scheduling frames when its layer is empty or the tab is hidden; reduced motion settles to a static frame.
Hover hit testing coalesces bursts of pointer events, and moving within a feature only repositions its
tooltip. Map layers are memoized, and zoom state updates only when crossing the clock-glyph threshold.

For repeatable measurements, run `node scripts/performance.mjs http://127.0.0.1:4173 report.json` against a
production preview. Add `--verify` to check performance invariants and desktop/mobile interactions.
Set `CHROME` to the browser executable when it is not in the default Windows location. Timing results depend
on hardware and background work; the script uses software WebGL, so they are not a hardware-GPU frame-rate benchmark.

## How the UI is organised

Three surfaces on top of the map, all on a 16 px inset:

- **Story panel** (left, 392 px): header (title + subtitle + `Sources` / `Play the story`), one of eleven steps at a
  time, footer with `‹ Back`, the step's date, `Next ›`. Arrow keys page too; the timeline bar under the map shows the
  stops. The last `Next` goes to Explore, which offers `Start the story again`. Each step: optional badge (the
  scenario step), title, one lede sentence, a short body or bullets, up to three stat rows (label, value, "so what"),
  at most one compact main-level table or list (rush hours vs whole day, supported PM2.5 decreases, the South Bronx
  burden table, DOT same-month pairs, persistence verdicts), then a collapsed `Details` disclosure (paragraphs,
  full tables, zero-centred interval bars, toll table, sources). Copy lives in `content/story.js`, templated from
  `summary.json` and its `reconciled` block.
- **Control panel** (right, 264 px): `Period` (segmented), `Layers` (rows with label, plain-English hint, the layer's
  map symbol and a small switch), `Key` (discrete color swatches, only for visible layers), and an `Advanced` disclosure
  with `Metric` and `Hour of day`. The header holds the theme toggle and a chevron that collapses the panel to a
  32 px `Controls` button. When a feature is selected, its detail (stat tiles, monthly timeline, hour-of-day profile,
  breakdown) replaces the controls in the same box; closing returns to the controls.
- **Attribution** (bottom-right, compact).

Entering a chapter applies that chapter's preset (layers, period, metric, hour); anything the reader changes afterwards
sticks until the next chapter. Explore never resets. Phones (< 720 px): the story panel becomes a bottom sheet
(top 45 %) and the control panel a `Controls` button that opens a sheet from the right.

## Design system

Tokens live at the top of `src/styles.css`; the map palette mirrors them in `src/lib/scales.js`.

- **Material** — one recipe for every panel: `.panel { background: var(--panel); backdrop-filter: blur(24px) saturate(120%);
  border: 1px solid var(--panel-edge); border-radius: 12px; box-shadow: 0 12px 32px rgba(0,0,0,.45) }` with
  `--panel: rgba(16,16,18,.84)` (light: `rgba(246,246,248,.86)`). Inner elements are flat `--fill` rectangles
  (8 px radius), no borders except separators, no gradients, no other shadows, no animations beyond 150 ms
  opacity/background transitions and the 1400 ms map flyTo.
- **Text** — `--text #f5f5f7`, `--text-2 rgba(235,235,245,.62)`, `--text-3 rgba(235,235,245,.38)` (light:
  `#1d1d1f`, `rgba(60,60,67,.6)`, `.38`). One family: `-apple-system, BlinkMacSystemFont, "SF Pro Display",
  "SF Pro Text", Inter, "Segoe UI", …` (Inter 400–700 from Google Fonts). Numbers use `tabular-nums`; nothing is
  larger than 20 px. Panel title 15/600, chapter title 20/600, lede 14/500, body 13.5/400 `--text-2`, stat value
  18/600, captions 11, section headers 11/600 uppercase `--text-3`, row labels 13/500, hints 11/400.
- **Controls** — segmented control 28 px with a 6 px inner thumb (`--thumb`), switches 26 × 16 (green `#30D158`
  on, `rgba(255,255,255,.18)` off), rows 36 px, buttons 32 px with 8 px radius and no fill until hover.
- **Palette (the whole of it)** — better / less traffic / improved `#30D158`; neutral `#8E8E93`; worse / more
  traffic / worsened `#FF453A`; insufficient `rgba(142,142,147,.5)`; equity `rgba(191,90,242,.26)` fill; zone
  outline `rgba(255,255,255,.7)` 1.25 px (ink in the light theme). The traffic change scale
  (`scales.js#changeScale`) runs green → grey → red over ±25 % with soft stops at ±3 %; the Key shows it as five
  12 × 12 swatches labelled "less traffic · cleaner" / "more traffic · worse". PM2.5 classes reuse the same three
  colors; "no eligible baseline" is a hollow grey ring, and a crossing whose 95% interval includes zero (or is
  coverage-limited) is drawn as a ring with a neutral flow line. Interval bars (`charts/IntervalBar.jsx`) are
  zero-centred: green below zero, red above, thin grey when the interval crosses zero.
- **Map symbols** — one plain style: filled discs in the class color with a 1 px `rgba(11,13,16,.9)` separation
  stroke (PM2.5 monitors r = 5, bridges & tunnels r = 4–9 by volume), zone entries as 2 px rings, DOT count
  locations as 5 px squares (matched sites filled by change; single-count sites are outlines, hidden unless
  "All DOT sites" is on). Featured features are full opacity, the rest 35 %. Bridges and monitors carry an
  11 px label (`shortName()` + change or class) from zoom 10.4. At zoom ≥ 11 the points become 24-hour clock
  glyphs (`ClockGlyph`): 1 px strokes, grey ring = baseline weekday profile, colored ring = selected period,
  center mark in the layer's shape, caption under the ring.

## How the map style works

`src/map/inkStyle.js#buildInkStyle(boroughsFC, theme)` returns a MapLibre style built on OpenFreeMap vector tiles
(OpenMapTiles schema, no API key). It draws only: background `#0b0d10`, water `#12161c`, `transportation` lines
filtered to motorway/trunk/primary (links from z12) as hairlines (`#2a2f36 → #3a4048`), and dashed county boundaries.
No buildings, landuse, POIs or OSM labels. Labels are ours: borough names from `boroughs.geojson` and a handful of
hand-placed highway labels. Three empty `anchor-*` background layers act as insertion slots so data layers stack
predictably (`beforeId="anchor-lines"` for choropleths, `anchor-points` for the zone, `labels-highways` for points).

Per-feature numbers come from `src/lib/metrics.js#featureMetrics(props, layer, period, hour, metric)`, which resolves
the baseline/period pair for each layer (CRZ entry points only have 2026-YTD vs 2025-YTD, B&T use 2024 / 2024 YTD,
monitors use the reconciled `evidence` block, falling back to `comparisons`) and returns nulls rather than throwing.
`support` (crossings) and `classification` (monitors) carry the interval-based verdict that drives the ring / disc styling.

## Structure

```
src/
  App.jsx                   shell: loading screen, map, story panel, side panel
  state/AppState.jsx        single reducer: period, metric, hour, activeChapter, exploreMode, selectedFeature,
                            layers, dotAll, theme, controlsCollapsed, controlsOpen, glyphMode; URL deep links
  lib/                      api.js, data.jsx (DataProvider/useData), format.js (incl. shortName), scales.js, metrics.js
  map/inkStyle.js           basemap style
  content/chapters.js       cameras, layer presets, featured ids, layer labels / hints / symbols (11 steps)
  content/story.js          step copy templated with live numbers (lede / body / stats / table / details)
  content/guide.js          guided-tour beats (callout text, camera, year the map switches to)
  content/corridors.js      hand-drawn routes for the animated flow layer
  hooks/useMediaQuery.js    usePhone, useReducedMotion
  components/               Segmented (sliding thumb), CloseButton, Swatch (LayerSymbol)
  components/map/           MapView, ZoneLayer, PolygonLayers, PointLayers, GlyphLayer, ClockGlyph
  components/panels/        StoryPanel, SidePanel (controls), KeyLegend, DetailPanel (DetailContent), TollTable, SourcesSheet (SourcesList)
  components/charts/        TimelineChart, HourProfileChart, BeforeAfterBars, StatTile, IntervalBar (interval bars,
                            status badge, month chips)
```

Theme: dark by default, light via `prefers-color-scheme`, `?theme=`, or the toggle in the control panel header
(`data-theme` on `<html>`). Nulls render as "—".
