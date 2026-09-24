import { fmtSigned, isNum, MONTHS_SHORT } from '../../lib/format.js';
import { COLORS, statusColor } from '../../lib/scales.js';

/** Plain-English label for an interval-based result. */
export const STATUS_TEXT = {
  increase: 'Supported increase',
  decrease: 'Supported decrease',
  uncertain: 'Uncertain',
  limited: 'Coverage-limited',
  no_baseline: 'No eligible baseline',
  none: 'Not available',
};

/** Classify an estimate by whether its 95% interval crosses zero (a given status wins when supplied). */
export function intervalStatus(lo, hi, status = null) {
  if (status === 'limited' || status === 'no_baseline') return status;
  if (!isNum(lo) || !isNum(hi)) return status ?? 'none';
  if (lo > 0) return 'increase';
  if (hi < 0) return 'decrease';
  return 'uncertain';
}

/** `what` names the measure ("traffic", "PM2.5") so the badge reads "Supported PM2.5 decrease". */
export function StatusBadge({ status, text, what = null }) {
  const st = status ?? 'none';
  const named = what && { increase: `Supported ${what} increase`, decrease: `Supported ${what} decrease`, uncertain: `${what} change uncertain`, no_baseline: `No 2024 ${what} baseline`, limited: `${what} coverage-limited` }[st];
  const label = text ?? named ?? STATUS_TEXT[st] ?? st;
  return <span className={`badge badge--${st}`}>{label.charAt(0).toUpperCase() + label.slice(1)}</span>;
}

/**
 * Zero-centred 95% interval bars: one shared symmetric scale, a dot at the estimate, a bar from low to high.
 * A bar that crosses the zero line is drawn thin and grey (uncertain); one entirely on one side is coloured
 * (green = fell, red = rose). rows: [{ label, sub, est, lo, hi, status }].
 */
export default function IntervalBars({ rows = [], unit = '%', digits = 1, maxAbs: forcedMax = null }) {
  const valid = rows.filter((r) => r && (isNum(r.est) || (isNum(r.lo) && isNum(r.hi))));
  if (!valid.length) return <div className="ivl__empty">No interval available</div>;
  const span = forcedMax ?? Math.max(0.5, ...valid.flatMap((r) => [r.lo, r.hi, r.est].filter(isNum).map(Math.abs)));
  const x = (v) => 50 + (v / span) * 47;
  const u = unit === '%' ? '%' : '';
  return (
    <div className="ivl" role="table" aria-label="Estimates with 95% intervals">
      {rows.map((r, i) => {
        if (!r) return null;
        const st = intervalStatus(r.lo, r.hi, r.status);
        const color = statusColor(st);
        const hasCi = isNum(r.lo) && isNum(r.hi);
        const soft = st === 'uncertain' || st === 'limited';
        return (
          <div className="ivl__row" key={i} role="row" data-status={st}>
            <div className="ivl__label" role="cell">
              <span>{r.label}</span>
              {r.sub ? <span className="ivl__sub">{r.sub}</span> : null}
            </div>
            <div className="ivl__track" role="cell" aria-label={`${r.label}: ${isNum(r.est) ? fmtSigned(r.est, digits) + u : 'not available'}${hasCi ? `, interval ${fmtSigned(r.lo, digits)} to ${fmtSigned(r.hi, digits)}${u}` : ''}`}>
              <span className="ivl__zero" />
              {hasCi ? <span className={soft ? 'ivl__bar ivl__bar--soft' : 'ivl__bar'} data-limited={st === 'limited' ? 'true' : 'false'} style={{ left: `${x(r.lo)}%`, width: `${Math.max(0.8, x(r.hi) - x(r.lo))}%`, background: color }} /> : null}
              {isNum(r.est) ? <span className="ivl__dot" style={{ left: `${x(r.est)}%`, background: st === 'none' ? COLORS.insufficient : color }} /> : null}
            </div>
            <div className="ivl__val" role="cell">
              <span className="num" style={{ color: st === 'none' ? 'var(--text-3)' : color }}>{isNum(r.est) ? `${fmtSigned(r.est, digits)}${u}` : '—'}</span>
              <span className="ivl__ci num">{hasCi ? `${fmtSigned(r.lo, digits)} to ${fmtSigned(r.hi, digits)}${u}` : st === 'no_baseline' ? 'no eligible baseline' : 'no interval'}</span>
            </div>
          </div>
        );
      })}
      <div className="ivl__axis" aria-hidden="true">
        <span className="ivl__axis-track">
          <span className="num">{fmtSigned(-span, digits)}{u}</span>
          <span className="num">0</span>
          <span className="num">{fmtSigned(span, digits)}{u}</span>
        </span>
        <span className="ivl__axis-spacer" />
      </div>
    </div>
  );
}

/** "8 / 12 matched months" plus small chips (filled = eligible in both years). months: ["03", "04", ...]. */
export function MonthChips({ months = [], label = 'matched months', total = 12 }) {
  const set = new Set((months ?? []).map((m) => Number(String(m).slice(-2))));
  const n = set.size;
  const names = MONTHS_SHORT.slice(0, total);
  return (
    <div className="chips" role="img" aria-label={`${n} of ${total} ${label}: ${[...set].sort((a, b) => a - b).map((i) => MONTHS_SHORT[i - 1]).join(', ') || 'none'}`}>
      <span className="chips__count num">{n} / {total} <span className="chips__label">{label}</span></span>
      <span className="chips__row" aria-hidden="true">
        {names.map((m, i) => <i key={m} data-on={set.has(i + 1) ? 'true' : 'false'} title={m}>{m[0]}</i>)}
      </span>
    </div>
  );
}
