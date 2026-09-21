import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AttributionControl, Map as MapGL } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { ATTRIBUTION, buildInkStyle } from '../../map/inkStyle.js';
import { CHAPTERS, EXPLORE_CAMERA, INTRO_CAMERA } from '../../content/chapters.js';
import { useData } from '../../lib/data.jsx';
import { useAppState, useDispatch } from '../../state/AppState.jsx';
import { usePhone, useReducedMotion } from '../../hooks/useMediaQuery.js';
import { fmtInt, fmtNum, fmtPercentile } from '../../lib/format.js';
import { tourPadding } from '../GuidePlayer.jsx';
import ZoneLayer from './ZoneLayer.jsx';
import PolygonLayers, { POLYGON_LAYER_IDS } from './PolygonLayers.jsx';
import PointLayers, { ensureSquareImage, POINT_LAYER_IDS, SQUARE_IMAGE } from './PointLayers.jsx';
import FlowLayer, { FLOW_LAYER_IDS } from './FlowLayer.jsx';
import GlyphLayer from './GlyphLayer.jsx';
import GuideCallouts from './GuideCallouts.jsx';

const YEAR = { pre_2024: ['2024', 'before the toll'], post_2025: ['2025', 'year one'], post_2026_ytd: ['2026', 'so far'] };
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const GLYPH_ZOOM = 11;
const NYC_BOUNDS = [[-74.7, 40.25], [-73.2, 41.15]];

/** Pixel value of a CSS custom property on :root (e.g. --story-w), with a fallback. */
function cssPx(name, fallback) {
  try {
    const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name));
    return Number.isFinite(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

function tipFor(f) {
  const p = f?.properties ?? {};
  if (p._layer) {
    return { title: p.name, lines: [`${p._baseLabel}: ${p._baseText}`, `${p._curLabel}: ${p._valueText}`, `change: ${p._changeText}`] };
  }
  if (p._of) {
    return { title: p.name, lines: [p._text, 'click for the full timeline'] };
  }
  if (f.layer?.id === POLYGON_LAYER_IDS.dac) {
    // The DAC fields are NY State percentile RANKS (0–1), never shares: 0.99 = the 99th percentile statewide.
    return {
      title: `Census tract ${p.geoid ?? ''}`,
      lines: [
        p.dac ? 'Disadvantaged Community (NY State, 2023)' : 'Not a designated Disadvantaged Community',
        `Combined burden score: ${fmtPercentile(p.combined_pct)} percentile in NY State`,
        `Asthma ER visits: ${fmtPercentile(p.asthma_pct)} · traffic volume: ${fmtPercentile(p.traffic_pct)} (statewide percentile ranks, not rates)`,
      ],
    };
  }
  if (f.layer?.id === POLYGON_LAYER_IDS.uhf42) {
    return {
      title: p.name,
      lines: [
        `Child asthma ER visits: ${fmtInt(p.asthma_ed_children)} per 10,000 ages 5–17 · adults ${fmtInt(p.asthma_ed_adults)} per 10,000 (${p.health_period ?? '2023'}, newest published)`,
        `Below the poverty line: ${fmtNum(p.poverty_pct, 1)}% (ACS 2019–23) · PM2.5 in 2024: ${fmtNum(p.pm25_2024)} µg/m³`,
        'pre-existing context, not an effect of the toll · click for detail',
      ],
    };
  }
  return null;
}

export default function MapView({ featured, guide }) {
  const mapRef = useRef(null);
  const flownRef = useRef(null);
  const { geo } = useData();
  const { activeChapter, exploreMode, theme, layerVisibility, selectedFeature, intro, autoplay, period, controlsCollapsed } = useAppState();
  const dispatch = useDispatch();
  const isPhone = usePhone();
  const reduced = useReducedMotion();
  const [loaded, setLoaded] = useState(false);
  const [zoom, setZoom] = useState(10);
  const [viewVersion, setViewVersion] = useState(0);
  const [tip, setTip] = useState(null);
  const touring = autoplay.on;

  const style = useMemo(() => buildInkStyle(geo.boroughs, theme), [geo.boroughs, theme]);

  const interactiveLayerIds = useMemo(() => {
    const ids = [];
    if (layerVisibility.dac) ids.push(POLYGON_LAYER_IDS.dac);
    if (layerVisibility.uhf42) ids.push(POLYGON_LAYER_IDS.uhf42);
    for (const [layer, id] of Object.entries(POINT_LAYER_IDS)) if (layerVisibility[layer]) ids.push(id);
    if (layerVisibility.flow) ids.push(FLOW_LAYER_IDS.hit);
    return ids;
  }, [layerVisibility]);

  // Camera per step / explore. Padding keeps the framed area clear of the panels and the timeline bar
  // (during the tour the panels are hidden, so the frame widens). While the intro title is up the map waits
  // at a wide view; when the intro leaves it flies in to step 1.
  useEffect(() => {
    const map = mapRef.current?.getMap?.();
    if (!map || !loaded) return;
    const inset = cssPx('--inset', 16);
    const padding = touring
      ? tourPadding()
      : isPhone
        ? { top: 64, bottom: Math.round(window.innerHeight * 0.55) + 16, left: 12, right: 12 }
        : { top: 40, bottom: cssPx('--timeline-h', 64) + inset + 28, left: cssPx('--story-w', 360) + inset + 24, right: (controlsCollapsed && !selectedFeature ? 0 : cssPx('--side-w', 264)) + inset + 24 };
    if (intro === 'show') {
      map.jumpTo({ center: INTRO_CAMERA.center, zoom: INTRO_CAMERA.zoom, padding });
      flownRef.current = null;
      return;
    }
    const key = `${exploreMode ? 'explore' : activeChapter}|${isPhone}|${touring}`;
    if (flownRef.current === key) return; // intro 'leaving' -> 'done' must not restart the flight
    flownRef.current = key;
    const cam = exploreMode ? EXPLORE_CAMERA : CHAPTERS[activeChapter]?.camera;
    if (!cam) return;
    // Step zooms are tuned for ~880 px of map height; shorter desktop windows zoom out proportionally.
    const avail = window.innerHeight - padding.top - padding.bottom;
    const zoom = isPhone ? cam.zoom : cam.zoom + Math.min(0, Math.log2(Math.max(200, avail) / 880));
    const opts = { center: cam.center, zoom, padding, essential: true };
    const fromIntro = intro === 'leaving';
    if (reduced) map.jumpTo(opts);
    else map.flyTo({ ...opts, duration: fromIntro ? 3200 : touring ? 2600 : 1400, easing: easeInOutCubic, curve: fromIntro || touring ? 0.9 : 1.1 });
  }, [activeChapter, exploreMode, loaded, isPhone, reduced, intro, touring, controlsCollapsed, selectedFeature]);

  useEffect(() => {
    dispatch({ type: 'SET_GLYPH_MODE', on: loaded && zoom >= GLYPH_ZOOM && !touring });
  }, [zoom, loaded, dispatch, touring]);

  const onLoad = useCallback((e) => {
    const map = e.target;
    ensureSquareImage(map);
    map.on('styleimagemissing', (ev) => { if (ev.id === SQUARE_IMAGE) ensureSquareImage(map); });
    setZoom(map.getZoom());
    setLoaded(true);
  }, []);

  const onMouseMove = useCallback((e) => {
    const feats = e.features ?? [];
    const f = feats.find((x) => x.properties?._layer) ?? feats.find((x) => x.properties?._of) ?? feats[0];
    const t = f ? tipFor(f) : null;
    setTip(t ? { ...t, x: e.point.x, y: e.point.y } : null);
  }, []);

  const onClick = useCallback((e) => {
    const feats = e.features ?? [];
    const f = feats.find((x) => x.properties?._layer) ?? feats.find((x) => x.properties?._of);
    const hood = feats.find((x) => x.layer?.id === POLYGON_LAYER_IDS.uhf42);
    if (f) dispatch({ type: 'SELECT_FEATURE', feature: { layer: f.properties._layer ?? f.properties._of, id: f.properties.id } });
    else if (hood?.properties?.uhf_code != null) dispatch({ type: 'SELECT_FEATURE', feature: { layer: 'uhf42', id: String(hood.properties.uhf_code) } });
    else if (selectedFeature) dispatch({ type: 'SELECT_FEATURE', feature: null });
  }, [dispatch, selectedFeature]);

  const startCam = intro === 'done' ? CHAPTERS[activeChapter]?.camera ?? EXPLORE_CAMERA : INTRO_CAMERA;

  return (
    <div className="map-stage">
      <MapGL
        id="main"
        ref={mapRef}
        initialViewState={{ longitude: startCam.center[0], latitude: startCam.center[1], zoom: startCam.zoom }}
        mapStyle={style}
        style={{ width: '100%', height: '100%' }}
        minZoom={8.5}
        maxZoom={15.5}
        maxBounds={NYC_BOUNDS}
        maxPitch={0}
        dragRotate={false}
        touchPitch={false}
        pitchWithRotate={false}
        attributionControl={false}
        interactiveLayerIds={interactiveLayerIds}
        cursor={tip ? 'pointer' : 'grab'}
        onLoad={onLoad}
        onStyleImageMissing={(e) => { if (e.id === SQUARE_IMAGE) ensureSquareImage(e.target); }}
        onMove={(e) => setZoom(Math.round(e.viewState.zoom * 10) / 10)}
        onMoveEnd={() => setViewVersion((v) => v + 1)}
        onMouseMove={onMouseMove}
        onMouseLeave={() => setTip(null)}
        onClick={onClick}
      >
        <AttributionControl customAttribution={ATTRIBUTION} position="bottom-right" compact={false} />
        <PolygonLayers />
        <ZoneLayer />
        <PointLayers featured={featured} imageReady={loaded} glyphs={!touring} />
        <FlowLayer featured={featured} />
        {loaded && zoom >= GLYPH_ZOOM && !touring ? <GlyphLayer featured={featured} viewVersion={viewVersion} /> : null}
        <GuideCallouts guide={guide} />
      </MapGL>
      {intro === 'done' && YEAR[period] ? (
        <div key={period} className="yearstamp" aria-live="polite">
          <span className="yearstamp__year num">{YEAR[period][0]}</span>
          <span className="yearstamp__sub">{YEAR[period][1]}</span>
        </div>
      ) : null}
      {tip && !touring ? (
        <div className="map-tip panel" style={{ left: tip.x, top: tip.y }} role="tooltip">
          <b>{tip.title ?? '—'}</b>
          {tip.lines.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      ) : null}
    </div>
  );
}
