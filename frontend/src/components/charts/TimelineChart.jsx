import { ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { fmtCompact, fmtMonth, fmtNum, isNum } from '../../lib/format.js';
import { ChartTip, axisLine, tick } from './chartTheme.jsx';

/**
 * Monthly timeline with a vertical marker at the toll start.
 * data: [{ x: 'YYYY-MM', y: number|null }]
 */
export default function TimelineChart({ data = [], color = 'var(--text)', marker = '2025-01', unit = '', digits = 0, label = 'value', id = 'tl' }) {
  const rows = data.filter((d) => d && typeof d.x === 'string');
  if (!rows.length) return <div className="chart"><div className="chart__empty">No monthly series available</div></div>;
  const markerX = rows.find((d) => d.x >= marker)?.x ?? null;
  const ticks = rows.filter((d) => d.x.endsWith('-01') || d === rows[0]).map((d) => d.x);
  const fmtVal = (v) => (isNum(v) ? (digits > 0 ? fmtNum(v, digits) : fmtCompact(v)) : '—');
  return (
    <div className="chart">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 14, right: 8, bottom: 0, left: 0 }}>
          <XAxis dataKey="x" ticks={ticks} tickFormatter={(v) => fmtMonth(v, { short: true })} tick={tick} axisLine={axisLine} tickLine={false} interval={0} minTickGap={16} />
          <YAxis width={38} tick={tick} axisLine={false} tickLine={false} tickCount={3} domain={['auto', 'auto']} tickFormatter={fmtVal} />
          <Tooltip cursor={{ stroke: 'var(--hairline)' }} content={<ChartTip formatLabel={(l) => fmtMonth(l)} rows={(p) => [{ name: label, value: `${fmtVal(p[0]?.value)}${unit ? ` ${unit}` : ''}`, color }]} />} />
          {markerX ? <ReferenceLine x={markerX} stroke="var(--text-2)" strokeDasharray="2 3" label={{ value: 'toll starts', position: 'insideTopLeft', fill: 'var(--text-2)', fontSize: 10.5, fontFamily: tick.fontFamily, dy: -8, dx: 4 }} /> : null}
          <Line type="monotone" dataKey="y" stroke={color} strokeWidth={1.5} dot={false} isAnimationActive={false} connectNulls={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
