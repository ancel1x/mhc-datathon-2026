// Number / date formatting. Every helper returns an em dash for null, undefined or NaN.
export const DASH = '—';
export const MINUS = '−';
export const EN_DASH = '–';

export const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

export const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function fmtInt(v) {
  return isNum(v) ? Math.round(v).toLocaleString('en-US') : DASH;
}

export function fmtNum(v, digits = 1) {
  if (!isNum(v)) return DASH;
  return v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function fmtCompact(v) {
  if (!isNum(v)) return DASH;
  const a = Math.abs(v);
  if (a >= 1e6) return `${(v / 1e6).toFixed(a >= 1e7 ? 0 : 1)}M`;
  if (a >= 1e4) return `${Math.round(v / 1e3)}k`;
  if (a >= 1e3) return `${(v / 1e3).toFixed(1)}k`;
  return fmtInt(v);
}

/** Traffic comparison value with enough precision to reconcile a displayed percent change. */
export function fmtTrafficK(v) {
  if (!isNum(v)) return DASH;
  return Math.abs(v) >= 1e3 ? `${fmtNum(v / 1e3, 1)}k` : fmtInt(v);
}

/** Signed number with a true minus sign. Zero renders as "0". */
export function fmtSigned(v, digits = 1) {
  if (!isNum(v)) return DASH;
  const rounded = Number(v.toFixed(digits));
  if (rounded === 0) return fmtNum(0, digits);
  return (rounded > 0 ? '+' : MINUS) + fmtNum(Math.abs(rounded), digits);
}

/** Percent from a percent value (e.g. -4.9 -> "−4.9%"). */
export function fmtPct(v, { signed = true, digits = 1 } = {}) {
  if (!isNum(v)) return DASH;
  return `${signed ? fmtSigned(v, digits) : fmtNum(v, digits)}%`;
}

/** Percent from a 0–1 share (e.g. 0.765 -> "77%"). */
export function fmtShare(v, digits = 0) {
  return isNum(v) ? `${fmtNum(v * 100, digits)}%` : DASH;
}

export function fmtDelta(v, unit = '', digits = 1) {
  if (!isNum(v)) return DASH;
  return `${fmtSigned(v, digits)}${unit ? ` ${unit}` : ''}`;
}

export function fmtMoney(v) {
  return isNum(v) ? `$${v.toFixed(2)}` : DASH;
}

export function fmtDate(iso) {
  if (!iso || typeof iso !== 'string') return DASH;
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return DASH;
  return `${MONTHS_SHORT[m - 1]} ${d}, ${y}`;
}

export function fmtMonth(ym, { short = false } = {}) {
  if (!ym || typeof ym !== 'string') return DASH;
  const [y, m] = ym.split('-').map(Number);
  if (!y || !m) return DASH;
  return short ? `${MONTHS_SHORT[m - 1]} ’${String(y).slice(2)}` : `${MONTHS_SHORT[m - 1]} ${y}`;
}

/** ["01","02","03"] -> "Jan–Mar"; non-contiguous lists are spelled out. */
export function fmtMonthList(months) {
  if (!Array.isArray(months) || months.length === 0) return DASH;
  const idx = months.map((m) => Number(String(m).slice(-2)) - 1).filter((i) => i >= 0 && i < 12).sort((a, b) => a - b);
  if (idx.length === 0) return DASH;
  const contiguous = idx.every((v, i) => i === 0 || v === idx[i - 1] + 1);
  if (contiguous && idx.length > 1) return `${MONTHS_SHORT[idx[0]]}${EN_DASH}${MONTHS_SHORT[idx[idx.length - 1]]}`;
  return idx.map((i) => MONTHS_SHORT[i]).join(', ');
}

export function fmtHour(h) {
  if (!isNum(h)) return 'all hours';
  const hh = ((Math.round(h) % 24) + 24) % 24;
  if (hh === 0) return '12 AM';
  if (hh === 12) return '12 PM';
  return hh < 12 ? `${hh} AM` : `${hh - 12} PM`;
}

export function fmtHourRange(a, b) {
  return `${fmtHour(a)}${EN_DASH}${fmtHour(b)}`;
}

export function fmtRange(a, b) {
  return `${a ?? DASH}${EN_DASH}${b ?? DASH}`;
}

export function plural(n, one, many = `${one}s`) {
  return n === 1 ? one : many;
}

export function fmtLabelledCount(n, one, many) {
  return `${fmtInt(n)} ${plural(n, one, many)}`;
}

const SMALL_WORDS = new Set(['of', 'and', 'the', 'at', 'to', 'in', 'on', 'for']);

/** "EAST 58 STREET" -> "East 58 Street" (only applied to all-caps input; mixed case is left alone). */
export function titleCase(s) {
  if (!s || typeof s !== 'string') return s ?? DASH;
  if (s !== s.toUpperCase()) return s;
  return s
    .toLowerCase()
    .split(/(\s+|\/|-)/)
    .map((w, i) => (i > 0 && SMALL_WORDS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join('');
}

// Names that stay as they are even though they end in "Bridge" (they would collide with a borough otherwise).
const KEEP_FULL = new Set(['manhattan bridge', 'brooklyn bridge', 'hamilton bridge']);

/**
 * Short map label for a facility / monitor / entry point:
 * "Robert F. Kennedy Bridge Bronx" -> "RFK · Bronx span", "Bronx - Whitestone Bridge" -> "Whitestone",
 * "West Side Highway at 60th St" -> "West Side Hwy 60th", "FDR Drive at 60th St" -> "FDR 60th".
 */
export function shortName(name) {
  if (!name) return DASH;
  let s = String(name).replace(/\s+/g, ' ').trim();
  const rfk = s.match(/^robert f\.? kennedy bridge\s+(.+)$/i);
  if (rfk) return `RFK · ${rfk[1]} span`;
  if (/^bronx\s*-\s*whitestone bridge$/i.test(s)) return 'Whitestone';
  if (/^verrazzano\s*-\s*narrows bridge$/i.test(s)) return 'Verrazzano';
  if (/^queens midtown tunnel$/i.test(s)) return 'Queens Midtown';
  if (/^hugh l\.? carey tunnel$/i.test(s)) return 'Hugh Carey';
  if (/^marine parkway bridge$/i.test(s)) return 'Marine Pkwy';
  const wsh = s.match(/^west side highway at (\d+\w*) st$/i);
  if (wsh) return `West Side Hwy ${wsh[1]}`;
  const fdr = s.match(/^fdr drive at (\d+\w*) st$/i);
  if (fdr) return `FDR ${fdr[1]}`;
  const street = s.match(/^(east|west) (\d+\w*) st$/i);
  if (street) return `${street[1]} ${street[2]}`;
  if (KEEP_FULL.has(s.toLowerCase())) return s;
  s = s.replace(/\s+(bridge|tunnel)$/i, '');
  return s;
}

/** Ordinal percentile from a 0–1 rank (0.958 -> "96th"). Used for the NYS DAC percentile-rank fields. */
export function fmtPercentile(v) {
  if (!isNum(v)) return DASH;
  const p = Math.max(0, Math.min(100, Math.round(v * 100)));
  const m100 = p % 100;
  const suffix = m100 >= 11 && m100 <= 13 ? 'th' : p % 10 === 1 ? 'st' : p % 10 === 2 ? 'nd' : p % 10 === 3 ? 'rd' : 'th';
  return `${p}${suffix}`;
}
