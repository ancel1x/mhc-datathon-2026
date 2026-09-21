import { Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { fmtCompact, fmtHour, fmtNum, isNum } from '../../lib/format.js';
import { ChartTip, axisLine, tick } from './chartTheme.jsx';

/** Hour-of-day profile: grey baseline vs colored current, with the peak window shaded. */
export default function HourProfileChart({ baseline, current, baselineLabel = 'baseline', currentLabel = 'selected', color = 'var(--text)', unit = '', digits = 0, hour = null, peak = [5, 21] }) {
  const hasBase = Array.isArray(baseline) && baseline.length === 24;
  const hasCur = Array.isArray(current) && current.length === 24;
  if (!hasBase && !hasCur) return <div className="chart chart--short"><div className="chart__empty">No hourly profile available</div></div>;
  const data = Array.from({ length: 24 }, (_, h) => ({ h, base: hasBase && isNum(baseline[h]) ? baseline[h] : null, cur: hasCur && isNum(current[h]) ? current[h] : null }));
  const fmtVal = (v) => (isNum(v) ? (digits > 0 ? fmtNum(v, digits) : fmtCompact(v)) : '—');
  return (
    <div>
      <div className="chart chart--short">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <ReferenceArea x1={peak[0]} x2={peak[1]} fill="var(--text)" fillOpacity={0.05} strokeOpacity={0} ifOverflow="visible" />
            <XAxis dataKey="h" type="number" domain={[0, 23]} ticks={[0, 6, 12, 18, 23]} tickFormatter={fmtHour} tick={tick} axisLine={axisLine} tickLine={false} />
            <YAxis width={38} tick={tick} axisLine={false} tickLine={false} tickCount={3} domain={['auto', 'auto']} tickFormatter={fmtVal} />
            <Tooltip cursor={{ stroke: 'var(--hairline)' }} content={<ChartTip formatLabel={fmtHour} rows={(p) => p.map((s) => ({ name: s.dataKey === 'base' ? baselineLabel : currentLabel, value: `${fmtVal(s.value)}${unit ? ` ${unit}` : ''}`, color: s.stroke }))} />} />
            {isNum(hour) ? <ReferenceLine x={hour} stroke="var(--text)" strokeOpacity={0.5} strokeDasharray="2 3" /> : null}
            {hasBase ? <Line type="monotone" dataKey="base" stroke="var(--glyph-base)" strokeWidth={1.25} dot={false} isAnimationActive={false} connectNulls /> : null}
            {hasCur ? <Line type="monotone" dataKey="cur" stroke={color} strokeWidth={1.6} dot={false} isAnimationActive={false} connectNulls /> : null}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="chart-key" aria-hidden="true">
        {hasBase ? <span style={{ '--k': 'var(--glyph-base)' }}>{baselineLabel}</span> : null}
        {hasCur ? <span style={{ '--k': color }}>{currentLabel}</span> : null}
        <span style={{ '--k': 'transparent' }}>shaded: peak window {`${fmtHour(peak[0])}–${fmtHour(peak[1])}`}</span>
      </div>
    </div>
  );
}
