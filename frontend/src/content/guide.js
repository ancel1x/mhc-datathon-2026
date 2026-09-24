// The guided tour ("Play the story"): for each step, a list of beats. Each beat is one short callout placed
// next to the thing it explains (`at` = [lon, lat] or { layer, id } for a map feature; null = top of the
// screen), an optional camera move, an optional `state` (year / metric the map switches to when the beat
// starts, so the reader watches the change happen), and how long it stays (ms). Numbers come from summary.json
// and its reconciled block, so the tour never says something the story card does not.
import { fmtInt, fmtPct } from '../lib/format.js';

const Y2024 = { period: 'pre_2024', metric: 'absolute' };
const Y2025 = { period: 'post_2025', metric: 'change' };
const LAYER_KEYS = ['zone', 'crz_entry', 'bt_facility', 'flow', 'dot_segment', 'aq_monitor', 'dac', 'uhf42'];
const chapterLayers = (...shown) => Object.fromEntries(LAYER_KEYS.map((key) => [key, shown.includes(key)]));

export function buildGuide({ summary, geo }) {
  const s = summary ?? {};
  const rc = s.reconciled ?? {};
  const air = rc.air ?? [];
  const traffic = rc.traffic ?? [];
  const dotRows = rc.dot?.tiers?.same_month_2024?.rows ?? [];
  const trafficById = (id) => traffic.find((row) => row.id === id) ?? {};
  const dotById = (id) => dotRows.find((row) => row.id === id) ?? {};
  const dotFeatureById = (id) => (geo?.dot_segment?.features ?? []).find((f) => f.properties?.id === id)?.properties ?? {};
  const increase = trafficById('rfk_manhattan');
  const decrease = trafficById('hlc');
  const localIds = ['dot_36369', 'dot_34332', 'dot_252708'];
  const directionNames = { NB: 'Northbound', SB: 'Southbound', EB: 'Eastbound', WB: 'Westbound' };
  const localExamples = localIds.map((id) => {
    const row = dotById(id);
    const feature = dotFeatureById(id);
    const directions = feature.directions_compared ?? feature.directions ?? [];
    return {
      label: `${String(row.street ?? feature.street ?? '').replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\bBr\b/, 'Bridge')} · ${directions.map((d) => directionNames[d] ?? d).join(' and ')}`,
      value: fmtPct(row.pct_change),
    };
  }).filter((item) => item.label && item.value !== '—');
  const aNo = air.filter((r) => r.class === 'no_baseline');
  const crossingIds = new Set((geo?.bt_facility?.features ?? []).map((f) => f.properties?.id).filter(Boolean));
  const streetIds = new Set((geo?.dot_segment?.features ?? []).filter((f) => f.properties?.role === 'matched').slice(0, 18).map((f) => f.properties?.id).filter(Boolean));
  const noBaselineIds = new Set(aNo.map((r) => r.id).filter(Boolean));
  const usableMonitorIds = new Set(air.map((r) => r.id).filter((id) => id && !noBaselineIds.has(id)));
  const improvedAir = air.filter((row) => row.class === 'decrease');
  const uncertainAir = air.filter((row) => row.class === 'uncertain');
  const higherAir = air.filter((row) => row.class === 'increase');
  const airById = (id) => air.find((row) => row.id === id) ?? {};
  const williamsburg = airById('aq_36061NY08552');
  const manhattanBridge = airById('aq_36061NY08454');
  const hamilton = airById('aq_36061NY12380');
  const monitorCard = (row, tone, verdict) => ({
    name: row.name,
    before: row.pre_mean?.toFixed(2) ?? '—',
    after: row.post_mean?.toFixed(2) ?? '—',
    change: row.delta_raw == null ? '—' : `${row.delta_raw > 0 ? '+' : '−'}${Math.abs(row.delta_raw).toFixed(2)} µg/m³`,
    tone,
    verdict,
  });

  return [
    // Chapter 1 · Before the Toll — eight cinematic baseline beats, 54 seconds total.
    [
      {
        at: null,
        placement: 'upper-left',
        size: 'large',
        variant: 'question',
        state: Y2024,
        layers: chapterLayers('bt_facility', 'flow'),
        camera: { center: [-73.94, 40.71], zoom: 9.65 },
        question: 'What did New York look like before congestion pricing?',
        captions: ['IN 2024, THE TOLL HAD NOT BEGUN.', 'TRAFFIC WAS ALREADY MOVING THROUGH A DENSE CITYWIDE NETWORK.'],
        legend: ['Moving lines show traffic flow', 'Thicker lines show higher volume', 'Arrows show direction'],
        footer: '2024 baseline traffic conditions',
        dwell: 7000,
      },
      {
        at: [-73.985, 40.742],
        side: 'left',
        variant: 'zone',
        size: 'compact',
        state: Y2024,
        layers: chapterLayers('zone', 'bt_facility', 'flow'),
        camera: { center: [-73.96, 40.72], zoom: 10.15 },
        text: 'Congestion pricing had not started yet. But one part of this network was about to change: the Congestion Relief Zone, the part of Manhattan south of 60th Street.',
        mapCallout: ['Future toll zone', 'Manhattan south of 60th Street'],
        footer: 'Zone geography before tolling begins',
        dwell: 6500,
      },
      {
        at: null,
        placement: 'left',
        variant: 'hero',
        size: 'medium',
        state: Y2024,
        layers: chapterLayers('zone', 'bt_facility', 'flow'),
        camera: { center: [-73.94, 40.71], zoom: 9.85 },
        featured: { bt_facility: crossingIds },
        text: 'The toll zone sat inside a much larger traffic network. In 2024, about 929,000 vehicles a day used the MTA’s nine bridges and tunnels.',
        heroValue: '~929K',
        heroLabel: 'vehicles per day',
        support: 'Across the MTA’s 9 bridges and tunnels',
        supportTile: '9 crossings',
        footer: 'Baseline bridge and tunnel traffic',
        dwell: 7500,
      },
      {
        at: null,
        placement: 'upper-right',
        variant: 'split',
        size: 'wide',
        state: Y2024,
        layers: chapterLayers('zone', 'bt_facility', 'flow', 'dot_segment'),
        dotAll: false,
        camera: { center: [-73.96, 40.72], zoom: 10.05 },
        featured: { bt_facility: crossingIds, dot_segment: streetIds },
        text: 'Bridge totals are only part of the picture. We also use street-level traffic counters to see what was happening on specific corridors and in specific directions before tolling began.',
        panels: [
          { title: 'MTA crossings', body: 'Regional traffic flow' },
          { title: 'DOT street counters', body: 'Local corridor conditions' },
        ],
        support: 'Together they create our traffic baseline.',
        footer: 'Two kinds of traffic evidence',
        dwell: 6500,
      },
      {
        at: null,
        placement: 'right',
        variant: 'definition',
        size: 'compact',
        state: Y2024,
        layers: chapterLayers('aq_monitor'),
        camera: { center: [-73.94, 40.735], zoom: 10.75 },
        captions: ['TRAFFIC IS ONLY HALF THE STORY.', 'THE CITY WAS ALSO MEASURING PM2.5.'],
        definition: 'PM2.5 = fine particulate pollution',
        text: 'Fine particulate matter small enough to reach deep into the lungs, measured in micrograms per cubic meter (µg/m³).',
        footer: 'Baseline air-quality measurement',
        dwell: 7000,
      },
      {
        at: null,
        placement: 'upper-left',
        variant: 'evidence',
        size: 'large',
        state: Y2024,
        layers: chapterLayers('aq_monitor'),
        camera: { center: [-73.94, 40.735], zoom: 10.75 },
        featured: { aq_monitor: usableMonitorIds },
        text: 'Our monitor network includes 16 street-level sites. Thirteen have usable 2024 records. Across those usable baseline records, average PM2.5 was 6.3 µg/m³.',
        stats: ['16 monitors', '13 usable in 2024', '6.3 µg/m³ average PM2.5'],
        recordBar: { usable: 13, unavailable: 3 },
        statTile: 'Average baseline PM2.5: 6.3 µg/m³',
        explanation: 'These are the baseline air-quality records we compare against later.',
        footer: '2024 PM2.5 baseline',
        dwell: 8000,
      },
      {
        at: null,
        placement: 'upper-right',
        variant: 'context',
        size: 'medium',
        state: Y2024,
        layers: chapterLayers('aq_monitor', 'dac'),
        dacMode: 'percentile',
        overlayOpacity: 0.28,
        camera: { center: [-73.93, 40.73], zoom: 9.95 },
        text: 'New York did not begin 2025 from a level playing field. Traffic, pollution, and health burdens were already distributed unevenly across neighborhoods.',
        note: 'Where change happens will matter, not just how much change occurs.',
        footer: 'Why geography matters',
        dwell: 6500,
      },
      {
        at: null,
        placement: 'upper-left',
        variant: 'close',
        size: 'medium',
        state: Y2024,
        layers: chapterLayers('zone', 'bt_facility', 'flow', 'aq_monitor', 'dac'),
        overlayOpacity: 0.2,
        camera: { center: [-73.94, 40.71], zoom: 9.7 },
        captions: ['THIS IS OUR BASELINE.', 'TRAFFIC HAD A GEOGRAPHY. AIR POLLUTION HAD A GEOGRAPHY.'],
        closeLine: 'THE NEIGHBORHOODS AROUND THEM DID NOT ALL START FROM THE SAME PLACE.',
        transition: 'On January 5, 2025, New York changed one part of that system.',
        footer: 'Next: Chapter 2 — The Headline',
        dwell: 6500,
      },
    ],
    // Chapter 2 · The Headline — seven beats, moving into the CRZ and back out again.
    [
      {
        at: null, placement: 'upper-left', size: 'medium', variant: 'question', state: Y2025,
        layers: chapterLayers('zone'), camera: { center: [-73.975, 40.735], zoom: 11.1 },
        question: 'What happened when congestion pricing began?',
        captions: ['JANUARY 5, 2025.', 'NEW YORK TURNED THE TOLL ON.'],
        text: 'Vehicles entering the Congestion Relief Zone were now charged based on vehicle type and time of day.',
        tollEvidence: { title: 'Standard E-ZPass passenger vehicle', daytime: '$9.00 daytime', overnight: '$2.25 overnight' },
        supportLine: 'The zone covers Manhattan south of 60th Street.',
        footer: 'January 5, 2025 · congestion pricing begins', dwell: 8000,
      },
      {
        at: null, placement: 'right', size: 'compact', variant: 'hero', tone: 'green', state: Y2025,
        layers: chapterLayers('zone', 'crz_entry', 'flow'), camera: { center: [-73.975, 40.745], zoom: 11.55 },
        captions: ['THE FIRST TOPLINE RESULT WAS SIMPLE:', 'FEWER VEHICLES ENTERED THE ZONE.'],
        heroValue: '~11% ↓', heroLabel: 'overall vehicle entries', heroLabelOutside: true, secondaryLabel: 'January–June 2025',
        explanation: 'Overall vehicle entries into the Congestion Relief Zone fell by about 11% during the first six months.',
        footer: 'Early CRZ traffic response', dwell: 7500,
      },
      {
        at: null, placement: 'left', size: 'medium', variant: 'comparison', tone: 'green', state: Y2025,
        layers: chapterLayers('zone', 'crz_entry', 'flow'), camera: { center: [-73.975, 40.745], zoom: 11.55 },
        captions: ['THE DROP WAS NOT THE SAME FOR EVERY VEHICLE.'],
        comparison: [
          { title: 'CARS', value: '~9% ↓', amount: 9 },
          { title: 'ALL VEHICLES', value: '~11% ↓', amount: 11 },
          { title: 'HEAVY-DUTY TRUCKS', value: '~18% ↓', amount: 18 },
        ],
        explanation: 'Heavy-duty truck entries fell more sharply than passenger-car entries during the first six months.',
        footer: 'CRZ entries · January–June 2025', dwell: 8000,
      },
      {
        at: null, placement: 'right', size: 'medium', variant: 'hero', tone: 'green', state: Y2025,
        layers: chapterLayers('zone', 'aq_monitor'), camera: { center: [-73.985, 40.73], zoom: 11.4 },
        captions: ['THEN CAME THE AIR-QUALITY HEADLINE.'],
        heroValue: '22% ↓', heroLabel: 'average daily maximum PM2.5\ninside the CRZ', heroLabelOutside: true,
        qualifier: 'Compared with a modeled no-toll scenario',
        explanation: 'During the first six months, one published study estimated average daily maximum PM2.5 in the CRZ was 22% lower than the level its model projected without congestion pricing.',
        evidenceLine: 'Estimated difference: −3.05 µg/m³',
        footer: 'Published six-month PM2.5 estimate', dwell: 9000,
      },
      {
        at: null, placement: 'upper-left', size: 'large', variant: 'comparison', tone: 'green', state: Y2025,
        layers: chapterLayers('zone', 'aq_monitor'), camera: { center: [-73.95, 40.72], zoom: 10.05 },
        captions: ['THE STUDY ALSO ESTIMATED IMPROVEMENT BEYOND THE TOLL ZONE.'],
        comparison: [
          { title: 'CRZ', value: '−3.05 µg/m³', amount: 3.05 },
          { title: 'FIVE BOROUGHS', value: '−1.07 µg/m³', amount: 1.07 },
          { title: 'BROADER METRO AREA', value: '−0.70 µg/m³', amount: 0.7 },
        ],
        supportLine: 'The estimated effect was strongest inside the CRZ and smaller across the rest of the city and region.',
        footer: 'Published modeled PM2.5 effects', dwell: 8000,
      },
      {
        at: null, placement: 'upper-right', size: 'compact', variant: 'close', state: Y2025,
        layers: chapterLayers('zone', 'crz_entry', 'flow'), camera: { center: [-73.975, 40.73], zoom: 10.6 },
        captions: ['LESS TRAFFIC ENTERED THE ZONE.', 'THE STUDY ESTIMATED LOWER PM2.5.', 'ON THE SURFACE, THE POLICY LOOKED LIKE A CLEAR WIN.'],
        supportLine: 'That is the headline.', dwell: 6000,
      },
      {
        at: { layer: 'bt_facility', id: 'rfk_manhattan' }, side: 'right', size: 'medium', variant: 'question', state: Y2025,
        layers: chapterLayers('zone', 'bt_facility', 'flow'), camera: { center: [-73.93, 40.75], zoom: 9.9 },
        question: 'But what happened outside the zone?',
        captions: ['A TOPLINE RESULT CANNOT TELL US WHAT HAPPENED ON EVERY ROAD, AT EVERY CROSSING, OR IN EVERY NEIGHBORHOOD.'],
        supportLine: 'The next question is not whether traffic entering the toll zone fell. It is how traffic patterns changed around it.',
        teaser: 'Some nearby corridors increased.',
        transition: 'Next: Chapter 3 — Where Did the Traffic Go?', dwell: 7000,
      },
    ],
    // Chapter 3 · Where Did the Traffic Go? — regional crossings, then local corridors.
    [
      {
        at: null, placement: 'upper-left', size: 'medium', variant: 'question', state: Y2025,
        layers: chapterLayers('zone', 'bt_facility', 'flow'), camera: { center: [-73.95, 40.74], zoom: 10.2 },
        question: 'But what happened on the roads around the zone?',
        captions: ['FEWER VEHICLES ENTERED THE CRZ.', 'THAT DID NOT MEAN EVERY ROUTE GOT QUIETER.'],
        text: 'To understand the first traffic response, we need to look at the bridges, tunnels, and local corridors around the toll zone.',
        footer: 'Looking beyond the topline', dwell: 7500,
      },
      {
        at: null, placement: 'right', size: 'medium', variant: 'evidence', state: Y2025,
        layers: chapterLayers('zone', 'bt_facility', 'flow'), camera: { center: [-73.93, 40.74], zoom: 10.05 },
        featured: { bt_facility: crossingIds },
        captions: ['THE FIRST CHECK IS THE MTA CROSSINGS.', 'THE PATTERN WAS MIXED.'],
        text: 'Across the MTA’s bridges and tunnels, some crossings carried fewer vehicles after tolling began, while others picked up traffic as drivers adjusted their routes.',
        supportLine: 'Regional traffic shifts',
        miniLegend: [{ label: 'decrease', tone: 'green' }, { label: 'increase', tone: 'red' }],
        footer: 'MTA bridges and tunnels', dwell: 7500,
      },
      {
        at: { layer: 'bt_facility', id: 'rfk_manhattan' }, side: 'left', size: 'compact', variant: 'route', state: Y2025,
        layers: chapterLayers('zone', 'bt_facility', 'flow'), camera: { center: [-73.91, 40.79], zoom: 11.15 },
        featured: { bt_facility: new Set(['rfk_manhattan']) },
        captions: [`ONE EXAMPLE WAS ${String(increase.name ?? 'Robert F. Kennedy Bridge Manhattan').toUpperCase()}.`],
        text: `In 2025, ${increase.name ?? 'Robert F. Kennedy Bridge Manhattan'} averaged ${fmtInt(increase.avg_daily_2025)} vehicles per day, up ${fmtPct(increase.pct_existing, { signed: false })} from 2024.`,
        supportLine: 'This is one example of traffic shifting onto routes around the toll zone.',
        routeStat: { value: fmtPct(increase.pct_existing), label: '2025 vs 2024', tone: 'red' },
        footer: 'Example increase', dwell: 8000,
      },
      {
        at: { layer: 'bt_facility', id: 'hlc' }, side: 'right', size: 'compact', variant: 'route', state: Y2025,
        layers: chapterLayers('zone', 'bt_facility', 'flow'), camera: { center: [-74.005, 40.705], zoom: 11.2 },
        featured: { bt_facility: new Set(['hlc']) },
        captions: ['ANOTHER ROUTE MOVED THE OTHER WAY.'],
        text: `${decrease.name ?? 'Hugh L. Carey Tunnel'} averaged ${fmtInt(decrease.avg_daily_2025)} vehicles per day in 2025, down ${fmtPct(Math.abs(decrease.pct_existing ?? 0), { signed: false })} from 2024.`,
        supportLine: 'That is why a single citywide headline would miss the actual geography of change.',
        routeStat: { value: fmtPct(decrease.pct_existing), label: '2025 vs 2024 · coverage-limited', tone: 'green' },
        note: 'Coverage is limited to comparable selected days, so treat this as an example—not a full-year verdict.',
        footer: 'Example decrease', dwell: 8500,
      },
      {
        at: null, placement: 'upper-right', size: 'large', variant: 'comparison', state: Y2025,
        layers: chapterLayers('zone', 'dot_segment'), dotAll: false, camera: { center: [-73.98, 40.72], zoom: 11.35 },
        featured: { dot_segment: new Set(localIds) },
        captions: ['MTA CROSSINGS SHOW REGIONAL SHIFTS.', 'DOT STREET COUNTERS SHOW THE LOCAL STORY.'],
        text: 'Street-level counters help show what changed on specific corridors and in specific directions after tolling began.',
        supportLine: 'Local corridor conditions', localExamples,
        note: 'These are one-week, same-month samples at specific locations—not a citywide street estimate.',
        footer: 'Street-level change', dwell: 9000,
      },
      {
        at: null, placement: 'upper-right', size: 'medium', variant: 'close', state: Y2025,
        layers: chapterLayers('zone', 'bt_facility', 'flow', 'dot_segment'), dotAll: false, camera: { center: [-73.95, 40.74], zoom: 10.05 },
        captions: ['TRAFFIC WAS REDISTRIBUTED.', 'CHANGE CLUSTERED AROUND SPECIFIC APPROACHES TO THE ZONE.'],
        text: 'Fewer vehicles entered the Congestion Relief Zone, but some traffic shifted onto nearby bridges, tunnels, and approach roads instead of disappearing evenly across the city.',
        supportLine: 'The first traffic story was not citywide silence. It was a network reshuffling.',
        note: 'The counts show where volumes changed; they do not track individual trips from one route to another.',
        footer: 'Reading the rerouting pattern', dwell: 8000,
      },
      {
        at: null, placement: 'upper-left', size: 'medium', variant: 'question', state: Y2025,
        layers: chapterLayers('zone', 'bt_facility', 'flow', 'aq_monitor'), camera: { center: [-73.94, 40.73], zoom: 9.85 },
        question: 'So what did those traffic shifts mean for the air?',
        captions: ['TRAFFIC CHANGE WAS ONLY PART OF THE STORY.', 'NEXT WE FOLLOW THE MONITORS.'],
        text: 'The next chapter looks at where air quality improved, where it did not, and how those changes were distributed across the city.',
        footer: 'Next: air quality', dwell: 7500,
      },
    ],
    // Chapter 4 · Follow the Air — from the network to individual monitoring locations.
    [
      {
        at: null, placement: 'upper-left', size: 'medium', variant: 'question', state: Y2025,
        layers: chapterLayers('aq_monitor'), camera: { center: [-73.94, 40.735], zoom: 10.35 },
        question: 'Did air quality improve everywhere?',
        captions: ['THE HEADLINE SAID THE AIR GOT CLEANER.', 'NOW WE CHECK THE MONITORS ONE BY ONE.'],
        text: 'Citywide and CRZ averages can summarize a broad trend. Individual monitoring sites show whether that improvement was experienced consistently across locations.',
        footer: 'Monitor-level PM2.5', dwell: 8000,
      },
      {
        at: null, placement: 'right', size: 'medium', variant: 'evidence', state: Y2025,
        layers: chapterLayers('aq_monitor'), camera: { center: [-73.94, 40.735], zoom: 10.25 },
        featured: { aq_monitor: usableMonitorIds },
        captions: ['THE MONITOR NETWORK DID NOT MOVE IN ONE DIRECTION.'],
        text: 'Some locations recorded lower PM2.5 after tolling began. Others changed little or moved higher.',
        airSummary: [
          { value: improvedAir.length, label: 'Improved', tone: 'green' },
          { value: uncertainAir.length, label: 'Mixed / uncertain', tone: 'neutral' },
          { value: higherAir.length, label: 'Supported higher', tone: 'red' },
          { value: aNo.length, label: 'No baseline', tone: 'neutral' },
        ],
        footer: '2024 → 2025 monitor comparison', dwell: 8000,
      },
      {
        at: { layer: 'aq_monitor', id: williamsburg.id }, side: 'right', size: 'compact', variant: 'monitor', tone: 'green', state: Y2025,
        layers: chapterLayers('aq_monitor'), camera: { center: [-73.99, 40.715], zoom: 11.65 },
        featured: { aq_monitor: new Set([williamsburg.id]) },
        captions: ['AT SOME SITES, THE IMPROVEMENT WAS CLEAR.'],
        monitorCard: monitorCard(williamsburg, 'green', 'Supported weather-adjusted decrease'),
        supportLine: 'PM2.5 was lower at this monitoring location in 2025.',
        footer: 'Selected monitor · lower PM2.5', dwell: 8500,
      },
      {
        at: { layer: 'aq_monitor', id: manhattanBridge.id }, side: 'left', size: 'compact', variant: 'monitor', tone: 'green', state: Y2025,
        layers: chapterLayers('aq_monitor'), camera: { center: [-73.985, 40.72], zoom: 11.55 },
        featured: { aq_monitor: new Set([manhattanBridge.id]) },
        captions: ['BUT THE SIZE OF THE CHANGE VARIED BY LOCATION.'],
        monitorCard: monitorCard(manhattanBridge, 'green', 'Supported weather-adjusted decrease'),
        footer: 'Selected monitor · lower PM2.5', dwell: 8000,
      },
      {
        at: { layer: 'aq_monitor', id: hamilton.id }, side: 'right', size: 'compact', variant: 'monitor', state: Y2025,
        layers: chapterLayers('aq_monitor'), camera: { center: [-73.93, 40.85], zoom: 11.55 },
        featured: { aq_monitor: new Set([hamilton.id]) },
        captions: ['NOT EVERY MONITOR GOT CLEANER.'],
        monitorCard: monitorCard(hamilton, 'red', 'Raw increase; weather-adjusted verdict uncertain'),
        supportLine: 'At this location, PM2.5 was higher in 2025 than in the 2024 baseline.',
        note: 'The raw value increased, but the weather-adjusted comparison remains uncertain.',
        footer: 'Selected monitor · higher PM2.5', dwell: 8500,
      },
      {
        at: null, placement: 'upper-right', size: 'medium', variant: 'close', state: Y2025,
        layers: chapterLayers('aq_monitor'), camera: { center: [-73.94, 40.735], zoom: 10.2 },
        captions: ['THE AVERAGE DOES NOT DESCRIBE EVERY LOCATION.', 'AIR-QUALITY CHANGE WAS GEOGRAPHICALLY UNEVEN.'],
        text: 'The topline improvement is real at the scale it measures, but monitor-level data show a more varied local picture.',
        note: 'Spatial overlap is evidence of a pattern, not proof that congestion pricing caused every PM2.5 change.',
        footer: 'Reading the local air-quality pattern', dwell: 8000,
      },
      {
        at: null, placement: 'upper-left', size: 'medium', variant: 'question', state: Y2025,
        layers: chapterLayers('aq_monitor', 'dac'), dacMode: 'percentile', overlayOpacity: 0.2, camera: { center: [-73.94, 40.735], zoom: 9.95 },
        question: 'Who was already carrying the greatest burden?',
        captions: ['THE NEXT QUESTION IS NOT ONLY WHERE AIR CHANGED.', 'IT IS WHO LIVED AROUND THOSE CHANGES.'],
        text: 'Next we compare traffic and PM2.5 patterns with neighborhoods that were already environmentally vulnerable before congestion pricing began.',
        footer: 'Next: Who Bears the Burden?', dwell: 8000,
      },
    ],
  ];
}
