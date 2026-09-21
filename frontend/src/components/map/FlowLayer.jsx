import { useEffect, useMemo, useRef } from 'react';
import { Layer, Source, useMap } from 'react-map-gl/maplibre';
import { useData } from '../../lib/data.jsx';
import { useAppState } from '../../state/AppState.jsx';
import { useReducedMotion } from '../../hooks/useMediaQuery.js';
import { featureMetrics } from '../../lib/metrics.js';
import { sqrtSize, themeColors } from '../../lib/scales.js';
import { fmtCompact, fmtPct, isNum } from '../../lib/format.js';
import { CROSSING_ROUTES, entryStub } from '../../content/corridors.js';

export const FLOW_LAYER_IDS = { hit: 'flow-hit' };

const SPEED = 44; // px per second: clearly moving, still calm
const TWEEN_MS = 1100; // how long a route takes to change color / width when the year changes
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

/** Current visual state of a route, tweening from `from` to `to`. */
function sample(r, now) {
  const k = smooth(Math.max(0, Math.min(1, (now - r.t0) / TWEEN_MS)));
  return {
    rgb: [lerp(r.from.rgb[0], r.to.rgb[0], k), lerp(r.from.rgb[1], r.to.rgb[1], k), lerp(r.from.rgb[2], r.to.rgb[2], k)],
    w: lerp(r.from.w, r.to.w, k),
    a: lerp(r.from.a, r.to.a, k),
  };
}

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

/** Point at distance d along a polyline given cumulative lengths. */
function pointAt(pts, cum, d) {
  let i = 1;
  while (i < cum.length - 1 && cum[i] < d) i += 1;
  const seg = cum[i] - cum[i - 1];
  const k = seg > 0 ? (d - cum[i - 1]) / seg : 0;
  return [lerp(pts[i - 1][0], pts[i][0], k), lerp(pts[i - 1][1], pts[i][1], k)];
}

/**
 * "Traffic flow": particles travelling along hand-drawn routes across the MTA crossings and short inbound
 * stubs at the zone gates. Drawn on a 2D canvas over the free part of the map (never under the frosted
 * panels), so the map itself is not re-rendered every frame. Color = the discs' change color (a plain light
 * line when the metric is "amount only"); thickness and particle density = volume. When the year or metric
 * changes, each route tweens to its new color and width so the reader sees the change happen.
 * An invisible wide MapLibre line under it gives hover and click.
 */
export default function FlowLayer({ featured }) {
  const { current: mapRef } = useMap();
  const { geo, indexes } = useData();
  const { period, metric, hour, layerVisibility, theme } = useAppState();
  const reduced = useReducedMotion();
  const canvasRef = useRef(null);
  const routesRef = useRef(new Map());
  const on = Boolean(layerVisibility.flow);
  const plain = themeColors(theme).flow;

  const targets = useMemo(() => {
    if (!on) return [];
    const out = [];
    const push = (coords, p, layer, m, width) => {
      const vol = isNum(m.value) ? m.value : isNum(m.baseline) ? m.baseline : 0;
      const fset = featured?.[layer] ?? null;
      out.push({
        key: `${layer}:${p.id}`,
        id: p.id,
        of: layer,
        name: p.name ?? p.id,
        coords,
        rgb: parseColor(metric === 'absolute' ? plain : m.color),
        w: width(vol),
        a: fset && !fset.has(p.id) ? 0.3 : 1,
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
    return out;
  }, [on, geo, indexes, period, hour, metric, layerVisibility.bt_facility, layerVisibility.crz_entry, featured, plain]);

  // Retarget the routes; routes that disappeared fade out and are dropped once invisible.
  useEffect(() => {
    const now = performance.now();
    const routes = routesRef.current;
    const seen = new Set();
    for (const t of targets) {
      seen.add(t.key);
      const r = routes.get(t.key);
      if (!r) routes.set(t.key, { coords: t.coords, kind: t.of, seed: 1 + Math.floor(Math.random() * 1e6), from: { rgb: t.rgb, w: t.w, a: 0 }, to: { rgb: t.rgb, w: t.w, a: t.a }, t0: now, phase: Math.random(), gone: false });
      else { r.from = sample(r, now); r.to = { rgb: t.rgb, w: t.w, a: t.a }; r.t0 = now; r.coords = t.coords; r.gone = false; }
    }
    for (const [key, r] of routes) {
      if (!seen.has(key) && !r.gone) { r.from = sample(r, now); r.to = { ...r.to, a: 0 }; r.t0 = now; r.gone = true; }
    }
  }, [targets]);

  // The render loop: ~30 fps on the overlay canvas only. Under reduced motion: one static frame per map move.
  useEffect(() => {
    const map = mapRef?.getMap?.();
    const canvas = canvasRef.current;
    if (!map || !canvas) return undefined;
    const ctx = canvas.getContext('2d');
    const container = map.getContainer();
    let raf = 0;
    let last = 0;
    let size = { w: 0, h: 0, dpr: 1 };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      size = { w: rect.width, h: rect.height, dpr };
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const draw = (now) => {
      const routes = routesRef.current;
      ctx.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
      ctx.clearRect(0, 0, size.w, size.h);
      if (!routes.size) return;
      const crect = container.getBoundingClientRect();
      const rect = canvas.getBoundingClientRect();
      const ox = rect.left - crect.left;
      const oy = rect.top - crect.top;
      const tSec = now / 1000;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (const [key, r] of routes) {
        const s = sample(r, now);
        if (r.gone && s.a <= 0.01 && now - r.t0 > TWEEN_MS) { routes.delete(key); continue; }
        if (s.a <= 0.005) continue;
        const pts = r.coords.map(([lon, lat]) => { const p = map.project([lon, lat]); return [p.x - ox, p.y - oy]; });
        if (pts.every(([x, y]) => x < -80 || y < -80 || x > size.w + 80 || y > size.h + 80)) continue;
        const cum = [0];
        for (let i = 1; i < pts.length; i += 1) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
        const L = cum[cum.length - 1];
        if (L < 4) continue;
        // the road: a faint solid line
        ctx.strokeStyle = rgba(s.rgb, 0.3 * s.a);
        ctx.lineWidth = Math.max(3, s.w * 1.7);
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i][0], pts[i][1]);
        ctx.stroke();
        // the traffic: little cars driving from the first coordinate to the last
        const carLen = 7.5 + s.w * 1.7;
        const spacing = carLen * 2.3;
        const travelled = reduced ? r.phase * spacing : tSec * SPEED + r.phase * spacing;
        const offset = travelled % spacing;
        const cycle = Math.floor(travelled / spacing); // a car keeps its paint as it moves down the route
        ctx.globalAlpha = s.a;
        let i = 0;
        for (let d = offset; d <= L; d += spacing, i += 1) {
          const sprite = carSprite(paintFor(r.kind, r.seed, cycle + i), carLen, size.dpr);
          const dw = sprite.len + SPRITE_PAD * 2;
          const dh = sprite.W + SPRITE_PAD * 2;
          const [x, y] = pointAt(pts, cum, d);
          const [ax, ay] = pointAt(pts, cum, Math.max(0, d - 2));
          const [bx, by] = pointAt(pts, cum, Math.min(L, d + 2));
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(Math.atan2(by - ay, bx - ax));
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
      }
    };

    if (reduced) {
      const still = () => draw(performance.now());
      still();
      map.on('move', still);
      const t = window.setInterval(still, 250); // lets tweens settle without a rAF loop
      return () => { map.off('move', still); window.clearInterval(t); ro.disconnect(); };
    }
    const frame = (now) => {
      raf = requestAnimationFrame(frame);
      if (now - last < FPS_MS) return;
      last = now;
      draw(now);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
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
