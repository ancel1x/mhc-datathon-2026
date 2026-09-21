// Plain-English readings of the metrics. Every number in the app keeps its unit; these helpers say what it
// means next to it, so a reader never has to know what "µg/m³", "+4.7%" or "per 10,000" imply on their own.
import { fmtSigned, isNum } from './format.js';

const VERDICT = {
  increase: 'and the data support it',
  decrease: 'and the data support it',
  uncertain: 'but the range of doubt includes zero, so no clear change',
  limited: 'but too few complete days to be sure',
};

/** "+1.9%" -> "about 2 more vehicles for every 100 in 2024, and the data support it". */
export function plainPct(pct, { status = null, what = 'vehicles', base = '2024' } = {}) {
  if (!isNum(pct)) return 'no comparison possible';
  const a = Math.abs(pct);
  let core;
  if (a < 0.5) core = `about the same number of ${what} as ${base}`;
  else if (a < 0.95) core = `${pct > 0 ? 'slightly more' : 'slightly fewer'} ${what} than ${base}`;
  else core = `about ${Math.round(a)} ${pct > 0 ? 'more' : 'fewer'} ${what} for every 100 in ${base}`;
  const tail = VERDICT[status];
  return tail ? `${core}, ${tail}` : core;
}

/** Short form for tables: "+4.7%" -> "≈5 more per 100". */
export function plainPctShort(pct) {
  if (!isNum(pct)) return '—';
  const a = Math.abs(pct);
  if (a < 0.5) return 'about the same';
  if (a < 0.95) return pct > 0 ? 'slightly more' : 'slightly fewer';
  return `≈${Math.round(a)} ${pct > 0 ? 'more' : 'fewer'} per 100`;
}

/** Change in µg/m³ against a 2024 level -> "about 29% less fine soot in the air than 2024, ...". */
export function plainAir(delta, pre, { status = null, base = '2024' } = {}) {
  if (!isNum(delta) || !isNum(pre) || pre <= 0) return 'no comparison possible';
  const pct = (delta / pre) * 100;
  const a = Math.abs(pct);
  const core = a < 3 ? `about the same amount of fine soot in the air as ${base}` : `about ${Math.round(a)}% ${pct < 0 ? 'less' : 'more'} fine soot in the air than ${base}`;
  if (status === 'decrease') return `${core}: cleaner air, and the data support it`;
  if (status === 'increase') return `${core}: dirtier air, and the data support it`;
  if (status === 'uncertain') return `${core}, but the range of doubt includes zero, so no clear change`;
  return core;
}

/** Short form for tables: "≈29% less soot". */
export function plainAirShort(delta, pre) {
  if (!isNum(delta) || !isNum(pre) || pre <= 0) return '—';
  const pct = (delta / pre) * 100;
  const a = Math.abs(pct);
  if (a < 3) return 'about the same';
  return `≈${Math.round(a)}% ${pct < 0 ? 'less' : 'more'} soot`;
}

/** 266 per 10,000 -> "about 1 in 38". */
export function plainRate(perTenK) {
  if (!isNum(perTenK) || perTenK <= 0) return '—';
  return `about 1 in ${Math.round(10000 / perTenK).toLocaleString('en-US')}`;
}

/** "range of doubt −1.23 to +0.51" */
export function plainRange(lo, hi, digits = 2, unit = '') {
  if (!isNum(lo) || !isNum(hi)) return 'no range of doubt available';
  return `range of doubt ${fmtSigned(lo, digits)} to ${fmtSigned(hi, digits)}${unit}`;
}

/** One-line reading of the three rush windows for a crossing. */
export function plainRush(peak) {
  if (!peak) return null;
  const part = (label, w) => (w && isNum(w.pct) ? `${label} ${plainPctShort(w.pct)}${w.status === 'increase' || w.status === 'decrease' ? ' (supported)' : w.status === 'uncertain' ? ' (uncertain)' : ''}` : null);
  const bits = [part('morning rush', peak.am), part('evening rush', peak.pm), part('other hours', peak.other)].filter(Boolean);
  return bits.length ? bits.join('; ') : null;
}
