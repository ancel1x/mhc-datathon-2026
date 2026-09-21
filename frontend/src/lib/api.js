// The bundled data is ready to serve without the optional API. An explicit API base opts in.
const API_BASE = import.meta.env?.VITE_API_BASE?.replace(/\/$/, '');
const STATIC_BASE = import.meta.env?.BASE_URL ?? '/';

export const GEO_LAYERS = new Set([
  'crz_zone', 'crz_entry_points', 'bt_facilities', 'dot_segments', 'aq_monitors', 'dac_tracts', 'uhf42', 'boroughs',
]);

const cache = new Map();

async function fetchJson(url, timeout) {
  const res = await fetch(url, { headers: { accept: 'application/json, application/geo+json' }, signal: timeout ? AbortSignal.timeout(timeout) : undefined });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  const type = res.headers.get('content-type') || '';
  if (/text\/html/i.test(type)) throw new Error(`HTML instead of JSON from ${url}`);
  return res.json();
}

/**
 * loadJson('summary') -> /data/summary.json
 * loadJson('aq_monitors') -> /data/aq_monitors.geojson
 * VITE_API_BASE opts into API-first loading, with a bounded wait before the static fallback.
 */
export function loadJson(name) {
  if (cache.has(name)) return cache.get(name);
  const isGeo = GEO_LAYERS.has(name);
  const primary = isGeo ? `${API_BASE}/geo/${name}` : `${API_BASE}/bundle/${name}`;
  const fallback = `${STATIC_BASE}data/${name}.${isGeo ? 'geojson' : 'json'}`;
  const request = API_BASE ? fetchJson(primary, 2500).catch(() => fetchJson(fallback)) : fetchJson(fallback);
  const promise = request
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
