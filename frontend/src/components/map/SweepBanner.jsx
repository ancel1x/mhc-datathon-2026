import { SWEEP_MS, SWEEP_MS_REDUCED, useAppState } from '../../state/AppState.jsx';
import { useReducedMotion } from '../../hooks/useMediaQuery.js';

/** Year stamp text per period: [year, what it is]. */
export const YEAR = { pre_2024: ['2024', 'before the toll'], post_2025: ['2025', 'year one'], post_2026_ytd: ['2026', 'so far'] };

function FastForwardIcon() {
  return (
    <svg width="16" height="12" viewBox="0 0 16 12" aria-hidden="true">
      <path d="M1 1v10l6.5-5zM8 1v10l6.5-5z" fill="currentColor" />
    </svg>
  );
}

/**
 * The label over the map while a step replays its change: "Before · 2024" with a countdown bar along its bottom
 * (so it reads as a moment, not the final state), then a fast-forward bar running 2024 -> 2025 while the traffic
 * races through the change, then "After · 2025" with what the route colors mean.
 */
export default function SweepBanner() {
  const { sweep, intro, layerVisibility, autoplay } = useAppState();
  const reduced = useReducedMotion();
  if (!autoplay.on || autoplay.step !== 2 || autoplay.beat !== 0 || !sweep || intro !== 'done') return null;
  const ms = reduced ? SWEEP_MS_REDUCED : SWEEP_MS;
  const { phase } = sweep;
  const [fromYear, fromSub] = YEAR[sweep.from.period] ?? ['', ''];
  const [toYear, toSub] = YEAR[sweep.to.period] ?? ['', ''];
  return (
    <div className="sweep" role="status" aria-live="polite">
      <div key={`${sweep.id}-${phase}`} className="sweep__pill panel" data-phase={phase} style={{ '--sweep-before': `${ms.before}ms`, '--sweep-ff': `${ms.ff}ms`, '--sweep-out': `${ms.after - 450}ms` }}>
        {phase === 'before' ? (
          <>
            <span className="sweep__tag">Before</span>
            <span className="sweep__year num">{fromYear}</span>
            <span className="sweep__sub">{fromSub}</span>
            <span className="sweep__timer" aria-hidden="true"><i /></span>
          </>
        ) : phase === 'ff' ? (
          <>
            <span className="sweep__tag"><FastForwardIcon /><span className="sweep__tag-text">Fast-forward</span></span>
            <span className="sweep__year num">{fromYear}</span>
            <span className="sweep__track" aria-hidden="true"><i /></span>
            <span className="sweep__year num">{toYear}</span>
          </>
        ) : (
          <>
            <span className="sweep__tag">After</span>
            <span className="sweep__year num">{toYear}</span>
            <span className="sweep__sub">{toSub}</span>
            {layerVisibility.flow ? (
              <span className="sweep__key">
                <span><i data-tone="red" />busier</span>
                <span><i data-tone="green" />quieter</span>
                <span><i data-tone="grey" />no clear change</span>
              </span>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
