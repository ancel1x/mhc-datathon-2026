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
  bt_facility: 'Discs · the nine MTA crossings; ring = uncertain',
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

const idsOf = (list, key = 'id') => new Set((list ?? []).map((x) => x?.[key]).filter(Boolean));
const supported = (rows) => idsOf((rows ?? []).filter((r) => r?.status === 'increase' || r?.status === 'decrease'));
const SOUTH_BRONX = ['aq_36005NY11534', 'aq_36005NY12387', 'aq_36005NY11790'];

export const CHAPTERS = [
  {
    id: 'before',
    era: '2024',
    when: '2024 · before the toll',
    short: 'Before',
    title: 'Before the toll',
    camera: { center: [-73.94, 40.72], zoom: 10 },
    layers: layers(['bt_facility', 'flow', 'aq_monitor']),
    period: 'pre_2024',
    metric: 'absolute',
    featured: () => null,
  },
  {
    id: 'toll',
    era: 'Jan 2025',
    when: 'January 5, 2025',
    short: 'Toll',
    title: 'The toll begins',
    camera: { center: [-73.975, 40.745], zoom: 11.5 },
    layers: layers(['zone']),
    period: 'post_2025',
    metric: 'change',
    featured: () => null,
  },
  {
    id: 'entries',
    era: '2025',
    when: '2025 · year one · the priced core',
    short: 'Inside',
    title: 'Inside the zone: what was measured',
    camera: { center: [-73.975, 40.755], zoom: 12.2 },
    layers: layers(['zone', 'crz_entry', 'flow']),
    period: 'post_2025',
    metric: 'absolute',
    featured: ({ summary }) => ({ crz_entry: idsOf(summary?.crz?.top_entry_points_2025) }),
  },
  {
    id: 'crossings',
    from: { period: 'pre_2024', metric: 'absolute' },
    era: '2025',
    when: '2025 vs 2024 · Jan 5–Dec 31',
    short: 'Bridges',
    title: 'Crossings: where volume changed',
    camera: { center: [-73.925, 40.73], zoom: 10.4 },
    layers: layers(['zone', 'bt_facility', 'flow']),
    period: 'post_2025',
    metric: 'change',
    featured: ({ summary }) => ({ bt_facility: supported(summary?.reconciled?.traffic) }),
  },
  {
    id: 'street',
    era: '2025',
    when: '2025 · sampled street counts',
    short: 'Streets',
    title: 'Street level: what DOT counters add',
    camera: { center: [-73.975, 40.73], zoom: 11 },
    layers: layers(['zone', 'dot_segment']),
    period: 'post_2025',
    metric: 'change',
    featured: ({ summary }) => ({ dot_segment: idsOf(summary?.reconciled?.dot?.tiers?.same_month_2024?.rows) }),
  },
  {
    id: 'air',
    from: { period: 'pre_2024', metric: 'absolute' },
    era: '2025',
    when: '2025 vs 2024 · matched months',
    short: 'Air',
    title: 'Air: where PM2.5 changed',
    camera: { center: [-73.94, 40.745], zoom: 10.7 },
    layers: layers(['zone', 'aq_monitor']),
    period: 'post_2025',
    metric: 'change',
    featured: ({ summary }) => ({ aq_monitor: idsOf((summary?.reconciled?.air ?? []).filter((r) => r?.class === 'decrease' || r?.class === 'increase')) }),
  },
  {
    id: 'bronx',
    era: '2025',
    when: '2025 vs 2024 · the South Bronx',
    short: 'Bronx',
    title: 'The South Bronx, monitor by monitor',
    camera: { center: [-73.905, 40.825], zoom: 11.9 },
    layers: layers(['zone', 'aq_monitor', 'uhf42', 'bt_facility']),
    period: 'post_2025',
    metric: 'change',
    featured: () => ({ aq_monitor: new Set(SOUTH_BRONX), bt_facility: new Set(['rfk_bronx', 'whitestone', 'throgs_neck', 'henry_hudson']) }),
  },
  {
    id: 'burden',
    era: '2025',
    when: '2025 · overlap with vulnerable communities',
    short: 'Burden',
    title: 'Who was already carrying the most',
    camera: { center: [-73.93, 40.73], zoom: 10 },
    layers: layers(['zone', 'dac', 'aq_monitor', 'bt_facility']),
    period: 'post_2025',
    metric: 'change',
    featured: ({ summary }) => {
      const rc = summary?.reconciled;
      const bt = idsOf((rc?.traffic ?? []).filter((r) => r?.status === 'increase' && r?.dac_designated));
      const aq = new Set([...idsOf((rc?.air ?? []).filter((r) => r?.class === 'decrease')), ...SOUTH_BRONX]);
      return { bt_facility: bt, aq_monitor: aq };
    },
  },
  {
    id: 'year_two',
    from: { period: 'post_2025', metric: 'change' },
    era: '2026',
    when: 'Jan 5–Aug 31 · 2024 vs 2025 vs 2026',
    short: '2026',
    title: '2026 so far: did year one persist?',
    camera: { center: [-73.95, 40.745], zoom: 10.6 },
    layers: layers(['zone', 'bt_facility', 'flow', 'aq_monitor']),
    period: 'post_2026_ytd',
    metric: 'change',
    featured: ({ summary }) => ({
      bt_facility: idsOf((summary?.reconciled?.persistence_highlights ?? []).filter((h) => h.kind === 'traffic')),
      aq_monitor: idsOf((summary?.reconciled?.persistence_highlights ?? []).filter((h) => h.kind === 'air')),
    }),
  },
  {
    id: 'what_if',
    era: 'What if',
    when: 'Scenario reasoning · the Major Deegan',
    short: 'What if',
    title: 'If the Major Deegan came down',
    camera: { center: [-73.915, 40.835], zoom: 11.4 },
    layers: layers(['zone', 'bt_facility', 'dot_segment', 'aq_monitor', 'uhf42']),
    dotAll: true, // the Deegan and Bruckner counts are post-toll only, so the single-count squares must show
    period: 'post_2025',
    metric: 'change',
    featured: () => ({
      bt_facility: new Set(['rfk_bronx', 'henry_hudson', 'whitestone', 'throgs_neck']),
      aq_monitor: new Set(['aq_36005NY11534', 'aq_36005NY12387', 'aq_36061NY12380']),
      dot_segment: new Set(['dot_139020', 'dot_276694', 'dot_9014571', 'dot_140064', 'dot_140062']),
    }),
  },
  {
    id: 'caveats',
    era: 'Notes',
    when: 'Before you draw conclusions',
    short: 'Notes',
    title: 'What this can’t say',
    camera: { center: [-73.94, 40.72], zoom: 10 },
    layers: layers(['zone', 'crz_entry', 'bt_facility', 'dot_segment', 'aq_monitor']),
    period: 'post_2025',
    metric: 'change',
    featured: () => null,
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
