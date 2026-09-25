import { useEffect } from 'react';
import { useMap } from 'react-map-gl/maplibre';
import { CHAPTERS } from '../content/chapters.js';
import { SWEEP_MS, SWEEP_MS_REDUCED, useAppState, useDispatch } from '../state/AppState.jsx';
import { useReducedMotion } from '../hooks/useMediaQuery.js';

const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const NEXT_PHASE = { before: 'ff', ff: 'after', after: 'end' };

/** Camera padding while the tour runs: the panels are hidden, only the timeline bar is on screen. */
export function tourPadding() {
  const css = (name, fallback) => {
    try { const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)); return Number.isFinite(v) ? v : fallback; } catch { return fallback; }
  };
  return { top: 72, bottom: css('--timeline-h', 64) + css('--inset', 16) + 48, left: 56, right: 56 };
}

/**
 * Runs the guided tour: walks each step's beats on a timer (pause keeps the remaining time), applies a beat's
 * year / metric so the map visibly changes, moves the camera for beats that ask for it, and hands over to
 * Explore at the end. Space pauses, Escape leaves the tour, the arrow keys (or Enter, or the "Next" button on a
 * callout) skip to the next / previous callout without waiting for its bar.
 * It also times Chapter 3 Card 1's guided "before -> after" replay: the earlier year holds, fast-forwards to
 * the chapter year, then labels the result.
 */
export default function GuidePlayer({ guide }) {
  const { autoplay, intro, sweep } = useAppState();
  const dispatch = useDispatch();
  const { main } = useMap();
  const reduced = useReducedMotion();
  const { on, paused, step, beat, elapsed } = autoplay;

  // ---- tour beats ----
  useEffect(() => {
    if (!on || paused) return undefined;
    const beats = guide?.[step] ?? [];
    const b = beats[beat];
    if (!b) {
      const t = window.setTimeout(() => dispatch(step >= CHAPTERS.length - 1 ? { type: 'AUTOPLAY_END' } : { type: 'AUTOPLAY_START', step: step + 1 }), 250);
      return () => window.clearTimeout(t);
    }
    if (elapsed === 0 && (b.state || b.layers)) dispatch({ type: 'SET_STEP_STATE', ...b.state, layers: b.layers, dotAll: b.dotAll, dacMode: b.dacMode, overlayOpacity: b.overlayOpacity });
    const map = main?.getMap?.();
    if (b.camera && map && elapsed === 0) {
      const opts = { center: b.camera.center, zoom: b.camera.zoom, padding: tourPadding() };
      if (reduced) map.jumpTo(opts);
      else map.easeTo({ ...opts, duration: 2400, easing: easeInOutCubic, essential: true });
    }
    const remaining = Math.max(0, (b.dwell ?? 6500) - elapsed);
    const t = window.setTimeout(() => dispatch({ type: 'AUTOPLAY_BEAT', beat: beat + 1 }), remaining);
    return () => window.clearTimeout(t);
  }, [on, paused, step, beat, elapsed, guide, main, dispatch, reduced]);

  useEffect(() => {
    if (!on) return undefined;
    const onKey = (e) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const count = (guide?.[step] ?? []).length;
      if (e.key === 'Escape') { e.preventDefault(); dispatch({ type: 'AUTOPLAY_STOP' }); }
      else if (e.key === ' ') { e.preventDefault(); dispatch({ type: 'AUTOPLAY_TOGGLE_PAUSE' }); }
      else if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); dispatch({ type: 'AUTOPLAY_SKIP', dir: 1, count }); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); dispatch({ type: 'AUTOPLAY_SKIP', dir: -1, count }); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [on, step, guide, dispatch]);

  // ---- before -> after replay: hold the earlier year, fast-forward, label the result, done ----
  const sweepId = sweep?.id;
  const sweepPhase = sweep?.phase;
  const sweepActive = on && step === 2 && beat === 0;
  useEffect(() => {
    if (!sweepActive || !sweepId || intro !== 'done') return undefined;
    const t = window.setTimeout(() => dispatch({ type: 'SWEEP_PHASE', id: sweepId, phase: NEXT_PHASE[sweepPhase] }), (reduced ? SWEEP_MS_REDUCED : SWEEP_MS)[sweepPhase] ?? 0);
    return () => window.clearTimeout(t);
  }, [sweepActive, sweepId, sweepPhase, intro, dispatch, reduced]);

  return null;
}
