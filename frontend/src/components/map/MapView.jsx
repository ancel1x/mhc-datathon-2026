import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AttributionControl, Map as MapGL, useMap } from 'react-map-gl/maplibre';
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
import PointLayers, { DIAMOND_IMAGE, ensureDiamondImage, ensureSquareImage, POINT_LAYER_IDS, SQUARE_IMAGE } from './PointLayers.jsx';
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

function tipFor(f, dacMode = 'designated') {
  const p = f?.properties ?? {};
  if (p._layer) {
    if (p._layer === 'dot_segment') {
      if (p._dotRole !== 'matched') return { title: p.name, lines: [`${p._valueText} vehicles/day`, `Counted ${p._observationMonth}`, p._dotRole === 'unpaired' ? 'No matched before/after comparison' : 'Single observation — no before/after comparison'] };
      return { title: p.name, lines: [
        ...(p._baseText && p._baseText !== '—' ? [`${p._baseLabel}: ${p._baseText}`] : []),
        ...(p._valueText && p._valueText !== '—' ? [`${p._curLabel}: ${p._valueText}`] : []),
        ...(p._changeText && p._changeText !== '—' ? [`Change from 2024: ${p._changeText}`] : []),
      ] };
    }
    return { title: p.name, lines: [
      ...(p._baseText && !p._baseText.includes('No data') ? [`${p._baseLabel}: ${p._baseText}`] : []),
      ...(p._valueText && !p._valueText.includes('No data') ? [`${p._curLabel}: ${p._valueText}`] : []),
      ...(p._changeText && !p._changeText.includes('No data') && p._changeText !== '—' ? [`change: ${p._changeText}`] : []),
    ] };
  }
  if (p._of) {
    return { title: p.name, lines: [p._text, 'click for the full timeline'] };
  }
  if (f.layer?.id === POLYGON_LAYER_IDS.dac) {
    // The DAC fields are NY State percentile RANKS (0–1), never shares: 0.99 = the 99th percentile statewide.
    const combinedRank = Number.isFinite(Number(p.combined_pct)) ? Number(p.combined_pct) : null;
    const explicitScore = Number.isFinite(Number(p.combined_score)) ? Number(p.combined_score) : null;
    const score = explicitScore ?? (combinedRank == null ? null : Math.round(combinedRank * 100));
    const designation = p.dac ? 'Disadvantaged Community (NY State, 2023)' : 'Not a designated Disadvantaged Community';
    const burdenLines = score != null
      ? [
          `Combined burden score: ${Math.round(score)} / 100`,
          'Higher score = greater combined burden',
          designation,
          ...(combinedRank == null ? [] : [`Statewide percentile: ${fmtPercentile(combinedRank)} percentile`]),
        ]
      : [
          designation,
          ...(combinedRank == null ? [] : [`Combined burden: ${fmtPercentile(combinedRank)} percentile statewide`]),
        ];
    return {
      title: `Census tract ${p.geoid ?? ''}`,
      lines: [
        ...burdenLines,
        ...(Number.isFinite(Number(p.asthma_pct)) ? [`Asthma ER visits: ${fmtPercentile(Number(p.asthma_pct))} percentile statewide`] : []),
        ...(Number.isFinite(Number(p.traffic_pct)) ? [`Traffic volume: ${fmtPercentile(Number(p.traffic_pct))} percentile statewide`] : []),
      ],
    };
  }
  if (f.layer?.id === POLYGON_LAYER_IDS.uhf42) {
    return {
      title: p.name,
      lines: [
        `Child asthma ER visits: ${fmtInt(p.asthma_ed_children)} per 10,000 children ages 5–17`,
        '2023 — latest available',
        '2023 is the latest available year and predates congestion pricing.',
        'This shows pre-existing health burden, not an effect of the toll.',
        `PM2.5 in 2024: ${fmtNum(p.pm25_2024)} µg/m³ (${fmtNum(p.pm25_2009)} in 2009)`,
      ],
    };
  }
  return null;
}

/** Pointer movement only updates this small overlay, never the map's React layer tree. */
function MapTooltip({ layers, enabled, container }) {
  const { current: mapRef } = useMap();
  const { period, metric, hour, dacMode } = useAppState();
  const element = useRef(null);
  const position = useRef({ x: 0, y: 0 });
  const [tip, setTip] = useState(null);

  useEffect(() => {
    const map = mapRef?.getMap?.();
    if (!map || !enabled) { setTip(null); return undefined; }
    let raf = 0;
    let lastHover = -Infinity;
    let point = null;
    let previous = null;
    const canvas = map.getCanvas();
    const clear = () => {
      cancelAnimationFrame(raf);
      raf = 0;
      previous = null;
      setTip(null);
      canvas.style.cursor = 'grab';
    };
    const update = () => {
      raf = 0;
      lastHover = performance.now();
      if (map.isMoving()) { clear(); return; }
      const visible = layers.filter((id) => map.getLayer(id));
      const feats = visible.length ? map.queryRenderedFeatures(point, { layers: visible }) : [];
      const f = feats.find((x) => x.properties?._layer) ?? feats.find((x) => x.properties?._of) ?? feats[0];
      const key = f ? `${f.layer.id}:${f.properties?.id ?? f.properties?.geoid ?? f.properties?.uhf_code}` : null;
      position.current = { x: point.x, y: point.y };
      if (element.current) {
        element.current.style.left = `${point.x}px`;
        element.current.style.top = `${point.y}px`;
      }
      if (key !== previous) {
        previous = key;
        const next = f ? tipFor(f, dacMode) : null;
        setTip(next);
        canvas.style.cursor = next ? 'pointer' : 'grab';
      }
    };
    const move = (e) => {
      point = e.point;
      // Handle ordinary pointer events immediately. Coalesce only bursts from fast input devices.
      if (performance.now() - lastHover >= 1000 / 60) {
        cancelAnimationFrame(raf);
        update();
      } else if (!raf) raf = requestAnimationFrame(update);
    };
    map.on('mousemove', move);
    map.on('movestart', clear);
    canvas.addEventListener('mouseleave', clear);
    return () => {
      clear();
      map.off('mousemove', move);
      map.off('movestart', clear);
      canvas.removeEventListener('mouseleave', clear);
    };
  }, [mapRef, layers, enabled, period, metric, hour, dacMode]);

  return tip && enabled && container.current ? createPortal(
    <div ref={element} className="map-tip panel" style={{ left: position.current.x, top: position.current.y }} role="tooltip">
      <b>{tip.title ?? '—'}</b>
      {tip.lines.map((line, i) => <div key={i}>{line}</div>)}
    </div>,
    container.current,
  ) : null;
}

function MapView({ featured, guide }) {
  const mapRef = useRef(null);
  const stageRef = useRef(null);
  const flownRef = useRef(null);
  const { geo } = useData();
  const { activeChapter, exploreMode, theme, layerVisibility, selectedFeature, intro, autoplay, period, controlsCollapsed } = useAppState();
  const dispatch = useDispatch();
  const isPhone = usePhone();
  const reduced = useReducedMotion();
  const [loaded, setLoaded] = useState(false);
  const [glyphZoom, setGlyphZoom] = useState(false);
  const [viewVersion, setViewVersion] = useState(0);
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
    dispatch({ type: 'SET_GLYPH_MODE', on: loaded && glyphZoom && !touring });
  }, [glyphZoom, loaded, dispatch, touring]);

  const onLoad = useCallback((e) => {
    const map = e.target;
    ensureSquareImage(map);
    ensureDiamondImage(map);
    map.on('styleimagemissing', (ev) => {
      if (ev.id === SQUARE_IMAGE) ensureSquareImage(map);
      else if (ev.id === DIAMOND_IMAGE) ensureDiamondImage(map);
    });
    setGlyphZoom(map.getZoom() >= GLYPH_ZOOM);
    setLoaded(true);
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
    <div className="map-stage" ref={stageRef}>
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
        cursor="grab"
        onLoad={onLoad}
        onStyleImageMissing={(e) => {
          if (e.id === SQUARE_IMAGE) ensureSquareImage(e.target);
          else if (e.id === DIAMOND_IMAGE) ensureDiamondImage(e.target);
        }}
        onZoom={(e) => setGlyphZoom(e.viewState.zoom >= GLYPH_ZOOM)}
        onMoveEnd={() => setViewVersion((v) => v + 1)}
        onClick={onClick}
      >
        <AttributionControl customAttribution={ATTRIBUTION} position="bottom-right" compact={false} />
        <PolygonLayers />
        <ZoneLayer />
        <PointLayers featured={featured} imageReady={loaded} glyphs={!touring} />
        <FlowLayer featured={featured} />
        {loaded && glyphZoom && !touring ? <GlyphLayer featured={featured} viewVersion={viewVersion} /> : null}
        <GuideCallouts guide={guide} />
        <MapTooltip layers={interactiveLayerIds} enabled={loaded && !touring} container={stageRef} />
      </MapGL>
      {intro === 'done' && YEAR[period] ? (
        <div key={period} className="yearstamp" aria-live="polite">
          <span className="yearstamp__year num">{YEAR[period][0]}</span>
          <span className="yearstamp__sub">{YEAR[period][1]}</span>
        </div>
      ) : null}
    </div>
  );
}

export default memo(MapView);
