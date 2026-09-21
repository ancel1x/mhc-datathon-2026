// Story steps, in time order. Each step sets the camera, which layers are on, which year the map shows
// (`period`), whether symbols are colored by change or just sized by amount (`metric`), and which ids are
// "featured" (everything else is faded). The Timeline bar groups steps by `era`.
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
  bt_facility: 'Discs · the nine MTA crossings',
  flow: 'Moving lines · which way traffic goes',
  dot_segment: 'Squares · one-week NYC DOT counts',
  aq_monitor: 'Dots · fine-particle pollution (PM2.5)',
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
    short: 'Toll begins',
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
    when: '2025 · year one',
    short: 'Entries',
    title: 'Half a million a day still come in',
    camera: { center: [-73.975, 40.755], zoom: 12.2 },
    layers: layers(['zone', 'crz_entry', 'flow']),
    period: 'post_2025',
    metric: 'absolute',
    featured: ({ summary }) => ({ crz_entry: idsOf(summary?.crz?.top_entry_points_2025) }),
  },
  {
    id: 'moved',
    from: { period: 'pre_2024', metric: 'absolute' },
    era: '2025',
    when: '2025 · year one',
    short: 'Rerouting',
    title: 'Traffic went around, not away',
    camera: { center: [-73.925, 40.73], zoom: 10.4 },
    layers: layers(['zone', 'bt_facility', 'flow', 'dot_segment']),
    period: 'post_2025',
    metric: 'change',
    featured: ({ summary }) => ({
      bt_facility: idsOf([...(summary?.bt?.facilities_up ?? []), ...(summary?.bt?.facilities_down ?? [])]),
      dot_segment: new Set((summary?.dot?.highlights ?? []).map((h) => h?.id ?? (h?.segment_id ? `dot_${h.segment_id}` : null)).filter(Boolean)),
    }),
  },
  {
    id: 'monitors',
    from: { period: 'pre_2024', metric: 'absolute' },
    era: '2025',
    when: '2025 · year one',
    short: 'The air',
    title: 'Cleaner by the bridges, not in the Bronx',
    camera: { center: [-73.92, 40.81], zoom: 11.8 },
    layers: layers(['zone', 'aq_monitor']),
    period: 'post_2025',
    metric: 'change',
    featured: ({ summary, aqIds }) => {
      const ids = new Set();
      for (const s of [...(summary?.aq?.south_bronx ?? []), ...(summary?.aq?.inside_sites ?? [])]) {
        const id = s?.id ?? aqIds?.get(s?.site_id);
        if (id) ids.add(id);
      }
      const c = summary?.aq?.control;
      const cid = c?.id ?? aqIds?.get(c?.site_id);
      if (cid) ids.add(cid);
      return ids.size ? { aq_monitor: ids } : null;
    },
  },
  {
    id: 'burden',
    era: '2025',
    when: '2025 · year one',
    short: 'Burden',
    title: 'Who bears it',
    camera: { center: [-73.93, 40.73], zoom: 10 },
    layers: layers(['zone', 'dac', 'aq_monitor', 'bt_facility']),
    period: 'post_2025',
    metric: 'change',
    featured: ({ aq, bt }) => ({
      aq_monitor: new Set((aq?.features ?? []).filter((f) => f.properties?.classification === 'worsened' && f.properties?.dac_designated).map((f) => f.properties.id)),
      bt_facility: new Set((bt?.features ?? []).filter((f) => (f.properties?.change?.pct_2025_vs_2024 ?? 0) > 0 && f.properties?.dac_designated).map((f) => f.properties.id)),
    }),
  },
  {
    id: 'year_two',
    from: { period: 'post_2025', metric: 'change' },
    era: '2026',
    when: '2026 · year two, so far',
    short: 'Year two',
    title: 'Year two: the drop shows up',
    camera: { center: [-73.95, 40.745], zoom: 10.9 },
    layers: layers(['zone', 'crz_entry', 'bt_facility', 'flow']),
    period: 'post_2026_ytd',
    metric: 'change',
    featured: () => null,
  },
  {
    id: 'what_if',
    era: 'What if',
    when: 'What if a highway came down',
    short: 'What if',
    title: 'If the Deegan or the BQE came down',
    camera: { center: [-73.95, 40.77], zoom: 10.2 },
    layers: layers(['zone', 'bt_facility', 'dot_segment', 'aq_monitor', 'dac']),
    dotAll: true, // the Deegan and Bruckner counts are post-toll only, so the single-count squares must show
    period: 'post_2025',
    metric: 'change',
    featured: () => ({
      bt_facility: new Set(['rfk_bronx', 'henry_hudson', 'whitestone', 'throgs_neck', 'verrazzano']),
      aq_monitor: new Set(['aq_36005NY11534', 'aq_36005NY12387', 'aq_36061NY12380', 'aq_36047NY07974']),
      dot_segment: new Set(['dot_139020', 'dot_276694', 'dot_9014571', 'dot_140064', 'dot_140062', 'dot_142655', 'dot_142657', 'dot_153104', 'dot_144320']),
    }),
  },
  {
    id: 'caveats',
    era: 'Notes',
    when: 'Before you draw conclusions',
    short: 'Caveats',
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
