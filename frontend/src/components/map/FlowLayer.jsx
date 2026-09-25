import { memo, useEffect, useMemo, useRef } from 'react';
import { Layer, Source, useMap } from 'react-map-gl/maplibre';
import { useData } from '../../lib/data.jsx';
import { SWEEP_MS, useAppState } from '../../state/AppState.jsx';
import { useReducedMotion } from '../../hooks/useMediaQuery.js';
import { featureMetrics } from '../../lib/metrics.js';
import { COLORS, sqrtSize, themeColors } from '../../lib/scales.js';
import { fmtCompact, fmtPct, isNum } from '../../lib/format.js';
import { CROSSING_ROUTES, entryStub, AQ_LINK_ROUTES } from '../../content/corridors.js';

export const FLOW_LAYER_IDS = { hit: 'flow-hit' };

const AQ_LINK_WIDTH = 2; // fixed width for AQ-monitor link routes: these have no traffic-volume figure to scale by
const AQ_LINK_LOAD = 0.3; // ...and a calm, even flow for the same reason
// How a route feels is set by its "load", 0 (empty road) to 1 (jammed): cars on a loaded route crawl, follow
// closely and bunch up in stop-and-go waves; on a light route they are spread out and move fast.
const SPEED_FREE = 80; // px per second on an empty road
const SPEED_JAM = 13; // px per second in a jam
const GAP_FREE = 5.5; // distance between cars, in car lengths, on an empty road
const GAP_JAM = 1.35; // ...and in a jam (nearly bumper to bumper)
const STOP_GO = 0.8; // how hard a loaded route's cars brake in its stop-and-go waves
const FF_BOOST = 5; // extra speed at the height of a before -> after fast-forward
const TWEEN_MS = 1100; // how long a route takes to change color / width / load when the year changes
const FPS_MS = 1000 / 30;
const TAU = Math.PI * 2;
const EMPTY = { type: 'FeatureCollection', features: [] };

/** '#rrggbb' | 'rgb(r, g, b)' | 'rgba(r, g, b, a)' -> [r, g, b] */
function parseColor(c) {
  if (typeof c !== 'string') return [142, 142, 147];
  const hex = c.match(/^#([0-9a-f]{6})$/i);
  if (hex) return [parseInt(hex[1].slice(0, 2), 16), parseInt(hex[1].slice(2, 4), 16), parseInt(hex[1].slice(4, 6), 16)];
  const m = c.match(/rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : [142, 142, 147];
}
const rgba = ([r, g, b], a) => `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
const smooth = (k) => k * k * (3 - 2 * k);
const lerp = (a, b, k) => a + (b - a) * k;
const clamp01 = (k) => Math.max(0, Math.min(1, k));

/** Current visual state of a route, tweening from `from` to `to` over the route's own duration. */
function sample(r, now) {
  const dur = r.dur ?? TWEEN_MS;
  if (now - r.t0 >= dur) return r.to;
  const k = smooth(clamp01((now - r.t0) / dur));
  return {
    rgb: [lerp(r.from.rgb[0], r.to.rgb[0], k), lerp(r.from.rgb[1], r.to.rgb[1], k), lerp(r.from.rgb[2], r.to.rgb[2], k)],
    w: lerp(r.from.w, r.to.w, k),
    a: lerp(r.from.a, r.to.a, k),
    load: lerp(r.from.load, r.to.load, k),
    hi: lerp(r.from.hi, r.to.hi, k),
  };
}

/**
 * Which way a route's traffic moved: +1 a supported rise, -1 a supported drop, 0 no supported change (or nothing
 * to compare yet). Crossings use their 95%-interval verdict; a coverage-limited one counts at 60% strength.
 * Without a verdict (zone entries, or a single hour picked) the raw change leads, with ±6% as full strength.
 */
function trafficDirection(m, metric, period, hour) {
  if (metric === 'absolute' || period === 'pre_2024') return 0;
  if (hour == null && m.support) {
    if (m.support === 'increase') return 1;
    if (m.support === 'decrease') return -1;
    if (m.support === 'limited' && isNum(m.change)) return Math.sign(m.change) * 0.6;
    return 0;
  }
  return isNum(m.change) ? Math.max(-1, Math.min(1, m.change / 6)) * 0.8 : 0;
}

/** Route color: red for a supported rise, green for a supported drop (paler when coverage-limited), grey otherwise. */
function flowColor(m, layer, dir, metric, hour, plain) {
  if (metric === 'absolute') return plain;
  if (layer === 'aq_monitor' || hour != null || !m.support) return m.color;
  if (dir >= 1) return COLORS.worse;
  if (dir <= -1) return COLORS.better;
  if (dir > 0) return COLORS.worseSoft;
  if (dir < 0) return COLORS.betterSoft;
  return COLORS.neutral;
}

/** Busier crossings (thicker lines, widths 1.5-5 px) start fuller; a supported rise adds load, a supported drop removes it. */
const routeLoad = (w, dir) => Math.max(0.08, Math.min(0.96, 0.15 + 0.4 * clamp01((w - 1.5) / 3.5) + 0.45 * dir));

/** Colors as [r, g, b]; mix toward white or black for the car's shading. */
const mix = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
const rgb = ([r, g, b]) => `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
function roundRect(g, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + rr, y);
  g.lineTo(x + w - rr, y);
  g.arcTo(x + w, y, x + w, y + rr, rr);
  g.lineTo(x + w, y + h - rr);
  g.arcTo(x + w, y + h, x + w - rr, y + h, rr);
  g.lineTo(x + rr, y + h);
  g.arcTo(x, y + h, x, y + h - rr, rr);
  g.lineTo(x, y + rr);
  g.arcTo(x, y, x + rr, y, rr);
  g.closePath();
}

// Car paint: a realistic mix rather than one color per route, so the road line and arrowhead carry the
// red / green change while the cars read as traffic. Zone gates get more yellow cabs (taxis and app rides
// are about a third of entries). Weights sum to 100.
const PAINT = {
  white: [242, 242, 242], silver: [184, 188, 196], charcoal: [96, 101, 112], blue: [64, 132, 246], red: [217, 74, 74], cab: [245, 197, 24],
};
const MIXES = {
  bt_facility: [['white', 28], ['silver', 22], ['charcoal', 18], ['blue', 14], ['red', 12], ['cab', 6]],
  crz_entry: [['cab', 30], ['white', 20], ['silver', 15], ['charcoal', 13], ['blue', 12], ['red', 10]],
};
function paintFor(kind, seed, id) {
  const h = (Math.imul(seed, 73856093) ^ Math.imul(id + 1, 19349663)) >>> 0;
  let roll = h % 100;
  for (const [name, w] of MIXES[kind] ?? MIXES.bt_facility) {
    if (roll < w) return PAINT[name];
    roll -= w;
  }
  return PAINT.white;
}

const SPRITE_PAD = 3;
const spriteCache = new Map();
/**
 * A little top-down car pointing right (+x), pre-rendered once per (color, length, pixel ratio): drop shadow,
 * body shaded light-to-dark for a rounded look, lighter roof between a dark windshield and rear window,
 * warm headlights at the front, red tail lights at the back.
 */
function carSprite(color, len, dpr) {
  const key = `${color.map((v) => Math.round(v / 12)).join(',')}|${Math.round(len * 2)}|${dpr}`;
  const hit = spriteCache.get(key);
  if (hit) return hit;
  if (spriteCache.size > 400) spriteCache.clear();
  const W = len * 0.56;
  const off = document.createElement('canvas');
  off.width = Math.ceil((len + SPRITE_PAD * 2) * dpr);
  off.height = Math.ceil((W + SPRITE_PAD * 2) * dpr);
  const g = off.getContext('2d');
  g.scale(dpr, dpr);
  g.translate(SPRITE_PAD, SPRITE_PAD);
  const light = mix(color, [255, 255, 255], 0.38);
  const dark = mix(color, [0, 0, 0], 0.32);
  const edge = mix(color, [0, 0, 0], 0.6);
  // shadow
  g.fillStyle = 'rgba(0,0,0,0.4)';
  roundRect(g, 0.9, 1.6, len, W, W * 0.36);
  g.fill();
  // body
  const grad = g.createLinearGradient(0, 0, 0, W);
  grad.addColorStop(0, rgb(light));
  grad.addColorStop(0.55, rgb(color));
  grad.addColorStop(1, rgb(dark));
  g.fillStyle = grad;
  roundRect(g, 0, 0, len, W, W * 0.36);
  g.fill();
  g.strokeStyle = rgb(edge);
  g.lineWidth = 0.8;
  g.stroke();
  // glass: windshield (front) and rear window, roof between them
  const cabX = len * 0.28;
  const cabL = len * 0.46;
  g.fillStyle = 'rgba(18,22,30,0.8)';
  roundRect(g, cabX + cabL * 0.62, W * 0.14, cabL * 0.38, W * 0.72, W * 0.16);
  g.fill();
  roundRect(g, cabX - cabL * 0.2, W * 0.2, cabL * 0.2, W * 0.6, W * 0.14);
  g.fill();
  g.fillStyle = rgb(mix(light, [255, 255, 255], 0.25));
  roundRect(g, cabX, W * 0.16, cabL * 0.62, W * 0.68, W * 0.16);
  g.fill();
  // lights
  const lr = Math.max(0.7, W * 0.11);
  g.fillStyle = 'rgba(255,246,205,0.95)';
  g.beginPath();
  g.arc(len - 0.9, W * 0.24, lr, 0, TAU);
  g.arc(len - 0.9, W * 0.76, lr, 0, TAU);
  g.fill();
  g.fillStyle = 'rgba(255,70,60,0.95)';
  g.beginPath();
  g.arc(0.9, W * 0.24, lr * 0.8, 0, TAU);
  g.arc(0.9, W * 0.76, lr * 0.8, 0, TAU);
  g.fill();
  const sprite = { canvas: off, len, W };
  spriteCache.set(key, sprite);
  return sprite;
}

/** A soft red glow, drawn behind a car's tail when it brakes in heavy traffic. Pre-rendered once per pixel ratio. */
let glowCache = null;
function brakeGlow(dpr) {
  if (glowCache?.dpr === dpr) return glowCache;
  const R = 8;
  const c = document.createElement('canvas');
  c.width = c.height = Math.ceil(R * 2 * dpr);
  const g = c.getContext('2d');
  g.scale(dpr, dpr);
  const grad = g.createRadialGradient(R, R, 0, R, R, R);
  grad.addColorStop(0, 'rgba(255,64,48,0.95)');
  grad.addColorStop(0.35, 'rgba(255,64,48,0.4)');
  grad.addColorStop(1, 'rgba(255,64,48,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, R * 2, R * 2);
  glowCache = { canvas: c, R, dpr };
  return glowCache;
}

/** Point at distance d along a polyline given cumulative lengths. */
function pointAt(pts, cum, d) {
  let i = 1;
  while (i < cum.length - 1 && cum[i] < d) i += 1;
  const seg = cum[i] - cum[i - 1];
  const k = seg > 0 ? (d - cum[i - 1]) / seg : 0;
  return [lerp(pts[i - 1][0], pts[i][0], k), lerp(pts[i - 1][1], pts[i][1], k)];
}

/** Speed multiplier of the before -> after fast-forward at time `now`: ramps up, holds, eases back to 1. */
function ffBoost(ff, now) {
  const k = (now - ff.t0) / ff.dur;
  if (!(k >= 0 && k <= 1)) return 1;
  const env = k < 0.18 ? k / 0.18 : k > 0.7 ? (1 - k) / 0.3 : 1;
  return 1 + FF_BOOST * smooth(env);
}

/**
 * Move a route's cars forward by one frame. Cars keep their place as a fraction of the route (so they stay put
 * when the map moves), never pass or touch the car ahead, brake in stop-and-go waves that grow with load, and
 * enter at the start whenever the gap there reaches the route's spacing. When the spacing changes (a new year,
 * a zoom) cars are added into gaps that grew too wide and faded out of gaps that became too tight, one per frame.
 */
function stepCars(r, L, carLen, spacing, load, base, dt, t) {
  const newCar = (s) => ({ s, id: r.nextId++, a: 0, brake: 0, dying: false });
  if (!r.cars) {
    r.cars = [];
    for (let d = r.phase * spacing; d < L; d += spacing) r.cars.push({ ...newCar(d / L), a: 1 });
    return;
  }
  const cars = r.cars;
  const minGap = carLen * 1.15;
  const wave = STOP_GO * load * load;
  let ahead = Infinity;
  for (let i = cars.length - 1; i >= 0; i -= 1) {
    const c = cars[i];
    const d = c.s * L;
    if (c.dying) {
      c.a -= dt * 4;
      c.s = (d + base * dt) / L;
      continue;
    }
    const want = base * (1 - wave * (0.5 + 0.5 * Math.sin(d / 34 + t * 2.1)));
    const nd = Math.max(d, Math.min(d + want * dt, ahead - minGap));
    if (dt > 0) c.brake = lerp(c.brake, 1 - clamp01((nd - d) / (base * dt)), 0.25);
    c.a = Math.min(1, c.a + dt * 3);
    c.s = nd / L;
    ahead = nd;
  }
  // entries at the start of the route, behind the rearmost car (cars are sorted from the start of the route)
  const rear = cars.find((c) => !c.dying);
  if (!rear) cars.push(newCar(0));
  else for (let fd = rear.s * L; fd >= spacing; ) { fd -= spacing; cars.push(newCar(fd / L)); }
  cars.sort((a, b) => a.s - b.s);
  // one gap repair per frame: fill a gap that is far too wide, or thin a pair that is far too close
  let prev = null;
  for (let i = 0; i < cars.length; i += 1) {
    const c = cars[i];
    if (c.dying) continue;
    if (prev) {
      const gap = (c.s - prev.s) * L;
      if (gap > spacing * 2.4) { cars.splice(i, 0, newCar((prev.s + c.s) / 2)); break; }
      if (gap < spacing * 0.55 && gap < minGap * 2) { prev.dying = true; break; }
    }
    prev = c;
  }
  r.cars = cars.filter((c) => c.s * L <= L && c.a > -0.01);
}

/**
 * "Traffic flow": little cars driving along hand-drawn routes across the MTA crossings and short inbound stubs
 * at the zone gates. Drawn on a 2D canvas over the free part of the map (never under the frosted panels), so
 * the map itself is not re-rendered every frame. Color = the change since 2024 (a plain light line when the
 * metric is "amount only"); thickness = volume; how busy the road looks (speed, spacing, braking) = volume plus
 * the supported change, so a crossing that got busier visibly clogs up and one that got quieter frees up. When
 * the year or metric changes each route tweens to its new look; during a step's before -> after replay the
 * tween lasts the whole fast-forward and the traffic speeds up while it runs.
 * An invisible wide MapLibre line under it gives hover and click.
 */
function FlowLayer({ featured }) {
  const { current: mapRef } = useMap();
  const { geo, indexes } = useData();
  const { period, metric, hour, layerVisibility, theme, sweep } = useAppState();
  const reduced = useReducedMotion();
  const canvasRef = useRef(null);
  const routesRef = useRef(new Map());
  const wakeRef = useRef(() => {});
  const ffRef = useRef({ t0: -Infinity, dur: 1 });
  const on = Boolean(layerVisibility.flow);
  const plain = themeColors(theme).flow;
  const ffPhase = sweep?.phase === 'ff' ? sweep.id : null;

  const targets = useMemo(() => {
    if (!on) return [];
    const out = [];
    const push = (coords, p, layer, m, width) => {
      const vol = isNum(m.value) ? m.value : isNum(m.baseline) ? m.baseline : 0;
      const w = width(vol);
      const dir = layer === 'aq_monitor' ? 0 : trafficDirection(m, metric, period, hour);
      const fset = featured?.[layer] ?? null;
      out.push({
        key: `${layer}:${p.id}`,
        id: p.id,
        of: layer,
        name: p.name ?? p.id,
        coords,
        rgb: parseColor(flowColor(m, layer, dir, metric, hour, plain)),
        w,
        a: fset && !fset.has(p.id) ? 0.3 : 1,
        load: layer === 'aq_monitor' ? AQ_LINK_LOAD : routeLoad(w, dir),
        hi: Math.min(1, Math.abs(dir) / 0.6),
        text: metric === 'absolute' ? `${fmtCompact(vol)} ${layer === 'crz_entry' ? 'a weekday' : 'a day'} · ${m.currentLabel}` : `${fmtPct(m.change)} vs ${m.baselineLabel}`,
      });
    };
    if (layerVisibility.bt_facility) {
      const width = sqrtSize(indexes?.maxima?.bt_facility?.value, [1.5, 5]);
      for (const f of geo.bt_facility?.features ?? []) {
        const p = f.properties ?? {};
        const route = CROSSING_ROUTES[p.id];
        if (route) push(route, p, 'bt_facility', featureMetrics(p, 'bt_facility', period, hour, metric), width);
      }
    }
    if (layerVisibility.crz_entry && period !== 'pre_2024') {
      const width = sqrtSize(indexes?.maxima?.crz_entry?.value, [1.5, 5]);
      for (const f of geo.crz_entry?.features ?? []) {
        const p = f.properties ?? {};
        const stub = entryStub(p.id, f.geometry?.coordinates);
        if (stub) push(stub, p, 'crz_entry', featureMetrics(p, 'crz_entry', period, hour, metric), width);
      }
    }
    if (layerVisibility.aq_monitor) {
      for (const f of geo.aq_monitor?.features ?? []) {
        const p = f.properties ?? {};
        const route = AQ_LINK_ROUTES[p.id];
        if (route) push(route, p, 'aq_monitor', featureMetrics(p, 'aq_monitor', period, hour, metric), () => AQ_LINK_WIDTH);
      }
    }
    return out;
  }, [on, geo, indexes, period, hour, metric, layerVisibility.bt_facility, layerVisibility.crz_entry, layerVisibility.aq_monitor, featured, plain]);

  // A fast-forward starts in the same update that moves the year, so this runs before the retarget below and
  // the new targets tween over the whole fast-forward.
  useEffect(() => {
    if (ffPhase == null || reduced) return;
    ffRef.current = { t0: performance.now(), dur: SWEEP_MS.ff };
    wakeRef.current();
  }, [ffPhase, reduced]);

  // Retarget the routes; routes that disappeared fade out and are dropped once invisible.
  useEffect(() => {
    const now = performance.now();
    const ff = ffRef.current;
    const dur = now - ff.t0 < ff.dur ? Math.max(400, ff.t0 + ff.dur - now) : TWEEN_MS;
    const routes = routesRef.current;
    const seen = new Set();
    for (const t of targets) {
      seen.add(t.key);
      const look = { rgb: t.rgb, w: t.w, a: t.a, load: t.load, hi: t.hi };
      const r = routes.get(t.key);
      if (!r) routes.set(t.key, { coords: t.coords, kind: t.of, seed: 1 + Math.floor(Math.random() * 1e6), from: { ...look, a: 0 }, to: look, t0: now, dur: TWEEN_MS, phase: Math.random(), cars: null, nextId: 0, gone: false });
      else { r.from = sample(r, now); r.to = look; r.t0 = now; r.dur = dur; r.coords = t.coords; r.projected = null; r.gone = false; }
    }
    for (const [key, r] of routes) {
      if (!seen.has(key) && !r.gone) { r.from = sample(r, now); r.to = { ...r.to, a: 0 }; r.t0 = now; r.dur = TWEEN_MS; r.gone = true; }
    }
    wakeRef.current();
  }, [targets]);

  // Project routes only when the camera/layout changes. Sleep when hidden, empty, or motion has settled.
  useEffect(() => {
    const map = mapRef?.getMap?.();
    const canvas = canvasRef.current;
    if (!map || !canvas) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;
    const container = map.getContainer();
    let raf = 0;
    let last = 0;
    let lastDraw = 0;
    let size = { w: 0, h: 0, dpr: 1 };
    let geometryDirty = true;
    let layoutDirty = true;
    let ox = 0;
    let oy = 0;

    const wake = () => {
      if (!raf && !document.hidden) raf = requestAnimationFrame(frame);
    };

    const resize = () => {
      layoutDirty = true;
      geometryDirty = true;
      wake();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    ro.observe(container);

    const draw = (now) => {
      const routes = routesRef.current;
      // seconds since the last drawn frame, capped so a background tab or a long pause does not teleport the cars
      const dt = lastDraw ? Math.min(0.1, (now - lastDraw) / 1000) : 0;
      lastDraw = now;
      if (layoutDirty) {
        const rect = canvas.getBoundingClientRect();
        const crect = container.getBoundingClientRect();
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        size = { w: rect.width, h: rect.height, dpr };
        if (canvas.width !== Math.round(rect.width * dpr)) canvas.width = Math.round(rect.width * dpr);
        if (canvas.height !== Math.round(rect.height * dpr)) canvas.height = Math.round(rect.height * dpr);
        ox = rect.left - crect.left;
        oy = rect.top - crect.top;
        layoutDirty = false;
      }
      ctx.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
      ctx.clearRect(0, 0, size.w, size.h);
      if (!routes.size) return;
      const tSec = now / 1000;
      const boost = reduced ? 1 : ffBoost(ffRef.current, now);
      const streak = clamp01((boost - 1.4) / 3);
      const glow = brakeGlow(size.dpr);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (const [key, r] of routes) {
        const s = sample(r, now);
        if (r.gone && s.a <= 0.01 && now - r.t0 > r.dur) { routes.delete(key); continue; }
        if (s.a <= 0.005) continue;
        if (geometryDirty || !r.projected) {
          const pts = r.coords.map(([lon, lat]) => { const p = map.project([lon, lat]); return [p.x - ox, p.y - oy]; });
          const cum = [0];
          for (let i = 1; i < pts.length; i += 1) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
          const visible = !pts.every(([x, y]) => x < -80 || y < -80 || x > size.w + 80 || y > size.h + 80);
          const path = new Path2D();
          path.moveTo(pts[0][0], pts[0][1]);
          for (let i = 1; i < pts.length; i += 1) path.lineTo(pts[i][0], pts[i][1]);
          r.projected = { pts, cum, L: cum[cum.length - 1], visible, path };
        }
        const { pts, cum, L, visible, path } = r.projected;
        if (!visible || L < 4) continue;
        // the road: a faint solid line, stronger and with a soft glow when the route changed (red or green)
        const roadW = Math.max(3, s.w * 1.7);
        if (s.hi > 0.02) {
          ctx.strokeStyle = rgba(s.rgb, 0.14 * s.hi * s.a);
          ctx.lineWidth = roadW * 2.8;
          ctx.stroke(path);
        }
        ctx.strokeStyle = rgba(s.rgb, (0.28 + 0.3 * s.hi) * s.a);
        ctx.lineWidth = roadW;
        ctx.stroke(path);
        // the traffic: little cars driving from the first coordinate to the last
        const carLen = 8 + s.w * 0.9;
        const spacing = carLen * lerp(GAP_FREE, GAP_JAM, s.load);
        const base = lerp(SPEED_FREE, SPEED_JAM, Math.pow(s.load, 0.8)) * boost;
        const braking = clamp01((s.load - 0.5) / 0.35); // only busy roads show brake lights
        let cars;
        if (reduced) {
          cars = [];
          for (let d = r.phase * spacing, i = 0; d <= L; d += spacing, i += 1) cars.push({ s: d / L, id: i, a: 1, brake: 0.6 });
        } else {
          stepCars(r, L, carLen, spacing, s.load, base, dt, tSec);
          cars = r.cars;
        }
        for (const c of cars) {
          const d = c.s * L;
          const fade = c.a * clamp01(d / (carLen * 0.8)) * clamp01((L - d) / (carLen * 1.2)); // ease in and out at the ends
          if (fade <= 0.01) continue;
          const sprite = carSprite(paintFor(r.kind, r.seed, c.id), carLen, size.dpr);
          const dw = sprite.len + SPRITE_PAD * 2;
          const dh = sprite.W + SPRITE_PAD * 2;
          const [x, y] = pointAt(pts, cum, d);
          const [ax, ay] = pointAt(pts, cum, Math.max(0, d - 2));
          const [bx, by] = pointAt(pts, cum, Math.min(L, d + 2));
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(Math.atan2(by - ay, bx - ax));
          ctx.globalAlpha = s.a * fade;
          if (streak > 0) {
            // fast-forward motion streak behind the car
            ctx.strokeStyle = `rgba(255,255,255,${(0.22 * streak).toFixed(3)})`;
            ctx.lineWidth = sprite.W * 0.7;
            ctx.beginPath();
            ctx.moveTo(-carLen / 2, 0);
            ctx.lineTo(-carLen / 2 - Math.min(46, base * 0.09), 0);
            ctx.stroke();
          }
          const brake = braking * (0.3 + 0.7 * c.brake);
          if (brake > 0.03) {
            const gs = sprite.W * 1.9;
            ctx.globalAlpha = s.a * fade * brake;
            ctx.drawImage(glow.canvas, -carLen / 2 - gs * 0.45, -gs / 2, gs, gs);
            ctx.globalAlpha = s.a * fade;
          }
          ctx.drawImage(sprite.canvas, -dw / 2, -dh / 2, dw, dh);
          ctx.restore();
        }
        ctx.globalAlpha = 1;
        // arrowhead at the end of the route: which way the traffic goes
        const ah = 5 + s.w * 1.5;
        const [ex, ey] = pts[pts.length - 1];
        const [bx, by] = pointAt(pts, cum, Math.max(0, L - 12));
        const ang = Math.atan2(ey - by, ex - bx);
        ctx.fillStyle = rgba(s.rgb, 0.9 * s.a);
        ctx.beginPath();
        ctx.moveTo(ex + Math.cos(ang) * ah * 0.7, ey + Math.sin(ang) * ah * 0.7);
        ctx.lineTo(ex + Math.cos(ang + 2.55) * ah, ey + Math.sin(ang + 2.55) * ah);
        ctx.lineTo(ex + Math.cos(ang - 2.55) * ah, ey + Math.sin(ang - 2.55) * ah);
        ctx.closePath();
        ctx.fill();
        // Flow arrows end at zone-entry coordinates. Redraw the diamond over them so the marker
        // remains legible without changing the route geometry or click target.
        if (r.kind === 'crz_entry') {
          const half = Math.max(6, s.w * 1.6);
          ctx.strokeStyle = rgba(s.rgb, s.a);
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(ex, ey - half);
          ctx.lineTo(ex + half, ey);
          ctx.lineTo(ex, ey + half);
          ctx.lineTo(ex - half, ey);
          ctx.closePath();
          ctx.stroke();
        }
      }
      geometryDirty = false;
    };

    const frame = (now) => {
      raf = 0;
      if (document.hidden) { lastDraw = 0; return; }
      if (geometryDirty || layoutDirty || now - last >= FPS_MS) {
        // Carry the fractional frame time forward so a 60 Hz screen keeps a steady 30 fps.
        last = now - ((now - last) % FPS_MS);
        draw(now);
      }
      const routes = routesRef.current;
      const tweening = reduced && [...routes.values()].some((r) => last - r.t0 <= (r.dur ?? TWEEN_MS));
      if (routes.size && (!reduced || tweening)) wake();
      else lastDraw = 0;
    };
    const moved = () => { geometryDirty = true; wake(); };
    const visibility = () => {
      if (document.hidden) { cancelAnimationFrame(raf); raf = 0; lastDraw = 0; }
      else resize();
    };
    wakeRef.current = wake;
    map.on('move', moved);
    map.on('resize', resize);
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', visibility);
    wake();
    return () => {
      wakeRef.current = () => {};
      cancelAnimationFrame(raf);
      ro.disconnect();
      map.off('move', moved);
      map.off('resize', resize);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [mapRef, reduced]);

  const hitData = useMemo(() => (targets.length ? {
    type: 'FeatureCollection',
    features: targets.map((t) => ({ type: 'Feature', geometry: { type: 'LineString', coordinates: t.coords }, properties: { id: t.id, name: t.name, _of: t.of, _text: t.text } })),
  } : EMPTY), [targets]);

  return (
    <>
      <div className="flow-canvas" aria-hidden="true"><canvas ref={canvasRef} /></div>
      <Source id="flow" type="geojson" data={hitData}>
        <Layer id={FLOW_LAYER_IDS.hit} type="line" beforeId="labels-highways" layout={{ 'line-cap': 'round', 'line-join': 'round' }} paint={{ 'line-color': '#000000', 'line-opacity': 0, 'line-width': 14 }} />
      </Source>
    </>
  );
}

export default memo(FlowLayer);
