import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppState } from '../../state/AppState.jsx';
import { useData, useLazyJson } from '../../lib/data.jsx';
import { COMMUNITY_META, dotTier, featureMetrics, LAYER_META, metaLine } from '../../lib/metrics.js';
import { fmtCompact, fmtDelta, fmtInt, fmtMonth, fmtMonthList, fmtNum, fmtPct, fmtShare, fmtTrafficK, isNum, shortName } from '../../lib/format.js';
import { CLASS_LABELS } from '../../lib/scales.js';
import { plainAir, plainRate } from '../../lib/plain.js';
import { StatRow } from '../charts/StatTile.jsx';
import TimelineChart from '../charts/TimelineChart.jsx';
import HourProfileChart from '../charts/HourProfileChart.jsx';
import BeforeAfterBars, { ClassMixBar } from '../charts/BeforeAfterBars.jsx';
import IntervalBars, { MonthChips, StatusBadge } from '../charts/IntervalBar.jsx';
import CloseButton from '../CloseButton.jsx';
import Segmented from '../Segmented.jsx';

const SERIES_FILE = { aq_monitor: 'aq_series', bt_facility: 'bt_series', crz_entry: 'crz_series', dot_segment: 'dot_matched' };
const PERS_TEXT = { reversed: 'Reversed in 2026', strengthened: 'Strengthened in 2026', confirmed: 'Confirmed in 2026', weakened: 'Weakened in 2026', inconclusive: 'Inconclusive so far' };
const STRONG = new Set(['reversed', 'strengthened', 'confirmed']);
const daysInMonth = (ym) => { const [y, m] = ym.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).getUTCDate(); };
const DOT_DIRECTIONS = { NB: 'Northbound', SB: 'Southbound', EB: 'Eastbound', WB: 'Westbound' };
const fmtDot = (v) => (isNum(v) ? (Math.abs(v) >= 1000 ? `${fmtNum(v / 1000, 1)}k` : fmtNum(v, 0)) : '—');

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

function Section({ title, aside, children }) {
  return (
    <section className="side__section">
      <div className="detail__section-head"><h3 className="side__section-title">{title}</h3>{aside ?? null}</div>
      {children}
    </section>
  );
}

/** Row for IntervalBars from a {pct, ci_low, ci_high, status} block. */
const ivl = (label, v, sub) => (v ? { label, sub, est: v.pct, lo: v.ci_low, hi: v.ci_high, status: v.status } : null);

/** Compact supported / uncertain verdict for a crossing, shown beside its top-level comparison. */
function TrafficSupport({ p, period }) {
  const ev = p.evidence;
  if (!ev?.full_year) return null;
  const fy = ev.full_year;
  const j25 = ev.jan_aug?.['2025'] ?? null;
  const j26 = ev.jan_aug?.['2026'] ?? null;
  const is26 = period === 'post_2026_ytd';
  const main = is26 && j26
    ? ivl('Jan–Aug 2026 vs 2024', j26, `${fmtInt(j26.days_2024)} + ${fmtInt(j26.days_2026)} matched days`)
    : ivl('2025 vs 2024', fy, `${fmtInt(fy.matched_days_2024)} + ${fmtInt(fy.matched_days_2025)} matched days`);
  return (
    <Section title="Is the change supported?" aside={<StatusBadge status={main?.status} />}>
      <IntervalBars rows={[main]} />
    </Section>
  );
}

/** Second-pipeline evidence for a monitor: raw vs weather-adjusted, coverage, the control reading, persistence. */
function AirEvidence({ p, period }) {
  const ev = p.evidence;
  const is26 = period === 'post_2026_ytd';
  const e = is26 ? ev?.jan_aug?.['2026'] : ev?.full_year;
  const c = p.comparisons?.post_2025_vs_pre_2024;
  const c26 = p.comparisons?.post_2026ytd_vs_ytd_2025;
  if (!ev || !e) {
    return (
      <Section title="Is the change supported?" aside={<StatusBadge status="no_baseline" />}>
        <p className="detail__hint">This monitor is outside the validated 15-site set: too little data for a before/after comparison. Shown as not available, never as zero.</p>
      </Section>
    );
  }
  const noBase = e.class === 'no_baseline';
  const j25 = ev.jan_aug?.['2025'] ?? null;
  const j26 = ev.jan_aug?.['2026'] ?? null;
  const rowFor = (label, j) => {
    if (!j || j.class === 'no_baseline') return { label, sub: 'Jan 5–Aug 31', est: null, lo: null, hi: null, status: 'no_baseline' };
    if (isNum(j.adj_delta)) return { label, sub: 'weather-adjusted', est: j.adj_delta, lo: j.adj_ci_low, hi: j.adj_ci_high, status: j.adj_status ?? 'none' };
    return { label, sub: 'raw only', est: j.delta_raw, lo: j.ci_low, hi: j.ci_high, status: j.raw_status ?? 'none' };
  };
  const persLabel = STRONG.has(ev.persistence) ? ev.persistence : STRONG.has(ev.persistence_adjusted) ? ev.persistence_adjusted : ev.persistence;
  return (
    <>
      <Section title={is26 ? 'Jan–Aug 2026 vs 2024' : 'Raw vs weather-adjusted'} aside={<StatusBadge status={e.class} />}>
        {noBase ? (
          <>
            <p className="detail__hint">{e.note ? `${e.note}.` : 'No eligible 2024 baseline: the monitor was offline or moved, so no before/after estimate exists.'} Missing data are shown as unavailable, never as zero.</p>
            {!is26 && c26?.coverage_ok && isNum(c26.pre_mean) ? (
              <p className="detail__hint">For context only: Jan–Aug 2026 read {fmtNum(c26.post_mean, 2)} µg/m³ against {fmtNum(c26.pre_mean, 2)} in Jan–Aug 2025 ({fmtDelta(c26.delta_raw, 'µg/m³', 2)}). That compares two post-toll years, so it is not a before/after result.</p>
            ) : null}
          </>
        ) : (
          <>
            <IntervalBars
              unit="µg/m³"
              digits={2}
              rows={[
                { label: 'Raw change', sub: 'observed', est: e.delta_raw, lo: e.ci_low, hi: e.ci_high, status: e.raw_status },
                { label: 'Weather-adjusted', sub: 'model-derived', est: e.adj_delta, lo: e.adj_ci_low, hi: e.adj_ci_high, status: e.adj_status ?? 'none' },
              ]}
            />
            <p className="detail__plain"><strong>In plain words:</strong> <span className="num">{fmtDelta(isNum(e.adj_delta) ? e.adj_delta : e.delta_raw, 'µg/m³', 2)}</span>{isNum(e.adj_delta) ? ' after weather adjustment' : ' raw'} means {plainAir(isNum(e.adj_delta) ? e.adj_delta : e.delta_raw, e.pre_mean, { status: e.class, base: is26 ? 'Jan–Aug 2024' : '2024' })}.</p>
            <MonthChips months={e.months} total={is26 ? 8 : 12} label={is26 ? 'matched months, Jan–Aug' : 'matched months'} />
            <p className="detail__hint">
              {is26 ? 'Jan 5–Aug 31 only.' : e.month_count === 12 ? 'All 12 months eligible: a complete-year estimate.' : `Within the Jan–Dec frame this monitor had ${e.month_count} eligible matched months, so this is a partial-year estimate, not a full-year one.`}
              {' '}Valid days: {fmtInt(e.days_2024)} in 2024, {fmtInt(is26 ? e.days_2026 : e.days_2025)} in {is26 ? '2026' : '2025'}. Values are µg/m³: micrograms of fine soot per cubic metre of air. The bars are 95% intervals, the range of doubt; the weather adjustment removes what a regional weather proxy would explain and corrects for testing many monitors at once.
            </p>
            {e.raw_status === 'increase' && e.class !== 'increase' ? <p className="detail__hint">The raw rise is supported but the weather-adjusted result is not, so this monitor is classed as uncertain: it may have worsened.</p> : null}
          </>
        )}
      </Section>
      {!is26 && c && isNum(c.delta_adj_control) ? (
        <Section title="Against the citywide trend">
          <table className="tbl">
            <tbody>
              <tr><td>This monitor, shared months</td><td>{fmtDelta(c.site_delta_on_control_months ?? c.delta_raw, 'µg/m³', 2)}</td></tr>
              <tr><td>Control site ({c.control_site ?? 'Van Wyck'})</td><td>{isNum(c.control_pre_mean) && isNum(c.control_post_mean) ? fmtDelta(c.control_post_mean - c.control_pre_mean, 'µg/m³', 2) : '—'}</td></tr>
              <tr><td>Difference</td><td className={c.relative_to_control === 'beat control' ? 'cls-decrease' : c.relative_to_control === 'lagged control' ? 'cls-uncertain' : ''}>{fmtDelta(c.delta_adj_control, 'µg/m³', 2)}{c.relative_to_control ? ` · ${c.relative_to_control}` : ''}</td></tr>
            </tbody>
          </table>
          <p className="detail__hint">Our own method: the monitor's matched-month change minus the Health Department control site's change on the same months ({fmtMonthList(c.delta_adj_control_months ?? c.months_used)}). Descriptive, no interval. "Lagged" means it fell less than the control; it is not a supported increase.</p>
        </Section>
      ) : null}
      <Section title="Jan–Aug, three years" aside={<StatusBadge status={persLabel} text={PERS_TEXT[persLabel] ?? persLabel} />}>
        <IntervalBars unit="µg/m³" digits={2} rows={[rowFor('2025 vs 2024', j25), rowFor('2026 vs 2024', j26)]} />
        <p className="detail__hint">Weather-adjusted where it could be estimated, raw otherwise; both against the same months of 2024. 2026 is not a complete year.{ev.persistence !== ev.persistence_adjusted ? ` Persistence: ${ev.persistence} (raw), ${ev.persistence_adjusted} (weather-adjusted).` : ''}</p>
      </Section>
    </>
  );
}

/** Neighborhood (UHF42) context card: poverty and asthma burden before the toll, plus what sits inside it. */
function CommunityDetail({ p, onClose, closeRef }) {
  const { geo } = useData();
  const { period } = useAppState();
  const frame = period === 'pre_2024' ? 'post_2025' : period;
  const here = (fc, layer) => (fc?.features ?? []).filter((f) => f.properties?.uhf42_name === p.name).map((f) => ({ props: f.properties, m: featureMetrics(f.properties, layer, frame, null, 'change'), layer }));
  const items = [...here(geo.aq_monitor, 'aq_monitor'), ...here(geo.bt_facility, 'bt_facility')];
  const tiles = [
    { label: 'Residents below the poverty line', value: isNum(p.poverty_pct) ? `${fmtNum(p.poverty_pct, 1)}%` : '—', sub: `${isNum(p.poverty_pct) ? `${plainRate(p.poverty_pct * 100)} residents` : '—'} · ACS 2019–23` },
    { label: 'Child asthma ER visits', value: fmtNum(p.asthma_ed_children, 1), sub: `per 10,000 ages 5–17 in ${p.health_period ?? '2023'}, i.e. ${plainRate(p.asthma_ed_children)} children that year` },
    { label: 'Adult asthma ER visits', value: fmtNum(p.asthma_ed_adults, 1), sub: `per 10,000 adults (age-adjusted) in ${p.health_period ?? '2023'}, i.e. ${plainRate(p.asthma_ed_adults)} adults` },
  ];
  return (
    <div className="detail">
      <header className="side__head side__head--detail">
        <div className="detail__heading">
          <div className="detail__kicker">{COMMUNITY_META.label}</div>
          <h2 className="detail__title">{p.name}</h2>
        </div>
        <CloseButton ref={closeRef} label="Close detail" onClick={onClose} />
      </header>
      <div className="side__body">
        <div className="detail__meta">{[p.borough, `UHF42 neighborhood ${p.uhf_code ?? ''}`.trim()].filter(Boolean).join(' · ')}</div>
        <p className="community__note"><strong>Pre-existing context.</strong> These describe the neighborhood before the toll: 2023 is the newest year published (health data lag about two years). Historical vulnerability is not a new harm caused by the policy.</p>
        <StatRow items={tiles} panel />
        <Section title="Monitors and crossings here">
          {items.length ? (
            <ul className="klist">
              {items.map(({ props, m, layer }) => {
                const key = layer === 'aq_monitor' ? m.classification : m.support;
                return (
                  <li key={`${layer}:${props.id}`}>
                    <span>{shortName(props.name)}</span>
                    <span className={`num cls-${key ?? 'no_baseline'}`}>{CLASS_LABELS[key] ?? 'not available'}</span>
                    <span className="num sub">{layer === 'aq_monitor' ? (isNum(m.evidence?.adj_delta) ? fmtDelta(m.evidence.adj_delta, 'µg/m³', 2) : isNum(m.change) ? fmtPct(m.change) : '—') : fmtPct(m.change)}</span>
                  </li>
                );
              })}
            </ul>
          ) : <p className="detail__hint">No monitor or MTA crossing sits inside this neighborhood.</p>}
          <p className="detail__hint">Verdicts for {frame === 'post_2026_ytd' ? 'Jan–Aug 2026 vs 2024' : '2025 vs 2024'}. Monitors show the weather-adjusted change; crossings the change in vehicles per day.</p>
        </Section>
        <p className="detail__note">
          Annual PM2.5 here: {fmtNum(p.pm25_2024, 1)} µg/m³ in 2024 (NYCCAS neighborhood estimate). Sources: NYC DOHMH Environment &amp; Health Data Portal (asthma ED visits 2023; poverty ACS 2019–23); NYCCAS annual air quality.
        </p>
      </div>
    </div>
  );
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

  useEffect(() => {
    if (layer === 'dot_segment' && period === 'pre_2024' && p?.role !== 'matched' && p?.last_month >= '2025-01') onClose?.();
  }, [layer, period, p, onClose]);

  const isCommunity = layer === 'uhf42';
  const { data: series, loading: seriesLoading } = useLazyJson(layer && !isCommunity ? SERIES_FILE[layer] : null, Boolean(p) && !isCommunity);
  const m = useMemo(() => (p && !isCommunity ? featureMetrics(p, layer, period, null, metric) : null), [p, layer, period, metric, isCommunity]);
  const timeline = useMemo(() => {
    if (isCommunity) return [];
    const all = buildTimeline(layer, p, series);
    if (layer === 'crz_entry' && period === 'pre_2024') return all.filter((r) => r.x >= '2025-01');
    if (period === 'pre_2024') return all.filter((r) => r.x.startsWith('2024-'));
    if (period === 'post_2025') return all.filter((r) => r.x >= '2024-01' && r.x < '2026-01');
    return all.filter((r) => r.x >= (p?.name === 'Hunts Point' ? '2025-01' : '2024-01'));
  }, [layer, p, series, period, isCommunity]);
  if (!p) return null;
  if (isCommunity) return <CommunityDetail p={p} onClose={onClose} closeRef={closeRef} />;
  if (!m) return null;
  const matched = layer === 'dot_segment' ? matchedFor(p, series) : null;
  const meta = LAYER_META[layer];
  const isAQ = layer === 'aq_monitor';
  const isBT = layer === 'bt_facility';
  const unit = isAQ ? 'µg/m³' : '';
  const digits = isAQ ? 2 : 0;
  const fmtVal = (v) => (isAQ ? fmtNum(v, 2) : layer === 'dot_segment' ? fmtDot(v) : layer === 'bt_facility' || layer === 'crz_entry' ? fmtTrafficK(v) : fmtCompact(v));
  const isBaseline = period === 'pre_2024';
  const isEntryBefore = layer === 'crz_entry' && isBaseline;
  const isBridgeBefore = layer === 'bt_facility' && isBaseline;
  const isDotLater = layer === 'dot_segment' && !isBaseline;
  const isDotMatched = layer === 'dot_segment' && p.role === 'matched';
  const isDotSingle = layer === 'dot_segment' && !isDotMatched;
  const baselineExists = isNum(m.baseline);
  const currentExists = isNum(m.value);
  const tiles = isEntryBefore ? [] : isDotSingle
    ? (currentExists ? [{ label: 'Observed traffic', value: fmtVal(m.value), sub: meta?.unit }] : [])
    : isBaseline
    ? (currentExists ? [{ label: isBridgeBefore ? '2024, before the toll' : '2024 baseline', value: fmtVal(m.value), sub: isAQ ? 'µg/m³' : meta?.unit }] : [])
    : isAQ
    ? [
        ...(baselineExists ? [{ label: m.baselineLabel || 'before', value: fmtVal(m.baseline), sub: 'mean µg/m³' }] : []),
        ...(currentExists ? [{ label: m.currentLabel || 'after', value: fmtVal(m.value), sub: 'mean µg/m³' }] : []),
      ]
    : [
        ...(baselineExists ? [{ label: isDotLater ? '2024 baseline' : m.baselineLabel || 'before', value: fmtVal(m.baseline), sub: isAQ ? 'mean µg/m³' : meta?.unit }] : []),
        ...(currentExists ? [{ label: isDotLater ? '2025 follow-up' : m.currentLabel || 'after', value: fmtVal(m.value), sub: isAQ ? 'mean µg/m³' : meta?.unit }] : []),
        ...(isNum(m.change) ? [{ label: isDotLater ? 'Change from 2024' : 'Change', value: fmtPct(m.change), sub: isAQ ? (isNum(m.comparison?.delta_adj_control) ? `${fmtDelta(m.comparison.delta_adj_control, 'µg/m³', 2)} adj.` : '') : 'vs baseline', tone: isAQ && Math.abs(m.change) < 0.05 ? 0 : m.change }] : []),
      ];

  const comparisonH = isBaseline ? null : layer === 'dot_segment' ? matched?.hourly_weekday_pre : dayType === 'weekday' ? m.baselineHourly : m.baselineWeekend;
  const curH = layer === 'dot_segment' ? (isBaseline ? matched?.hourly_weekday_pre : matched?.hourly_weekday_post) : dayType === 'weekday' ? m.currentHourly : m.currentWeekend;
  const baseH = Array.isArray(comparisonH) && Array.isArray(curH) && comparisonH.every((v, i) => v === curH[i]) ? null : comparisonH;
  const hourlyUnit = isAQ ? 'µg/m³' : 'vehicles/hour';
  const monthlyUnit = isAQ ? 'µg/m³' : 'vehicles/day';
  const hasHourly = (values) => Array.isArray(values) && values.some(isNum);
  const showMonthly = layer !== 'dot_segment' && timeline.some((r) => isNum(r.y));
  const showHourly = hasHourly(baseH) || hasHourly(curH);
  const neutralCurrent = !isBaseline && (!isNum(m.change) || isAQ);
  const chartColor = neutralCurrent ? 'var(--blue)' : m.color;
  const baselineYear = Number((m.baselineLabel ?? '').match(/\b(20\d{2})\b/)?.[1]) || null;
  const currentYear = period === 'post_2026_ytd' ? 2026 : period === 'post_2025' ? 2025 : 2024;
  const aqPeriod = isAQ ? p.periods?.[period] : null;

  let breakdown = null;
  if (layer === 'crz_entry') {
    const mix = p.periods?.[period === 'pre_2024' ? 'ytd_2025' : period]?.class_mix ?? p.periods?.post_2025?.class_mix;
    if (Object.values(mix ?? {}).some((v) => isNum(v) && v > 0)) breakdown = <ClassMixBar mix={mix} />;
  } else if (layer === 'dot_segment' && matched?.by_direction) {
    const rows = Object.entries(matched.by_direction).map(([dir, d]) => ({ label: DOT_DIRECTIONS[dir] ?? dir, before: isBaseline ? null : d?.pre_adv ?? null, after: isBaseline ? d?.pre_adv ?? null : d?.post_adv ?? null }));
    if (rows.some((r) => isNum(r.before) || isNum(r.after))) breakdown = <BeforeAfterBars rows={rows} beforeLabel="2024 baseline" afterLabel={isBaseline ? '2024 baseline' : '2025 follow-up'} color={m.color} showBefore={!isBaseline} valueFormatter={fmtDot} />;
  } else if (isAQ && !isBaseline && m.comparison) {
    const c = m.comparison;
    const hasAdjusted = isNum(c.delta_adj_control);
    const hasResult = ['improved', 'unchanged', 'worsened'].includes(c.classification);
    const technicalRows = [
      isNum(c.delta_raw) ? ['Observed change at this monitor', fmtDelta(c.delta_raw, unit, 2)] : null,
      hasAdjusted ? ['Compared with Van Wyck control', fmtDelta(c.delta_adj_control, unit, 2)] : null,
      isNum(c.delta_adj_reference) ? ['Compared with Queens College reference', fmtDelta(c.delta_adj_reference, unit, 2)] : null,
      isNum(c.ci_low) && isNum(c.ci_high) ? ['95% uncertainty range', `${fmtNum(c.ci_low, 2)} to ${fmtNum(c.ci_high, 2)}`] : null,
      c.months_used?.length ? ['Months used', fmtMonthList(c.months_used)] : null,
      isNum(aqPeriod?.coverage_pct) ? ['Coverage', `${fmtNum(aqPeriod.coverage_pct, 0)}%`] : null,
      isNum(aqPeriod?.smoke_days_excluded) ? ['Smoke days excluded', fmtInt(aqPeriod.smoke_days_excluded)] : null,
      p.role && p.role !== 'site' ? ['Monitor role', p.role] : null,
    ].filter(Boolean);
    if (hasAdjusted || hasResult) {
      breakdown = (
        <>
          <table className="tbl"><tbody>
            {hasAdjusted ? <tr><td>Difference from the citywide trend</td><td>{fmtDelta(c.delta_adj_control, unit, 2)}</td></tr> : null}
            {hasResult ? <tr><td>Result</td><td className={`cls-${c.classification}`}>{c.classification[0].toUpperCase() + c.classification.slice(1)}</td></tr> : null}
          </tbody></table>
          {hasAdjusted ? <p className="detail__note">Negative values mean the monitor improved more than the citywide trend.</p> : null}
          {technicalRows.length ? <details className="disclosure"><summary className="text-btn disclosure__summary">Details / Methodology <svg className="chev" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><path d="M2 4.5l4 4 4-4" /></svg></summary><div className="disclosure__body"><table className="tbl tbl--method"><tbody>{technicalRows.map(([label, value]) => <tr key={label}><td>{label}</td><td>{value}</td></tr>)}</tbody></table></div></details> : null}
        </>
      );
    }
  }

  let note = null;
  if (isAQ) {
    const per = p.periods?.[period];
    const bits = [
      isBaseline ? '2024 baseline' : null,
      isNum(per?.coverage_pct) ? `coverage ${fmtNum(per.coverage_pct, 0)}%` : null,
      isNum(per?.smoke_days_excluded) ? `${fmtInt(per.smoke_days_excluded)} regional smoke days excluded` : null,
      p.role && p.role !== 'site' ? `Health Department ${p.role} site` : null,
      p.geometry_note || null,
      p.evidence?.limitation || null,
    ].filter(Boolean);
    note = bits.length ? `${bits.join('; ')}.` : null;
  } else if (layer === 'crz_entry') {
    const per = p.periods?.[period === 'pre_2024' ? 'ytd_2025' : period];
    note = isEntryBefore ? null : `${fmtInt(per?.days)} days in period; ${fmtShare(per?.excluded_share)} of entries on excluded roadways; peak share ${fmtShare(per?.peak_share)}. ${m.note ?? ''}`;
  } else if (layer === 'bt_facility') {
    note = null;
  } else if (layer === 'dot_segment') {
    const tier = dotTier(p);
    const pre = (p.pre_months ?? []).map((x) => fmtMonth(x, { short: true })).join(', ');
    const post = (p.post_months ?? []).map((x) => fmtMonth(x, { short: true })).join(', ');
    note = isDotMatched
      ? isBaseline
        ? `Counted ${pre}; spot count, not continuous; ${tier?.label ?? 'matched location'}.`
        : `Counted ${pre} and ${post} (${tier?.label ?? (p.comparison_kind === 'same_month' ? 'same calendar month' : 'different months')}); spot counts, not continuous; describes this spot only, not the city.`
      : p.role === 'unpaired'
        ? `Counted ${fmtMonth(p.last_month)}. This location has no matched before/after observation, so no comparison is available.`
        : `Counted ${fmtMonth(p.last_month)}. This location has one usable observation period, so no before/after comparison is available.`;
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
      {isEntryBefore ? <p className="detail__meta">Entry-point counts begin Jan. 5, 2025, so there is no comparable point-level 2024 entry count.</p> : null}
      <StatRow items={tiles} panel />

      {isBT && period !== 'pre_2024' ? <TrafficSupport p={p} period={period} /> : null}
      {isAQ && breakdown ? (
        <section className="side__section">
          <h3 className="side__section-title">Comparison with the citywide trend</h3>
          {breakdown}
        </section>
      ) : null}
      {isAQ && period !== 'pre_2024' ? (
        <details className="disclosure">
          <summary className="text-btn disclosure__summary">Additional interval evidence <svg className="chev" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><path d="M2 4.5l4 4 4-4" /></svg></summary>
          <div className="disclosure__body"><AirEvidence p={p} period={period} /></div>
        </details>
      ) : null}

      {showMonthly ? (
        <section className="side__section">
          <div className="detail__section-head"><h3 className="side__section-title detail__chart-title">{isAQ ? 'Monthly PM2.5' : layer === 'crz_entry' && period !== 'post_2026_ytd' ? 'Monthly entries per day' : 'Monthly traffic'} ({monthlyUnit})</h3>{isEntryBefore ? <span className="caption">begins Jan. 2025</span> : seriesLoading ? <span className="caption">loading</span> : null}</div>
          <TimelineChart data={timeline} color={chartColor} unit={monthlyUnit} digits={digits} label={isAQ ? 'PM2.5' : 'traffic'} marker={isBaseline ? null : '2025-01'} id={`tl-${layer}`} baselineYear={isAQ && !isBaseline ? baselineYear : null} currentYear={isAQ && !isBaseline ? currentYear : null} baselineLabel={m.baselineLabel} currentLabel={m.currentLabel} />
        </section>
      ) : null}

      {showHourly ? <section className="side__section">
        <div className="detail__section-head">
          <h3 className="side__section-title detail__chart-title">{isAQ ? 'PM2.5 by hour' : 'Traffic by hour'} ({hourlyUnit})</h3>
          {layer !== 'dot_segment' ? <div className="detail__seg"><Segmented size="sm" label="Compare weekday or weekend hourly patterns" value={dayType} onChange={setDayType} options={[{ value: 'weekday', label: 'Weekday' }, { value: 'weekend', label: 'Weekend' }]} /></div> : null}
        </div>
        <HourProfileChart baseline={baseH} current={curH} baselineLabel={m.baselineLabel} currentLabel={isBaseline ? '2024' : m.currentLabel} color={chartColor} unit={hourlyUnit} digits={digits} hour={hour} peak={dayType === 'weekend' && layer !== 'dot_segment' ? [9, 21] : [5, 21]} />
      </section> : null}

      {breakdown && !isAQ ? (
        <section className="side__section">
          <div className="detail__section-head"><h3 className="side__section-title">{layer === 'crz_entry' ? 'Vehicle class mix' : layer === 'bt_facility' || layer === 'dot_segment' ? 'Traffic by direction (vehicles/day)' : 'Comparison'}</h3>{isEntryBefore ? <span className="caption">2025 observed entries</span> : null}</div>
          {breakdown}
        </section>
      ) : null}

      {note ? <p className="detail__note">{note}</p> : null}

      {timeline.some((r) => isNum(r.y)) || hasHourly(curH) ? <table className="sr-only">
        <caption>Chart data for {p.name ?? p.id}</caption>
        <tbody>
          {timeline.filter((r) => isNum(r.y)).map((r) => <tr key={r.x}><th scope="row">{fmtMonth(r.x)}</th><td>{fmtVal(r.y)}</td></tr>)}
          {Array.isArray(curH) ? curH.map((v, h) => <tr key={`h${h}`}><th scope="row">{h}:00</th>{Array.isArray(baseH) ? <td>{fmtVal(baseH[h])}</td> : null}<td>{fmtVal(v)}</td></tr>) : null}
        </tbody>
      </table> : null}
      </div>
    </div>
  );
}
