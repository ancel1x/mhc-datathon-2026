import { isNum } from '../../lib/format.js';

/** Big tabular number with a caption under it. `tone` > 0 = worse (red), < 0 = better (green). */
export default function StatTile({ label, value, sub, tone = null }) {
  const cls = isNum(tone) && tone !== 0 ? (tone > 0 ? 'stat__value stat__value--worse' : 'stat__value stat__value--better') : 'stat__value';
  const text = value ?? '—';
  const len = String(text).length;
  return (
    <div className="stat">
      <div className={cls} data-len={len > 7 ? 'xl' : len > 5 ? 'l' : 'm'}>{text}</div>
      <div className="stat__label">{label}</div>
      {sub ? <div className="stat__sub">{sub}</div> : null}
    </div>
  );
}

export function StatRow({ items = [], panel = false }) {
  if (!items.length) return null;
  return (
    <div className={panel ? 'stats stats--panel' : 'stats'} role="list">
      {items.map((it, i) => (
        <div role="listitem" key={i} style={{ display: 'contents' }}>
          <StatTile {...it} />
        </div>
      ))}
    </div>
  );
}
