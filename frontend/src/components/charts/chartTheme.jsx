// Shared Recharts styling: system font, tabular ticks, no gridlines, faint baseline.
export const FONT = 'inherit';

export const tick = { fontFamily: FONT, fontSize: 10.5, fill: 'var(--text-2)', fontVariantNumeric: 'tabular-nums' };
export const axisLine = { stroke: 'var(--sep)', strokeWidth: 1 };
export const noLine = false;

export function ChartTip({ active, payload, label, formatLabel, rows }) {
  if (!active || !payload?.length) return null;
  const items = rows ? rows(payload, label) : payload.map((p) => ({ name: p.name, value: p.value, color: p.color ?? p.stroke }));
  return (
    <div className="chart-tip" role="status">
      <div>{formatLabel ? formatLabel(label) : label}</div>
      {items.map((r, i) => (
        <div className="chart-tip__row" key={i}>
          <span style={{ color: r.color ?? 'inherit' }}>{r.name}</span>
          <span className="num">{r.value}</span>
        </div>
      ))}
    </div>
  );
}
