import { memo, useMemo } from 'react';
import { arc, curveCardinalClosed, lineRadial } from 'd3-shape';
import { scaleSqrt } from 'd3-scale';
import { isNum } from '../../lib/format.js';

const TAU = Math.PI * 2;
const angleAt = (i) => (i / 24) * TAU;
const TICKS = [0, 6, 12, 18];
const PEAK = [5, 21];
const OUTLINE = 'rgba(11,13,16,0.9)';

/** Center mark that matches the layer's symbol below the glyph zoom: ring (entries) or disc (the rest). */
function CenterMark({ shape, color, hollow }) {
  if (shape === 'entry') return <circle r={4} fill="none" stroke={color} strokeWidth={2} />;
  if (hollow) return <circle r={3.5} fill="none" stroke={color} strokeWidth={1.5} />;
  return <circle r={3.5} fill={color} stroke={OUTLINE} strokeWidth={1} />;
}

/**
 * 24-hour radial glyph. Midnight at the top, clockwise. 1 px strokes: grey ring = baseline weekday profile,
 * colored ring = selected period. Radius is a sqrt scale from 0 to the layer maximum.
 */
function ClockGlyph({ baseline, current, max, color = '#8E8E93', size = 64, hour = null, selected = false, peak = PEAK, title, shape = 'monitor', hollow = false, dimmed = false }) {
  const r = size / 2;
  const R = r - 7;

  const geo = useMemo(() => {
    const rs = scaleSqrt().domain([0, isNum(max) && max > 0 ? max : 1]).range([0, R]).clamp(true);
    const curve = curveCardinalClosed.tension(0.55);
    const line = lineRadial().angle((_, i) => angleAt(i)).radius((d) => rs(d)).defined((d) => isNum(d)).curve(curve);
    const hasBase = Array.isArray(baseline) && baseline.length === 24 && baseline.some(isNum);
    const hasCur = Array.isArray(current) && current.length === 24 && current.some(isNum);
    const wedge = arc()({ innerRadius: 0, outerRadius: R + 3, startAngle: angleAt(peak[0]), endAngle: angleAt(peak[1]) });
    let hourPt = null;
    if (isNum(hour)) {
      const v = hasCur && isNum(current[hour]) ? current[hour] : hasBase && isNum(baseline[hour]) ? baseline[hour] : null;
      if (isNum(v)) hourPt = [Math.sin(angleAt(hour)) * rs(v), -Math.cos(angleAt(hour)) * rs(v)];
    }
    return {
      basePath: hasBase ? line(baseline) : null,
      curPath: hasCur ? line(current) : null,
      wedge,
      hourPt,
      spokeEnd: isNum(hour) ? [Math.sin(angleAt(hour)) * R, -Math.cos(angleAt(hour)) * R] : null,
    };
  }, [baseline, current, max, R, hour, peak]);

  return (
    <svg width={size} height={size} viewBox={`${-r} ${-r} ${size} ${size}`} role="img" aria-label={title} style={{ color: 'var(--text)' }}>
      <path d={geo.wedge} fill="currentColor" opacity={0.05} />
      {TICKS.map((h) => {
        const a = angleAt(h);
        const s = Math.sin(a);
        const c = -Math.cos(a);
        return <line key={h} x1={s * (R + 1)} y1={c * (R + 1)} x2={s * (R + 4)} y2={c * (R + 4)} stroke="currentColor" strokeWidth={1} opacity={0.35} />;
      })}
      {selected ? <circle r={R + 5.5} fill="none" stroke="currentColor" strokeWidth={1} opacity={0.6} /> : null}
      {geo.spokeEnd ? <line x1={0} y1={0} x2={geo.spokeEnd[0]} y2={geo.spokeEnd[1]} stroke="currentColor" strokeWidth={1} opacity={0.35} /> : null}
      {geo.basePath ? <path d={geo.basePath} fill="none" stroke="var(--glyph-base)" strokeWidth={1} /> : null}
      {geo.curPath ? <path d={geo.curPath} fill="none" stroke={color} strokeWidth={1} strokeLinejoin="round" /> : null}
      {geo.hourPt ? <circle cx={geo.hourPt[0]} cy={geo.hourPt[1]} r={2.4} fill={color} stroke={OUTLINE} strokeWidth={1} /> : null}
      <CenterMark shape={shape} color={color} hollow={hollow} />
      {dimmed ? null : <title>{title}</title>}
    </svg>
  );
}

export default memo(ClockGlyph);
