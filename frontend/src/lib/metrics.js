// Per-feature metric resolution shared by circles, glyphs, flow lines, legend and the detail panel.
import { isNum } from './format.js';
import { metricColor } from './scales.js';

export const POINT_LAYERS = ['aq_monitor', 'crz_entry', 'bt_facility', 'dot_segment'];
export const GLYPH_LAYERS = ['aq_monitor', 'crz_entry', 'bt_facility'];

export const LAYER_META = {
  crz_entry: { file: 'crz_entry_points', label: 'Zone entry point', short: 'Zone entries', unit: 'vehicles / weekday', baselineKey: 'ytd_2025', baselineLabel: 'Jan–Aug 2025' },
  bt_facility: { file: 'bt_facilities', label: 'MTA bridge or tunnel', short: 'Bridges & tunnels', unit: 'vehicles / day', baselineKey: 'pre_2024', baselineLabel: '2024, before the toll' },
  aq_monitor: { file: 'aq_monitors', label: 'NYCCAS PM2.5 monitor', short: 'PM2.5 monitors', unit: 'µg/m³', baselineKey: 'pre_2024', baselineLabel: '2024, before the toll' },
  dot_segment: { file: 'dot_segments', label: 'NYC DOT count location', short: 'DOT counts', unit: 'vehicles / day', baselineKey: null, baselineLabel: 'before' },
};
/** The neighborhood polygons are selectable too (community context), but they are not a point layer. */
export const COMMUNITY_META = { file: 'uhf42', label: 'Neighborhood context', short: 'Neighborhoods', unit: '' };

export const PERIODS = ['pre_2024', 'post_2025', 'post_2026_ytd'];
export const PERIOD_LABELS = { pre_2024: '2024 · before the toll', post_2025: '2025 · year one', post_2026_ytd: '2026 · Jan–Aug so far' };

/** The existing pipeline's control-relative classes, mapped onto the four interval-based classes. */
export const LEGACY_CLASS = { improved: 'decrease', unchanged: 'uncertain', worsened: 'increase', insufficient: 'no_baseline' };

const AQ_COMPARISON = { post_2025: 'post_2025_vs_pre_2024', post_2026_ytd: 'post_2026ytd_vs_ytd_2024' };
const BT_BASELINE = { post_2025: 'pre_2024', post_2026_ytd: 'ytd_2024' };
const BT_CHANGE = { post_2025: 'pct_2025_vs_2024', post_2026_ytd: 'pct_2026ytd_vs_2024ytd' };

const arr24 = (a) => (Array.isArray(a) && a.length === 24 ? a : null);
const pctOf = (cur, base) => (isNum(cur) && isNum(base) && base !== 0 ? ((cur - base) / base) * 100 : null);

function hourly(props, key, weekend = false) {
  return arr24(props?.periods?.[key]?.[weekend ? 'hourly_weekend' : 'hourly_weekday']);
}

/**
 * Second-pipeline evidence for a crossing in the current frame: { pct, lo, hi, status, frame, label }.
 * status: 'increase' | 'decrease' | 'uncertain' | 'limited' (coverage-limited full-day estimate).
 */
export function btEvidence(p, period) {
  const ev = p?.evidence;
  if (!ev) return null;
  if (period === 'post_2025' && ev.full_year) {
    const f = ev.full_year;
    return { pct: f.pct, lo: f.ci_low, hi: f.ci_high, status: f.status, frame: 'full_year', label: 'Jan 5–Dec 31, 2025 vs 2024' };
  }
  if (period === 'post_2026_ytd' && ev.jan_aug?.['2026']) {
    const j = ev.jan_aug['2026'];
    return { pct: j.pct, lo: j.ci_low, hi: j.ci_high, status: j.status, frame: 'jan_aug_2026', label: 'Jan 5–Aug 31, 2026 vs 2024' };
  }
  return null;
}

/** Second-pipeline evidence for a monitor in the current frame (raw + weather-adjusted + class), or null. */
export function aqEvidence(p, period) {
  const ev = p?.evidence;
  if (!ev) return null;
  if (period === 'post_2025') return ev.full_year ? { ...ev.full_year, frame: 'full_year', label: 'Jan 5–Dec 31, 2025 vs 2024' } : null;
  if (period === 'post_2026_ytd') return ev.jan_aug?.['2026'] ? { ...ev.jan_aug['2026'], frame: 'jan_aug_2026', label: 'Jan 5–Aug 31, 2026 vs 2024' } : null;
  return null;
}

/**
 * Resolve before/after/change for a feature under the current period (and optional hour).
 * Returns nulls rather than throwing for anything missing.
 */
export function featureMetrics(props, layer, period, hour = null, metric = 'change') {
  const p = props || {};
  const m = { layer, value: null, baseline: null, change: null, classification: null, support: null, ci: null, evidence: null, baselineHourly: null, currentHourly: null, baselineWeekend: null, currentWeekend: null, baselineLabel: '', currentLabel: PERIOD_LABELS[period] ?? period, comparison: null, note: null };

  if (layer === 'crz_entry') {
    // These detectors were switched on with the toll (Jan 5 2025), so the only like-for-like change is
    // Jan–Aug 2026 against Jan–Aug 2025. For 2025 itself there is no earlier level: no baseline, no change.
    const yearTwo = period === 'post_2026_ytd';
    const cur = period === 'pre_2024' ? null : p.periods?.[period];
    m.baselineLabel = yearTwo ? 'Jan–Aug 2025' : 'before the toll';
    m.currentLabel = yearTwo ? 'Jan–Aug 2026' : PERIOD_LABELS[period];
    m.value = cur?.avg_weekday_entries ?? null;
    m.baseline = yearTwo ? p.periods?.ytd_2025?.avg_weekday_entries ?? null : null;
    m.change = yearTwo ? p.change?.weekday_pct_2026ytd_vs_2025ytd ?? p.change?.pct_2026ytd_vs_2025ytd ?? null : null;
    m.baselineHourly = yearTwo ? hourly(p, 'ytd_2025') : null;
    m.currentHourly = period === 'pre_2024' ? null : hourly(p, period);
    m.baselineWeekend = yearTwo ? hourly(p, 'ytd_2025', true) : null;
    m.currentWeekend = period === 'pre_2024' ? null : hourly(p, period, true);
    m.note = yearTwo ? 'Change is Jan–Aug 2026 vs Jan–Aug 2025 (no counts exist here before the toll).' : 'No counts exist at these detectors before Jan 5 2025, so there is no earlier level to compare with.';
  } else if (layer === 'bt_facility') {
    const baseKey = BT_BASELINE[period] ?? 'pre_2024';
    m.baselineLabel = baseKey === 'ytd_2024' ? 'Jan–Aug 2024' : '2024, before the toll';
    m.value = p.periods?.[period]?.avg_daily ?? null;
    m.baseline = p.periods?.[baseKey]?.avg_daily ?? null;
    m.change = period === 'pre_2024' ? null : p.change?.[BT_CHANGE[period]] ?? pctOf(m.value, m.baseline);
    m.baselineHourly = hourly(p, 'pre_2024');
    m.currentHourly = hourly(p, period);
    m.baselineWeekend = hourly(p, 'pre_2024', true);
    m.currentWeekend = hourly(p, period, true);
    const e = period === 'pre_2024' ? null : btEvidence(p, period);
    m.evidence = e;
    m.support = e?.status ?? null;
    m.ci = e && isNum(e.lo) && isNum(e.hi) ? [e.lo, e.hi] : null;
  } else if (layer === 'aq_monitor') {
    const key = AQ_COMPARISON[period];
    const c = key ? p.comparisons?.[key] ?? null : null;
    const e = period === 'pre_2024' ? null : aqEvidence(p, period);
    // In "change" mode the before / after figures are the matched-month means the verdict was computed from
    // (the reconciled ones when they exist, so they agree with the interval shown), and "amount only" shows the
    // plain period mean.
    const wantMatched = metric !== 'absolute' && period !== 'pre_2024';
    const useEv = wantMatched && e && isNum(e.pre_mean) && isNum(e.post_mean);
    const useOld = !useEv && wantMatched && isNum(c?.pre_mean) && isNum(c?.post_mean);
    const baseKey = period === 'post_2026_ytd' ? 'ytd_2024' : 'pre_2024';
    m.comparison = c;
    m.evidence = e;
    m.baselineLabel = period === 'post_2026_ytd' ? 'Jan–Aug 2024' : '2024, before the toll';
    m.value = useEv ? e.post_mean : useOld ? c.post_mean : p.periods?.[period]?.mean ?? c?.post_mean ?? null;
    m.baseline = period === 'pre_2024' ? null : useEv ? e.pre_mean : useOld ? c.pre_mean : p.periods?.[baseKey]?.mean ?? c?.pre_mean ?? null;
    m.change = period === 'pre_2024' ? null : useEv ? e.pct_raw ?? pctOf(m.value, m.baseline) : useOld ? c.pct_raw ?? pctOf(m.value, m.baseline) : pctOf(m.value, m.baseline);
    m.classification = period === 'pre_2024' ? null : e?.class ?? LEGACY_CLASS[c?.classification ?? p.classification] ?? 'no_baseline';
    m.support = m.classification;
    m.ci = e && isNum(e.adj_ci_low) && isNum(e.adj_ci_high) ? [e.adj_ci_low, e.adj_ci_high] : e && isNum(e.ci_low) && isNum(e.ci_high) ? [e.ci_low, e.ci_high] : null;
    m.baselineHourly = hourly(p, 'pre_2024') ?? hourly(p, 'ytd_2025');
    m.currentHourly = hourly(p, period);
    m.baselineWeekend = hourly(p, 'pre_2024', true) ?? hourly(p, 'ytd_2025', true);
    m.currentWeekend = hourly(p, period, true);
  } else if (layer === 'dot_segment') {
    m.baselineLabel = 'before';
    m.currentLabel = 'after';
    m.value = p.post_adv ?? p.latest_adv ?? null;
    m.baseline = p.pre_adv ?? null;
    m.change = p.role === 'matched' ? p.pct_change ?? pctOf(m.value, m.baseline) : null;
  }

  if (isNum(hour) && hour >= 0 && hour < 24 && layer !== 'dot_segment') {
    const cur = m.currentHourly?.[hour] ?? null;
    const base = m.baselineHourly?.[hour] ?? null;
    m.value = isNum(cur) ? cur : null;
    m.baseline = isNum(base) ? base : null;
    m.change = period === 'pre_2024' ? null : pctOf(cur, base);
  }

  m.color = metricColor(m, metric);
  return m;
}

/** Layer-wide maxima used for stable size scales (computed once per dataset). */
export function layerMaxima(fc, layer) {
  const out = { value: 0, hourly: 0 };
  for (const f of fc?.features ?? []) {
    const p = f.properties || {};
    if (layer === 'dot_segment') {
      out.value = Math.max(out.value, p.latest_adv ?? 0, p.post_adv ?? 0, p.pre_adv ?? 0);
      continue;
    }
    for (const per of Object.values(p.periods || {})) {
      const v = layer === 'aq_monitor' ? per?.mean : layer === 'crz_entry' ? per?.avg_weekday_entries : per?.avg_daily;
      if (isNum(v)) out.value = Math.max(out.value, v);
      for (const h of per?.hourly_weekday ?? []) if (isNum(h)) out.hourly = Math.max(out.hourly, h);
      for (const h of per?.hourly_weekend ?? []) if (isNum(h)) out.hourly = Math.max(out.hourly, h);
    }
  }
  return out;
}

export function metaLine(props) {
  const bits = [];
  if (props?.boro) bits.push(props.boro);
  if (props?.uhf42_name) bits.push(props.uhf42_name);
  if (props?.crz_status) bits.push(props.crz_status === 'inside' ? 'inside the zone' : props.crz_status === 'boundary' ? 'on the zone boundary' : 'outside the zone');
  if (props?.dac_designated === true) bits.push('Disadvantaged Community tract');
  else if (props?.dac_designated === false) bits.push('not a designated tract');
  if (props?.approx) bits.push('approx. location');
  return bits.join(' · ');
}

/** DOT matched-pair tier: how comparable the "before" sample is to the "after" sample. */
export function dotTier(p) {
  if (!p || p.role !== 'matched') return null;
  const y = (p.pre_months ?? [])[0]?.slice(0, 4);
  if (p.comparison_kind === 'same_month' && y === '2024') return { key: 'same_month_2024', label: 'same calendar month, 2024 baseline', rank: 0 };
  if (p.comparison_kind === 'same_month') return { key: 'same_month_older', label: `same calendar month, ${y ?? 'older'} baseline`, rank: 1 };
  return { key: 'different_month', label: 'different months or years', rank: 2 };
}
