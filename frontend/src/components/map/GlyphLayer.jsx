import { memo, useMemo, useState } from 'react';
import { Marker, useMap } from 'react-map-gl/maplibre';
import ClockGlyph from './ClockGlyph.jsx';
import { isHollow } from './PointLayers.jsx';
import { useData } from '../../lib/data.jsx';
import { useAppState, useDispatch } from '../../state/AppState.jsx';
import { featureMetrics, GLYPH_LAYERS, LAYER_META } from '../../lib/metrics.js';
import { CLASS_LABELS } from '../../lib/scales.js';
import { fmtCompact, fmtNum, fmtPct, isNum, shortName } from '../../lib/format.js';

const SIZES = { crz_entry: 64, bt_facility: 70, aq_monitor: 58 };
const SHAPES = { crz_entry: 'entry', bt_facility: 'bridge', aq_monitor: 'monitor' };

const fmtVal = (layer, v) => (layer === 'aq_monitor' ? (isNum(v) ? `${fmtNum(v, 2)} µg/m³` : '—') : fmtCompact(v));

/** Caption text under the ring: change for traffic, class for monitors, value when the metric is absolute. */
function captionFor(layer, m, metric) {
  if (metric === 'absolute') return layer === 'aq_monitor' ? (isNum(m.value) ? `${fmtNum(m.value, 1)} µg/m³` : '—') : fmtCompact(m.value);
  if (layer === 'aq_monitor') return CLASS_LABELS[m.classification] ?? 'no eligible baseline';
  if (!isNum(m.change) && isNum(m.value)) return fmtCompact(m.value);
  return fmtPct(m.change);
}

/** Marker-based clock glyphs, rendered at zoom >= 11 for the visible glyph layers. */
function GlyphLayer({ featured, viewVersion }) {
  const { current: mapRef } = useMap();
  const { geo, indexes } = useData();
  const { period, metric, hour, layerVisibility, selectedFeature } = useAppState();
  const dispatch = useDispatch();
  const [hovered, setHovered] = useState(null);

  const items = useMemo(() => {
    const map = mapRef?.getMap?.();
    const b = map?.getBounds?.() ?? null;
    const pad = 0.03;
    const inView = (lon, lat) => !b || (lon >= b.getWest() - pad && lon <= b.getEast() + pad && lat >= b.getSouth() - pad && lat <= b.getNorth() + pad);
    const out = [];
    for (const layer of GLYPH_LAYERS) {
      if (!layerVisibility[layer]) continue;
      const max = indexes?.maxima?.[layer]?.hourly ?? 1;
      const fset = featured?.[layer] ?? null;
      for (const f of geo[layer]?.features ?? []) {
        const [lon, lat] = f.geometry?.coordinates ?? [];
        if (!isNum(lon) || !isNum(lat) || !inView(lon, lat)) continue;
        const p = f.properties ?? {};
        const m = featureMetrics(p, layer, period, hour, metric);
        const hollow = isHollow(layer, m, metric, period);
        out.push({ key: `${layer}:${p.id}`, layer, id: p.id, lon, lat, name: p.name ?? p.id, m, max, hollow, featured: Boolean(fset && fset.has(p.id)), dimmed: Boolean(fset && !fset.has(p.id)) });
      }
    }
    return out;
  }, [mapRef, geo, indexes, period, metric, hour, layerVisibility, featured, viewVersion]);

  const select = (it) => dispatch({ type: 'SELECT_FEATURE', feature: { layer: it.layer, id: it.id } });

  return items.map((it) => {
    const isSelected = selectedFeature?.layer === it.layer && selectedFeature?.id === it.id;
    const isHovered = hovered === it.key;
    const caption = captionFor(it.layer, it.m, metric);
    const support = it.layer === 'bt_facility' && metric === 'change' && it.m.support ? CLASS_LABELS[it.m.support] ?? it.m.support : null;
    return (
      <Marker
        key={it.key}
        longitude={it.lon}
        latitude={it.lat}
        anchor="center"
        style={{ zIndex: isHovered || isSelected ? 6 : it.dimmed ? 1 : 3 }}
        onClick={(e) => { e.originalEvent?.stopPropagation?.(); select(it); }}
      >
        <div
          className="glyph"
          data-dimmed={it.dimmed ? 'true' : 'false'}
          data-selected={isSelected ? 'true' : 'false'}
          tabIndex={0}
          role="button"
          aria-label={`${it.name}: ${LAYER_META[it.layer].label}. ${it.m.baselineLabel} ${fmtVal(it.layer, it.m.baseline)}, ${it.m.currentLabel} ${fmtVal(it.layer, it.m.value)}, change ${fmtPct(it.m.change)}${support ? `, ${support}` : ''}.`}
          onMouseEnter={() => setHovered(it.key)}
          onMouseLeave={() => setHovered(null)}
          onFocus={() => setHovered(it.key)}
          onBlur={() => setHovered(null)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(it); } }}
        >
          <ClockGlyph baseline={it.m.baselineHourly} current={it.m.currentHourly} max={it.max} color={it.m.color} size={SIZES[it.layer] ?? 64} hour={hour} dimmed={it.dimmed} selected={isSelected} title={it.name} shape={SHAPES[it.layer]} hollow={it.hollow} />
          <div className="glyph__cap" aria-hidden="true">
            <span className="glyph__cap-name">{shortName(it.name)}</span>
            <span className="glyph__cap-val num" style={{ color: it.m.color }}>{caption}</span>
          </div>
          {isHovered ? (
            <div className="glyph__tip panel" role="tooltip">
              <b>{it.name}</b>
              <div className="row"><span>{it.m.baselineLabel}</span><span className="num">{fmtVal(it.layer, it.m.baseline)}</span></div>
              <div className="row"><span>{it.m.currentLabel}</span><span className="num">{fmtVal(it.layer, it.m.value)}</span></div>
              <div className="row"><span>change</span><span className="num" style={{ color: it.m.color }}>{fmtPct(it.m.change)}{support ? ` · ${support}` : ''}</span></div>
            </div>
          ) : null}
        </div>
      </Marker>
    );
  });
}

export default memo(GlyphLayer);
