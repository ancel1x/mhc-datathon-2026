// Data access: FastAPI bundle first, static /data fallback. Results are cached in a Map.
const BASE = import.meta.env.VITE_API_BASE ?? '/api';

export const GEO_LAYERS = new Set([
  'crz_zone', 'crz_entry_points', 'bt_facilities', 'dot_segments', 'aq_monitors', 'dac_tracts', 'uhf42', 'boroughs',
]);

const cache = new Map();

async function fetchJson(url) {
  const res = await fetch(url, { headers: { accept: 'application/json, application/geo+json' } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  const type = res.headers.get('content-type') || '';
  if (/text\/html/i.test(type)) throw new Error(`HTML instead of JSON from ${url}`);
  return res.json();
}

/**
 * loadJson('summary') -> /api/bundle/summary, falling back to /data/summary.json
 * loadJson('aq_monitors') -> /api/geo/aq_monitors, falling back to /data/aq_monitors.geojson
 */
export function loadJson(name) {
  if (cache.has(name)) return cache.get(name);
  const isGeo = GEO_LAYERS.has(name);
  const primary = isGeo ? `${BASE}/geo/${name}` : `${BASE}/bundle/${name}`;
  const fallback = isGeo ? `/data/${name}.geojson` : `/data/${name}.json`;
  const promise = fetchJson(primary)
    .catch(() => fetchJson(fallback))
    .catch((err) => {
      cache.delete(name);
      throw err;
    });
  cache.set(name, promise);
  return promise;
}

export const loadGeo = loadJson;

export function peekJson(name) {
  return cache.get(name) ?? null;
}
