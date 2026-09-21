// Story copy, templated with live numbers from summary.json. Inline markup: `...` renders as a tabular
// number span, **...** as strong. Every number falls back to "—" when null.
//
// Each step shows: title, ONE lede sentence saying what happened, one or two sentences saying why it
// matters, and three stats. Every stat has a plain label (what it is) and a sub-line (what it means).
// Everything else lives under `details`, behind a collapsed "Details" disclosure.
import { DASH, fmtCompact, fmtDate, fmtDelta, fmtHour, fmtInt, fmtMoney, fmtNum, fmtPct, fmtShare, isNum, shortName, titleCase } from '../lib/format.js';

const n = (s) => `\`${s}\``;
const mean = (arr) => { const v = arr.filter(isNum); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
const argmax = (arr) => (Array.isArray(arr) && arr.length ? arr.reduce((bi, v, i, a) => (isNum(v) && (!isNum(a[bi]) || v > a[bi]) ? i : bi), 0) : null);
const sumCounts = (c) => (c ? (c.improved ?? 0) + (c.unchanged ?? 0) + (c.worsened ?? 0) + (c.insufficient ?? 0) : 0);
const joinNames = (list) => (list.length <= 1 ? list.join('') : `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`);
/** "−1.0% to −2.5%" from a list of percentages (smallest move first). */
const pctRange = (list) => {
  const v = list.filter(isNum).sort((a, b) => Math.abs(a) - Math.abs(b));
  if (!v.length) return DASH;
  return v[0] === v[v.length - 1] ? fmtPct(v[0]) : `${fmtPct(v[0])} to ${fmtPct(v[v.length - 1])}`;
};

export function buildStory({ summary, tolls, sources, geo, indexes }) {
  const s = summary ?? {};
  const crz = s.crz ?? {};
  const bt = s.bt ?? {};
  const dot = s.dot ?? {};
  const aq = s.aq ?? {};
  const eq = s.equity ?? {};
  const t = tolls ?? {};
  const car = t.ezpass_rates?.[0] ?? {};
  const bigTruck = t.ezpass_rates?.[t.ezpass_rates.length - 1] ?? {};
  const startDate = fmtDate(s.cp_start ?? '2025-01-05');

  const up = bt.facilities_up ?? [];
  const down = bt.facilities_down ?? [];
  const upInDac = up.filter((f) => f.dac_designated);
  const insideSites = aq.inside_sites ?? [];
  const insideTotal = sumCounts(aq.inside) || insideSites.length;
  const insideImproved = insideSites.filter((x) => x?.classification === 'improved');
  const control = aq.control ?? {};
  const southBronx = (aq.south_bronx ?? []).filter((r) => r?.basis === 'post_2025_vs_pre_2024');
  const sbImproved = southBronx.filter((r) => r?.classification === 'improved');
  const lagged = (aq.south_bronx ?? []).filter((r) => r?.relative_to_control === 'lagged control');
  const noBaseline = (aq.south_bronx ?? []).filter((r) => r?.basis === 'post_2026ytd_vs_ytd_2025');
  const worsened = (geo?.aq_monitor?.features ?? []).map((f) => f.properties ?? {}).filter((p) => p.classification === 'worsened');
  const worsenedInDac = worsened.filter((p) => p.dac_designated);
  const peakHour = argmax(crz.hourly_weekday_2025);
  const mix = crz.class_mix_2025 ?? {};
  const trucksShare = isNum(mix.trucks_single) || isNum(mix.trucks_multi) ? (mix.trucks_single ?? 0) + (mix.trucks_multi ?? 0) : null;

  // Child asthma ER visits: the 2023 all-cause rate per 10,000 children (newest published) when the bundle has it,
  // else the older PM2.5-attributable rate per 100,000.
  const uhf = (geo?.uhf42?.features ?? []).map((f) => f.properties ?? {});
  const has2023 = uhf.some((p) => isNum(p.asthma_ed_children));
  const asthmaOf = (p) => (has2023 ? p?.asthma_ed_children : p?.asthma_ed_pm25_children);
  const asthmaUnit = has2023 ? 'per 10,000 children in 2023' : 'per 100,000 children';
  const asthmaSorted = uhf.filter((p) => isNum(asthmaOf(p))).sort((a, b) => asthmaOf(b) - asthmaOf(a));
  const asthmaHi = asthmaSorted[0];
  const asthmaLo = asthmaSorted[asthmaSorted.length - 1];

  const highlights = [...(dot.highlights ?? [])].filter((h) => isNum(h?.pct_change)).sort((a, b) => Math.abs(b.pct_change) - Math.abs(a.pct_change)).slice(0, 4);
  const sourcesCount = sources?.length ?? 0;
  const dotOther = isNum(dot.post_only_segments) ? dot.post_only_segments + (dot.pre_only_segments ?? 0) : null;
  const dotTotal = dot.segments_on_map ?? (isNum(dotOther) && isNum(dot.matched_segments) ? dotOther + dot.matched_segments : null);
  const rockaways = up.filter((f) => /rockaway/i.test(f.role ?? ''));
  const insideGain = mean(insideImproved.map((x) => x.delta_adj_control));

  // The highway what-if (Major Deegan / BQE): counts on the roads themselves, the crossings that feed them,
  // the monitors beside them. Reasoned from the data, not modeled.
  const upById = (id) => up.find((f) => f.id === id);
  const dotFeats = (geo?.dot_segment?.features ?? []).map((f) => f.properties ?? {});
  const deegan = dotFeats.filter((p) => /major deegan/i.test(p.street ?? '')).sort((a, b) => (b.latest_adv ?? 0) - (a.latest_adv ?? 0))[0];
  const bqe = dotFeats.filter((p) => /brooklyn queens expressway/i.test(p.street ?? '') && isNum(p.pct_change));
  const bqeBoth = bqe.length ? bqe.reduce((a, p) => a + (p.post_adv ?? 0), 0) : null;
  const bqeYear = bqe[0]?.pre_months?.[0]?.slice(0, 4) ?? 'before the toll';
  const hamilton = [...(dot.highlights ?? [])].filter((h) => /hamilton/i.test(h.street ?? '')).sort((a, b) => Math.abs(b.pct_change ?? 0) - Math.abs(a.pct_change ?? 0))[0];
  const mottHaven = southBronx.find((r) => /mott haven/i.test(r.name ?? ''));
  const crossBronx = southBronx.find((r) => /cross bronx/i.test(r.name ?? ''));
  const bqeMonitor = (geo?.aq_monitor?.features ?? []).map((f) => f.properties ?? {}).find((p) => /^bqe/i.test(p.name ?? ''));
  const bqeMonitorPhrase = { improved: 'beat the citywide trend', unchanged: 'followed the citywide trend', worsened: 'got worse' }[bqeMonitor?.classification] ?? 'has too little data to judge';

  return [
    {
      kicker: '2024 · before the toll',
      title: 'Before the toll',
      lede: `In 2024, before any toll, about ${n(fmtCompact(bt.system_avg_daily_2024))} vehicles a day used the MTA's nine bridges and tunnels, and the city's air already carried about ${n(fmtPct(isNum(aq.citywide_pm25_2009) && isNum(aq.citywide_pm25_2024) ? Math.abs((aq.citywide_pm25_2024 - aq.citywide_pm25_2009) / aq.citywide_pm25_2009) * 100 : null, { signed: false, digits: 0 }))} less fine-particle pollution than in 2009.`,
      body: 'This is the starting line. Everything that follows is measured against it, so a change only counts if it beats what was already happening.',
      stats: [
        { label: 'Vehicles a day on the nine MTA crossings', value: fmtCompact(bt.system_avg_daily_2024), sub: 'the 2024 starting point' },
        { label: 'Fine-particle pollution (PM2.5), citywide', value: `${fmtNum(aq.citywide_pm25_2024)} µg/m³`, sub: `down from ${fmtNum(aq.citywide_pm25_2009)} in 2009, long before the toll` },
        { label: 'Street-level air monitors in this story', value: fmtInt(aq.sites_total), sub: 'inside and outside the zone' },
      ],
      details: {
        paragraphs: [
          'PM2.5 is the fine soot from engines, heating and cooking that gets deep into the lungs. It is measured in micrograms per cubic metre (µg/m³): lower is better, and a change of one unit is a lot for a single street.',
          'On the map, bigger discs and thicker lines mean more vehicles. The lines move in the direction traffic travels across each crossing. Click any crossing or monitor for its own timeline.',
        ],
      },
    },
    {
      kicker: 'January 5, 2025',
      title: 'The toll begins',
      lede: `On ${n(startDate)}, driving into Manhattan below 60th Street started costing most cars ${n(fmtMoney(car.peak))} a day.`,
      body: 'It is the first charge of its kind in the United States. The goal: fewer cars in the busiest square miles of the country, and cleaner air for the people who live along the routes into them.',
      stats: [
        { label: 'A car, daytime', value: fmtMoney(car.peak), sub: `once a day · weekdays ${t.peak_hours?.weekday ?? '5 AM – 9 PM'}` },
        { label: 'A car, overnight', value: fmtMoney(car.overnight), sub: 'three quarters off, 9 PM to 5 AM' },
        { label: 'The largest trucks', value: fmtMoney(bigTruck.peak), sub: 'the highest rate' },
      ],
      details: {
        paragraphs: [
          `Taxis and app rides pay a small fee per trip instead, and drivers arriving through the four tolled tunnels get a credit. The ${(t.excluded_roadways ?? []).slice(0, 2).join(' and ') || 'FDR Drive and West Side Highway'} stay free: you can drive along the island's edges without paying, but not turn into the grid.`,
          `The car toll is scheduled to rise to ${n(fmtMoney(t.scheduled_increases?.[0]?.peak_car))} in ${n(t.scheduled_increases?.[0]?.year ?? DASH)} and ${n(fmtMoney(t.scheduled_increases?.[1]?.peak_car))} in ${n(t.scheduled_increases?.[1]?.year ?? DASH)}.`,
        ],
        extra: 'tolls',
      },
    },
    {
      kicker: '2025 · year one',
      title: 'Half a million a day still come in',
      lede: `In year one, about ${n(fmtCompact(crz.avg_weekday_entries_2025))} vehicles still drove into the zone on a typical weekday.`,
      body: 'The toll did not empty Manhattan. The drops in the headlines compare against a modeled “no toll” year, because nobody counted these gates before the toll; this step shows what was actually measured. Most trips arrive in the tolled daytime hours, and the biggest gate is the East 60th Street line.',
      stats: [
        { label: 'Vehicles entering, per weekday', value: fmtCompact(crz.avg_weekday_entries_2025), sub: `${fmtShare(mix.taxi_fhv)} of them taxis and app rides` },
        { label: 'Arriving in the tolled daytime hours', value: fmtShare(crz.peak_share_2025), sub: `when the full ${fmtMoney(car.peak)} applies` },
        { label: 'Busiest hour', value: fmtHour(peakHour), sub: 'the morning rush' },
      ],
      details: {
        paragraphs: [
          `Cars are ${n(fmtShare(mix.cars))} of entries, taxis and app rides ${n(fmtShare(mix.taxi_fhv))}, trucks ${n(fmtShare(trucksShare))}. ${n(fmtShare(crz.overnight_share_2025))} of entries arrive overnight, when the toll is a quarter of the price.`,
          '**Nobody counted vehicles at these gates before the toll.** The detectors were switched on with it, so the MTA\'s reported year-one decline is measured against a modeled baseline, not a 2024 count. This step shows the level in year one; the next steps compare the bridges, tunnels and air monitors that do have a 2024 record.',
        ],
        list: { title: 'Busiest entry points, 2025 weekdays', rows: (crz.top_entry_points_2025 ?? []).map((p) => ({ label: p.name, value: fmtCompact(p.avg_weekday_entries), sub: `${fmtShare(p.share)} of all entries` })) },
      },
    },
    {
      kicker: '2025 · year one',
      title: 'Traffic went around, not away',
      lede: 'The two tunnels straight into the zone lost traffic. Every bridge that lets drivers go around Manhattan gained some.',
      body: 'Add it all up and the nine crossings carried almost exactly as many vehicles as in 2024. Traffic was not eliminated in year one; it shifted to the crossings around the zone, most of them in the Bronx and Queens. The moving lines show which way: red is more than 2024, green is less.',
      stats: [
        { label: 'Tunnels into the zone', value: pctRange(down.map((f) => f.pct_2025_vs_2024)), sub: `fewer vehicles than 2024 · ${joinNames(down.map((f) => shortName(f.name)))}`, tone: -1 },
        { label: 'Bridges around the zone', value: pctRange(up.map((f) => f.pct_2025_vs_2024)), sub: `${fmtInt(up.length)} of ${fmtInt(up.length)} got busier`, tone: 1 },
        { label: 'All nine crossings together', value: fmtPct(bt.system_pct_2025_vs_2024), sub: 'about the same as before the toll', tone: 0 },
      ],
      details: {
        paragraphs: [
          `${rockaways.length ? `The ${joinNames(rockaways.map((f) => shortName(f.name)))} bridges out by the Rockaways, far from the zone, also rose about ${pctRange(rockaways.map((f) => f.pct_2025_vs_2024))}, so part of the increase around Manhattan is ordinary growth rather than rerouting. ` : ''}Trucks shifted more than cars on the Bronx–Queens bridges: Whitestone ${n(fmtPct(up.find((f) => f.id === 'whitestone')?.trucks_pct_2025_vs_2024))}, Henry Hudson ${n(fmtPct(up.find((f) => f.id === 'henry_hudson')?.trucks_pct_2025_vs_2024))}.`,
          `NYC DOT's street counters (the small squares) tell the same story at street level. Of ${n(fmtInt(dot.matched_segments))} spots counted both before and after the toll, ${n(fmtInt(dot.matched_down))} fell and ${n(fmtInt(dot.matched_up))} rose, with the biggest drops on the approaches to the East River bridges. The other ${n(fmtInt(dotOther))} spots were counted only once; switch on “All DOT sites” under Layers to see them.`,
        ],
        list: {
          title: 'Each crossing, 2025 vs 2024',
          rows: [...up, ...down].sort((a, b) => (b.pct_2025_vs_2024 ?? 0) - (a.pct_2025_vs_2024 ?? 0)).map((f) => ({ label: shortName(f.name), value: fmtPct(f.pct_2025_vs_2024), sub: `${fmtCompact(f.avg_daily_2025)} a day`, tone: f.pct_2025_vs_2024 })),
        },
      },
    },
    {
      kicker: '2025 · year one',
      title: 'Cleaner by the bridges, not in the Bronx',
      lede: 'The air got cleaner at the two monitors beside the bridges into the zone. In the South Bronx, the highway corridor known as “Asthma Alley”, it did not improve at all.',
      body: 'Each monitor is read on its own, not through the citywide average. The whole city was already getting cleaner, so a monitor only counts as “improved” if it beat that trend. Two inside the zone did. The South Bronx monitors, beside the highways that carry traffic around Manhattan, stood still while the rest of the city improved.',
      stats: [
        { label: 'Inside the zone: monitors that beat the citywide trend', value: `${fmtInt(insideImproved.length)} of ${fmtInt(insideTotal)}`, sub: joinNames(insideImproved.map((x) => x.name)) || 'none', tone: insideImproved.length ? -1 : 0 },
        { label: 'South Bronx: monitors that improved', value: `${fmtInt(sbImproved.length)} of ${fmtInt(southBronx.length)}`, sub: lagged.length ? `${joinNames(lagged.map((r) => r.name))} stood still` : 'no site moved beyond the citywide trend', tone: sbImproved.length ? -1 : 0 },
        { label: 'Monitors that got worse', value: fmtInt(worsened.length), sub: joinNames(worsened.map((p) => shortName(p.name))) || 'none', tone: worsened.length ? 1 : 0 },
      ],
      details: {
        paragraphs: [
          `How “improved” is decided: the Health Department's control site on the ${control.name ?? 'Van Wyck'} Expressway, away from the zone, fell ${n(fmtDelta(control.delta_raw, 'µg/m³', 2))} (${n(fmtPct(control.pct_raw))}) over the same months. That is the citywide trend. A monitor counts as improved or worsened only if it moved more than 0.5 µg/m³ beyond that. Wildfire-smoke days are left out.`,
          `The widely quoted “22% cleaner” figure for the zone is a modeled estimate against a projected no-toll year (Cornell University, npj Clean Air, 2025), not a measured change since 2024. Measured against what the rest of the city actually did, the gain inside the zone is about ${n(fmtNum(isNum(insideGain) ? Math.abs(insideGain) : null, 1))} µg/m³ at ${n(fmtInt(insideImproved.length))} monitors and nothing at the other ${n(fmtInt(insideTotal - insideImproved.length))}.`,
          `${lagged.length ? `${joinNames(lagged.map((r) => r.name))} lagged the citywide improvement by about ${n(fmtDelta(mean(lagged.map((r) => r.delta_adj_control)), 'µg/m³', 2))}.` : ''}${noBaseline.length ? ` ${joinNames(noBaseline.map((r) => r.name))} ${noBaseline.length === 1 ? 'has' : 'have'} no 2024 record because the monitor was offline, so it compares 2026 with 2025 instead.` : ''} Inside the zone: ${n(fmtInt(aq.inside?.improved))} improved, ${n(fmtInt(aq.inside?.unchanged))} unchanged, ${n(fmtInt(aq.inside?.worsened))} worsened. Outside: ${n(fmtInt(aq.outside?.improved))} improved, ${n(fmtInt(aq.outside?.unchanged))} unchanged, ${n(fmtInt(aq.outside?.worsened))} worsened, ${n(fmtInt(aq.outside?.insufficient))} without enough data.`,
        ],
        table: {
          title: 'South Bronx monitors · µg/m³',
          head: ['Site', '2024', '2025', 'Change', 'vs trend'],
          rows: southBronx.map((r) => ({ cells: [r.name, fmtNum(r.pre_mean, 2), fmtNum(r.post_mean, 2), fmtDelta(r.delta_raw, '', 2), fmtDelta(r.delta_adj_control, '', 2)], cls: r.classification })),
        },
      },
    },
    {
      kicker: '2025 · year one',
      title: 'Who bears it',
      lede: 'The places where traffic and pollution got worse are mostly places that were already carrying the most.',
      body: `New York State flags neighborhoods with high pollution, poverty and health burdens as Disadvantaged Communities (purple on the map). ${fmtInt(upInDac.length)} of the ${fmtInt(up.length)} bridges that got busier, and both South Bronx monitors that stood still, are in them.`,
      stats: [
        { label: 'Busier bridges in disadvantaged communities', value: `${fmtInt(upInDac.length)} of ${fmtInt(up.length)}`, sub: joinNames(upInDac.map((f) => shortName(f.name))) || 'none', tone: upInDac.length ? 1 : 0 },
        { label: 'Worsened monitors in disadvantaged communities', value: `${fmtInt(worsenedInDac.length)} of ${fmtInt(worsened.length)}`, sub: joinNames(worsenedInDac.map((p) => shortName(p.name))) || 'none', tone: worsenedInDac.length ? 1 : 0 },
        { label: 'Child asthma ER visits', value: `${fmtInt(asthmaOf(asthmaHi))} vs ${fmtInt(asthmaOf(asthmaLo))}`, sub: `${asthmaUnit} · ${asthmaHi?.name ?? DASH} vs ${asthmaLo?.name ?? DASH}` },
      ],
      details: {
        paragraphs: [
          `${n(fmtShare(eq.dac_share))} of the city's census tracts (${n(fmtInt(eq.dac_designated_tracts))} of ${n(fmtInt(eq.nyc_tracts))}) carry the state designation. Switch the purple layer to the asthma rate to see where the health burden already sits; the bright points are the busier crossings and worsened monitors inside designated areas.`,
          'Health data lag about two years: 2023 is the newest year published, so there are no post-toll asthma figures yet. The asthma rate is all emergency visits for asthma among children, not only the pollution-linked ones.',
        ],
        extra: 'choropleth',
      },
    },
    {
      kicker: '2026 · year two, so far',
      title: 'Year two: the drop shows up',
      lede: `In 2026 the drop finally shows up: weekday entries into the zone are ${n(fmtPct(crz.yoy_weekday_pct))} on a year earlier, and the crossings around it are down too.`,
      body: `Trucks fell the most. Across all nine MTA crossings, traffic now sits ${n(fmtPct(bt.system_pct_2026ytd_vs_2024ytd))} below the same months of 2024, so the rerouting of year one is fading. Green lines mean less traffic than before.`,
      stats: [
        { label: 'Vehicles entering, per weekday', value: fmtCompact(crz.avg_weekday_entries_2026ytd), sub: `${fmtPct(crz.yoy_weekday_pct)} vs the same months of 2025`, tone: crz.yoy_weekday_pct },
        { label: 'Trucks entering the zone', value: fmtPct(crz.trucks_yoy_pct), sub: 'vs the same months of 2025', tone: crz.trucks_yoy_pct },
        { label: 'All nine MTA crossings', value: fmtPct(bt.system_pct_2026ytd_vs_2024ytd), sub: 'vs January–August 2024', tone: bt.system_pct_2026ytd_vs_2024ytd },
      ],
      details: {
        paragraphs: [
          'The decline is concentrated in the daytime peak, when the full toll applies. Entry points compare 2026 with 2025 because no counts exist at the gates before the toll; bridges and tunnels compare with the same months of 2024.',
          `Data runs to ${n(fmtDate(crz.last_date))} for zone entries and ${n(fmtDate(bt.last_date))} for the MTA crossings.${noBaseline.length ? ` In the South Bronx, ${joinNames(noBaseline.map((r) => r.name))} reads ${n(fmtNum(noBaseline[0]?.post_mean, 2))} µg/m³ so far this year against ${n(fmtNum(noBaseline[0]?.pre_mean, 2))} last year.` : ''}`,
        ],
      },
    },
    {
      kicker: 'What if · reasoned from the data',
      title: 'If the Deegan or the BQE came down',
      lede: 'Year one is the evidence: when a route got costlier, traffic went around it, not away.',
      body: 'A highway removed without a charge would do the same, on a larger scale. The Deegan and the BQE carry what the busier bridges deliver, past the monitors that did not follow the citywide improvement and through the neighborhoods with the city’s highest child asthma rates after Harlem.',
      stats: [
        { label: 'Major Deegan at High Bridge', value: fmtCompact(deegan?.latest_adv), sub: 'vehicles a day on one roadway · counted after the toll, no “before”' },
        { label: 'BQE at Joralemon Street', value: fmtCompact(bqeBoth), sub: `vehicles a day, both roadways · ${pctRange(bqe.map((p) => p.pct_change))} vs ${bqeYear}`, tone: -1 },
        { label: 'Child asthma ER visits beside the Deegan', value: fmtInt(deegan?.uhf42_asthma_ed_children), sub: `${asthmaUnit} · ${deegan?.uhf42_name ?? DASH}` },
      ],
      details: {
        paragraphs: [
          `**Where the traffic would go.** The question is not whether removal would help these neighborhoods, but where the traffic would go. The bridges that feed the Deegan (RFK Bronx span ${n(fmtCompact(upById('rfk_bronx')?.avg_daily_2025))} a day, Henry Hudson ${n(fmtCompact(upById('henry_hudson')?.avg_daily_2025))}) and the BQE (Verrazzano ${n(fmtCompact(upById('verrazzano')?.avg_daily_2025))}) all got busier in year one, and the Alexander Hamilton Bridge, where the Cross Bronx meets the Deegan, rose ${n(fmtPct(hamilton?.pct_change))} on one roadway. Without a charge, those trips move to the parallel streets (Bruckner Boulevard and the Grand Concourse in the Bronx; Third and Atlantic Avenues in Brooklyn), which run through the same disadvantaged tracts. Year two shows the other path: when a charge stays, trips do disappear (weekday entries ${n(fmtPct(crz.yoy_weekday_pct))}, trucks ${n(fmtPct(crz.trucks_yoy_pct))}).`,
          `**What the air would do.** The Cross Bronx monitor reads ${n(fmtNum(crossBronx?.post_mean, 1))} µg/m³ and Mott Haven ${n(fmtNum(mottHaven?.post_mean, 1))}, against a citywide ${n(fmtNum(aq.citywide_pm25_2024, 1))}, and neither followed the citywide decline; the BQE monitor in Williamsburg ${bqeMonitorPhrase}. Taking the road away removes the local source, but exhaust is a minority share of fine particles, so the gap would narrow, not close. Traffic pushed onto local streets would sit beside homes and schools instead of on the highway.`,
          `**Why this is reasoning, not a model.** None of these sources record where trips start and end, so the counts cannot say how many trips would vanish and how many would divert. The Deegan has only post-toll counts and the BQE’s baseline dates from ${n(bqeYear)}. Modeling one corridor properly needs origin–destination data these sources do not have.`,
        ],
      },
    },
    {
      kicker: 'Before you draw conclusions',
      title: 'What this can’t say',
      lede: 'This is a careful before-and-after comparison, not proof of cause.',
      bullets: [
        'Nobody counted vehicles at the zone gates before the toll. “Before” comes from the bridges, tunnels and street counters, so what happened on the South Bronx highways is inferred from the bridges beside them, not measured on the road.',
        `Street counters are one-week samples at rotating spots. Only ${n(fmtInt(dot.matched_segments))} of ${n(fmtInt(dotTotal))} locations were counted both before and after the toll, and ${n(fmtInt(dot.matched_same_month))} of those in the same month of the year.`,
        'Fine-particle pollution moves with weather, heating and wildfire smoke. Smoke days are removed and the citywide trend is subtracted, but one year against one baseline cannot rule out everything else that changed.',
        `All ${n(fmtInt(sourcesCount))} sources are official NYC Open Data, New York State Open Data or NYC Health Department publications. Crossing and gate locations are approximate.`,
      ],
      details: {
        extra: 'sources',
      },
    },
  ];
}

export const EXPLORE_CARD = {
  kicker: 'Explore',
  title: 'Now the map is yours',
  lede: 'Everything you switch on from here stays on.',
  body: 'Pick the year on the right, turn layers on or off, and click any point or moving line for its full timeline and hour-by-hour profile. Zoom in past level 11 and the points become 24-hour clocks: grey ring = 2024, colored ring = the year shown.',
};
