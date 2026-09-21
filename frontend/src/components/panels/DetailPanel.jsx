import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppState } from '../../state/AppState.jsx';
import { useLazyJson } from '../../lib/data.jsx';
import { featureMetrics, LAYER_META, metaLine } from '../../lib/metrics.js';
import { fmtCompact, fmtDelta, fmtInt, fmtMonth, fmtMonthList, fmtNum, fmtPct, fmtShare, isNum } from '../../lib/format.js';
import { StatRow } from '../charts/StatTile.jsx';
import TimelineChart from '../charts/TimelineChart.jsx';
import HourProfileChart from '../charts/HourProfileChart.jsx';
import BeforeAfterBars, { ClassMixBar } from '../charts/BeforeAfterBars.jsx';
import CloseButton from '../CloseButton.jsx';
import Segmented from '../Segmented.jsx';

const SERIES_FILE = { aq_monitor: 'aq_series', bt_facility: 'bt_series', crz_entry: 'crz_series', dot_segment: 'dot_matched' };
const daysInMonth = (ym) => { const [y, m] = ym.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).getUTCDate(); };

function buildTimeline(layer, p, series) {
  if (!p || !series) return [];
  if (layer === 'aq_monitor') {
    const rows = series.monthly?.[p.site_id] ?? series.monthly?.[p.id] ?? [];
    return rows.map((r) => ({ x: r.ym, y: isNum(r.mean) ? r.mean : null }));
  }
  if (layer === 'bt_facility') {
    const rows = series.monthly?.[p.id] ?? [];
    return rows.map((r) => ({ x: r.ym, y: isNum(r.total) ? Math.round(r.total / daysInMonth(r.ym)) : null }));
  }
  if (layer === 'crz_entry') {
    const rows = series.daily_by_point?.[p.id] ?? [];
    const agg = new Map();
    for (const r of rows) {
      if (!r?.date || !isNum(r.entries)) continue;
      const ym = r.date.slice(0, 7);
      const a = agg.get(ym) ?? { sum: 0, n: 0 };
      a.sum += r.entries; a.n += 1; agg.set(ym, a);
    }
    return [...agg.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([ym, a]) => ({ x: ym, y: Math.round(a.sum / a.n) }));
  }
  return [];
}

function matchedFor(p, series) {
  if (!Array.isArray(series) || !p) return null;
  return series.find((d) => d.id === p.id || (p.segment_id != null && String(d.segment_id) === String(p.segment_id))) ?? null;
}

/** Feature detail, rendered inside the right-hand panel in place of the controls. */
export default function DetailContent({ layer, feature, onClose }) {
  const { period, hour, metric } = useAppState();
  const [dayType, setDayType] = useState('weekday');
  const closeRef = useRef(null);
  const p = feature?.properties ?? null;

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    const t = setTimeout(() => closeRef.current?.focus(), 50);
    return () => { window.removeEventListener('keydown', onKey); clearTimeout(t); };
  }, [onClose, p]);

  const { data: series, loading: seriesLoading } = useLazyJson(layer ? SERIES_FILE[layer] : null, Boolean(p));
  const m = useMemo(() => (p ? featureMetrics(p, layer, period, null, metric) : null), [p, layer, period, metric]);
  const timeline = useMemo(() => buildTimeline(layer, p, series), [layer, p, series]);
  const matched = layer === 'dot_segment' ? matchedFor(p, series) : null;
  const meta = LAYER_META[layer];
  const isAQ = layer === 'aq_monitor';
  const unit = isAQ ? 'µg/m³' : '';
  const digits = isAQ ? 2 : 0;
  const fmtVal = (v) => (isAQ ? fmtNum(v, 2) : fmtCompact(v));
  if (!p || !m) return null;

  const tiles = [
    { label: m.baselineLabel || 'before', value: fmtVal(m.baseline), sub: isAQ ? 'mean µg/m³' : meta?.unit },
    { label: m.currentLabel || 'after', value: fmtVal(m.value), sub: isAQ ? 'mean µg/m³' : meta?.unit },
    { label: 'Change', value: fmtPct(m.change), sub: isAQ ? `${fmtDelta(m.comparison?.delta_adj_control, 'µg/m³', 2)} adj.` : 'vs baseline', tone: isAQ ? (m.classification === 'worsened' ? 1 : m.classification === 'improved' ? -1 : 0) : m.change },
  ];

  const baseH = layer === 'dot_segment' ? matched?.hourly_weekday_pre : dayType === 'weekday' ? m.baselineHourly : m.baselineWeekend;
  const curH = layer === 'dot_segment' ? matched?.hourly_weekday_post : dayType === 'weekday' ? m.currentHourly : m.currentWeekend;

  let breakdown = null;
  if (layer === 'crz_entry') {
    const mix = p.periods?.[period === 'pre_2024' ? 'ytd_2025' : period]?.class_mix ?? p.periods?.post_2025?.class_mix;
    breakdown = <ClassMixBar mix={mix} />;
  } else if (layer === 'bt_facility' && p.by_direction) {
    const rows = Object.entries(p.by_direction).map(([dir, d]) => ({ label: dir, before: d?.avg_daily_2024 ?? null, after: d?.avg_daily_2025 ?? null }));
    breakdown = <BeforeAfterBars rows={rows} beforeLabel="2024" afterLabel="2025" color={m.color} />;
  } else if (layer === 'dot_segment' && matched?.by_direction) {
    const rows = Object.entries(matched.by_direction).map(([dir, d]) => ({ label: dir, before: d?.pre_adv ?? null, after: d?.post_adv ?? null }));
    breakdown = <BeforeAfterBars rows={rows} beforeLabel="before" afterLabel="after" color={m.color} />;
  } else if (isAQ && m.comparison) {
    const c = m.comparison;
    breakdown = (
      <table className="tbl">
        <tbody>
          <tr><td>Raw change</td><td>{fmtDelta(c.delta_raw, unit, 2)}</td></tr>
          <tr><td>Control-adjusted ({c.control_site ?? 'control'})</td><td>{fmtDelta(c.delta_adj_control, unit, 2)}</td></tr>
          <tr><td>Reference-adjusted ({c.reference_site ?? 'reference'})</td><td>{fmtDelta(c.delta_adj_reference, unit, 2)}</td></tr>
          <tr><td>95% interval</td><td>{isNum(c.ci_low) && isNum(c.ci_high) ? `${fmtNum(c.ci_low, 2)} to ${fmtNum(c.ci_high, 2)}` : '—'}</td></tr>
          <tr><td>Classification</td><td className={`cls-${c.classification ?? 'insufficient'}`}>{c.classification ?? '—'}</td></tr>
        </tbody>
      </table>
    );
  }

  let note = null;
  if (isAQ) {
    const per = p.periods?.[period];
    note = `months used: ${fmtMonthList(m.comparison?.months_used)}; coverage ${isNum(per?.coverage_pct) ? `${fmtNum(per.coverage_pct, 0)}%` : '—'}; ${fmtInt(per?.smoke_days_excluded)} smoke days excluded${p.role && p.role !== 'site' ? ` · role: ${p.role}` : ''}`;
  } else if (layer === 'crz_entry') {
    const per = p.periods?.[period === 'pre_2024' ? 'ytd_2025' : period];
    note = `${fmtInt(per?.days)} days in period; ${fmtShare(per?.excluded_share)} of entries on excluded roadways; peak share ${fmtShare(per?.peak_share)}. ${m.note ?? ''}`;
  } else if (layer === 'bt_facility') {
    const per = p.periods?.[period];
    note = `${fmtInt(per?.days)} days in period; truck share ${fmtShare(per?.truck_share, 1)}; peak share ${fmtShare(per?.peak_share)}${p.role ? ` · ${p.role}` : ''}`;
  } else if (layer === 'dot_segment') {
    note = p.role === 'matched'
      ? `counted ${(p.pre_months ?? []).map((x) => fmtMonth(x, { short: true })).join(', ') || '—'} and ${(p.post_months ?? []).map((x) => fmtMonth(x, { short: true })).join(', ') || '—'} (${p.comparison_kind === 'same_month' ? 'same calendar month' : 'different months'}); spot counts, not continuous`
      : p.role === 'unpaired'
        ? `counted before and after the toll (${(p.months ?? []).map((x) => fmtMonth(x, { short: true })).join(', ') || '—'}) but never in the same direction, so no before/after comparison is possible`
        : `${p.role === 'post_only' ? 'counted only after' : 'counted only before'} the toll (${(p.months ?? []).map((x) => fmtMonth(x, { short: true })).join(', ') || '—'}); no before/after comparison possible`;
  }

  return (
    <div className="detail">
      <header className="side__head side__head--detail">
        <div className="detail__heading">
          <div className="detail__kicker">{meta?.label}</div>
          <h2 className="detail__title">{p.name ?? p.id}</h2>
        </div>
        <CloseButton ref={closeRef} label="Close detail" onClick={onClose} />
      </header>
      <div className="side__body">
      <div className="detail__meta">{metaLine(p) || ' '}</div>
      <StatRow items={tiles} panel />

      {layer !== 'dot_segment' ? (
        <section className="side__section">
          <div className="detail__section-head"><h3 className="side__section-title">Monthly {isAQ ? 'mean PM2.5' : layer === 'crz_entry' ? 'entries per day' : 'vehicles per day'}</h3>{seriesLoading ? <span className="caption">loading</span> : null}</div>
          <TimelineChart data={timeline} color={m.color} unit={unit} digits={digits} label={isAQ ? 'mean' : 'per day'} id={`tl-${layer}`} />
        </section>
      ) : null}

      <section className="side__section">
        <div className="detail__section-head">
          <h3 className="side__section-title">Hour of day</h3>
          {layer !== 'dot_segment' ? <div className="detail__seg"><Segmented size="sm" label="Day type" value={dayType} onChange={setDayType} options={[{ value: 'weekday', label: 'Weekday' }, { value: 'weekend', label: 'Weekend' }]} /></div> : null}
        </div>
        <HourProfileChart baseline={baseH} current={curH} baselineLabel={m.baselineLabel} currentLabel={m.currentLabel} color={m.color} unit={unit} digits={digits} hour={hour} peak={dayType === 'weekend' && layer !== 'dot_segment' ? [9, 21] : [5, 21]} />
      </section>

      {breakdown ? (
        <section className="side__section">
          <h3 className="side__section-title">{layer === 'crz_entry' ? 'Vehicle class mix' : layer === 'bt_facility' || layer === 'dot_segment' ? 'By direction' : 'Comparison'}</h3>
          {breakdown}
        </section>
      ) : null}

      {note ? <p className="detail__note">{note}</p> : null}

      <table className="sr-only">
        <caption>Chart data for {p.name ?? p.id}</caption>
        <tbody>
          {timeline.map((r) => <tr key={r.x}><th scope="row">{fmtMonth(r.x)}</th><td>{fmtVal(r.y)}</td></tr>)}
          {Array.isArray(curH) ? curH.map((v, h) => <tr key={`h${h}`}><th scope="row">{h}:00</th><td>{fmtVal(baseH?.[h])}</td><td>{fmtVal(v)}</td></tr>) : null}
        </tbody>
      </table>
      </div>
    </div>
  );
}
