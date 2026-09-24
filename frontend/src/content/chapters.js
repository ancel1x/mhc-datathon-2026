// Story steps, in time order. Each step sets the camera, which layers are on, which year the map shows
// (`period`), whether symbols are colored by change or just sized by amount (`metric`), and which ids are
// "featured" (everything else is faded). The Timeline bar groups steps by `era`.
//
// Every step answers one part of the Phase 1 brief: the three required layers (NYCCAS PM2.5 before/after,
// MTA + DOT traffic, the zone + toll) and the four questions (headline vs daily/peak picture; eliminated vs
// shifted and who lives there; the South Bronx monitor by monitor; a highway-removal scenario).
export const LAYER_KEYS = ['zone', 'crz_entry', 'bt_facility', 'flow', 'dot_segment', 'aq_monitor', 'dac', 'uhf42'];

export const LAYER_LABELS = {
  zone: 'Toll zone',
  crz_entry: 'Entry points',
  bt_facility: 'Bridges & tunnels',
  flow: 'Traffic flow',
  dot_segment: 'Street counters',
  aq_monitor: 'Air monitors',
  dac: 'Disadvantaged communities',
  uhf42: 'Child asthma ER visits',
};

/** One-line plain-English hint under each layer switch. */
export const LAYER_HINTS = {
  zone: 'White outline · Manhattan below 60th St',
  crz_entry: 'Rings · where vehicles enter the zone',
  bt_facility: 'Discs · nine MTA facilities, ten routes shown',
  flow: 'Moving lines · which way traffic goes',
  dot_segment: 'Squares · one-week NYC DOT counts',
  aq_monitor: 'Dots · PM2.5, weather-adjusted verdict',
  dac: 'Purple fill · state-designated areas',
  uhf42: 'Purple shading · ER visits per 10,000 children, 2023',
};

/** Symbol kind for each layer's row (see components/Swatch.jsx#LayerSymbol). */
export const LAYER_SYMBOL = {
  zone: { kind: 'zone' },
  crz_entry: { kind: 'entry' },
  bt_facility: { kind: 'disc' },
  flow: { kind: 'line' },
  dot_segment: { kind: 'square' },
  aq_monitor: { kind: 'disc' },
  dac: { kind: 'fill' },
  uhf42: { kind: 'ramp' },
};

const layers = (on) => Object.fromEntries(LAYER_KEYS.map((k) => [k, on.includes(k)]));

export const CHAPTERS = [
  {
    id: 'before',
    era: 'Chapter 1',
    when: 'CHAPTER 1 · BEFORE THE TOLL',
    short: '1. BEFORE THE TOLL',
    title: 'Chapter 1 — Before the Toll',
    camera: { center: [-73.94, 40.71], zoom: 9.65 },
    layers: layers(['bt_facility', 'flow']),
    period: 'pre_2024',
    metric: 'absolute',
    featured: () => null,
  },
  {
    id: 'headline',
    era: 'Chapter 2',
    when: 'CHAPTER 2 · THE HEADLINE',
    short: '2. THE HEADLINE',
    title: 'Chapter 2 — The Headline',
    camera: { center: [-73.975, 40.735], zoom: 11.1 },
    layers: layers(['zone', 'crz_entry', 'flow']),
    period: 'post_2025',
    metric: 'change',
    featured: () => null,
  },
  {
    id: 'traffic_shift',
    era: 'Chapter 3',
    when: 'CHAPTER 3 · WHERE DID THE TRAFFIC GO?',
    short: '3. WHERE DID THE TRAFFIC GO?',
    title: 'Chapter 3 — Where Did the Traffic Go?',
    camera: { center: [-73.95, 40.74], zoom: 10.2 },
    layers: layers(['zone', 'bt_facility', 'flow']),
    period: 'post_2025',
    metric: 'change',
    featured: () => null,
  },
  {
    id: 'follow_air',
    era: 'Chapter 4',
    when: 'CHAPTER 4 · FOLLOW THE AIR',
    short: '4. FOLLOW THE AIR',
    title: 'Chapter 4 — Follow the Air',
    camera: { center: [-73.94, 40.735], zoom: 10.35 },
    layers: layers(['zone', 'aq_monitor']),
    period: 'post_2025',
    metric: 'change',
    featured: ({ summary }) => ({ aq_monitor: new Set((summary?.reconciled?.air ?? []).filter((r) => r.class !== 'no_baseline').map((r) => r.id)) }),
  },
];

export const EXPLORE_STEP = { era: 'Explore', when: 'Explore', short: 'Explore', title: 'Explore the map' };
export const EXPLORE_CAMERA = { center: [-73.95, 40.73], zoom: 10.4 };
export const EXPLORE_LAYERS = layers(['zone', 'crz_entry', 'bt_facility', 'aq_monitor']);
/** Wide view of the whole city shown behind the intro title; the map flies from here to step 1. */
export const INTRO_CAMERA = { center: [-73.93, 40.69], zoom: 9.4 };

/** Featured id sets for a step index, or null when nothing is emphasised. */
export function featuredFor(index, ctx) {
  const ch = CHAPTERS[index];
  if (!ch) return null;
  try {
    const f = ch.featured(ctx);
    if (!f) return null;
    const clean = Object.fromEntries(Object.entries(f).filter(([, set]) => set && set.size > 0));
    return Object.keys(clean).length ? clean : null;
  } catch {
    return null;
  }
}
