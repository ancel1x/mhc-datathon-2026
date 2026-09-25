import { memo, useMemo } from 'react';
import { Layer, Source } from 'react-map-gl/maplibre';
import { useData } from '../../lib/data.jsx';
import { useAppState } from '../../state/AppState.jsx';
import { featureMetrics, POINT_LAYERS } from '../../lib/metrics.js';
import { COLORS, resultLabel, sqrtSize, themeColors } from '../../lib/scales.js';
import { fmtCompact, fmtNum, fmtPct, fmtTrafficK, isNum, shortName } from '../../lib/format.js';

export const DIAMOND_IMAGE = 'dot-diamond';
const DIAMOND_HALF = 6;
export const POINT_LAYER_IDS = { aq_monitor: 'pt-aq_monitor', crz_entry: 'pt-crz_entry', bt_facility: 'pt-bt_facility' };
export const LABEL_ZOOM = 10.4;
const GLYPH_SWITCH_ZOOM = 11;
const TRANSPARENT = 'rgba(0,0,0,0)';
const FONT = ['Noto Sans Regular'];
const EMPTY = { type: 'FeatureCollection', features: [] };
export const DIM = 0.35;
const AQ_R = 5;
const fmtTraffic = (layer, v) => (layer === 'bt_facility' || layer === 'crz_entry' ? fmtTrafficK(v) : fmtCompact(v));

/** SDF diamond used for zone entries so they remain distinct from circular crossings and monitors. */
export function diamondSDF(size = 20, half = DIAMOND_HALF, corner = 0.6) {
  const data = new Uint8ClampedArray(size * size * 4);
  const c = (size - 1) / 2;
  const radius = 8;
  const cutoff = 0.25;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const d = Math.abs(x - c) + Math.abs(y - c) - half - corner;
      const a = Math.max(0, Math.min(1, 1 - (d / radius + cutoff)));
      data[(y * size + x) * 4 + 3] = Math.round(a * 255);
    }
  }
  return { width: size, height: size, data };
}

export function ensureDiamondImage(map) {
  if (map && !map.hasImage(DIAMOND_IMAGE)) map.addImage(DIAMOND_IMAGE, diamondSDF(), { sdf: true });
}

/**
 * A crossing whose change is not statistically supported (95% interval includes zero) or is coverage-limited,
 * and a monitor with no eligible baseline, are drawn as rings instead of filled discs.
 */
export function isHollow(layer, m, metric, period) {
  if (metric !== 'change' || period === 'pre_2024') return false;
  if (layer === 'aq_monitor') return (m.classification ?? 'no_baseline') === 'no_baseline';
  if (layer === 'bt_facility') return m.support === 'uncertain' || m.support === 'limited' || m.support == null;
  return false;
}

/** Text under a point: short name + change (traffic) or class (monitors); value when the metric is absolute. */
export function pointLabel(layer, name, m, metric) {
  const short = shortName(name);
  if (metric === 'absolute') return `${short} ${layer === 'aq_monitor' ? (isNum(m.value) ? fmtNum(m.value, 1) : 'No data available for this period') : fmtTraffic(layer, m.value)}`;
  if (layer === 'aq_monitor') return `${short} ${resultLabel(layer, m.classification ?? 'no_baseline')}`;
  if (!isNum(m.change) && isNum(m.value)) return `${short} ${fmtTraffic(layer, m.value)}`;
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
    const hollow = isHollow(layer, m, metric, period);
    const r = layer === 'aq_monitor' ? AQ_R : Math.max(4, size(isNum(m.value) ? m.value : isNum(m.baseline) ? m.baseline : 0));
    const color = m.color;
    const supportText = layer === 'bt_facility' && m.support ? ` · ${resultLabel(layer, m.support)}` : '';
    features.push({
      type: 'Feature',
      geometry: f.geometry,
      properties: {
        id: p.id,
        name: p.name ?? p.id,
        _layer: layer,
        _color: color,
        _r: r,
        _dim: dim,
        _featured: featured ? 1 : 0,
        _hollow: hollow ? 1 : 0,
        _label: pointLabel(layer, p.name ?? p.id, m, metric),
        _valueText: layer === 'aq_monitor' ? (isNum(m.value) ? `${fmtNum(m.value, 2)} µg/m³` : 'No data available for this period') : fmtTraffic(layer, m.value),
        _baseText: layer === 'aq_monitor' ? (isNum(m.baseline) ? `${fmtNum(m.baseline, 2)} µg/m³` : 'No data available for this period') : fmtTraffic(layer, m.baseline),
        _changeText: layer === 'aq_monitor' && metric === 'change' ? `${isNum(m.change) ? fmtPct(m.change) : 'No data available for this period'} · ${resultLabel(layer, m.classification ?? 'no_baseline')}` : `${fmtPct(m.change)}${metric === 'change' ? supportText : ''}`,
        _baseLabel: m.baselineLabel,
        _curLabel: m.currentLabel,
        _class: m.classification ?? m.support ?? '',
      },
    });
  }
  return { type: 'FeatureCollection', features };
}

const dimCase = (on, off) => ['case', ['==', ['get', '_dim'], 1], on, off];
const radiusExpr = (extra = 0) => ['interpolate', ['linear'], ['zoom'], 9, ['*', ['+', ['get', '_r'], extra], 0.8], 11, ['+', ['get', '_r'], extra]];
const FEATURED = ['==', ['get', '_featured'], 1];
const HOLLOW = ['==', ['get', '_hollow'], 1];
const fade = { duration: 600 };
const diamondSizeExpr = (extra = 0) => [
  'interpolate', ['linear'], ['zoom'],
  9, ['/', ['*', ['+', ['get', '_r'], extra], 0.8], DIAMOND_HALF],
  11, ['/', ['+', ['get', '_r'], extra], DIAMOND_HALF],
];

/**
 * Point layers below the glyph zoom. One plain style: filled discs in the result color with a 1 px dark
 * separation stroke (monitors r = 5, bridges r = 4–9 by volume) and zone entries as 2 px diamond outlines.
 * Uncertain crossings and monitors without a baseline are rings.
 * Featured = full opacity, the rest 35 %. Text labels for bridges and monitors from zoom 10.4 to 11.
 */
function PointLayers({ featured, imageReady = true, glyphs = true }) {
  const maxzoom = glyphs ? GLYPH_SWITCH_ZOOM : 24;
  const { geo, indexes } = useData();
  const { period, metric, hour, layerVisibility, theme } = useAppState();
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

  const disc = (on) => ({
    'circle-radius': radiusExpr(0),
    'circle-color': ['case', HOLLOW, TRANSPARENT, ['get', '_color']],
    'circle-opacity': on ? dimCase(DIM, 1) : 0,
    'circle-stroke-color': ['case', HOLLOW, ['get', '_color'], outline],
    'circle-stroke-width': ['case', HOLLOW, 1.75, 1],
    'circle-stroke-opacity': on ? dimCase(DIM, 1) : 0,
    'circle-opacity-transition': fade,
    'circle-stroke-opacity-transition': fade,
  });

  return (
    <>
      {/* Zone entry points: volume-sized hollow diamonds, distinct from circular crossings and monitors. */}
      <Source id="pts-crz_entry" type="geojson" data={imageReady ? data.crz_entry : EMPTY}>
        <Layer
          id={POINT_LAYER_IDS.crz_entry}
          type="symbol"
          maxzoom={maxzoom}
          beforeId="labels-highways"
          layout={{
            'icon-image': DIAMOND_IMAGE,
            'icon-size': diamondSizeExpr(1),
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
          }}
          paint={{
            'icon-color': TRANSPARENT,
            'icon-halo-color': ['get', '_color'],
            'icon-halo-width': 2,
            'icon-opacity': crzOn ? dimCase(DIM, 1) : 0,
            'icon-opacity-transition': fade,
          }}
        />
      </Source>

      {/* Bridges & tunnels: filled disc, r 4–9 by volume; ring = change not supported / coverage-limited */}
      <Source id="pts-bt_facility" type="geojson" data={data.bt_facility}>
        <Layer id={POINT_LAYER_IDS.bt_facility} type="circle" maxzoom={maxzoom} beforeId="labels-highways" paint={disc(btOn)} />
        <Layer id="lbl-bt_facility" type="symbol" minzoom={LABEL_ZOOM} maxzoom={maxzoom} layout={labelLayout(btOn)} paint={labelPaint} />
      </Source>

      {/* PM2.5 monitors: filled disc r 5 in the result color; "no eligible baseline" = hollow grey ring */}
      <Source id="pts-aq_monitor" type="geojson" data={data.aq_monitor}>
        <Layer id={POINT_LAYER_IDS.aq_monitor} type="circle" maxzoom={maxzoom} beforeId="labels-highways" paint={disc(aqOn)} />
        <Layer id="lbl-aq_monitor" type="symbol" minzoom={LABEL_ZOOM} maxzoom={maxzoom} layout={labelLayout(aqOn)} paint={labelPaint} />
      </Source>

    </>
  );
}

export default memo(PointLayers);
