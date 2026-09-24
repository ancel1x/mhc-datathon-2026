// The guided tour ("Play the story"): for each step, a list of beats. Each beat is one short callout placed
// next to the thing it explains (`at` = [lon, lat] or { layer, id } for a map feature; null = top of the
// screen), an optional camera move, an optional `state` (year / metric the map switches to when the beat
// starts, so the reader watches the change happen), and how long it stays (ms). Numbers come from summary.json
// and its reconciled block, so the tour never says something the story card does not.
import { fmtInt, fmtPct } from '../lib/format.js';

const Y2024 = { period: 'pre_2024', metric: 'absolute' };
const Y2025 = { period: 'post_2025', metric: 'change' };
const Y2026 = { period: 'post_2026_ytd', metric: 'change' };
const LAYER_KEYS = ['zone', 'crz_entry', 'bt_facility', 'flow', 'aq_monitor', 'dac', 'uhf42'];
const chapterLayers = (...shown) => Object.fromEntries(LAYER_KEYS.map((key) => [key, shown.includes(key)]));

export function buildGuide({ summary, geo }) {
  const s = summary ?? {};
  const rc = s.reconciled ?? {};
  const air = rc.air ?? [];
  const traffic = rc.traffic ?? [];
  const trafficById = (id) => traffic.find((row) => row.id === id) ?? {};
  const dotFeatureById = (id) => (geo?.dot_segment?.features ?? []).find((f) => f.properties?.id === id)?.properties ?? {};
  const increase = trafficById('rfk_manhattan');
  const decrease = trafficById('hlc');
  const aNo = air.filter((r) => r.class === 'no_baseline');
  const crossingIds = new Set((geo?.bt_facility?.features ?? []).map((f) => f.properties?.id).filter(Boolean));
  const noBaselineIds = new Set(aNo.map((r) => r.id).filter(Boolean));
  const usableMonitorIds = new Set(air.map((r) => r.id).filter((id) => id && !noBaselineIds.has(id)));
  const improvedAir = air.filter((row) => row.class === 'decrease');
  const uncertainAir = air.filter((row) => row.class === 'uncertain');
  const higherAir = air.filter((row) => row.class === 'increase');
  const airById = (id) => air.find((row) => row.id === id) ?? {};
  const airFeatureById = (id) => (geo?.aq_monitor?.features ?? []).find((f) => f.properties?.id === id)?.properties ?? {};
  const trafficFeatureById = (id) => (geo?.bt_facility?.features ?? []).find((f) => f.properties?.id === id)?.properties ?? {};
  const williamsburg = airById('aq_36061NY08552');
  const manhattanBridge = airById('aq_36061NY08454');
  const hamilton = airById('aq_36061NY12380');
  const hamiltonFeature = airFeatureById('aq_36061NY12380');
  const rfkFeature = trafficFeatureById('rfk_manhattan');
  const rfkBronx = trafficById('rfk_bronx');
  const mottHaven = airById('aq_36005NY11534');
  const crossBronx = airById('aq_36005NY12387');
  const mottFeature = airFeatureById('aq_36005NY11534');
  const deegan = dotFeatureById('dot_139020');
  const crossBay = trafficById('cross_bay');
  const qmt = trafficById('qmt');
  const williamsburgFeature = airFeatureById('aq_36061NY08552');
  const crossBayFeature = trafficFeatureById('cross_bay');
  const qmtFeature = trafficFeatureById('qmt');
  const rfkBronxFeature = trafficFeatureById('rfk_bronx');
  const highBridge = (geo?.uhf42?.features ?? []).find((f) => f.properties?.name === 'High Bridge - Morrisania')?.properties ?? {};
  const burdenScore = (feature) => feature.dac_combined_pct == null ? '—' : `${Math.round(feature.dac_combined_pct * 100)} / 100`;
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
        layers: chapterLayers('zone', 'bt_facility', 'flow'),
        camera: { center: [-73.96, 40.72], zoom: 10.05 },
        featured: { bt_facility: crossingIds },
        text: 'Bridge totals are only part of the picture. Each crossing is read hour by hour and by direction of travel, so a quiet daily total can still hide a busier morning rush.',
        panels: [
          { title: 'Nine MTA crossings', body: 'Regional traffic flow' },
          { title: 'Hourly, by direction', body: 'Rush hours read separately' },
        ],
        support: 'Together they create our traffic baseline.',
        footer: 'The crossing baseline',
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
        // no `state`: the chapter's before -> after replay (2024 -> 2025) plays under this first callout
        at: null, placement: 'upper-left', size: 'medium', variant: 'question',
        layers: chapterLayers('zone', 'bt_facility', 'flow'), camera: { center: [-73.95, 40.74], zoom: 10.2 },
        question: 'But what happened on the roads around the zone?',
        captions: ['FEWER VEHICLES ENTERED THE CRZ.', 'THAT DID NOT MEAN EVERY ROUTE GOT QUIETER.'],
        text: 'To understand the first traffic response, we need to look at the bridges, tunnels, and local corridors around the toll zone.',
        footer: 'Looking beyond the topline', dwell: 9500,
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
        at: null, placement: 'upper-right', size: 'medium', variant: 'close', state: Y2025,
        layers: chapterLayers('zone', 'bt_facility', 'flow'), camera: { center: [-73.95, 40.74], zoom: 10.05 },
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
    // Chapter 5 · Who Bears the Burden? — layer observed changes over pre-existing vulnerability.
    [
      {
        at: null, placement: 'upper-left', size: 'medium', variant: 'question', state: Y2025,
        layers: chapterLayers('aq_monitor'), camera: { center: [-73.94, 40.735], zoom: 10.2 },
        question: 'Who was already carrying the greatest burden?',
        captions: ['THESE CHANGES HAPPENED IN REAL NEIGHBORHOODS.', 'SOME OF THEM WERE ALREADY WORSE OFF.'],
        text: 'The same traffic or pollution change can mean something very different in a neighborhood that was already facing heavier environmental and health burdens.',
        footer: 'From change to equity', dwell: 8000,
      },
      {
        at: null, placement: 'upper-right', size: 'medium', variant: 'burden', state: Y2025,
        layers: chapterLayers('aq_monitor', 'dac'), dacMode: 'percentile', overlayOpacity: 0.72, camera: { center: [-73.94, 40.735], zoom: 9.95 },
        captions: ['SOME NEIGHBORHOODS ENTERED 2025 WITH FAR LESS ENVIRONMENTAL MARGIN.'],
        text: 'New York’s disadvantaged-community indicators combine environmental and socioeconomic burdens into a broader measure of vulnerability.',
        burdenLegend: { value: 'Higher 0–100 score', label: '= greater cumulative disadvantage / burden', note: 'Percentile shows how an area ranks relative to other areas.' },
        footer: 'Existing vulnerability before tolling', dwell: 8500,
      },
      {
        at: { layer: 'bt_facility', id: 'rfk_manhattan' }, side: 'left', size: 'medium', variant: 'combined', state: Y2025,
        layers: chapterLayers('bt_facility', 'flow', 'dac'), dacMode: 'percentile', overlayOpacity: 0.58, camera: { center: [-73.91, 40.79], zoom: 10.95 },
        featured: { bt_facility: new Set(['rfk_manhattan']) },
        captions: ['NOW PLACE THE TRAFFIC CHANGES ON TOP.', 'SOME UNFAVORABLE SHIFTS OVERLAP ALREADY-BURDENED COMMUNITIES.'],
        text: 'The citywide traffic decline was not experienced uniformly. Some routes that gained traffic run through or beside communities that were already carrying greater environmental burdens.',
        combinedEvidence: [
          { label: 'Traffic change', value: fmtPct(increase.pct_existing), tone: 'red' },
          { label: 'Community burden score', value: burdenScore(rfkFeature), tone: 'purple' },
          { label: 'Status', value: increase.dac_designated ? 'Disadvantaged community' : 'Not designated' },
        ],
        footer: 'Traffic + vulnerability overlap', dwell: 9500,
      },
      {
        at: { layer: 'aq_monitor', id: hamilton.id }, side: 'right', size: 'large', variant: 'combined', state: Y2025,
        layers: chapterLayers('aq_monitor', 'dac'), dacMode: 'percentile', overlayOpacity: 0.58, camera: { center: [-73.93, 40.85], zoom: 11.35 },
        featured: { aq_monitor: new Set([hamilton.id]) },
        captions: ['THE SAME QUESTION APPLIES TO THE AIR.'],
        text: 'Where PM2.5 stayed elevated or increased, the equity question is whether those monitoring locations sit within or near communities that were already environmentally vulnerable.',
        combinedEvidence: [
          { label: 'Monitor', value: hamilton.name },
          { label: '2024 PM2.5', value: `${hamilton.pre_mean?.toFixed(2) ?? '—'} µg/m³` },
          { label: '2025 PM2.5', value: `${hamilton.post_mean?.toFixed(2) ?? '—'} µg/m³` },
          { label: 'Raw change', value: `+${hamilton.delta_raw?.toFixed(2) ?? '—'} µg/m³`, tone: 'red' },
          { label: 'Local burden score', value: burdenScore(hamiltonFeature), tone: 'purple' },
          { label: 'Community status', value: hamilton.dac_designated ? 'Disadvantaged community' : 'Not designated' },
        ],
        note: 'Spatial overlap shows a pattern. It does not prove that congestion pricing caused the observed PM2.5 change.',
        footer: 'Air quality + vulnerability', dwell: 10500,
      },
      {
        at: null, placement: 'upper-left', size: 'medium', variant: 'burden', state: Y2025,
        layers: chapterLayers('aq_monitor', 'uhf42'), overlayOpacity: 0.66, camera: { center: [-73.93, 40.77], zoom: 9.95 },
        captions: ['ENVIRONMENTAL BURDEN IS ALSO A HEALTH STORY.', 'SOME OF THESE COMMUNITIES ALREADY FACE HIGHER ASTHMA BURDEN.'],
        text: 'Child asthma ER visit rates provide additional context for neighborhoods where traffic exposure and particulate pollution were already public-health concerns.',
        note: '2023 is the latest available year and predates congestion pricing. This layer shows pre-existing health burden, not an effect of the toll.',
        footer: 'Existing health burden', dwell: 9000,
      },
      {
        at: { layer: 'aq_monitor', id: hamilton.id }, side: 'left', size: 'large', variant: 'combined', state: Y2025,
        layers: chapterLayers('aq_monitor', 'dac'), dacMode: 'percentile', overlayOpacity: 0.66, camera: { center: [-73.933, 40.8465], zoom: 12.0 },
        featured: { aq_monitor: new Set([hamilton.id]) },
        captions: ['THIS IS WHAT “BURDEN” LOOKS LIKE WHEN THE LAYERS OVERLAP.'],
        combinedEvidence: [
          { label: 'Location', value: `${hamilton.name} · Washington Heights` },
          { label: 'PM2.5', value: `${hamilton.pre_mean?.toFixed(2) ?? '—'} → ${hamilton.post_mean?.toFixed(2) ?? '—'} µg/m³`, tone: 'red' },
          { label: 'Disadvantage', value: `${burdenScore(hamiltonFeature)} · designated`, tone: 'purple' },
          { label: 'Asthma context', value: `${hamilton.uhf42_asthma_ed_children?.toFixed(1) ?? '—'} ER visits per 10,000 children (2023)` },
        ],
        text: 'This location combines an unfavorable observed change with environmental or health burdens that were already present before congestion pricing began.',
        note: 'The raw PM2.5 value increased; the weather-adjusted verdict remains uncertain.',
        footer: 'Combined evidence', dwell: 10500,
      },
      {
        at: null, placement: 'upper-left', size: 'large', variant: 'close', state: Y2025,
        layers: chapterLayers('bt_facility', 'flow', 'aq_monitor', 'dac'), dacMode: 'percentile', overlayOpacity: 0.35, camera: { center: [-73.93, 40.76], zoom: 9.8 },
        captions: ['THE BURDEN WAS NOT CREATED IN 2025.', 'BUT NEW TRAFFIC AND AIR-QUALITY PATTERNS LANDED ON TOP OF AN UNEQUAL CITY.'],
        text: 'That is the environmental-justice question: not simply whether New York improved on average, but whether unfavorable local changes overlapped neighborhoods already facing greater environmental and health burdens.',
        closingQuestion: 'What happens when we stop looking citywide and zoom into the South Bronx?',
        transition: 'Next: Chapter 6 — Asthma Alley',
        footer: 'From citywide overlap to one neighborhood', dwell: 10000,
      },
    ],
    // Chapter 6 · Asthma Alley — a South Bronx case study grounded in mapped project evidence.
    [
      {
        at: null, placement: 'upper-left', size: 'medium', variant: 'question', state: Y2025,
        layers: chapterLayers('aq_monitor', 'dac'), dacMode: 'percentile', overlayOpacity: 0.34, camera: { center: [-73.91, 40.82], zoom: 11.05 },
        question: 'What changes when we stop looking citywide?',
        captions: ['THE CITYWIDE AVERAGE DOES NOT DESCRIBE EVERY NEIGHBORHOOD.', 'SO WE ZOOM INTO THE SOUTH BRONX.'],
        text: 'Mott Haven, Port Morris, and surrounding highway corridors have long carried heavy traffic, industrial activity, and elevated asthma burden.',
        footer: 'South Bronx close-up', dwell: 8500,
      },
      {
        at: { layer: 'aq_monitor', id: mottHaven.id }, side: 'left', size: 'medium', variant: 'combined', state: Y2025,
        layers: chapterLayers('aq_monitor', 'dac', 'uhf42'), dacMode: 'percentile', overlayOpacity: 0.38, camera: { center: [-73.91, 40.82], zoom: 11.25 },
        featured: { aq_monitor: new Set([mottHaven.id]) },
        captions: ['THIS AREA DID NOT START FROM A NEUTRAL BASELINE.'],
        text: 'The South Bronx entered 2025 with existing environmental and health burdens that make local traffic and pollution changes especially important.',
        combinedEvidence: [
          { label: 'Disadvantage score', value: burdenScore(mottFeature), tone: 'purple' },
          { label: 'Asthma burden', value: `${mottHaven.uhf42_asthma_ed_children?.toFixed(1) ?? '—'} ER visits per 10,000 children (2023)`, tone: 'purple' },
          { label: 'Highway corridor', value: 'Major Deegan Expressway' },
        ],
        footer: 'Existing burden before tolling', dwell: 9500,
      },
      {
        at: { layer: 'bt_facility', id: 'rfk_bronx' }, side: 'right', size: 'large', variant: 'combined', state: Y2025,
        layers: chapterLayers('bt_facility', 'flow', 'dac'), dacMode: 'percentile', overlayOpacity: 0.28, camera: { center: [-73.91, 40.81], zoom: 11.05 },
        featured: { bt_facility: new Set(['rfk_bronx']) },
        captions: ['NOW LOOK AT THE ROADS.', 'THE LOCAL TRAFFIC STORY MAY NOT MATCH THE CRZ AVERAGE.'],
        combinedEvidence: [
          { label: 'RFK Bridge Bronx approach · 2024', value: `${fmtInt(rfkBronx.avg_daily_2024)} vehicles/day` },
          { label: 'RFK Bridge Bronx approach · 2025', value: `${fmtInt(rfkBronx.avg_daily_2025)} vehicles/day` },
          { label: 'Change', value: `${fmtPct(rfkBronx.pct_existing)} · uncertain`, tone: 'red' },
          { label: 'Major Deegan · Northbound', value: `${fmtInt(deegan.latest_adv)} vehicles/day · Oct–Nov 2025 snapshot` },
        ],
        text: 'The nearby RFK Bronx approach was slightly higher in 2025, but its interval includes zero. The mapped Major Deegan count is post-toll context only, with no before/after comparison.',
        footer: 'South Bronx traffic evidence', dwell: 11000,
      },
      {
        at: { layer: 'aq_monitor', id: mottHaven.id }, side: 'left', size: 'large', variant: 'combined', state: Y2025,
        layers: chapterLayers('aq_monitor', 'dac'), dacMode: 'percentile', overlayOpacity: 0.24, camera: { center: [-73.91, 40.825], zoom: 11.35 },
        featured: { aq_monitor: new Set([mottHaven.id, crossBronx.id]) },
        captions: ['THEN LOOK AT THE AIR.'],
        combinedEvidence: [
          { label: mottHaven.name, value: `${mottHaven.pre_mean?.toFixed(2) ?? '—'} → ${mottHaven.post_mean?.toFixed(2) ?? '—'} µg/m³ · +${mottHaven.delta_raw?.toFixed(2) ?? '—'} (${mottHaven.pct_raw?.toFixed(1) ?? '—'}%)` },
          { label: 'Mott Haven verdict', value: 'No clear weather-adjusted change' },
          { label: crossBronx.name, value: `${crossBronx.pre_mean?.toFixed(2) ?? '—'} → ${crossBronx.post_mean?.toFixed(2) ?? '—'} µg/m³ · −${Math.abs(crossBronx.delta_raw ?? 0).toFixed(2)} (${crossBronx.pct_raw?.toFixed(1) ?? '—'}%)` },
          { label: 'Cross Bronx verdict', value: 'No clear weather-adjusted change' },
        ],
        text: 'Mott Haven was slightly higher and Cross Bronx was slightly lower in the raw readings, but neither monitor showed a statistically clear weather-adjusted change.',
        footer: 'South Bronx PM2.5', dwell: 11000,
      },
      {
        at: null, placement: 'upper-right', size: 'wide', variant: 'split', state: Y2025,
        layers: chapterLayers('zone', 'bt_facility', 'flow', 'aq_monitor'), camera: { center: [-73.94, 40.79], zoom: 9.9 },
        featured: { bt_facility: new Set(['rfk_bronx']), aq_monitor: new Set([mottHaven.id, crossBronx.id]) },
        captions: ['BOTH STORIES CAN BE TRUE AT THE SAME TIME.'],
        text: 'A broad improvement inside the toll zone does not mean every neighborhood experienced the same traffic or air-quality pattern.',
        panels: [
          { title: 'CITYWIDE / CRZ', body: '~11% fewer CRZ entries\n22% lower modeled daily maximum PM2.5' },
          { title: 'SOUTH BRONX LOCAL', body: `RFK Bronx ${fmtPct(rfkBronx.pct_existing)} · uncertain\nMott Haven +${mottHaven.delta_raw?.toFixed(2) ?? '—'} µg/m³ · uncertain\nCross Bronx −${Math.abs(crossBronx.delta_raw ?? 0).toFixed(2)} µg/m³ · uncertain` },
        ],
        footer: 'One policy · different geographic scales', dwell: 11000,
      },
      {
        at: { layer: 'aq_monitor', id: mottHaven.id }, side: 'left', size: 'large', variant: 'combined', state: Y2025,
        layers: chapterLayers('bt_facility', 'aq_monitor', 'dac', 'uhf42'), dacMode: 'percentile', overlayOpacity: 0.34, camera: { center: [-73.91, 40.82], zoom: 11.2 },
        featured: { bt_facility: new Set(['rfk_bronx']), aq_monitor: new Set([mottHaven.id]) },
        captions: ['THAT DIFFERENCE MATTERS MORE WHERE THE BASELINE BURDEN WAS ALREADY HIGH.'],
        text: 'In the South Bronx, local traffic and PM2.5 observations sit on top of long-standing environmental and health disparities.',
        combinedEvidence: [
          { label: 'Location', value: 'Mott Haven–Port Morris' },
          { label: 'Traffic', value: `RFK Bronx ${fmtPct(rfkBronx.pct_existing)} · uncertain` },
          { label: 'PM2.5', value: `Mott Haven ${mottHaven.pre_mean?.toFixed(2) ?? '—'} → ${mottHaven.post_mean?.toFixed(2) ?? '—'} µg/m³ · uncertain` },
          { label: 'Disadvantage', value: `${burdenScore(mottFeature)} · designated`, tone: 'purple' },
          { label: 'Asthma', value: `${mottHaven.uhf42_asthma_ed_children?.toFixed(1) ?? '—'} ER visits per 10,000 children · 2023`, tone: 'purple' },
        ],
        note: 'These overlapping patterns do not by themselves prove that congestion pricing caused the observed health or pollution differences.',
        footer: 'Local burden in context', dwell: 11000,
      },
      {
        at: null, placement: 'upper-left', size: 'large', variant: 'close', state: Y2025,
        layers: chapterLayers('bt_facility', 'aq_monitor', 'dac'), dacMode: 'percentile', overlayOpacity: 0.3, camera: { center: [-73.91, 40.82], zoom: 10.75 },
        featured: { bt_facility: new Set(['rfk_bronx']), aq_monitor: new Set([mottHaven.id, crossBronx.id]) },
        captions: ['THE AVERAGE DOES NOT DESCRIBE EVERY NEIGHBORHOOD.', 'THE NEXT QUESTION IS WHETHER THESE EARLY PATTERNS LASTED.'],
        text: 'The first year gives us a local snapshot. To understand whether these changes were temporary or persistent, we need to move forward in time.',
        closingQuestion: 'What changed one year later?',
        transition: 'Next: Chapter 7 — One Year Later',
        footer: 'From local variation to persistence', dwell: 10000,
      },
    ],
    // Chapter 7 · One Year Later — matched Jan–Aug 2024/2025/2026 persistence evidence.
    [
      {
        // no `state`: the chapter's before -> after replay (2025 -> 2026) plays under this first callout
        at: null, placement: 'upper-left', size: 'medium', variant: 'question',
        layers: chapterLayers('bt_facility', 'flow', 'aq_monitor'), camera: { center: [-73.91, 40.82], zoom: 10.75 },
        question: 'What changed one year later?',
        captions: ['THE FIRST YEAR SHOWED US WHERE THE PATTERNS EMERGED.', 'NOW WE ASK WHICH ONES LASTED.'],
        text: '2026 lets us test whether the early traffic and air-quality patterns persisted, reversed, or remain uncertain.',
        statusBadge: '2026 SO FAR',
        note: '2026 comparisons use the available January–August period only.',
        footer: '2026 follow-up', dwell: 9500,
      },
      {
        at: null, placement: 'upper-right', size: 'wide', variant: 'trend', state: Y2026,
        layers: chapterLayers('bt_facility', 'flow'), camera: { center: [-73.96, 40.69], zoom: 9.55 },
        featured: { bt_facility: new Set(['qmt', 'cross_bay']) },
        captions: ['START WITH THE ROADS.'],
        trendSeries: [
          {
            title: qmt.name,
            values: [
              { year: '2024', value: fmtInt(qmtFeature.periods?.ytd_2024?.avg_daily), amount: qmtFeature.periods?.ytd_2024?.avg_daily },
              { year: '2025', value: fmtInt(qmtFeature.periods?.ytd_2025?.avg_daily), amount: qmtFeature.periods?.ytd_2025?.avg_daily },
              { year: '2026', value: fmtInt(qmtFeature.periods?.post_2026_ytd?.avg_daily), amount: qmtFeature.periods?.post_2026_ytd?.avg_daily },
            ],
            status: 'PERSISTED', tone: 'green', detail: `${fmtPct(qmt.jan_aug?.['2025']?.pct)} → ${fmtPct(qmt.jan_aug?.['2026']?.pct)} vs Jan–Aug 2024`,
          },
          {
            title: crossBay.name,
            values: [
              { year: '2024', value: fmtInt(crossBayFeature.periods?.ytd_2024?.avg_daily), amount: crossBayFeature.periods?.ytd_2024?.avg_daily },
              { year: '2025', value: fmtInt(crossBayFeature.periods?.ytd_2025?.avg_daily), amount: crossBayFeature.periods?.ytd_2025?.avg_daily },
              { year: '2026', value: fmtInt(crossBayFeature.periods?.post_2026_ytd?.avg_daily), amount: crossBayFeature.periods?.post_2026_ytd?.avg_daily },
            ],
            status: 'REVERSED', tone: 'green', detail: `${fmtPct(crossBay.jan_aug?.['2025']?.pct)} → ${fmtPct(crossBay.jan_aug?.['2026']?.pct)} vs Jan–Aug 2024`,
          },
        ],
        text: 'The Queens Midtown Tunnel’s reduction strengthened. Cross Bay moved from a supported increase in 2025 to a supported decrease in 2026.',
        footer: 'Traffic over time', dwell: 11000,
      },
      {
        at: { layer: 'aq_monitor', id: williamsburg.id }, side: 'right', size: 'large', variant: 'trend', state: Y2026,
        layers: chapterLayers('aq_monitor'), camera: { center: [-73.99, 40.715], zoom: 11.45 },
        featured: { aq_monitor: new Set([williamsburg.id]) },
        captions: ['THEN CHECK THE AIR.'],
        trendSeries: [
          {
            title: williamsburg.name,
            values: [
              { year: '2024', value: `${williamsburgFeature.periods?.ytd_2024?.mean?.toFixed(2) ?? '—'} µg/m³`, amount: williamsburgFeature.periods?.ytd_2024?.mean },
              { year: '2025', value: `${williamsburgFeature.periods?.ytd_2025?.mean?.toFixed(2) ?? '—'} µg/m³`, amount: williamsburgFeature.periods?.ytd_2025?.mean },
              { year: '2026', value: `${williamsburgFeature.periods?.post_2026_ytd?.mean?.toFixed(2) ?? '—'} µg/m³`, amount: williamsburgFeature.periods?.post_2026_ytd?.mean },
            ],
            status: 'PERSISTED', tone: 'green', detail: `${williamsburg.jan_aug?.['2025']?.delta_raw?.toFixed(2) ?? '—'} → ${williamsburg.jan_aug?.['2026']?.delta_raw?.toFixed(2) ?? '—'} µg/m³ vs Jan–Aug 2024`,
          },
        ],
        text: 'Lower PM2.5 remained visible at Williamsburg Bridge in the comparable 2026 period, and the supported decrease became larger.',
        footer: 'PM2.5 over time', dwell: 10000,
      },
      {
        at: { layer: 'aq_monitor', id: mottHaven.id }, side: 'left', size: 'large', variant: 'combined', state: Y2026,
        layers: chapterLayers('bt_facility', 'aq_monitor', 'dac'), dacMode: 'percentile', overlayOpacity: 0.25, camera: { center: [-73.91, 40.82], zoom: 11.15 },
        featured: { bt_facility: new Set(['rfk_bronx']), aq_monitor: new Set([mottHaven.id, crossBronx.id]) },
        captions: ['WHAT ABOUT THE SOUTH BRONX?'],
        text: 'The local case study matters most if we can see whether its early pattern continued.',
        combinedEvidence: [
          { label: 'RFK Bronx traffic', value: `${fmtPct(rfkBronx.jan_aug?.['2025']?.pct)} → ${fmtPct(rfkBronx.jan_aug?.['2026']?.pct)} vs Jan–Aug 2024` },
          { label: 'Traffic status', value: 'STILL UNCERTAIN' },
          { label: 'Mott Haven PM2.5', value: `+${mottHaven.jan_aug?.['2025']?.delta_raw?.toFixed(2) ?? '—'} → +${mottHaven.jan_aug?.['2026']?.delta_raw?.toFixed(2) ?? '—'} µg/m³ vs 2024` },
          { label: 'Cross Bronx PM2.5', value: `${crossBronx.jan_aug?.['2025']?.delta_raw?.toFixed(2) ?? '—'} → ${crossBronx.jan_aug?.['2026']?.delta_raw?.toFixed(2) ?? '—'} µg/m³ vs 2024` },
          { label: 'Air status', value: 'STILL UNCERTAIN' },
        ],
        note: 'All three 2026 intervals include zero; the available January–August evidence does not support a clear persistence or reversal verdict.',
        footer: 'South Bronx · 2026 follow-up', dwell: 11500,
      },
      {
        at: null, placement: 'upper-right', size: 'wide', variant: 'status', state: Y2026,
        layers: chapterLayers('bt_facility', 'aq_monitor'), camera: { center: [-73.94, 40.73], zoom: 9.55 },
        featured: { bt_facility: new Set(['qmt', 'cross_bay', 'rfk_bronx']), aq_monitor: new Set([williamsburg.id, mottHaven.id, crossBronx.id]) },
        captions: ['ONE YEAR LATER, THE STORY IS NOT ONE OF SIMPLE CONTINUATION.', 'SOME PATTERNS LASTED. SOME CHANGED. SOME STILL NEED MORE DATA.'],
        statusColumns: [
          { title: 'PERSISTED', tone: 'blue', items: ['Queens Midtown traffic reduction', 'Williamsburg Bridge PM2.5 decrease'] },
          { title: 'REVERSED', tone: 'green', items: ['Cross Bay traffic: increase → decrease'] },
          { title: 'STILL UNCERTAIN', tone: 'neutral', items: ['RFK Bronx traffic', 'Mott Haven PM2.5', 'Cross Bronx PM2.5'] },
        ],
        footer: '2026 status check', dwell: 10500,
      },
      {
        at: null, placement: 'upper-left', size: 'large', variant: 'caveat', state: Y2026,
        layers: chapterLayers('bt_facility', 'aq_monitor'), camera: { center: [-73.94, 40.73], zoom: 9.8 },
        captions: ['TIME ADDS EVIDENCE — BUT NOT CERTAINTY EVERYWHERE.'],
        text: 'Differences in monitoring coverage, incomplete 2026 data, seasonal variation, and non-matching observation periods can limit direct year-to-year comparisons.',
        caveatList: [
          'Traffic and air comparisons use January–August 2024, 2025, and 2026—not complete 2026.',
          'Hunts Point has no eligible 2024 PM2.5 baseline.',
          'Midtown West moved in July 2026, so it has no eligible Jan–Aug 2026 comparison.',
        ],
        footer: 'What remains uncertain', dwell: 10000,
      },
      {
        at: null, placement: 'upper-left', size: 'large', variant: 'close', state: Y2026,
        layers: chapterLayers('bt_facility', 'aq_monitor', 'dac'), dacMode: 'percentile', overlayOpacity: 0.3, camera: { center: [-73.93, 40.75], zoom: 9.65 },
        featured: { bt_facility: new Set(['rfk_bronx']), aq_monitor: new Set([mottHaven.id, crossBronx.id]) },
        question: 'If we know where the burden is, what should New York do with that knowledge?',
        captions: ['THE FIRST SEVEN CHAPTERS ASKED WHAT HAPPENED.', 'THE FINAL QUESTION IS WHAT COULD HAPPEN INSTEAD.'],
        text: 'The evidence now gives us a way to identify where intervention could matter most.',
        transition: 'Next: What Could NYC Become?',
        footer: 'From evidence to intervention', dwell: 10000,
      },
    ],
    // Chapter 8 · What Could NYC Become? — a data-grounded intervention hypothesis, not a forecast.
    [
      {
        at: null, placement: 'upper-left', size: 'large', variant: 'question', state: Y2026,
        layers: chapterLayers('bt_facility', 'flow', 'aq_monitor', 'dac'), dacMode: 'percentile', overlayOpacity: 0.22, camera: { center: [-73.94, 40.73], zoom: 9.55 },
        question: 'So where should New York intervene?',
        captions: ['WE STARTED WITH A CITYWIDE HEADLINE.', 'THE MAP LED US SOMEWHERE MORE SPECIFIC.'],
        text: 'Traffic changed unevenly. Air quality changed unevenly. Some of those patterns overlapped communities already carrying greater environmental and health burdens.',
        footer: 'From evidence to intervention', dwell: 9000,
      },
      {
        at: { layer: 'dot_segment', id: 'dot_139020' }, side: 'left', size: 'large', variant: 'combined', state: Y2026,
        layers: chapterLayers('bt_facility', 'aq_monitor', 'dac'), dacMode: 'percentile', overlayOpacity: 0.42, camera: { center: [-73.928, 40.8425], zoom: 11.45 },
        featured: { bt_facility: new Set(['rfk_bronx']), aq_monitor: new Set([hamilton.id, mottHaven.id, crossBronx.id]) },
        captions: ['THIS LOCATION EMERGED FROM THE EVIDENCE.'],
        combinedEvidence: [
          { label: 'Location', value: 'Major Deegan Expressway · High Bridge' },
          { label: 'Traffic', value: `${fmtInt(deegan.latest_adv)} northbound vehicles/day · Oct–Nov 2025 snapshot` },
          { label: 'Nearby PM2.5 concern', value: `Hamilton Bridge ${hamilton.pre_mean?.toFixed(2) ?? '—'} → ${hamilton.post_mean?.toFixed(2) ?? '—'} µg/m³ · uncertain` },
          { label: 'Environmental burden', value: `${burdenScore(deegan)} · disadvantaged community`, tone: 'purple' },
          { label: 'Asthma context', value: `${highBridge.asthma_ed_children?.toFixed(1) ?? '—'} ER visits per 10,000 children · 2023`, tone: 'purple' },
          { label: '2026 status', value: 'STILL UNCERTAIN' },
        ],
        text: 'No single metric selected this place. The case comes from the overlap of transportation, air-quality, environmental-justice, and health evidence.',
        footer: 'Why this site', dwell: 11500,
      },
      {
        at: { layer: 'dot_segment', id: 'dot_139020' }, side: 'right', size: 'large', variant: 'combined', state: Y2025,
        layers: chapterLayers('bt_facility', 'flow', 'aq_monitor', 'dac'), dacMode: 'percentile', overlayOpacity: 0.3, camera: { center: [-73.928, 40.8425], zoom: 12.0 },
        featured: { bt_facility: new Set(['rfk_bronx']), aq_monitor: new Set([mottHaven.id, crossBronx.id]) },
        captions: ['TODAY, THIS SPACE IS ORGANIZED AROUND MOVING VEHICLES.'],
        text: 'The same infrastructure that carries regional traffic also shapes local exposure, neighborhood connections, and how much land remains available for other uses.',
        combinedEvidence: [
          { label: 'Major Deegan · Northbound', value: `${fmtInt(deegan.latest_adv)} vehicles/day · post-toll snapshot` },
          { label: 'Nearby RFK Bronx approach', value: `${fmtInt(rfkBronx.avg_daily_2025)} vehicles/day in 2025` },
          { label: 'RFK Bronx trucks', value: `${fmtInt(rfkBronxFeature.periods?.post_2025?.trucks_avg_daily)} per day · ${(rfkBronxFeature.periods?.post_2025?.truck_share * 100).toFixed(1)}% share` },
          { label: 'Nearby communities', value: 'High Bridge–Morrisania · Mott Haven–Port Morris · Crotona–Tremont' },
        ],
        note: 'The Deegan record has no matched pre-toll count, so its volume is context—not evidence of a traffic increase.',
        footer: 'Existing condition', dwell: 11000,
      },
      {
        at: { layer: 'dot_segment', id: 'dot_139020' }, side: 'left', size: 'wide', variant: 'scenario', state: Y2026,
        layers: chapterLayers('bt_facility', 'flow', 'aq_monitor', 'dac'), dacMode: 'percentile', overlayOpacity: 0.3, camera: { center: [-73.928, 40.8425], zoom: 11.75 },
        featured: { aq_monitor: new Set([mottHaven.id, crossBronx.id]) },
        question: 'What if part of this road space were repurposed?',
        statusBadge: 'SCENARIO · NOT AN OBSERVED RESULT',
        captions: ['A REDESIGN WOULD CHANGE MORE THAN THE STREETSCAPE.'],
        scenarioPanels: [
          { title: 'TRAFFIC', body: 'Some trips could disappear, shift modes, take other routes, or relocate to nearby streets. The project does not model how many.' },
          { title: 'AIR QUALITY', body: 'Less local vehicle exposure could reduce traffic-related pollution, but benefits depend on where displaced traffic moves and how exposure changes.' },
          { title: 'EQUITY', body: `A ${burdenScore(deegan)} disadvantaged-community corridor with ${highBridge.asthma_ed_children?.toFixed(1) ?? '—'} child asthma ER visits per 10,000 could receive public investment instead of additional exposure.` },
        ],
        footer: 'Scenario reasoning · traffic + air + equity', dwell: 12500,
      },
      {
        at: null, placement: 'upper-right', size: 'large', variant: 'caveat', state: Y2026,
        layers: chapterLayers('bt_facility', 'flow', 'dac'), dacMode: 'percentile', overlayOpacity: 0.24, camera: { center: [-73.91, 40.82], zoom: 10.9 },
        featured: { bt_facility: new Set(['rfk_bronx']) },
        captions: ['RECLAIMING ROAD SPACE DOES NOT MAKE TRAFFIC DISAPPEAR.', 'THE DESIGN HAS TO ACCOUNT FOR WHERE IT GOES NEXT.'],
        text: 'Any future redesign would need to evaluate nearby routes, transit alternatives, truck movement, street geometry, and potential pollution displacement before reducing major road capacity.',
        caveatList: [
          'Potential network effects—not predictions—include pressure on Bruckner Boulevard, the Grand Concourse, Third Avenue, and other connecting streets.',
          'Truck access and regional travel would need explicit alternatives.',
          'Moving traffic into nearby disadvantaged communities would recreate the same equity problem.',
        ],
        footer: 'The displacement problem', dwell: 11000,
      },
      {
        at: { layer: 'dot_segment', id: 'dot_139020' }, side: 'right', size: 'large', variant: 'opportunity', state: Y2026,
        layers: chapterLayers('aq_monitor', 'dac'), dacMode: 'percentile', overlayOpacity: 0.3, camera: { center: [-73.928, 40.8425], zoom: 12.05 },
        featured: {},
        statusBadge: 'PHASE 2 DESIGN OPPORTUNITY',
        captions: ['BUT ROAD SPACE IS ALSO CITY SPACE.'],
        text: 'If transportation demand can be reduced or reorganized without shifting the burden elsewhere, that land becomes an opportunity for something different: green infrastructure, safer public space, stormwater management, and neighborhood reconnection.',
        opportunityList: ['Green infrastructure', 'Safer public space', 'Stormwater management', 'Neighborhood reconnection'],
        note: 'These are future design opportunities, not measured Phase 1 outcomes.',
        footer: 'From transportation infrastructure to neighborhood infrastructure', dwell: 10500,
      },
      {
        at: null, placement: 'upper-left', size: 'large', variant: 'close', state: Y2026,
        layers: chapterLayers('aq_monitor', 'dac'), dacMode: 'percentile', overlayOpacity: 0.3, camera: { center: [-73.928, 40.8425], zoom: 11.45 },
        featured: { aq_monitor: new Set([mottHaven.id, crossBronx.id]) },
        captions: ["CONGESTION PRICING CHANGED ONE PART OF NEW YORK'S TRANSPORTATION SYSTEM.", 'THE DATA SHOW WHY THE NEXT CHANGE HAS TO BE MORE LOCAL.'],
        closingQuestion: 'What could this place become?',
        text: 'Phase 1 identified the problem and the place. Phase 2 begins with the question of how to redesign it without simply moving the burden somewhere else.',
        finalLabel: 'PHASE 1 COMPLETE',
        transition: 'Next: Reimagining the corridor',
        footer: 'Major Deegan Expressway · High Bridge', dwell: 11000,
      },
    ],
  ];
}
