import { useCallback, useEffect, useRef } from 'react';
import { useAppState, useDispatch } from '../state/AppState.jsx';
import { useReducedMotion } from '../hooks/useMediaQuery.js';

const MIN_HOLD_MS = 3000; // the title stays at least this long, even if the data loads instantly
const LEAVE_MS = 1000; // fade-out; the map is already flying in underneath

/**
 * Title card shown when the page opens. It carries the loading progress, then (once the data is in and the
 * title has been on screen for a moment) fades away while the map flies in to the first step. A click, Enter
 * or Space skips ahead. `?intro=hold` keeps it on screen (for screenshots); `?chapter=` skips it.
 */
export default function Intro({ loading, progress = 0, error = null }) {
  const { intro, introHold } = useAppState();
  const dispatch = useDispatch();
  const reduced = useReducedMotion();
  const mountedAt = useRef(performance.now());
  const leaving = intro === 'leaving';

  const leave = useCallback(() => {
    if (intro !== 'show' || loading || error) return;
    dispatch({ type: 'INTRO_LEAVE' });
    window.setTimeout(() => dispatch({ type: 'INTRO_DONE' }), reduced ? 0 : LEAVE_MS);
  }, [intro, loading, error, dispatch, reduced]);

  useEffect(() => {
    if (loading || error || intro !== 'show' || introHold) return undefined;
    const wait = Math.max(0, MIN_HOLD_MS - (performance.now() - mountedAt.current));
    const t = window.setTimeout(leave, wait);
    return () => window.clearTimeout(t);
  }, [loading, error, intro, introHold, leave]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); leave(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [leave]);

  const pct = Math.round(progress * 100);
  return (
    <div className="intro" data-phase={leaving ? 'out' : 'in'} onClick={leave} role="presentation" aria-hidden={leaving}>
      {loading ? <div className="intro__bar" style={{ width: `${Math.max(2, pct)}%` }} /> : null}
      <div className="intro__inner">
        <div className="intro__kicker">New York City · since January 5, 2025</div>
        <h1 className="intro__title">The real story of congestion pricing</h1>
        <p className="intro__sub">What happened to the traffic and the air after the $9 toll, where it moved, and who bears it, told from official data one year at a time.</p>
        <div className="intro__status num" role="status" aria-live="polite">
          {error ?? (loading ? `Loading official data · ${pct}%` : 'Click to begin')}
        </div>
      </div>
    </div>
  );
}
