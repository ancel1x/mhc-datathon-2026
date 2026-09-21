import { scaleLinear, scaleSqrt } from 'd3-scale';
import { isNum } from './format.js';

// One meaning system: better = green, neutral = grey, worse = red — for traffic (less -> more) and air
// (cleaner -> dirtier) alike. Equity is purple. Nothing else. Map encodings are identical in both themes.
export const COLORS = {
  bg: '#0b0d10',
  text: '#F5F5F7',
  textLight: '#1D1D1F',
  outline: 'rgba(11,13,16,0.9)', // 1 px separation stroke on every disc / square
  outlineLight: 'rgba(11,13,16,0.9)',

  better: '#30D158',
  betterSoft: '#56B670',
  neutral: '#8E8E93',
  worseSoft: '#D2625E',
  worse: '#FF453A',

  improved: '#30D158',
  unchanged: '#8E8E93',
  worsened: '#FF453A',
  insufficient: 'rgba(142,142,147,0.5)',

  purple: '#BF5AF2',
  dacFill: 'rgba(191,90,242,0.26)',
};

export const CLASS_COLORS = {
  improved: COLORS.improved,
  unchanged: COLORS.unchanged,
  worsened: COLORS.worsened,
  insufficient: COLORS.insufficient,
};

export const CLASS_LABELS = {
  improved: 'improved',
  unchanged: 'unchanged',
  worsened: 'worsened',
  insufficient: 'no data',
};

/**
 * Diverging change scale in percent, clamped to ±25 %. Green = less traffic / cleaner, red = more / worse.
 * The soft stops at ±3 % keep small changes visible without saturating them.
 */
export const changeScale = scaleLinear()
  .domain([-25, -3, 0, 3, 25])
  .range([COLORS.better, COLORS.betterSoft, COLORS.neutral, COLORS.worseSoft, COLORS.worse])
  .clamp(true);

/** Five discrete swatches for the Key. */
export const CHANGE_KEY = [-25, -8, 0, 8, 25].map((v) => changeScale(v));

/** Five purple steps (alpha carries the intensity) for the DAC-percentile / asthma choropleths and their Key. */
export const PURPLE_STEPS = [0.08, 0.14, 0.22, 0.3, 0.4].map((a) => `rgba(191,90,242,${a})`);

export function changeColor(pct) {
  return isNum(pct) ? changeScale(pct) : COLORS.neutral;
}

export function changeClass(pct, band = 2) {
  if (!isNum(pct)) return 'insufficient';
  if (pct < -band) return 'improved';
  if (pct > band) return 'worsened';
  return 'unchanged';
}

export function classColor(cls) {
  return CLASS_COLORS[cls] ?? COLORS.insufficient;
}

/** MapLibre expression: five purple steps over a numeric property between min and max. */
export function violetExpression(prop, min, max) {
  const lo = isNum(min) ? min : 0;
  const hi = isNum(max) && max > lo ? max : lo + 1;
  const w = (hi - lo) / PURPLE_STEPS.length;
  const expr = ['step', ['coalesce', ['to-number', ['get', prop]], lo], PURPLE_STEPS[0]];
  for (let i = 1; i < PURPLE_STEPS.length; i += 1) expr.push(lo + w * i, PURPLE_STEPS[i]);
  return expr;
}

export function sqrtSize(max, range = [4, 9]) {
  return scaleSqrt().domain([0, isNum(max) && max > 0 ? max : 1]).range(range).clamp(true);
}

/** Theme-dependent ink colors used inside MapLibre paint expressions. */
export function themeColors(theme) {
  return theme === 'light'
    ? { bg: '#f3f1ec', text: COLORS.textLight, outline: COLORS.outlineLight, label: 'rgba(29,29,31,0.8)', halo: '#f3f1ec', zone: 'rgba(29,29,31,0.7)', flow: 'rgba(29,29,31,0.65)' }
    : { bg: COLORS.bg, text: COLORS.text, outline: COLORS.outline, label: 'rgba(235,235,245,0.75)', halo: '#0b0d10', zone: 'rgba(255,255,255,0.7)', flow: 'rgba(235,235,245,0.8)' };
}

/** Color for a feature given the current metric. */
export function metricColor({ change, classification }, metric) {
  if (metric === 'absolute') return COLORS.neutral;
  if (classification) return classColor(classification);
  return changeColor(change);
}
