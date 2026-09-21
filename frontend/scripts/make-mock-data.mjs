#!/usr/bin/env node
/**
 * make-mock-data.mjs — writes realistic placeholder files into frontend/public/data/
 * that follow docs/DATA_CONTRACT.md. It NEVER overwrites an existing file, so the real
 * pipeline output always wins. Every JSON object written here carries `"_mock": true`.
 *
 *   node scripts/make-mock-data.mjs            # write missing files
 *   node scripts/make-mock-data.mjs --list     # only print what would be written
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, '..', 'public', 'data');
const LIST_ONLY = process.argv.includes('--list');
mkdirSync(OUT, { recursive: true });

// ---------------------------------------------------------------- deterministic PRNG
let seed = 20250105;
function rnd() {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const jitter = (amp) => (rnd() - 0.5) * 2 * amp;
const r1 = (x) => Math.round(x * 10) / 10;
const r2 = (x) => Math.round(x * 100) / 100;
const r3 = (x) => Math.round(x * 1000) / 1000;
const pct = (a, b) => (a == null || b == null || b === 0 ? null : r1(((a - b) / b) * 100));

function write(name, obj) {
  const p = join(OUT, name);
  if (existsSync(p)) { console.log(`skip   ${name} (exists)`); return; }
  if (LIST_ONLY) { console.log(`would  ${name}`); return; }
  const body = Array.isArray(obj) ? obj : { _mock: true, ...obj };
  writeFileSync(p, JSON.stringify(body));
  console.log(`wrote  ${name}`);
}

// ---------------------------------------------------------------- calendar helpers
const CP_START = '2025-01-05';
const PERIODS = {
  pre_2023:      { label: '2023',          start: '2023-01-01', end: '2023-12-31' },
  pre_2024:      { label: '2024 baseline', start: '2024-01-05', end: '2024-12-31' },
  post_2025:     { label: '2025',          start: '2025-01-05', end: '2025-12-31' },
  post_2026_ytd: { label: '2026 YTD',      start: '2026-01-01', end: '2026-08-31' },
  ytd_2024:      { label: '2024 Jan–Aug',  start: '2024-01-05', end: '2024-08-31' },
  ytd_2025:      { label: '2025 Jan–Aug',  start: '2025-01-05', end: '2025-08-31' },
};
const dayMs = 86400000;
const toISO = (d) => d.toISOString().slice(0, 10);
const parse = (s) => new Date(`${s}T12:00:00Z`);
const daysBetween = (a, b) => Math.round((parse(b) - parse(a)) / dayMs) + 1;
function* eachDay(a, b) { for (let t = parse(a).getTime(); t <= parse(b).getTime(); t += dayMs) yield new Date(t); }
const isWeekday = (d) => d.getUTCDay() >= 1 && d.getUTCDay() <= 5;
const season = (d) => 1 + 0.06 * Math.cos(((d.getUTCMonth() - 9) / 12) * 2 * Math.PI); // Oct high, Apr low
const months = (a, b) => { const out = []; let [y, m] = a.split('-').map(Number); const [ey, em] = b.split('-').map(Number); while (y < ey || (y === ey && m <= em)) { out.push(`${y}-${String(m).padStart(2, '0')}`); m++; if (m > 12) { m = 1; y++; } } return out; };
const dim = (ym) => { const [y, m] = ym.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).getUTCDate(); };

// ---------------------------------------------------------------- hourly profiles
const WEEKDAY_SHAPE = [0.9, 0.6, 0.45, 0.4, 0.55, 1.2, 2.6, 4.4, 5.6, 5.2, 4.6, 4.7, 4.9, 5.0, 5.3, 5.8, 6.4, 6.8, 6.0, 4.8, 3.8, 3.1, 2.4, 1.5];
const WEEKEND_SHAPE = [1.6, 1.1, 0.8, 0.6, 0.5, 0.7, 1.2, 2.0, 3.0, 3.9, 4.7, 5.3, 5.7, 5.9, 5.9, 5.7, 5.4, 5.0, 4.5, 4.0, 3.5, 3.1, 2.6, 2.0];
const AQ_SHAPE = [0.4, 0.3, 0.2, 0.1, 0.1, 0.3, 0.7, 1.0, 0.9, 0.5, 0.1, -0.2, -0.4, -0.5, -0.5, -0.4, -0.2, 0.0, 0.3, 0.6, 0.8, 0.8, 0.7, 0.5];
const norm = (arr) => { const s = arr.reduce((a, b) => a + b, 0); return arr.map((v) => v / s); };
const scaleShape = (shape, total, wobble = 0.04) => norm(shape.map((v) => v * (1 + jitter(wobble)))).map((v) => Math.round(v * total));
const aqHourly = (mean, amp = 1) => AQ_SHAPE.map((v) => r2(mean + v * amp + jitter(0.15)));
const peakShare = (hourly, from = 5, to = 21) => { const s = hourly.reduce((a, b) => a + b, 0); return s ? r3(hourly.slice(from, to).reduce((a, b) => a + b, 0) / s) : null; };

// ---------------------------------------------------------------- geography (coarse)
const BOROUGHS = [
  { boro_name: 'Manhattan', boro_code: 1, ring: [[-74.019, 40.700], [-73.972, 40.708], [-73.928, 40.797], [-73.909, 40.872], [-73.934, 40.877], [-73.950, 40.850], [-73.963, 40.800], [-73.995, 40.775], [-74.019, 40.700]] },
  { boro_name: 'Bronx', boro_code: 2, ring: [[-73.933, 40.800], [-73.885, 40.800], [-73.830, 40.810], [-73.765, 40.840], [-73.790, 40.880], [-73.850, 40.910], [-73.910, 40.917], [-73.933, 40.880], [-73.933, 40.800]] },
  { boro_name: 'Brooklyn', boro_code: 3, ring: [[-74.045, 40.640], [-74.020, 40.700], [-73.965, 40.705], [-73.935, 40.700], [-73.900, 40.620], [-73.860, 40.580], [-73.940, 40.570], [-74.030, 40.600], [-74.045, 40.640]] },
  { boro_name: 'Queens', boro_code: 4, ring: [[-73.962, 40.740], [-73.930, 40.775], [-73.900, 40.790], [-73.820, 40.800], [-73.740, 40.780], [-73.700, 40.755], [-73.730, 40.680], [-73.760, 40.600], [-73.830, 40.590], [-73.900, 40.620], [-73.940, 40.700], [-73.962, 40.740]] },
  { boro_name: 'Staten Island', boro_code: 5, ring: [[-74.255, 40.505], [-74.190, 40.520], [-74.160, 40.560], [-74.120, 40.595], [-74.070, 40.640], [-74.055, 40.605], [-74.090, 40.560], [-74.150, 40.530], [-74.200, 40.500], [-74.255, 40.505]] },
];
const CRZ_RING = [[-73.9935, 40.7740], [-73.9730, 40.7645], [-73.9590, 40.7590], [-73.9615, 40.7500], [-73.9710, 40.7400], [-73.9740, 40.7300], [-73.9745, 40.7200], [-73.9760, 40.7100], [-73.9900, 40.7040], [-74.0050, 40.7010], [-74.0175, 40.7010], [-74.0190, 40.7060], [-74.0165, 40.7160], [-74.0125, 40.7250], [-74.0110, 40.7330], [-74.0090, 40.7410], [-74.0085, 40.7480], [-74.0040, 40.7590], [-74.0010, 40.7620], [-73.9950, 40.7705], [-73.9935, 40.7740]];
function inRing(pt, ring) { let inside = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i]; const [xj, yj] = ring[j]; if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) inside = !inside; } return inside; }
const boroOf = (pt) => BOROUGHS.find((b) => inRing(pt, b.ring))?.boro_name ?? null;
const insideCRZ = (pt) => inRing(pt, CRZ_RING);
const dist = (a, b) => Math.hypot((a[0] - b[0]) * 0.76, a[1] - b[1]);
const sq = (lon, lat, h) => [[[lon - h, lat - h], [lon + h, lat - h], [lon + h, lat + h], [lon - h, lat + h], [lon - h, lat - h]]];
const feature = (geometry, properties) => ({ type: 'Feature', geometry, properties });
const point = (lon, lat) => ({ type: 'Point', coordinates: [lon, lat] });

// Environmental-burden hot spots (drive DAC designation + asthma mock values)
const HOT = [[-73.915, 40.812, 0.06], [-73.885, 40.820, 0.05], [-73.900, 40.845, 0.05], [-73.940, 40.805, 0.03], [-73.935, 40.830, 0.03], [-73.920, 40.695, 0.04], [-73.905, 40.665, 0.04], [-73.790, 40.700, 0.04], [-73.865, 40.745, 0.03], [-74.010, 40.650, 0.025], [-74.130, 40.635, 0.03], [-73.945, 40.760, 0.02]];
const burden = (pt) => Math.min(1, HOT.reduce((m, [x, y, rad]) => Math.max(m, 1 - dist(pt, [x, y]) / rad), 0));

// UHF42 neighbourhoods (approximate centres)
const UHF = [
  [101, 'Kingsbridge - Riverdale', 'Bronx', -73.905, 40.885], [102, 'Northeast Bronx', 'Bronx', -73.845, 40.885], [103, 'Fordham - Bronx Park', 'Bronx', -73.885, 40.865], [104, 'Pelham - Throgs Neck', 'Bronx', -73.825, 40.835], [105, 'Crotona - Tremont', 'Bronx', -73.895, 40.845], [106, 'High Bridge - Morrisania', 'Bronx', -73.920, 40.833], [107, 'Hunts Point - Mott Haven', 'Bronx', -73.905, 40.810],
  [201, 'Greenpoint', 'Brooklyn', -73.948, 40.728], [202, 'Downtown - Heights - Slope', 'Brooklyn', -73.990, 40.685], [203, 'Bedford Stuyvesant - Crown Heights', 'Brooklyn', -73.945, 40.678], [204, 'East New York', 'Brooklyn', -73.885, 40.665], [205, 'Sunset Park', 'Brooklyn', -74.010, 40.650], [206, 'Borough Park', 'Brooklyn', -73.985, 40.630], [207, 'East Flatbush - Flatbush', 'Brooklyn', -73.945, 40.645], [208, 'Canarsie - Flatlands', 'Brooklyn', -73.910, 40.625], [209, 'Bensonhurst - Bay Ridge', 'Brooklyn', -74.010, 40.610], [210, 'Coney Island - Sheepshead Bay', 'Brooklyn', -73.960, 40.590], [211, 'Williamsburg - Bushwick', 'Brooklyn', -73.930, 40.700],
  [301, 'Washington Heights - Inwood', 'Manhattan', -73.935, 40.855], [302, 'Central Harlem - Morningside Heights', 'Manhattan', -73.950, 40.815], [303, 'East Harlem', 'Manhattan', -73.938, 40.795], [304, 'Upper West Side', 'Manhattan', -73.975, 40.787], [305, 'Upper East Side', 'Manhattan', -73.958, 40.773], [306, 'Chelsea - Clinton', 'Manhattan', -73.998, 40.752], [307, 'Gramercy Park - Murray Hill', 'Manhattan', -73.978, 40.745], [308, 'Greenwich Village - SoHo', 'Manhattan', -74.002, 40.728], [309, 'Union Square - Lower East Side', 'Manhattan', -73.985, 40.718], [310, 'Lower Manhattan', 'Manhattan', -74.010, 40.708],
  [401, 'Long Island City - Astoria', 'Queens', -73.925, 40.765], [402, 'West Queens', 'Queens', -73.885, 40.745], [403, 'Flushing - Clearview', 'Queens', -73.820, 40.765], [404, 'Bayside - Little Neck', 'Queens', -73.760, 40.765], [405, 'Ridgewood - Forest Hills', 'Queens', -73.870, 40.710], [406, 'Fresh Meadows', 'Queens', -73.790, 40.735], [407, 'Southwest Queens', 'Queens', -73.840, 40.680], [408, 'Jamaica', 'Queens', -73.790, 40.695], [409, 'Southeast Queens', 'Queens', -73.750, 40.680], [410, 'Rockaway', 'Queens', -73.820, 40.595],
  [501, 'Port Richmond', 'Staten Island', -74.135, 40.632], [502, 'Stapleton - St. George', 'Staten Island', -74.085, 40.615], [503, 'Willowbrook', 'Staten Island', -74.150, 40.600], [504, 'South Beach - Tottenville', 'Staten Island', -74.195, 40.545],
];
const uhfFor = (pt) => UHF.reduce((best, u) => (dist(pt, [u[3], u[4]]) < dist(pt, [best[3], best[4]]) ? u : best), UHF[0]);
const uhfProps = (u) => {
  const b = burden([u[3], u[4]]);
  return { uhf_code: u[0], name: u[1], borough: u[2], pm25_2024: r1(5.9 + b * 1.8 + (u[2] === 'Manhattan' ? 0.9 : 0) + jitter(0.3)), pm25_2009: r1(9.6 + b * 2.4 + (u[2] === 'Manhattan' ? 1.6 : 0) + jitter(0.4)), asthma_ed_pm25_children: Math.round(18 + b * 95 + jitter(8)), asthma_ed_pm25_adults: Math.round(6 + b * 28 + jitter(3)), asthma_period: '2019-2021' };
};
const common = (id, name, layer, lon, lat, approx = true) => {
  const pt = [lon, lat]; const b = burden(pt); const u = uhfFor(pt); const up = uhfProps(u);
  return { id, name, layer, approx, dac_designated: b > 0.35, dac_combined_pct: r3(Math.min(0.99, 0.35 + b * 0.6 + jitter(0.08))), dac_asthma_pct: r3(Math.min(0.99, 0.3 + b * 0.65 + jitter(0.08))), uhf42_code: u[0], uhf42_name: u[1], uhf42_asthma_ed_pm25_children: up.asthma_ed_pm25_children, uhf42_pm25_2024: up.pm25_2024 };
};

// ================================================================ CRZ entry points
const CRZ_POINTS = [
  ['brooklyn_bridge', 'Brooklyn Bridge', -74.0030, 40.7100, 34000, 0.03, -6.1], ['manhattan_bridge', 'Manhattan Bridge', -73.9930, 40.7130, 40000, 0.03, -3.8], ['williamsburg_bridge', 'Williamsburg Bridge', -73.9815, 40.7175, 36000, 0.04, -2.4],
  ['queensboro_bridge', 'Queensboro Bridge', -73.9635, 40.7583, 60000, 0.05, -1.9], ['queens_midtown_tunnel', 'Queens-Midtown Tunnel', -73.9700, 40.7460, 48000, 0.02, 1.6], ['lincoln_tunnel', 'Lincoln Tunnel', -74.0020, 40.7600, 66000, 0.02, 0.8],
  ['holland_tunnel', 'Holland Tunnel', -74.0110, 40.7260, 44000, 0.02, -0.6], ['hugh_carey_tunnel', 'Hugh L. Carey Tunnel', -74.0135, 40.7040, 26000, 0.06, 2.9], ['west_60th', 'West 60th St', -73.9880, 40.7715, 52000, 0.05, -4.2],
  ['east_60th', 'East 60th St', -73.9660, 40.7625, 78000, 0.05, -3.1], ['fdr_60th', 'FDR Drive at 60th St', -73.9595, 40.7595, 42000, 0.86, -1.2], ['wsh_60th', 'West Side Highway at 60th St', -73.9925, 40.7735, 36000, 0.84, 0.4],
];
const CLASS_MIX = { cars: 0.78, trucks_single: 0.07, trucks_multi: 0.01, buses: 0.02, motorcycles: 0.01, taxi_fhv: 0.11 };
function crzPeriod(weekday, exclShare, scale, days) {
  const wd = Math.round(weekday * scale); const we = Math.round(wd * 0.78); const avgDaily = Math.round((wd * 5 + we * 2) / 7);
  const total = avgDaily * days; const hw = scaleShape(WEEKDAY_SHAPE, wd); const hwe = scaleShape(WEEKEND_SHAPE, we);
  const mix = Object.fromEntries(Object.entries(CLASS_MIX).map(([k, v]) => [k, r3(v * (1 + jitter(0.1)))]));
  return { total_entries: total, excluded_entries: Math.round(total * exclShare), excluded_share: r3(exclShare), days, avg_daily_entries: avgDaily, avg_weekday_entries: wd, avg_weekend_entries: we, peak_share: peakShare(hw), class_mix: mix, hourly_weekday: hw, hourly_weekend: hwe };
}
const crzFeatures = CRZ_POINTS.map(([id, name, lon, lat, wd, excl, chg]) => {
  const periods = { post_2025: crzPeriod(wd, excl, 1, daysBetween(PERIODS.post_2025.start, PERIODS.post_2025.end)), ytd_2025: crzPeriod(wd, excl, 1.01, daysBetween(PERIODS.ytd_2025.start, PERIODS.ytd_2025.end)), post_2026_ytd: crzPeriod(wd, excl, 1.01 * (1 + chg / 100), daysBetween(PERIODS.post_2026_ytd.start, PERIODS.post_2026_ytd.end)) };
  return feature(point(lon, lat), { ...common(id, name, 'crz_entry', lon, lat), region: name, periods, change: { pct_2026ytd_vs_2025ytd: r1(chg + jitter(0.4)), weekday_pct_2026ytd_vs_2025ytd: r1(chg), trucks_pct_2026ytd_vs_2025ytd: r1(chg - 2.5 + jitter(1.5)) } });
});
const crzTotalWeekday2025 = crzFeatures.reduce((s, f) => s + f.properties.periods.post_2025.avg_weekday_entries, 0);
const crzTotalWeekday2026 = crzFeatures.reduce((s, f) => s + f.properties.periods.post_2026_ytd.avg_weekday_entries, 0);

// ================================================================ MTA bridges & tunnels
const BT = [
  ['rfk_bronx', 'RFK Bridge – Bronx Plaza', -73.9215, 40.7985, 90000, 3.1, 0.08, ['Bronx-bound', 'Manhattan/Queens-bound']], ['rfk_manhattan', 'RFK Bridge – Manhattan Plaza', -73.9310, 40.7860, 75000, -1.4, 0.05, ['Manhattan-bound', 'Queens/Bronx-bound']],
  ['bronx_whitestone', 'Bronx-Whitestone Bridge', -73.8292, 40.8012, 115000, 2.6, 0.09, ['Bronx-bound', 'Queens-bound']], ['throgs_neck', 'Throgs Neck Bridge', -73.7935, 40.8010, 105000, 1.9, 0.11, ['Bronx-bound', 'Queens-bound']],
  ['henry_hudson', 'Henry Hudson Bridge', -73.9220, 40.8775, 65000, 0.6, 0.01, ['Bronx-bound', 'Manhattan-bound']], ['verrazzano', 'Verrazzano-Narrows Bridge', -74.0447, 40.6066, 200000, 1.4, 0.07, ['Brooklyn-bound', 'Staten Island-bound']],
  ['queens_midtown_tunnel_bt', 'Queens-Midtown Tunnel', -73.9650, 40.7440, 80000, -6.8, 0.04, ['Manhattan-bound', 'Queens-bound']], ['hugh_carey_tunnel_bt', 'Hugh L. Carey Tunnel', -74.0130, 40.6990, 55000, -8.4, 0.05, ['Manhattan-bound', 'Brooklyn-bound']],
  ['marine_parkway', 'Marine Parkway–Gil Hodges Bridge', -73.8860, 40.5730, 22000, -0.9, 0.02, ['Rockaway-bound', 'Brooklyn-bound']], ['cross_bay', 'Cross Bay Veterans Memorial Bridge', -73.8200, 40.5980, 25000, 0.5, 0.02, ['Rockaway-bound', 'Queens-bound']],
];
const BT_YEAR_SCALE = { 2023: 0.985, 2024: 1, 2025: null, 2026: null };
function btPeriod(avgDaily, truckShare, days) {
  const wd = Math.round(avgDaily * 1.08); const we = Math.round(avgDaily * 0.8); const hw = scaleShape(WEEKDAY_SHAPE, wd); const hwe = scaleShape(WEEKEND_SHAPE, we);
  return { total: avgDaily * days, days, avg_daily: Math.round(avgDaily), avg_weekday: wd, avg_weekend: we, trucks_total: Math.round(avgDaily * days * truckShare), trucks_avg_daily: Math.round(avgDaily * truckShare), truck_share: r3(truckShare), peak_share: peakShare(hw), hourly_weekday: hw, hourly_weekend: hwe };
}
const btFeatures = BT.map(([id, name, lon, lat, base, chg25, truckShare, directions]) => {
  const chg26 = chg25 + jitter(1.2) - 0.4; const truckChg25 = chg25 + 1.8 + jitter(1.5);
  const scale = { pre_2023: 0.985, pre_2024: 1, post_2025: 1 + chg25 / 100, post_2026_ytd: 1 + chg26 / 100, ytd_2024: 0.995, ytd_2025: 0.995 * (1 + chg25 / 100) };
  const periods = Object.fromEntries(Object.entries(scale).map(([k, s]) => [k, btPeriod(base * s, truckShare * (k.startsWith('post') ? 1 + truckChg25 / 200 : 1), daysBetween(PERIODS[k].start, PERIODS[k].end))]));
  const by_direction = Object.fromEntries(directions.map((d, i) => { const share = i === 0 ? 0.52 : 0.48; const dchg = chg25 + jitter(1.5); const a24 = Math.round(base * share); const a25 = Math.round(a24 * (1 + dchg / 100)); return [d, { avg_daily_2024: a24, avg_daily_2025: a25, pct_2025_vs_2024: r1(dchg), trucks_pct_2025_vs_2024: r1(truckChg25 + jitter(1)) }]; }));
  return feature(point(lon, lat), { ...common(id, name, 'bt_facility', lon, lat), role: /Tunnel/.test(name) ? 'crossing_credit_tunnel' : 'bridge', directions, periods, change: { pct_2025_vs_2024: r1(chg25), pct_2025_vs_2023: r1(chg25 + 1.5), pct_2026ytd_vs_2025ytd: r1(chg26 - chg25), pct_2026ytd_vs_2024ytd: r1(chg26 + 0.5), trucks_pct_2025_vs_2024: r1(truckChg25), trucks_pct_2026ytd_vs_2024ytd: r1(truckChg25 + jitter(1)), peak_share_delta_2025_vs_2024: r3(jitter(0.012)) }, by_direction });
});

// ================================================================ DOT count locations
const DOT = [
  ['bruckner_138', 'Bruckner Blvd', 'E 138 St', 'E 141 St', 'Bronx', -73.9145, 40.8075, 'matched', 6.4], ['grand_concourse_149', 'Grand Concourse', 'E 149 St', 'E 153 St', 'Bronx', -73.9265, 40.8185, 'matched', 2.1], ['hunts_point_ave', 'Hunts Point Ave', 'Bruckner Blvd', 'Lafayette Ave', 'Bronx', -73.8905, 40.8150, 'matched', 4.8],
  ['jerome_ave_170', 'Jerome Ave', 'E 170 St', 'E 174 St', 'Bronx', -73.9155, 40.8395, 'post_only', null], ['e_tremont', 'E Tremont Ave', 'Webster Ave', 'Third Ave', 'Bronx', -73.8985, 40.8465, 'post_only', null], ['willis_ave', 'Willis Ave', 'E 135 St', 'E 138 St', 'Bronx', -73.9235, 40.8080, 'pre_only', null],
  ['canal_st', 'Canal St', 'Bowery', 'Broadway', 'Manhattan', -73.9995, 40.7180, 'matched', -9.2], ['broadway_35', 'Broadway', 'W 34 St', 'W 36 St', 'Manhattan', -73.9878, 40.7507, 'matched', -11.5], ['first_ave_23', '1 Ave', 'E 23 St', 'E 25 St', 'Manhattan', -73.9790, 40.7375, 'post_only', null],
  ['second_ave_60', '2 Ave', 'E 59 St', 'E 61 St', 'Manhattan', -73.9635, 40.7615, 'matched', 3.4], ['west_st_chambers', 'West St', 'Chambers St', 'Warren St', 'Manhattan', -74.0140, 40.7160, 'post_only', null], ['125_st', 'W 125 St', 'Lenox Ave', 'Adam Clayton Powell Blvd', 'Manhattan', -73.9455, 40.8085, 'post_only', null],
  ['flatbush_atlantic', 'Flatbush Ave', 'Atlantic Ave', 'Pacific St', 'Brooklyn', -73.9775, 40.6845, 'matched', -1.8], ['atlantic_ave_bk', 'Atlantic Ave', 'Nostrand Ave', 'Bedford Ave', 'Brooklyn', -73.9510, 40.6790, 'post_only', null], ['tillary_st', 'Tillary St', 'Jay St', 'Adams St', 'Brooklyn', -73.9880, 40.6960, 'matched', -4.6],
  ['metropolitan_ave', 'Metropolitan Ave', 'Union Ave', 'Lorimer St', 'Brooklyn', -73.9510, 40.7140, 'post_only', null], ['fourth_ave_bk', '4 Ave', '36 St', '38 St', 'Brooklyn', -74.0030, 40.6545, 'post_only', null],
  ['queens_blvd', 'Queens Blvd', '39 St', '41 St', 'Queens', -73.9265, 40.7440, 'matched', 2.7], ['northern_blvd', 'Northern Blvd', '48 St', '50 St', 'Queens', -73.9130, 40.7550, 'post_only', null], ['astoria_blvd', 'Astoria Blvd', '31 St', '33 St', 'Queens', -73.9195, 40.7705, 'post_only', null],
  ['van_wyck_svc', 'Van Wyck Expwy Svc Rd', 'Jamaica Ave', 'Hillside Ave', 'Queens', -73.8110, 40.7085, 'post_only', null], ['woodhaven_blvd', 'Woodhaven Blvd', 'Jamaica Ave', 'Atlantic Ave', 'Queens', -73.8560, 40.6905, 'pre_only', null],
  ['hylan_blvd', 'Hylan Blvd', 'Steuben St', 'Old Town Rd', 'Staten Island', -74.0810, 40.5990, 'post_only', null], ['richmond_terr', 'Richmond Terrace', 'Jersey St', 'Westervelt Ave', 'Staten Island', -74.0855, 40.6430, 'post_only', null],
];
const dotFeatures = DOT.map(([segment_id, street, from_st, to_st, boro, lon, lat, role, chg]) => {
  const base = Math.round(9000 + rnd() * 26000); const matched = role === 'matched';
  const pre_months = matched ? ['2024-05', '2024-06'] : role === 'pre_only' ? ['2023-09'] : []; const post_months = role === 'pre_only' ? [] : matched ? ['2025-05', '2025-06'] : ['2025-10'];
  const pre_adv = role === 'post_only' ? null : base; const post_adv = role === 'pre_only' ? null : Math.round(base * (1 + (chg ?? jitter(4)) / 100));
  const allMonths = [...pre_months, ...post_months];
  return feature(point(lon, lat), { ...common(`dot_${segment_id}`, `${street} (${from_st} – ${to_st})`, 'dot_segment', lon, lat, false), segment_id, street, from_st, to_st, boro, directions: ['NB', 'SB'], months: allMonths, first_month: allMonths[0], last_month: allMonths[allMonths.length - 1], latest_adv: post_adv ?? pre_adv, role, has_pre_post: matched, pre_adv, post_adv, pct_change: matched ? r1(chg) : null, pre_months, post_months, comparison_kind: matched ? 'same_month' : null, baseline_long_adv: matched ? Math.round(base * 0.97) : null, baseline_years: matched ? [2023, 2024] : [] });
});
const dotMatched = dotFeatures.filter((f) => f.properties.role === 'matched').map((f) => { const p = f.properties; const nb = p.pct_change + jitter(2); const sb = p.pct_change - (nb - p.pct_change); return { ...p, hourly_weekday_pre: scaleShape(WEEKDAY_SHAPE, p.pre_adv), hourly_weekday_post: scaleShape(WEEKDAY_SHAPE, p.post_adv), by_direction: { NB: { pre_adv: Math.round(p.pre_adv * 0.51), post_adv: Math.round(p.pre_adv * 0.51 * (1 + nb / 100)), pct_change: r1(nb) }, SB: { pre_adv: Math.round(p.pre_adv * 0.49), post_adv: Math.round(p.pre_adv * 0.49 * (1 + sb / 100)), pct_change: r1(sb) } } }; });

// ================================================================ NYCCAS PM2.5 monitors
// [site_id, name, address, lon, lat, role, crz_status, pre_2024 mean, raw delta 2025, raw delta 2026ytd, coverage]
const AQ = [
  ['mott_haven', 'Mott Haven', 'E 138 St & Willis Ave, Bronx', -73.9225, 40.8065, 'site', 'outside', 9.1, 0.3, 0.4, 94], ['hunts_point', 'Hunts Point', 'Hunts Point Ave & Bruckner Blvd, Bronx', -73.886, 40.819, 'site', 'outside', 8.8, -0.2, -0.1, 91], ['cross_bronx', 'Cross Bronx Expwy', 'Cross Bronx Expwy & Webster Ave, Bronx', -73.9005, 40.8445, 'site', 'outside', 9.4, 0.4, 0.5, 89],
  ['midtown_35', 'Midtown – Broadway/35th', 'Broadway & W 35 St, Manhattan', -73.9878, 40.7507, 'site', 'inside', 9.6, -1.3, -1.4, 95], ['lower_east_side', 'Lower East Side', 'Delancey St & Essex St, Manhattan', -73.9880, 40.7185, 'site', 'inside', 8.9, -1.0, -1.1, 92], ['chelsea', 'Chelsea', 'W 23 St & 8 Ave, Manhattan', -73.9965, 40.7450, 'site', 'inside', 9.0, -1.1, -1.2, 93], ['wall_st', 'Financial District', 'Wall St & Water St, Manhattan', -74.0075, 40.7055, 'site', 'inside', 8.7, -0.6, -0.7, 88], ['murray_hill', 'Murray Hill', 'E 36 St & 2 Ave, Manhattan', -73.9750, 40.7465, 'site', 'inside', 9.2, -0.5, -0.6, 90],
  ['east_60th_aq', 'East 60th St (boundary)', 'E 60 St & 2 Ave, Manhattan', -73.9635, 40.7615, 'site', 'boundary', 9.3, -0.4, -0.3, 87], ['upper_east', 'Upper East Side', 'E 86 St & Lexington Ave, Manhattan', -73.9555, 40.7790, 'site', 'outside', 8.4, -0.6, -0.6, 96], ['harlem_125', 'Harlem', 'W 125 St & Lenox Ave, Manhattan', -73.9455, 40.8085, 'site', 'outside', 8.6, -0.3, -0.2, 93],
  ['astoria', 'Astoria', 'Astoria Blvd & 31 St, Queens', -73.9195, 40.7705, 'site', 'outside', 8.1, -0.5, -0.5, 95], ['williamsburg', 'Williamsburg', 'Metropolitan Ave & Union Ave, Brooklyn', -73.9510, 40.7140, 'site', 'outside', 8.3, -0.7, -0.8, 94], ['sunset_park', 'Sunset Park', '4 Ave & 36 St, Brooklyn', -74.0030, 40.6545, 'site', 'outside', 8.0, -0.4, -0.4, 90],
  ['van_wyck', 'Van Wyck Expwy (DOHMH control)', 'Van Wyck Expwy & Jamaica Ave, Queens', -73.8110, 40.7079, 'control', 'outside', 8.5, -0.4, -0.5, 97], ['port_richmond', 'Port Richmond (reference)', 'Richmond Terrace & Port Richmond Ave, Staten Island', -74.1355, 40.6390, 'reference', 'outside', 6.9, -0.4, -0.4, 92], ['flushing', 'Flushing', 'Main St & Roosevelt Ave, Queens', -73.8300, 40.7595, 'site', 'outside', 7.9, -0.2, null, 54],
];
const CONTROL_DELTA = { post_2025: -0.4, post_2026_ytd: -0.5 }; const REF_DELTA = { post_2025: -0.4, post_2026_ytd: -0.4 };
const classify = (adj, coverage) => (coverage < 60 || adj == null ? 'insufficient' : adj < -0.5 ? 'improved' : adj > 0.5 ? 'worsened' : 'unchanged');
function aqPeriod(mean, days, coverage, smoke) {
  if (mean == null) return null; const hw = aqHourly(mean, 0.9); const hwe = aqHourly(mean - 0.3, 0.6);
  return { mean: r2(mean), median: r2(mean - 0.7), days: Math.round(days * coverage / 100), coverage_pct: r1(coverage), peak_mean: r2(mean + 0.35), overnight_mean: r2(mean - 0.25), smoke_days_excluded: smoke, hourly_weekday: hw, hourly_weekend: hwe };
}
function aqComparison(pre, post, key, coverage, monthsUsed) {
  if (pre == null || post == null) return { months_used: monthsUsed, pre_mean: pre == null ? null : r2(pre), post_mean: post == null ? null : r2(post), delta_raw: null, pct_raw: null, delta_adj_control: null, control_site: 'van_wyck', delta_adj_reference: null, reference_site: 'port_richmond', ci_low: null, ci_high: null, coverage_ok: false, classification: 'insufficient' };
  const delta = r2(post - pre); const adj = r2(delta - CONTROL_DELTA[key]);
  return { months_used: monthsUsed, pre_mean: r2(pre), post_mean: r2(post), delta_raw: delta, pct_raw: pct(post, pre), delta_adj_control: adj, control_site: 'van_wyck', delta_adj_reference: r2(delta - REF_DELTA[key]), reference_site: 'port_richmond', ci_low: r2(adj - 0.35), ci_high: r2(adj + 0.35), coverage_ok: coverage >= 60, classification: classify(adj, coverage) };
}
const ALL_MONTHS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')); const YTD_MONTHS = ALL_MONTHS.slice(0, 8);
const aqFeatures = AQ.map(([site_id, name, address, lon, lat, role, crz_status, pre, d25, d26, coverage]) => {
  const post25 = pre + d25; const post26 = d26 == null ? null : pre + d26;
  const periods = { pre_2024: aqPeriod(pre, 362, coverage, 6), post_2025: aqPeriod(post25, 361, coverage, 4), post_2026_ytd: aqPeriod(post26, 243, d26 == null ? 40 : coverage, 2), ytd_2024: aqPeriod(pre - 0.1, 240, coverage, 5), ytd_2025: aqPeriod(post25 - 0.05, 239, coverage, 3) };
  const comparisons = { post_2025_vs_pre_2024: aqComparison(pre, post25, 'post_2025', coverage, ALL_MONTHS), post_2026ytd_vs_ytd_2025: aqComparison(post25 - 0.05, post26, 'post_2026_ytd', d26 == null ? 40 : coverage, YTD_MONTHS), post_2026ytd_vs_ytd_2024: aqComparison(pre - 0.1, post26, 'post_2026_ytd', d26 == null ? 40 : coverage, YTD_MONTHS) };
  return feature(point(lon, lat), { ...common(site_id, name, 'aq_monitor', lon, lat, false), site_id, address, role, crz_status, active_from: '2023-01-01', active_to: null, relocated: false, periods, comparisons, classification: comparisons.post_2025_vs_pre_2024.classification });
});

// ================================================================ polygons
const boroughsFC = { type: 'FeatureCollection', features: BOROUGHS.map((b) => feature({ type: 'Polygon', coordinates: [b.ring] }, { boro_name: b.boro_name, boro_code: b.boro_code })) };
const crzZoneFC = { type: 'FeatureCollection', features: [feature({ type: 'Polygon', coordinates: [CRZ_RING] }, { name: 'Congestion Relief Zone', source: 'mock — coarse outline of Manhattan south of 60th St' })] };
const uhfFC = { type: 'FeatureCollection', features: UHF.map((u) => feature({ type: 'Polygon', coordinates: sq(u[3], u[4], 0.021) }, { ...uhfProps(u), pm25_change_pct_2009_2024: null })).map((f) => { f.properties.pm25_change_pct_2009_2024 = pct(f.properties.pm25_2024, f.properties.pm25_2009); return f; }) };
const dacFeatures = []; const COUNTY = { Manhattan: 'New York', Bronx: 'Bronx', Brooklyn: 'Kings', Queens: 'Queens', 'Staten Island': 'Richmond' };
for (let lat = 40.50; lat < 40.92; lat += 0.01) for (let lon = -74.26; lon < -73.70; lon += 0.013) {
  const c = [lon + 0.0065, lat + 0.005]; const boro = boroOf(c); if (!boro) continue; const b = burden(c); const noise = rnd();
  const combined = Math.min(0.99, Math.max(0.01, 0.25 + b * 0.62 + (noise - 0.5) * 0.3)); const dac = combined > 0.55;
  dacFeatures.push(feature({ type: 'Polygon', coordinates: [[[lon, lat], [lon + 0.013, lat], [lon + 0.013, lat + 0.01], [lon, lat + 0.01], [lon, lat]]] }, { geoid: `36${String(dacFeatures.length).padStart(9, '0')}`, dac, combined_pct: r3(combined), asthma_pct: r3(Math.min(0.99, 0.2 + b * 0.7 + (noise - 0.5) * 0.2)), traffic_pct: r3(Math.min(0.99, 0.3 + b * 0.5 + (rnd() - 0.5) * 0.3)), truck_pct: r3(Math.min(0.99, 0.25 + b * 0.6 + (rnd() - 0.5) * 0.3)), county: COUNTY[boro], population: Math.round(2500 + rnd() * 4500) }));
}
const dacFC = { type: 'FeatureCollection', features: dacFeatures };

// ================================================================ series
const crzDaily = []; const crzByPoint = Object.fromEntries(CRZ_POINTS.map((p) => [p[0], []]));
for (const d of eachDay(CP_START, PERIODS.post_2026_ytd.end)) {
  const yr = d.getUTCFullYear(); const yearScale = yr === 2026 ? crzTotalWeekday2026 / crzTotalWeekday2025 : 1; const ramp = d < parse('2025-02-15') ? 0.93 : 1;
  const base = (isWeekday(d) ? crzTotalWeekday2025 : crzTotalWeekday2025 * 0.78) * season(d) * yearScale * ramp * (1 + jitter(0.05)); const entries = Math.round(base);
  crzDaily.push({ date: toISO(d), entries, excluded: Math.round(entries * 0.18), cars: Math.round(entries * CLASS_MIX.cars), trucks: Math.round(entries * (CLASS_MIX.trucks_single + CLASS_MIX.trucks_multi)), taxi_fhv: Math.round(entries * CLASS_MIX.taxi_fhv), buses: Math.round(entries * CLASS_MIX.buses), motorcycles: Math.round(entries * CLASS_MIX.motorcycles) });
  for (const f of crzFeatures) crzByPoint[f.properties.id].push({ date: toISO(d), entries: Math.round(entries * (f.properties.periods.post_2025.avg_weekday_entries / crzTotalWeekday2025) * (1 + jitter(0.03))) });
}
const weekly = []; for (let i = 0; i < crzDaily.length; i += 7) { const chunk = crzDaily.slice(i, i + 7); const wk = chunk.filter((r) => isWeekday(parse(r.date))); weekly.push({ week_start: chunk[0].date, entries: chunk.reduce((s, r) => s + r.entries, 0), weekday_avg: wk.length ? Math.round(wk.reduce((s, r) => s + r.entries, 0) / wk.length) : null }); }
const crzSeries = { daily_total: crzDaily, daily_by_point: crzByPoint, weekly_total: weekly };

const btMonthly = {}; const btDaily = {}; const sysMonthly = {};
for (const f of btFeatures) { const p = f.properties; const yearly = { 2023: p.periods.pre_2023.avg_daily, 2024: p.periods.pre_2024.avg_daily, 2025: p.periods.post_2025.avg_daily, 2026: p.periods.post_2026_ytd.avg_daily };
  btMonthly[p.id] = months('2023-01', '2026-08').map((ym) => { const y = Number(ym.slice(0, 4)); const total = Math.round(yearly[y] * dim(ym) * season(parse(`${ym}-15`)) * (1 + jitter(0.03))); const tr = Math.round(total * p.periods.pre_2024.truck_share); sysMonthly[ym] = sysMonthly[ym] || { ym, total: 0, trucks: 0 }; sysMonthly[ym].total += total; sysMonthly[ym].trucks += tr; return { ym, total, cars: total - tr - Math.round(total * 0.02), trucks: tr, buses: Math.round(total * 0.015), motorcycles: Math.round(total * 0.005) }; });
  btDaily[p.id] = []; for (const d of eachDay('2023-01-01', '2026-08-31')) btDaily[p.id].push({ date: toISO(d), total: Math.round(yearly[d.getUTCFullYear()] * (isWeekday(d) ? 1.08 : 0.8) * season(d) * (1 + jitter(0.06))) }); }
const btSeries = { monthly: btMonthly, daily: btDaily, system_monthly: Object.values(sysMonthly) };

const SMOKE = ['2024-06-11', '2024-06-12', '2024-07-19', '2024-07-20', '2024-08-02', '2024-11-09', '2025-06-06', '2025-06-07', '2025-08-14', '2025-08-15', '2026-06-22', '2026-07-30'];
const aqMonthly = {}; const aqDaily = {};
for (const f of aqFeatures) { const p = f.properties; const meanFor = (y) => (y === 2024 ? p.periods.pre_2024?.mean : y === 2025 ? p.periods.post_2025?.mean : p.periods.post_2026_ytd?.mean ?? null);
  aqMonthly[p.site_id] = months('2024-01', '2026-08').map((ym) => { const m = meanFor(Number(ym.slice(0, 4))); if (m == null) return { ym, mean: null, median: null, days: 0 }; const mo = Number(ym.slice(5)); const seasonal = 0.9 * Math.cos(((mo - 1) / 12) * 2 * Math.PI) + (mo === 7 ? 0.6 : 0); const mean = r2(m + seasonal + jitter(0.4)); return { ym, mean, median: r2(mean - 0.7), days: Math.round(dim(ym) * (p.periods.pre_2024?.coverage_pct ?? 90) / 100) }; });
  aqDaily[p.site_id] = []; for (const d of eachDay('2024-01-01', '2026-08-31')) { const mo = aqMonthly[p.site_id].find((r) => r.ym === toISO(d).slice(0, 7)); if (!mo || mo.mean == null) continue; const smoke = SMOKE.includes(toISO(d)); aqDaily[p.site_id].push({ date: toISO(d), mean: r1(smoke ? mo.mean + 28 + rnd() * 20 : Math.max(2, mo.mean + jitter(3.2))) }); } }
const aqSeries = { monthly: aqMonthly, daily: aqDaily, smoke_days: SMOKE };

// ================================================================ summary
const site = (f) => { const p = f.properties; const c = p.comparisons.post_2025_vs_pre_2024; return { site_id: p.site_id, name: p.name, pre_mean: c.pre_mean, post_mean: c.post_mean, delta_raw: c.delta_raw, delta_adj_control: c.delta_adj_control, pct_raw: c.pct_raw, classification: c.classification, months_used: c.months_used }; };
const count = (list) => ({ improved: list.filter((f) => f.properties.classification === 'improved').length, unchanged: list.filter((f) => f.properties.classification === 'unchanged').length, worsened: list.filter((f) => f.properties.classification === 'worsened').length, insufficient: list.filter((f) => f.properties.classification === 'insufficient').length });
const insideSites = aqFeatures.filter((f) => f.properties.crz_status === 'inside'); const outsideSites = aqFeatures.filter((f) => f.properties.crz_status !== 'inside');
const control = aqFeatures.find((f) => f.properties.role === 'control'); const cc = control.properties.comparisons.post_2025_vs_pre_2024;
const sys24 = btFeatures.reduce((s, f) => s + f.properties.periods.pre_2024.avg_daily, 0); const sys25 = btFeatures.reduce((s, f) => s + f.properties.periods.post_2025.avg_daily, 0);
const sysY24 = btFeatures.reduce((s, f) => s + f.properties.periods.ytd_2024.avg_daily, 0); const sysY26 = btFeatures.reduce((s, f) => s + f.properties.periods.post_2026_ytd.avg_daily, 0);
const trucks24 = btFeatures.reduce((s, f) => s + f.properties.periods.pre_2024.trucks_avg_daily, 0); const trucks25 = btFeatures.reduce((s, f) => s + f.properties.periods.post_2025.trucks_avg_daily, 0);
const facRow = (f) => ({ id: f.properties.id, name: f.properties.name, pct_2025_vs_2024: f.properties.change.pct_2025_vs_2024, role: f.properties.role, dac_designated: f.properties.dac_designated });
const facUp = btFeatures.filter((f) => f.properties.change.pct_2025_vs_2024 > 0).sort((a, b) => b.properties.change.pct_2025_vs_2024 - a.properties.change.pct_2025_vs_2024).map(facRow);
const facDown = btFeatures.filter((f) => f.properties.change.pct_2025_vs_2024 <= 0).sort((a, b) => a.properties.change.pct_2025_vs_2024 - b.properties.change.pct_2025_vs_2024).map(facRow);
const matched = dotFeatures.filter((f) => f.properties.role === 'matched');
const sumHourly = (key) => crzFeatures.reduce((acc, f) => acc.map((v, i) => v + (f.properties.periods[key]?.hourly_weekday[i] ?? 0)), Array(24).fill(0));
const hw25 = sumHourly('post_2025'); const totalEntries25 = crzFeatures.reduce((s, f) => s + f.properties.periods.post_2025.total_entries, 0);
const summary = {
  generated_at: new Date().toISOString(), cp_start: CP_START, periods: PERIODS,
  crz: { first_date: CP_START, last_date: PERIODS.post_2026_ytd.end, days_covered: daysBetween(CP_START, PERIODS.post_2026_ytd.end), avg_weekday_entries_2025: crzTotalWeekday2025, avg_weekday_entries_2026ytd: crzTotalWeekday2026, avg_weekend_entries_2025: Math.round(crzTotalWeekday2025 * 0.78), yoy_weekday_pct: pct(crzTotalWeekday2026, crzTotalWeekday2025), peak_share_2025: peakShare(hw25), overnight_share_2025: r3(1 - peakShare(hw25)), excluded_share_2025: r3(crzFeatures.reduce((s, f) => s + f.properties.periods.post_2025.excluded_entries, 0) / totalEntries25), class_mix_2025: CLASS_MIX, trucks_yoy_pct: -4.1, hourly_weekday_2025: hw25, hourly_weekday_2026ytd: sumHourly('post_2026_ytd'), top_entry_points_2025: [...crzFeatures].sort((a, b) => b.properties.periods.post_2025.avg_weekday_entries - a.properties.periods.post_2025.avg_weekday_entries).slice(0, 5).map((f) => ({ id: f.properties.id, name: f.properties.name, avg_weekday_entries: f.properties.periods.post_2025.avg_weekday_entries, share: r3(f.properties.periods.post_2025.avg_weekday_entries / crzTotalWeekday2025) })) },
  bt: { system_avg_daily_2024: sys24, system_avg_daily_2025: sys25, system_pct_2025_vs_2024: pct(sys25, sys24), system_pct_2026ytd_vs_2024ytd: pct(sysY26, sysY24), trucks_pct_2025_vs_2024: pct(trucks25, trucks24), facilities_up: facUp, facilities_down: facDown, facilities_up_in_dac: facUp.filter((f) => f.dac_designated).length, facilities_up_total: facUp.length },
  dot: { matched_segments: matched.length, post_only_segments: dotFeatures.filter((f) => f.properties.role === 'post_only').length, matched_up: matched.filter((f) => f.properties.pct_change > 0).length, matched_down: matched.filter((f) => f.properties.pct_change <= 0).length, highlights: matched.slice(0, 6).map((f) => { const p = f.properties; return { segment_id: p.segment_id, street: p.street, boro: p.boro, pre_adv: p.pre_adv, post_adv: p.post_adv, pct_change: p.pct_change, pre_months: p.pre_months, post_months: p.post_months, comparison_kind: p.comparison_kind }; }) },
  aq: { sites_total: aqFeatures.length, sites_with_comparison: aqFeatures.filter((f) => f.properties.classification !== 'insufficient').length, inside: count(insideSites), outside: count(outsideSites), control: { site_id: control.properties.site_id, name: control.properties.name, pre_mean: cc.pre_mean, post_mean: cc.post_mean, delta_raw: cc.delta_raw, pct_raw: cc.pct_raw }, south_bronx: aqFeatures.filter((f) => ['mott_haven', 'hunts_point', 'cross_bronx'].includes(f.properties.site_id)).map(site), inside_sites: insideSites.map(site), smoke_days_excluded: { pre_2024: 6, post_2025: 4, post_2026_ytd: 2 }, sites_worsened_in_dac: aqFeatures.filter((f) => f.properties.classification === 'worsened' && f.properties.dac_designated).length, sites_worsened_total: aqFeatures.filter((f) => f.properties.classification === 'worsened').length, citywide_pm25_2009: 10.9, citywide_pm25_2024: 6.4 },
  equity: { nyc_tracts: 2325, dac_designated_tracts: 1082, dac_share: r3(1082 / 2325) },
};

const tolls = { effective: CP_START, peak_hours: { weekday: '5:00 AM – 9:00 PM', weekend: '9:00 AM – 9:00 PM' }, overnight_discount: '75% off peak', ezpass_rates: [{ class: 'Passenger & small commercial vehicles', peak: 9.0, overnight: 2.25, crossing_credit: 3.0 }, { class: 'Motorcycles', peak: 4.5, overnight: 1.05, crossing_credit: 1.5 }, { class: 'Small trucks & charter buses', peak: 14.4, overnight: 3.6, crossing_credit: 7.2 }, { class: 'Large trucks & tour buses', peak: 21.6, overnight: 5.4, crossing_credit: 12.0 }], per_trip: [{ class: 'Taxis, green cabs, black cars', fee: 0.75 }, { class: 'High-volume for-hire vehicles (Uber/Lyft)', fee: 1.5 }], crossing_credit_tunnels: ['Lincoln Tunnel', 'Holland Tunnel', 'Queens-Midtown Tunnel', 'Hugh L. Carey Tunnel'], excluded_roadways: ['FDR Drive', 'West Side Highway / Route 9A', 'Battery Park Underpass', 'Hugh L. Carey Tunnel surface connection to West St'], scheduled_increases: [{ year: 2028, peak_car: 12.0 }, { year: 2031, peak_car: 15.0 }], source: 'https://www.mta.info/fares-tolls/tolls/congestion-relief-zone/about' };

const sources = [
  { name: 'MTA Congestion Relief Zone Vehicle Entries: Beginning 2025', publisher: 'Metropolitan Transportation Authority', portal: 'NY State Open Data', dataset_id: 't6yz-b64h', url: 'https://data.ny.gov/d/t6yz-b64h', used_for: 'Zone entries by detector group, hour and vehicle class (chapter 2)' },
  { name: 'Hourly Traffic on MTA Bridges and Tunnels', publisher: 'MTA Bridges and Tunnels', portal: 'NY State Open Data', dataset_id: 'ebfx-2m7v', url: 'https://data.ny.gov/d/ebfx-2m7v', used_for: 'Crossing volumes 2023–2026 by facility, direction and vehicle class (chapter 3)' },
  { name: 'Automated Traffic Volume Counts', publisher: 'NYC Department of Transportation', portal: 'NYC Open Data', dataset_id: '7ym2-wayt', url: 'https://data.cityofnewyork.us/Transportation/Automated-Traffic-Volume-Counts/7ym2-wayt', used_for: 'Spot counts on local streets before and after the toll (chapter 3)' },
  { name: 'NYCCAS real-time PM2.5 monitoring (hist/csv)', publisher: 'NYC Department of Health and Mental Hygiene', portal: 'GitHub (nychealth/nyccas-data)', dataset_id: 'nyccas-data', url: 'https://github.com/nychealth/nyccas-data', used_for: 'Hourly PM2.5 at street-level monitors, 2023–2026 (chapter 4)' },
  { name: 'Air Quality (Environment & Health Data Portal)', publisher: 'NYC DOHMH', portal: 'NYC Open Data', dataset_id: 'c3uy-2p5r', url: 'https://data.cityofnewyork.us/Environment/Air-Quality/c3uy-2p5r', used_for: 'UHF42 annual PM2.5 and asthma emergency visits attributable to PM2.5 (chapter 5)' },
  { name: 'Disadvantaged Communities (DAC) 2023', publisher: 'NYS Climate Justice Working Group', portal: 'NY State Open Data', dataset_id: '2e6c-s6fp', url: 'https://data.ny.gov/d/2e6c-s6fp', used_for: 'Tract-level designation and burden percentiles (chapter 5)' },
  { name: 'MTA Central Business District Geofence', publisher: 'Metropolitan Transportation Authority', portal: 'NY State Open Data', dataset_id: 'srxy-5nxn', url: 'https://data.ny.gov/d/srxy-5nxn', used_for: 'Congestion Relief Zone outline (chapter 1)' },
  { name: 'UHF42 neighborhood geography', publisher: 'NYC DOHMH Environment & Health', portal: 'GitHub (nycehs/NYC_geography)', dataset_id: 'UHF42', url: 'https://github.com/nycehs/NYC_geography', used_for: 'Neighborhood polygons for the asthma choropleth' },
  { name: 'Borough Boundaries', publisher: 'NYC Department of City Planning', portal: 'NYC Open Data', dataset_id: 'tqmj-j8zm', url: 'https://data.cityofnewyork.us/City-Government/Borough-Boundaries/tqmj-j8zm', used_for: 'Borough labels on the basemap' },
  { name: 'Congestion Relief Zone toll schedule', publisher: 'Metropolitan Transportation Authority', portal: 'mta.info', dataset_id: null, url: 'https://www.mta.info/fares-tolls/tolls/congestion-relief-zone/about', used_for: 'Toll table and excluded roadways (chapter 1)' },
];

// ================================================================ write
write('summary.json', summary);
write('crz_zone.geojson', crzZoneFC);
write('crz_entry_points.geojson', { type: 'FeatureCollection', features: crzFeatures });
write('crz_series.json', crzSeries);
write('bt_facilities.geojson', { type: 'FeatureCollection', features: btFeatures });
write('bt_series.json', btSeries);
write('dot_segments.geojson', { type: 'FeatureCollection', features: dotFeatures });
write('dot_matched.json', dotMatched);
write('aq_monitors.geojson', { type: 'FeatureCollection', features: aqFeatures });
write('aq_series.json', aqSeries);
write('dac_tracts.geojson', dacFC);
write('uhf42.geojson', uhfFC);
write('boroughs.geojson', boroughsFC);
write('tolls.json', tolls);
write('sources.json', sources);
console.log(`done → ${OUT}`);
