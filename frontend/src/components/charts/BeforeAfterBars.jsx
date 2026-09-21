import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { fmtCompact, fmtPct, fmtShare, isNum } from '../../lib/format.js';
import { ChartTip, tick } from './chartTheme.jsx';

/** Grouped before/after bars, one row per category (direction, class...). */
export default function BeforeAfterBars({ rows = [], beforeLabel = 'before', afterLabel = 'after', color = 'var(--text)' }) {
  const data = rows.filter((r) => r && (isNum(r.before) || isNum(r.after)));
  if (!data.length) return <div className="chart chart--short"><div className="chart__empty">No before/after breakdown</div></div>;
  const height = Math.max(70, data.length * 34 + 16);
  return (
    <div>
      <div className="chart" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 12, bottom: 0, left: 0 }} barGap={2} barCategoryGap={10}>
            <XAxis type="number" hide domain={[0, 'auto']} />
            <YAxis type="category" dataKey="label" width={104} tick={{ ...tick, fontFamily: 'inherit', fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip cursor={{ fill: 'var(--text)', fillOpacity: 0.04 }} content={<ChartTip rows={(p, label) => [...p.map((s) => ({ name: s.dataKey === 'before' ? beforeLabel : afterLabel, value: fmtCompact(s.value), color: s.fill })), { name: 'change', value: fmtPct(pct(p)) }]} />} />
            <Bar dataKey="before" fill="var(--neutral)" fillOpacity={0.55} barSize={8} isAnimationActive={false} radius={1} />
            <Bar dataKey="after" fill={color} barSize={8} isAnimationActive={false} radius={1} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="chart-key" aria-hidden="true">
        <span style={{ '--k': 'var(--neutral)' }}>{beforeLabel}</span>
        <span style={{ '--k': color }}>{afterLabel}</span>
      </div>
    </div>
  );
}

function pct(payload) {
  const b = payload.find((s) => s.dataKey === 'before')?.value;
  const a = payload.find((s) => s.dataKey === 'after')?.value;
  return isNum(a) && isNum(b) && b !== 0 ? ((a - b) / b) * 100 : null;
}

const CLASS_ORDER = [
  ['cars', 'Cars', 'var(--text)'],
  ['taxi_fhv', 'Taxi / FHV', 'var(--text-3)'],
  ['trucks_single', 'Single-unit trucks', 'rgba(255, 69, 58, 0.6)'],
  ['trucks_multi', 'Multi-unit trucks', 'var(--red)'],
  ['buses', 'Buses', 'var(--purple)'],
  ['motorcycles', 'Motorcycles', 'var(--grey)'],
];

/** Single stacked share bar for a class mix { cars, trucks_single, ... } (shares 0–1). */
export function ClassMixBar({ mix, title }) {
  const entries = CLASS_ORDER.filter(([k]) => isNum(mix?.[k]) && mix[k] > 0);
  if (!entries.length) return <div className="chart chart--short"><div className="chart__empty">No class mix available</div></div>;
  const total = entries.reduce((s, [k]) => s + mix[k], 0) || 1;
  return (
    <div>
      {title ? <div className="detail__section-title" style={{ marginBottom: 8 }}>{title}</div> : null}
      <div className="stackbar" role="img" aria-label={entries.map(([k, l]) => `${l} ${fmtShare(mix[k] / total)}`).join(', ')}>
        {entries.map(([k, l, c]) => (
          <span key={k} title={`${l}: ${fmtShare(mix[k] / total)}`} style={{ width: `${(mix[k] / total) * 100}%`, background: c }} />
        ))}
      </div>
      <div className="stackbar-key">
        {entries.map(([k, l, c]) => (
          <div key={k}><i style={{ background: c }} />{l} <span className="num">{fmtShare(mix[k] / total)}</span></div>
        ))}
      </div>
    </div>
  );
}
