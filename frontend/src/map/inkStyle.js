// "Ink blueprint" basemap: OpenFreeMap vector tiles (OpenMapTiles schema, no key), only water,
// major roads and county boundaries. Labels are our own (boroughs + a few highways).

const DARK = { bg: '#0b0d10', water: '#12161c', road: '#2a2f36', roadHi: '#3a4048', motorway: '#3c434c', motorwayHi: '#4c545e', boundary: '#242930', label: '#4b525c', halo: '#0b0d10' };
const LIGHT = { bg: '#f3f1ec', water: '#e1e4e8', road: '#cfcac2', roadHi: '#b8b2a8', motorway: '#b6b0a6', motorwayHi: '#9f988d', boundary: '#d8d3cb', label: '#8a857c', halo: '#f3f1ec' };

// Hand-placed label anchors (approximate) — rotation follows the corridor.
const HIGHWAY_LABELS = [
  { name: 'BQE', lon: -73.9545, lat: 40.7015, rotate: -62 },
  { name: 'Major Deegan Expwy', lon: -73.9265, lat: 40.8455, rotate: -72 },
  { name: 'Cross Bronx Expwy', lon: -73.8835, lat: 40.8425, rotate: 8 },
  { name: 'FDR Dr', lon: -73.9628, lat: 40.7545, rotate: -76 },
  { name: 'Bruckner Expwy', lon: -73.8735, lat: 40.8225, rotate: 38 },
  { name: 'Van Wyck Expwy', lon: -73.8125, lat: 40.7165, rotate: -82 },
];

const BOROUGH_ANCHORS = {
  Manhattan: { lon: -73.9705, lat: 40.7905, rotate: -62 },
  Bronx: { lon: -73.8655, lat: 40.8695, rotate: 0 },
  Brooklyn: { lon: -73.9455, lat: 40.6425, rotate: 0 },
  Queens: { lon: -73.7955, lat: 40.7405, rotate: 0 },
  'Staten Island': { lon: -74.1525, lat: 40.5785, rotate: 0 },
};

function centroidOf(geometry) {
  if (!geometry) return null;
  let ring = null;
  if (geometry.type === 'Polygon') ring = geometry.coordinates?.[0];
  else if (geometry.type === 'MultiPolygon') {
    let best = 0;
    for (const poly of geometry.coordinates ?? []) {
      const r = poly?.[0];
      if (r && r.length > best) { best = r.length; ring = r; }
    }
  }
  if (!ring || ring.length === 0) return null;
  let x = 0; let y = 0;
  for (const [lon, lat] of ring) { x += lon; y += lat; }
  return [x / ring.length, y / ring.length];
}

function boroughLabelFeatures(boroughsFC) {
  const feats = [];
  for (const f of boroughsFC?.features ?? []) {
    const name = f.properties?.boro_name ?? f.properties?.name;
    if (!name) continue;
    const anchor = BOROUGH_ANCHORS[name];
    const c = anchor ? [anchor.lon, anchor.lat] : centroidOf(f.geometry);
    if (!c) continue;
    feats.push({ type: 'Feature', geometry: { type: 'Point', coordinates: c }, properties: { name, rotate: anchor?.rotate ?? 0 } });
  }
  return { type: 'FeatureCollection', features: feats };
}

const highwayFC = {
  type: 'FeatureCollection',
  features: HIGHWAY_LABELS.map((h) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [h.lon, h.lat] }, properties: { name: h.name, rotate: h.rotate } })),
};

const MAJOR = ['motorway', 'trunk', 'primary'];
const LINKS = ['motorway', 'trunk', 'motorway_link', 'trunk_link'];

export function buildInkStyle(boroughsFC, theme = 'dark') {
  const c = theme === 'light' ? LIGHT : DARK;
  const roadColor = ['interpolate', ['linear'], ['zoom'],
    10, ['match', ['get', 'class'], 'motorway', c.motorway, c.road],
    14, ['match', ['get', 'class'], 'motorway', c.motorwayHi, c.roadHi]];
  const roadWidth = ['interpolate', ['linear'], ['zoom'], 10, 0.6, 14, 1.6];
  const fontStack = ['Noto Sans Regular'];

  return {
    version: 8,
    name: `ink-${theme}`,
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    sources: {
      omt: { type: 'vector', url: 'https://tiles.openfreemap.org/planet', attribution: '© OpenMapTiles © OpenStreetMap contributors' },
      'labels-boroughs': { type: 'geojson', data: boroughLabelFeatures(boroughsFC) },
      'labels-highways': { type: 'geojson', data: highwayFC },
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': c.bg } },
      { id: 'water', type: 'fill', source: 'omt', 'source-layer': 'water', paint: { 'fill-color': c.water, 'fill-antialias': false } },
      {
        id: 'roads-major', type: 'line', source: 'omt', 'source-layer': 'transportation', minzoom: 8,
        filter: ['all', ['in', ['get', 'class'], ['literal', MAJOR]], ['!=', ['coalesce', ['get', 'ramp'], 0], 1]],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': roadColor, 'line-width': roadWidth },
      },
      {
        id: 'roads-links', type: 'line', source: 'omt', 'source-layer': 'transportation', minzoom: 12,
        filter: ['all', ['in', ['get', 'class'], ['literal', LINKS]], ['==', ['coalesce', ['get', 'ramp'], 0], 1]],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': roadColor, 'line-width': ['interpolate', ['linear'], ['zoom'], 12, 0.5, 14, 1.0] },
      },
      {
        id: 'boundary-county', type: 'line', source: 'omt', 'source-layer': 'boundary',
        filter: ['all', ['==', ['get', 'admin_level'], 6], ['!=', ['coalesce', ['get', 'maritime'], 0], 1]],
        paint: { 'line-color': c.boundary, 'line-width': 0.8, 'line-dasharray': [3, 3] },
      },
      // Empty anchors so data layers can be slotted in a stable order via beforeId.
      { id: 'anchor-polygons', type: 'background', paint: { 'background-opacity': 0 } },
      { id: 'anchor-lines', type: 'background', paint: { 'background-opacity': 0 } },
      { id: 'anchor-points', type: 'background', paint: { 'background-opacity': 0 } },
      {
        id: 'labels-highways', type: 'symbol', source: 'labels-highways', minzoom: 10.3,
        layout: { 'text-field': ['get', 'name'], 'text-font': fontStack, 'text-size': ['interpolate', ['linear'], ['zoom'], 10.3, 9, 13, 11], 'text-letter-spacing': 0.08, 'text-rotate': ['get', 'rotate'], 'text-allow-overlap': false, 'text-padding': 4 },
        paint: { 'text-color': c.label, 'text-halo-color': c.halo, 'text-halo-width': 1 },
      },
      {
        id: 'labels-boroughs', type: 'symbol', source: 'labels-boroughs', maxzoom: 13,
        layout: { 'text-field': ['upcase', ['get', 'name']], 'text-font': fontStack, 'text-size': ['interpolate', ['linear'], ['zoom'], 9, 10, 12, 13], 'text-letter-spacing': 0.32, 'text-rotate': ['get', 'rotate'], 'text-allow-overlap': true, 'text-ignore-placement': true },
        paint: { 'text-color': c.label, 'text-halo-color': c.halo, 'text-halo-width': 1.2, 'text-opacity': ['interpolate', ['linear'], ['zoom'], 11.5, 1, 13, 0] },
      },
    ],
  };
}

export const ATTRIBUTION = '© OpenMapTiles © OpenStreetMap contributors';
