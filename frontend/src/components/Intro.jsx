import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { useAppState, useDispatch } from '../state/AppState.jsx';
import { useReducedMotion } from '../hooks/useMediaQuery.js';
import { INTRO_PHOTOS } from '../content/introPhotos.js';

const TITLE_WORDS = 'The real story of congestion pricing'.split(' ');
/** "The real story of" sits on the first line, "congestion pricing" on the second. */
const LEAD_WORDS = 4;
const LEAVE_MS = 900;
/** The button arrives once the title has settled; before that the reader only sees the words come in. */
const CTA_AT_MS = 1100;
const CTA_IN_MS = 600;
/** The cover turns itself once the data is in; the CTA is a way to go sooner, not a gate. */
const AUTO_MS = 6000;
/** When the app may mount the map and panels under the cover without stalling the entrance. */
export const INTRO_SETTLE_MS = CTA_AT_MS;

const PHOTO_BASE = `${import.meta.env?.BASE_URL ?? '/'}assets/intro/`;
/** How long each photo stays up: the reel speeds into a fast riffle as the title lands, then eases off. */
const REEL_GAPS = [380, 280, 200, 150, 115, 90, 80, 80, 80, 80, 80, 90, 110, 140, 190, 260, 360, 520, 800, 1300];
const REEL_CALM_MS = 1700;
/** From this gap up, photos cross-fade instead of cutting. */
const REEL_FADE_FROM = 500;

/**
 * Title cover shown when the page opens. The words rise in one after another over a reel of traffic photos,
 * then "Begin the story" arrives under them with a thin line that fills as a countdown; when it is
 * full (or as soon as the reader presses it) the cover pushes forward and fades into the map, which is
 * mounted underneath by then and flies in to the first story step.
 * `?intro=hold` keeps it on screen indefinitely (for screenshots); `?chapter=` skips it.
 */
/**
 * Flip-book of traffic and transit photos behind the title, in the spirit of a film studio's opening reel:
 * hard cuts speeding up while the title arrives, then slow cross-fades while the reader waits. The photos
 * are greyscale and sit dim under a dark wash, so the cuts read as texture, not flashes. Reduced motion
 * shows one still photo.
 */
function Reel({ still }) {
  const ref = useRef(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return undefined;
    const frames = [...root.querySelectorAll('img')];
    let alive = true;
    let timer = null;
    let at = -1;
    let step = 0;
    const loaded = (img) => img.complete && img.naturalWidth > 0;
    const show = (next, fade) => {
      root.style.setProperty('--reel-fade', `${fade}ms`);
      frames.forEach((img, k) => {
        img.toggleAttribute('data-prev', k === at);
        img.toggleAttribute('data-on', k === next);
      });
      at = next;
    };
    const tick = () => {
      if (!alive) return;
      const gap = step < REEL_GAPS.length ? REEL_GAPS[step] : REEL_CALM_MS;
      step += 1;
      // skip photos that have not arrived yet rather than cutting to an empty frame
      for (let k = 1; k <= frames.length; k++) {
        const next = (at + k + frames.length) % frames.length;
        if (loaded(frames[next])) { show(next, gap >= REEL_FADE_FROM ? Math.min(900, gap * 0.55) : 0); break; }
      }
      timer = window.setTimeout(tick, gap);
    };
    // Start once the first few photos are decoded (or after a short wait) so the riffle does not stutter.
    const first = frames.slice(0, still ? 1 : 6).map((img) => img.decode().catch(() => {}));
    Promise.race([Promise.all(first), new Promise((r) => { timer = window.setTimeout(r, 1200); })]).then(() => {
      if (!alive) return;
      window.clearTimeout(timer);
      root.dataset.live = 'true';
      if (still) show(0, 0);
      else tick();
    });
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [still]);
  return (
    <div className="intro__reel" ref={ref} aria-hidden="true">
      <div className="intro__reel-track">
        {INTRO_PHOTOS.map((p, i) => (
          <img key={p.file} src={`${PHOTO_BASE}${p.file}`} alt="" decoding="async" fetchPriority={i < 6 ? 'auto' : 'low'} />
        ))}
      </div>
    </div>
  );
}

/** Title words from..to, each in its own span so they can rise one after another. */
function words(from, to) {
  return TITLE_WORDS.slice(from, to).map((word, j) => (
    <Fragment key={word}>
      {j ? ' ' : null}
      <span className="intro__word" style={{ '--i': from + j }}>{word}</span>
    </Fragment>
  ));
}

export default function Intro({ loading, progress = 0, error = null }) {
  const { intro, introHold } = useAppState();
  const dispatch = useDispatch();
  const reduced = useReducedMotion();
  const [turning, setTurning] = useState(false);
  const mountedAt = useRef(performance.now());
  const ctaDelayRef = useRef(null);
  const frameRef = useRef(null);
  const nestedFrameRef = useRef(null);
  const fallbackRef = useRef(null);
  const autoRef = useRef(null);
  const leaving = turning || intro === 'leaving';
  const ready = !loading && !error;

  // Fixed the first time the data is ready: a fast load waits for the title to settle, a slow one shows the
  // button straight away.
  if (ready && ctaDelayRef.current == null) {
    ctaDelayRef.current = reduced ? 0 : Math.max(0, Math.round(CTA_AT_MS - (performance.now() - mountedAt.current)));
  }
  const ctaDelay = ctaDelayRef.current ?? 0;
  const countdownDelay = ctaDelay + (reduced ? 0 : CTA_IN_MS);

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

  // The cover turns itself once the button's countdown fill completes, so reaching the story needs no input.
  // `?intro=hold` opts out, keeping the cover up for screenshots.
  useEffect(() => {
    if (intro !== 'show' || !ready || turning || introHold) return undefined;
    autoRef.current = window.setTimeout(leave, countdownDelay + AUTO_MS);
    return () => {
      if (autoRef.current != null) window.clearTimeout(autoRef.current);
      autoRef.current = null;
    };
  }, [intro, ready, turning, introHold, leave, countdownDelay]);

  const onLeaveEnd = useCallback((event) => {
    if (event.target === event.currentTarget && event.animationName === 'intro-out') finish();
  }, [finish]);

  const pct = Math.round(progress * 100);
  return (
    <section className="intro" data-phase={leaving ? 'out' : 'in'} aria-labelledby="intro-title" aria-hidden={leaving} onAnimationEnd={onLeaveEnd}>
      <Reel still={reduced} />
      <div className="intro__inner">
        <div className="intro__kicker">New York City · since January 5, 2025</div>
        <h1 className="intro__title" id="intro-title">
          <span className="intro__line">{words(0, LEAD_WORDS)}</span>{' '}
          <span className="intro__line">{words(LEAD_WORDS, TITLE_WORDS.length)}</span>
        </h1>
        <p className="intro__sub">What happened to the traffic and the air after the $9 toll, where it moved, and who bears it, told from official data one year at a time.</p>
        <div className="intro__action">
          {ready ? (
            <button className="intro__cta" type="button" onClick={leave} disabled={leaving} style={{ '--cta-delay': `${ctaDelay}ms` }}>
              <span>Begin the story</span>
              <svg className="intro__cta-chevron" viewBox="0 0 8 14" aria-hidden="true">
                <path d="M1.5 1.5 6.5 7l-5 5.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="intro__cta-line" aria-hidden="true">
                {introHold ? null : <span className="intro__cta-fill" style={{ '--fill-delay': `${countdownDelay}ms`, '--fill-ms': `${AUTO_MS}ms` }} />}
              </span>
            </button>
          ) : (
            <div className="intro__status num" role="status" aria-live="polite">
              {error ? null : (
                <span className="intro__track" aria-hidden="true">
                  <span style={{ transform: `scaleX(${Math.max(0.02, progress)})` }} />
                </span>
              )}
              <span>{error ?? `Loading official data · ${pct}%`}</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
