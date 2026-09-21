// Per-feature metric resolution shared by circles, glyphs, legend and the detail panel.
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

export const PERIODS = ['pre_2024', 'post_2025', 'post_2026_ytd'];
export const PERIOD_LABELS = { pre_2024: '2024 · before the toll', post_2025: '2025 · year one', post_2026_ytd: '2026 · so far' };

const AQ_COMPARISON = { post_2025: 'post_2025_vs_pre_2024', post_2026_ytd: 'post_2026ytd_vs_ytd_2024' };
const BT_BASELINE = { post_2025: 'pre_2024', post_2026_ytd: 'ytd_2024' };
const BT_CHANGE = { post_2025: 'pct_2025_vs_2024', post_2026_ytd: 'pct_2026ytd_vs_2024ytd' };

const arr24 = (a) => (Array.isArray(a) && a.length === 24 ? a : null);
const pctOf = (cur, base) => (isNum(cur) && isNum(base) && base !== 0 ? ((cur - base) / base) * 100 : null);

function hourly(props, key, weekend = false) {
  return arr24(props?.periods?.[key]?.[weekend ? 'hourly_weekend' : 'hourly_weekday']);
}

/**
 * Resolve before/after/change for a feature under the current period (and optional hour).
 * Returns nulls rather than throwing for anything missing.
 */
export function featureMetrics(props, layer, period, hour = null, metric = 'change') {
  const p = props || {};
  const m = { layer, value: null, baseline: null, change: null, classification: null, baselineHourly: null, currentHourly: null, baselineWeekend: null, currentWeekend: null, baselineLabel: '', currentLabel: PERIOD_LABELS[period] ?? period, comparison: null, note: null };

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
  } else if (layer === 'aq_monitor') {
    const key = AQ_COMPARISON[period];
    const c = key ? p.comparisons?.[key] ?? null : null;
    // In "change" mode the before / after figures are the months-matched means the verdict was computed
    // from, so before, after and the % agree with each other; "amount only" shows the plain period mean.
    const matched = metric !== 'absolute' && isNum(c?.pre_mean) && isNum(c?.post_mean);
    const baseKey = period === 'post_2026_ytd' ? 'ytd_2024' : 'pre_2024';
    m.comparison = c;
    m.baselineLabel = period === 'post_2026_ytd' ? 'Jan–Aug 2024' : '2024, before the toll';
    m.value = matched ? c.post_mean : p.periods?.[period]?.mean ?? c?.post_mean ?? null;
    m.baseline = period === 'pre_2024' ? null : matched ? c.pre_mean : p.periods?.[baseKey]?.mean ?? c?.pre_mean ?? null;
    m.change = period === 'pre_2024' ? null : matched ? c.pct_raw ?? pctOf(m.value, m.baseline) : pctOf(m.value, m.baseline);
    m.classification = period === 'pre_2024' ? null : c?.classification ?? p.classification ?? 'insufficient';
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
  if (props?.dac_designated === true) bits.push('DAC tract');
  else if (props?.dac_designated === false) bits.push('not a DAC tract');
  if (props?.approx) bits.push('approx. location');
  return bits.join(' · ');
}
