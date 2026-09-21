import { useMemo } from 'react';
import { Layer, Source } from 'react-map-gl/maplibre';
import { useData } from '../../lib/data.jsx';
import { useAppState } from '../../state/AppState.jsx';
import { featureMetrics, POINT_LAYERS } from '../../lib/metrics.js';
import { changeColor, CLASS_LABELS, COLORS, sqrtSize, themeColors } from '../../lib/scales.js';
import { fmtCompact, fmtNum, fmtPct, isNum, shortName } from '../../lib/format.js';

export const SQUARE_IMAGE = 'dot-square';
export const POINT_LAYER_IDS = { aq_monitor: 'pt-aq_monitor', crz_entry: 'pt-crz_entry', bt_facility: 'pt-bt_facility', dot_segment: 'pt-dot_segment' };
export const LABEL_ZOOM = 10.4;
const GLYPH_SWITCH_ZOOM = 11;
const TRANSPARENT = 'rgba(0,0,0,0)';
const FONT = ['Noto Sans Regular'];
const EMPTY = { type: 'FeatureCollection', features: [] };
export const DIM = 0.35;
const AQ_R = 5;

/** Signed-distance-field 5 px square, recolored per feature by the symbol layer. */
export function squareSDF(size = 20, half = 2.5, corner = 0.8) {
  const data = new Uint8ClampedArray(size * size * 4);
  const c = (size - 1) / 2;
  const radius = 8;
  const cutoff = 0.25;
  const inner = half - corner;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = Math.abs(x - c) - inner;
      const dy = Math.abs(y - c) - inner;
      const d = (dx > 0 && dy > 0 ? Math.hypot(dx, dy) : Math.max(dx, dy)) - corner;
      const a = Math.max(0, Math.min(1, 1 - (d / radius + cutoff)));
      const i = (y * size + x) * 4;
      data[i + 3] = Math.round(a * 255);
    }
  }
  return { width: size, height: size, data };
}

export function ensureSquareImage(map) {
  if (map && !map.hasImage(SQUARE_IMAGE)) map.addImage(SQUARE_IMAGE, squareSDF(), { sdf: true });
}

/** Text under a point: short name + change (traffic) or class (monitors); value when the metric is absolute. */
export function pointLabel(layer, name, m, metric) {
  const short = shortName(name);
  if (metric === 'absolute') return `${short} ${layer === 'aq_monitor' ? (isNum(m.value) ? fmtNum(m.value, 1) : '—') : fmtCompact(m.value)}`;
  if (layer === 'aq_monitor') return `${short} ${CLASS_LABELS[m.classification] ?? 'no data'}`;
  if (!isNum(m.change) && isNum(m.value)) return `${short} ${fmtCompact(m.value)}`;
  return `${short} ${fmtPct(m.change)}`;
}

function derive(fc, layer, { period, hour, metric, featuredSet, maxima }) {
  const max = isNum(hour) ? maxima?.hourly : maxima?.value;
  const size = sqrtSize(max, [4, 9]);
  const features = [];
  for (const f of fc?.features ?? []) {
    const p = f.properties ?? {};
    const m = featureMetrics(p, layer, period, hour, metric);
    const featured = Boolean(featuredSet && featuredSet.has(p.id));
    const dim = featuredSet ? (featured ? 0 : 1) : 0;
    const matched = layer === 'dot_segment' && p.role === 'matched';
    const hollow = layer === 'aq_monitor' && metric === 'change' && (m.classification ?? 'insufficient') === 'insufficient';
    const r = layer === 'aq_monitor' ? AQ_R : Math.max(4, size(isNum(m.value) ? m.value : isNum(m.baseline) ? m.baseline : 0));
    const color = matched ? (metric === 'absolute' ? m.color : changeColor(p.pct_change)) : m.color;
    features.push({
      type: 'Feature',
      geometry: f.geometry,
      properties: {
        id: p.id,
        name: p.name ?? p.id,
        _layer: layer,
        _color: color,
        _fill: matched ? color : TRANSPARENT,
        _r: r,
        _dim: dim,
        _featured: featured ? 1 : 0,
        _hollow: hollow ? 1 : 0,
        _label: pointLabel(layer, p.name ?? p.id, m, metric),
        _valueText: layer === 'aq_monitor' ? (isNum(m.value) ? `${fmtNum(m.value, 2)} µg/m³` : '—') : fmtCompact(m.value),
        _baseText: layer === 'aq_monitor' ? (isNum(m.baseline) ? `${fmtNum(m.baseline, 2)} µg/m³` : '—') : fmtCompact(m.baseline),
        _changeText: layer === 'aq_monitor' && metric === 'change' ? `${fmtPct(m.change)} · ${CLASS_LABELS[m.classification] ?? 'no data'}` : fmtPct(m.change),
        _baseLabel: m.baselineLabel,
        _curLabel: m.currentLabel,
        _class: m.classification ?? '',
        _matched: matched ? 1 : 0,
      },
    });
  }
  return { type: 'FeatureCollection', features };
}

const dimCase = (on, off) => ['case', ['==', ['get', '_dim'], 1], on, off];
const radiusExpr = (extra = 0) => ['interpolate', ['linear'], ['zoom'], 9, ['*', ['+', ['get', '_r'], extra], 0.8], 11, ['+', ['get', '_r'], extra]];
const FEATURED = ['==', ['get', '_featured'], 1];
const fade = { duration: 600 };

/**
 * Point layers below the glyph zoom. One plain style: filled discs in the class color with a 1 px dark
 * separation stroke (monitors r = 5, bridges r = 4–9 by volume), zone entries as 2 px rings, DOT counts as
 * 5 px squares (matched only unless `dotAll`). Featured = full opacity, the rest 35 %.
 * Text labels for bridges and monitors from zoom 10.4 to 11.
 */
export default function PointLayers({ featured, imageReady = true, glyphs = true }) {
  const maxzoom = glyphs ? GLYPH_SWITCH_ZOOM : 24;
  const { geo, indexes } = useData();
  const { period, metric, hour, layerVisibility, dotAll, theme } = useAppState();
  const { outline, label, halo } = themeColors(theme);

  const data = useMemo(() => {
    const out = {};
    for (const layer of POINT_LAYERS) {
      out[layer] = derive(geo[layer], layer, { period, hour, metric, featuredSet: featured?.[layer] ?? null, maxima: indexes?.maxima?.[layer] });
    }
    return out;
  }, [geo, indexes, period, hour, metric, featured]);

  const labelLayout = (on) => ({
    'text-field': ['get', '_label'],
    'text-font': FONT,
    'text-size': 11,
    'text-variable-anchor': ['top', 'bottom'],
    'text-radial-offset': ['/', ['+', ['get', '_r'], 5], 11],
    'text-justify': 'center',
    'text-max-width': 18,
    'text-padding': 2,
    'text-allow-overlap': false,
    'symbol-sort-key': ['case', FEATURED, 0, 1],
    visibility: on ? 'visible' : 'none',
  });
  const labelPaint = {
    'text-color': label,
    'text-halo-color': halo,
    'text-halo-width': 1,
    'text-opacity': dimCase(DIM, 1),
  };

  const aqOn = Boolean(layerVisibility.aq_monitor);
  const btOn = Boolean(layerVisibility.bt_facility);
  const crzOn = Boolean(layerVisibility.crz_entry);
  const dotOn = Boolean(layerVisibility.dot_segment);

  const disc = (on) => ({
    'circle-radius': radiusExpr(0),
    'circle-color': ['case', ['==', ['get', '_hollow'], 1], TRANSPARENT, ['get', '_color']],
    'circle-opacity': on ? dimCase(DIM, 1) : 0,
    'circle-stroke-color': ['case', ['==', ['get', '_hollow'], 1], COLORS.insufficient, outline],
    'circle-stroke-width': ['case', ['==', ['get', '_hollow'], 1], 1.5, 1],
    'circle-stroke-opacity': on ? dimCase(DIM, 1) : 0,
    'circle-opacity-transition': fade,
    'circle-stroke-opacity-transition': fade,
  });

  return (
    <>
      {/* Zone entry points: 2 px ring in the change color, transparent center */}
      <Source id="pts-crz_entry" type="geojson" data={data.crz_entry}>
        <Layer
          id={POINT_LAYER_IDS.crz_entry}
          type="circle"
          maxzoom={maxzoom}
          beforeId="labels-highways"
          paint={{
            'circle-radius': radiusExpr(1),
            'circle-color': TRANSPARENT,
            'circle-stroke-color': ['get', '_color'],
            'circle-stroke-width': 2,
            'circle-stroke-opacity': crzOn ? dimCase(DIM, 1) : 0,
            'circle-stroke-opacity-transition': fade,
          }}
        />
      </Source>

      {/* Bridges & tunnels: filled disc, r 4–9 by volume */}
      <Source id="pts-bt_facility" type="geojson" data={data.bt_facility}>
        <Layer id={POINT_LAYER_IDS.bt_facility} type="circle" maxzoom={maxzoom} beforeId="labels-highways" paint={disc(btOn)} />
        <Layer id="lbl-bt_facility" type="symbol" minzoom={LABEL_ZOOM} maxzoom={maxzoom} layout={labelLayout(btOn)} paint={labelPaint} />
      </Source>

      {/* PM2.5 monitors: filled disc r 5 in the class color; "no data" = hollow grey ring */}
      <Source id="pts-aq_monitor" type="geojson" data={data.aq_monitor}>
        <Layer id={POINT_LAYER_IDS.aq_monitor} type="circle" maxzoom={maxzoom} beforeId="labels-highways" paint={disc(aqOn)} />
        <Layer id="lbl-aq_monitor" type="symbol" minzoom={LABEL_ZOOM} maxzoom={maxzoom} layout={labelLayout(aqOn)} paint={labelPaint} />
      </Source>

      {/* DOT count locations: 5 px squares. Matched sites are filled by change; single-count sites are outlines, hidden unless dotAll. */}
      <Source id="pts-dot_segment" type="geojson" data={imageReady ? data.dot_segment : EMPTY}>
        <Layer
          id={POINT_LAYER_IDS.dot_segment}
          type="symbol"
          beforeId="labels-highways"
          filter={['>=', ['get', '_matched'], dotAll ? 0 : 1]}
          layout={{
            'icon-image': SQUARE_IMAGE,
            'icon-size': 1,
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
            'symbol-sort-key': ['case', FEATURED, 0, ['==', ['get', '_matched'], 1], 1, 2],
          }}
          paint={{
            'icon-color': ['get', '_fill'],
            'icon-halo-color': ['case', ['==', ['get', '_matched'], 1], outline, COLORS.insufficient],
            'icon-halo-width': 1,
            'icon-opacity': dotOn ? dimCase(DIM, 1) : 0,
            'icon-opacity-transition': fade,
          }}
        />
      </Source>
    </>
  );
}
