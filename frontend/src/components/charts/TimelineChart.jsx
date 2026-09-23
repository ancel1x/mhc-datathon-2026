import { ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { fmtCompact, fmtMonth, fmtNum, isNum } from '../../lib/format.js';
import { ChartTip, axisLine, tick } from './chartTheme.jsx';

/**
 * Monthly timeline with a vertical marker at the toll start.
 * data: [{ x: 'YYYY-MM', y: number|null }]
 */
export default function TimelineChart({ data = [], color = 'var(--text)', marker = '2025-01', unit = '', digits = 0, label = 'value', id = 'tl', baselineYear = null, currentYear = null, baselineLabel = 'baseline', currentLabel = 'current' }) {
  const rows = data.filter((d) => d && typeof d.x === 'string');
  if (!rows.length) return <div className="chart"><div className="chart__empty">No monthly series available</div></div>;
  const comparison = Number.isFinite(baselineYear) && Number.isFinite(currentYear) && baselineYear !== currentYear;
  const plotRows = comparison ? rows.map((d) => {
    const year = Number(d.x.slice(0, 4));
    return { ...d, base: year === baselineYear ? d.y : null, current: year === currentYear ? d.y : null, context: year !== baselineYear && year !== currentYear ? d.y : null };
  }) : rows;
  const hasContext = comparison && plotRows.some((d) => isNum(d.context));
  const markerX = marker ? rows.find((d) => d.x >= marker)?.x ?? null : null;
  const ticks = rows.filter((d) => d.x.endsWith('-01') || d === rows[0]).map((d) => d.x);
  const fmtVal = (v) => (isNum(v) ? (digits > 0 ? fmtNum(v, digits) : fmtCompact(v)) : '—');
  return (
    <div>
    <div className="chart">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={plotRows} margin={{ top: 14, right: 8, bottom: 0, left: 0 }}>
          <XAxis dataKey="x" ticks={ticks} tickFormatter={(v) => fmtMonth(v, { short: true })} tick={tick} axisLine={axisLine} tickLine={false} interval={0} minTickGap={16} />
          <YAxis width={38} tick={tick} axisLine={false} tickLine={false} tickCount={3} domain={['auto', 'auto']} tickFormatter={fmtVal} />
          <Tooltip cursor={{ stroke: 'var(--hairline)' }} content={<ChartTip formatLabel={(l) => fmtMonth(l)} rows={(p) => comparison ? p.filter((s) => isNum(s.value)).map((s) => ({ name: s.dataKey === 'base' ? baselineLabel : s.dataKey === 'current' ? currentLabel : 'Other observed year', value: `${fmtVal(s.value)}${unit ? ` ${unit}` : ''}`, color: s.stroke })) : [{ name: label, value: `${fmtVal(p[0]?.value)}${unit ? ` ${unit}` : ''}`, color }]} />} />
          {markerX ? <ReferenceLine x={markerX} stroke="var(--text-2)" strokeDasharray="2 3" label={{ value: 'toll starts', position: 'insideTopLeft', fill: 'var(--text-2)', fontSize: 10.5, fontFamily: tick.fontFamily, dy: -8, dx: 4 }} /> : null}
          {comparison ? <>
            {hasContext ? <Line type="monotone" dataKey="context" stroke="var(--glyph-base)" strokeOpacity={0.45} strokeDasharray="2 3" strokeWidth={1} dot={false} isAnimationActive={false} connectNulls={false} /> : null}
            <Line type="monotone" dataKey="base" stroke="var(--glyph-base)" strokeWidth={1.25} dot={false} isAnimationActive={false} connectNulls={false} />
            <Line type="monotone" dataKey="current" stroke={color} strokeWidth={1.8} dot={false} isAnimationActive={false} connectNulls={false} />
          </> : <Line type="monotone" dataKey="y" stroke={color} strokeWidth={1.5} dot={false} isAnimationActive={false} connectNulls={false} />}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
    {comparison ? <div className="chart-key" aria-hidden="true">
      <span style={{ '--k': 'var(--glyph-base)' }}>{baselineLabel}</span>
      <span style={{ '--k': color }}>{currentLabel}</span>
      {hasContext ? <span style={{ '--k': 'var(--glyph-base)' }}>other observed year</span> : null}
    </div> : null}
    </div>
  );
}
