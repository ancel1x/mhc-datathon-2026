import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppState, useDispatch } from '../state/AppState.jsx';
import { useReducedMotion } from '../hooks/useMediaQuery.js';

const LEAVE_MS = 1150;
/** The cover turns itself once the data is in; the CTA is a way to go sooner, not a gate. */
const AUTO_MS = 3500;

/**
 * Graphic-novel cover shown when the page opens. It turns away on its own AUTO_MS after the data is ready, or
 * as soon as the reader uses the CTA; the map is already mounted underneath so the cover can turn away and
 * reveal the first story step.
 * `?intro=hold` keeps it on screen indefinitely (for screenshots); `?chapter=` skips it.
 */
export default function Intro({ loading, progress = 0, error = null }) {
  const { intro, introHold } = useAppState();
  const dispatch = useDispatch();
  const reduced = useReducedMotion();
  const [turning, setTurning] = useState(false);
  const frameRef = useRef(null);
  const nestedFrameRef = useRef(null);
  const fallbackRef = useRef(null);
  const autoRef = useRef(null);
  const leaving = turning || intro === 'leaving';
  const ready = !loading && !error;

  useEffect(() => () => {
    if (frameRef.current != null) window.cancelAnimationFrame(frameRef.current);
    if (nestedFrameRef.current != null) window.cancelAnimationFrame(nestedFrameRef.current);
    if (fallbackRef.current != null) window.clearTimeout(fallbackRef.current);
    if (autoRef.current != null) window.clearTimeout(autoRef.current);
  }, []);

  const finish = useCallback(() => {
    if (fallbackRef.current != null) window.clearTimeout(fallbackRef.current);
    fallbackRef.current = null;
    dispatch({ type: 'INTRO_DONE' });
  }, [dispatch]);

  const leave = useCallback((event) => {
    if (intro !== 'show' || !ready || turning) return;
    event?.currentTarget?.blur();
    // Start the compositor-friendly cover animation before the context update makes the map fly and
    // reveals every story panel. Two frames guarantee the browser paints motion before that heavier work.
    setTurning(true);
    frameRef.current = window.requestAnimationFrame(() => {
      nestedFrameRef.current = window.requestAnimationFrame(() => {
        dispatch({ type: 'INTRO_LEAVE' });
        if (reduced) finish();
      });
    });
    if (!reduced) fallbackRef.current = window.setTimeout(finish, LEAVE_MS + 300);
  }, [intro, ready, turning, dispatch, reduced, finish]);

  // The cover turns itself once the data has loaded, so reaching the story needs no input. The countdown
  // starts at `ready` rather than on mount, so a slow load still leaves AUTO_MS to actually read the title.
  // `?intro=hold` opts out, keeping the cover up for screenshots.
  useEffect(() => {
    if (intro !== 'show' || !ready || turning || introHold) return undefined;
    autoRef.current = window.setTimeout(leave, AUTO_MS);
    return () => {
      if (autoRef.current != null) window.clearTimeout(autoRef.current);
      autoRef.current = null;
    };
  }, [intro, ready, turning, introHold, leave]);

  const onTurnEnd = useCallback((event) => {
    if (event.target === event.currentTarget && event.animationName === 'intro-page-turn') finish();
  }, [finish]);

  const pct = Math.round(progress * 100);
  return (
    <section className="intro" data-phase={leaving ? 'out' : 'in'} aria-labelledby="intro-title" aria-hidden={leaving} onAnimationEnd={onTurnEnd}>
      {loading ? <div className="intro__bar" style={{ width: `${Math.max(2, pct)}%` }} /> : null}
      <div className="intro__inner">
        <div className="intro__kicker">New York City · since January 5, 2025</div>
        <h1 className="intro__title" id="intro-title">The real story of congestion pricing</h1>
        <p className="intro__sub">What happened to the traffic and the air after the $9 toll, where it moved, and who bears it, told from official data one year at a time.</p>
      </div>
      {ready ? (
        <button className="intro__cta" type="button" onClick={leave} disabled={leaving}>
          <span>Begin the story</span>
          <span className="intro__cta-arrow" aria-hidden="true">→</span>
        </button>
      ) : (
        <div className="intro__status num" role="status" aria-live="polite">
          {error ?? `Loading official data · ${pct}%`}
        </div>
      )}
    </section>
  );
}
