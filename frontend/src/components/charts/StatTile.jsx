import { isNum } from '../../lib/format.js';

const PCT_TOKEN = /([+−-]?\d+(?:\.\d+)?%)/g;
const PCT_PART = /^[+−-]?\d+(?:\.\d+)?%$/;

function TonedPercentages({ text, tone }) {
  if (tone === 'directional') {
    return String(text).split(PCT_TOKEN).map((part, i) => {
      if (!PCT_PART.test(part)) return part;
      const cls = /^[+−-]?0(?:\.0+)?%$/.test(part) ? '' : part.startsWith('+') ? 'tone-worse' : 'tone-better';
      return cls ? <span className={cls} key={i}>{part}</span> : part;
    });
  }
  const cls = isNum(tone) && tone !== 0 ? (tone > 0 ? 'tone-worse' : 'tone-better') : '';
  if (!cls) return text;
  return String(text).split(PCT_TOKEN).map((part, i) => (
    PCT_PART.test(part) ? <span className={cls} key={i}>{part}</span> : part
  ));
}

/** Big tabular number with a caption under it. `tone` > 0 = worse (red), < 0 = better (green). */
export default function StatTile({ label, value, sub, tone = null, subTone = null, raw, rawTone = null, verdict }) {
  const cls = isNum(tone) && tone !== 0 ? (tone > 0 ? 'stat__value stat__value--worse' : 'stat__value stat__value--better') : 'stat__value';
  const text = value ?? '—';
  const len = String(text).length;
  return (
    <div className="stat">
      {text !== '' ? <div className={cls} data-len={len > 7 ? 'xl' : len > 5 ? 'l' : 'm'}>{text}</div> : null}
      <div className="stat__label">{label}</div>
      {raw ? <div className={`stat__raw num ${toneClass(rawTone)}`}>{raw}</div> : null}
      {verdict ? <div className="stat__verdict">{verdict}</div> : null}
      {sub ? <div className="stat__sub"><TonedPercentages text={sub} tone={subTone} /></div> : null}
    </div>
  );
}

function toneClass(tone) {
  return isNum(tone) && tone !== 0 ? (tone > 0 ? 'tone-worse' : 'tone-better') : '';
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
