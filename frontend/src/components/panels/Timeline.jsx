import { useEffect, useRef } from 'react';
import { CHAPTERS, EXPLORE_STEP } from '../../content/chapters.js';
import { useAppState, useDispatch } from '../../state/AppState.jsx';

const STOPS = [...CHAPTERS.map((c) => ({ era: c.era, short: c.short, title: c.title })), EXPLORE_STEP];
const N = STOPS.length;
const fillScale = (p) => `scaleX(${(Math.max(0, Math.min(N - 1, p)) / (N - 1)).toFixed(4)})`;

// Consecutive steps that share an era ("2025") get one label spanning their columns.
const GROUPS = STOPS.reduce((acc, s, i) => {
  const last = acc[acc.length - 1];
  if (last && last.era === s.era) last.end = i;
  else acc.push({ era: s.era, start: i, end: i });
  return acc;
}, []);

function PlayIcon({ paused }) {
  return paused
    ? <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true"><path d="M3 2.2v9.6a.6.6 0 0 0 .9.5l7.6-4.8a.6.6 0 0 0 0-1L3.9 1.7a.6.6 0 0 0-.9.5z" /></svg>
    : <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true"><rect x="2.5" y="2" width="3.2" height="10" rx="0.8" /><rect x="8.3" y="2" width="3.2" height="10" rx="0.8" /></svg>;
}

/**
 * The timeline across the bottom of the map: one stop per step, grouped by year, filled up to where the
 * reader is. Clicking a stop jumps there; the story panel's Back / Next and the arrow keys move along it.
 * The play button starts the guided tour, during which the fill advances in real time through each callout.
 */
export default function Timeline({ guide }) {
  const { activeChapter, exploreMode, autoplay } = useAppState();
  const dispatch = useDispatch();
  const fillRef = useRef(null);
  const cur = exploreMode ? N - 1 : activeChapter;

  // Live fill during the tour: written straight to the DOM each frame, no React re-render.
  useEffect(() => {
    if (!autoplay.on) return undefined;
    const beats = guide?.[autoplay.step] ?? [];
    const dwell = beats[autoplay.beat]?.dwell ?? 6500;
    const n = Math.max(1, beats.length);
    let raf = 0;
    const tick = () => {
      const el = autoplay.elapsed + (autoplay.paused ? 0 : performance.now() - autoplay.startedAt);
      const frac = Math.min(1, el / dwell);
      if (fillRef.current) fillRef.current.style.transform = fillScale(autoplay.step + Math.min(1, (autoplay.beat + frac) / n));
      if (!autoplay.paused) raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [autoplay, guide]);

  const go = (i) => {
    if (i >= CHAPTERS.length) dispatch({ type: 'ENTER_EXPLORE' });
    else if (autoplay.on) dispatch({ type: 'AUTOPLAY_START', step: i });
    else dispatch({ type: 'SET_CHAPTER', index: i });
  };
  const play = () => {
    if (autoplay.on) dispatch({ type: 'AUTOPLAY_TOGGLE_PAUSE' });
    else dispatch({ type: 'AUTOPLAY_START', step: exploreMode ? 0 : activeChapter });
  };

  return (
    <nav className="timeline panel" aria-label="Story timeline" style={{ '--n': N }}>
      <button type="button" className={autoplay.on ? 'tl__play tl__play--on' : 'tl__play'} onClick={play} aria-label={autoplay.on ? (autoplay.paused ? 'Resume the tour' : 'Pause the tour') : 'Play the story as a guided tour'} title={autoplay.on ? (autoplay.paused ? 'Resume' : 'Pause') : 'Play the story'}>
        <PlayIcon paused={!autoplay.on || autoplay.paused} />
        <span className="tl__play-label">{autoplay.on ? (autoplay.paused ? 'Resume' : 'Pause') : 'Play the story'}</span>
      </button>
      {autoplay.on ? (
        <span className="tl__skips">
          <button type="button" className="tl__skip" onClick={() => dispatch({ type: 'AUTOPLAY_SKIP', dir: -1, count: (guide?.[autoplay.step] ?? []).length })} aria-label="Previous callout" title="Previous callout (←)">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true"><path d="M8.5 1.8v8.4a.5.5 0 0 1-.8.4L2.4 6.4a.5.5 0 0 1 0-.8l5.3-4.2a.5.5 0 0 1 .8.4z" /><rect x="1.2" y="1.5" width="1.4" height="9" rx="0.5" /></svg>
          </button>
          <button type="button" className="tl__skip" onClick={() => dispatch({ type: 'AUTOPLAY_SKIP', dir: 1, count: (guide?.[autoplay.step] ?? []).length })} aria-label="Next callout" title="Next callout (→)">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true"><path d="M3.5 1.8v8.4a.5.5 0 0 0 .8.4l5.3-4.2a.5.5 0 0 0 0-.8L4.3 1.4a.5.5 0 0 0-.8.4z" /><rect x="9.4" y="1.5" width="1.4" height="9" rx="0.5" /></svg>
          </button>
        </span>
      ) : null}
      <div className="tl__grid">
        <div className="tl__eras" aria-hidden="true">
          {GROUPS.map((g) => (
            <span key={`${g.era}-${g.start}`} className="tl__era" style={{ gridColumn: `${g.start + 1} / ${g.end + 2}` }}>{g.era}</span>
          ))}
        </div>
        <ol className="tl__track">
          <span className="tl__line" aria-hidden="true" />
          <span ref={fillRef} className={autoplay.on ? 'tl__fill tl__fill--live' : 'tl__fill'} aria-hidden="true" style={autoplay.on ? undefined : { transform: fillScale(cur) }} />
          {STOPS.map((s, i) => (
            <li key={i}>
              <button
                type="button"
                className="tl__stop"
                aria-current={i === cur ? 'step' : undefined}
                data-past={i < cur ? 'true' : 'false'}
                aria-label={`${s.era}: ${s.title}`}
                title={s.title}
                onClick={() => go(i)}
              >
                <i />
              </button>
            </li>
          ))}
        </ol>
        <div className="tl__titles" aria-hidden="true">
          {STOPS.map((s, i) => <span key={i} className="tl__title" data-current={i === cur ? 'true' : 'false'}>{s.short}</span>)}
        </div>
      </div>
      {autoplay.on ? (
        <button type="button" className="text-btn text-btn--quiet tl__exit" onClick={() => dispatch({ type: 'AUTOPLAY_STOP' })}>Exit tour</button>
      ) : null}
    </nav>
  );
}
