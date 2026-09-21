// The guided tour ("Play the story"): for each step, a list of beats. Each beat is one short callout placed
// next to the thing it explains (`at` = [lon, lat] or { layer, id } for a map feature; null = top of the
// screen), an optional camera move, an optional `state` (year / metric the map switches to when the beat
// starts, so the reader watches the change happen), and how long it stays (ms). Numbers come from summary.json
// and its reconciled block, so the tour never says something the story card does not.
import { fmtCompact, fmtDelta, fmtInt, fmtMoney, fmtNum, fmtPct, fmtSigned, isNum, shortName } from '../lib/format.js';

const DWELL = 6500;
const LONG = 8000;
const Y2024 = { period: 'pre_2024', metric: 'absolute' };
const Y2025 = { period: 'post_2025', metric: 'change' };
const Y2026 = { period: 'post_2026_ytd', metric: 'change' };
const joinNames = (list) => (list.length <= 1 ? list.join('') : `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`);
const share = (v) => (isNum(v) ? `${Math.round(v * 100)}%` : '—');

export function buildGuide({ summary, tolls, geo }) {
  const s = summary ?? {};
  const deegan = (geo?.dot_segment?.features ?? []).map((f) => f.properties ?? {}).filter((p) => /major deegan/i.test(p.street ?? '')).sort((a, b) => (b.latest_adv ?? 0) - (a.latest_adv ?? 0))[0];
  const rc = s.reconciled ?? {};
  const crz = s.crz ?? {};
  const bt = s.bt ?? {};
  const aq = s.aq ?? {};
  const t = tolls ?? {};
  const car = t.ezpass_rates?.[0] ?? {};
  const traffic = rc.traffic ?? [];
  const air = rc.air ?? [];
  const tById = (id) => traffic.find((r) => r.id === id) ?? {};
  const aById = (id) => air.find((r) => r.id === id) ?? {};
  const tUp = traffic.filter((r) => r.status === 'increase');
  const tUnc = traffic.filter((r) => r.status === 'uncertain');
  const aDec = air.filter((r) => r.class === 'decrease');
  const aUnc = air.filter((r) => r.class === 'uncertain');
  const aNo = air.filter((r) => r.class === 'no_baseline');
  const sb = rc.south_bronx ?? [];
  const mott = sb.find((r) => /mott/i.test(r.name)) ?? {};
  const cross = sb.find((r) => /cross bronx/i.test(r.name)) ?? {};
  const hunts = sb.find((r) => /hunts/i.test(r.name)) ?? {};
  const pers = rc.persistence_highlights ?? [];
  const tier1 = rc.dot?.tiers?.same_month_2024?.rows ?? [];
  const top = tUp[0] ?? {};
  const strongest = aDec[0] ?? {};
  const white = tById('whitestone');
  const hh = tById('henry_hudson');
  const qmt = tById('qmt');
  const rfkBronx = tById('rfk_bronx');
  const hamilton = aById('aq_36061NY12380');
  const upInDac = tUp.filter((r) => r.dac_designated);
  const qmtP = pers.find((h) => h.id === 'qmt');
  const cbP = pers.find((h) => h.id === 'cross_bay');
  const wbP = pers.find((h) => h.id === 'aq_36061NY08552');
  const first1 = tier1[0];

  return [
    // 0 · Before the toll
    [
      { at: null, state: Y2024, text: 'This is New York in 2024, the year before the toll. The moving lines are traffic; thicker lines carry more, and the arrows show which way it goes.', dwell: DWELL },
      { at: { layer: 'bt_facility', id: 'verrazzano' }, side: 'right', camera: { center: [-74.0, 40.66], zoom: 10.6 }, text: `About ${fmtCompact(bt.system_avg_daily_2024)} vehicles a day use the MTA's nine bridges and tunnels. Every change that follows is measured against this year.`, dwell: LONG },
      { at: { layer: 'aq_monitor', id: 'aq_36081NY07615' }, side: 'left', camera: { center: [-73.9, 40.73], zoom: 10.4 }, text: `${fmtInt(aq.sites_total)} street-level monitors measure fine-particle pollution (PM2.5); ${fmtInt(air.length - aNo.length)} of them have a usable 2024 record. Citywide it averaged ${fmtNum(aq.citywide_pm25_2024)} µg/m³.`, dwell: LONG },
    ],
    // 1 · The toll begins
    [
      { at: [-73.985, 40.742], side: 'right', state: Y2025, text: `January 5, 2025. Driving into Manhattan below 60th Street now costs a car ${fmtMoney(car.peak)} a day, ${fmtMoney(car.overnight)} overnight; the largest trucks pay ${fmtMoney(t.ezpass_rates?.[t.ezpass_rates.length - 1]?.peak)}.`, dwell: LONG },
      { at: [-73.97, 40.765], side: 'right', camera: { center: [-73.975, 40.762], zoom: 12.2 }, text: 'The line is 60th Street. The official topline (a modeled 22% cleaner zone) describes this priced core. Our question is what happened across the rest of the city.', dwell: DWELL },
    ],
    // 2 · Inside the zone
    [
      { at: { layer: 'crz_entry', id: 'east_60th' }, side: 'right', text: `In year one about ${fmtCompact(crz.avg_weekday_entries_2025)} vehicles a day still drove in. Nobody counted these gates before the toll, so this is a level, not a change.`, dwell: LONG },
      { at: { layer: 'crz_entry', id: 'lincoln_tunnel' }, side: 'left', camera: { center: [-73.99, 40.75], zoom: 12 }, text: `${share(crz.peak_share_2025)} of entries arrive in the tolled daytime hours and the busiest hour is still the morning rush: the daily picture is more mixed than "less traffic".`, dwell: DWELL },
    ],
    // 3 · Crossings: first 2024, then watch 2025 color in
    [
      { at: null, state: Y2024, text: 'Here is how traffic flowed in 2024, before the toll: plain lines, sized by volume. Watch what the toll does to them.', dwell: 5500 },
      { at: top.id ? { layer: 'bt_facility', id: top.id } : [-73.93, 40.8], side: 'right', state: Y2025, camera: { center: [-73.9, 40.78], zoom: 10.6 }, text: `Now 2025. Red = more vehicles than 2024, and the data support it (the range of doubt stays above zero): ${joinNames(tUp.map((r) => `${shortName(r.name)} ${fmtPct(r.pct_existing)}`)) || 'none'}, roughly 2 more vehicles for every 100.`, dwell: LONG },
      { at: { layer: 'bt_facility', id: 'qmt' }, side: 'right', camera: { center: [-73.975, 40.735], zoom: 11 }, text: `Grey rings are uncertain: ${fmtInt(tUnc.length)} crossings, including the Queens Midtown Tunnel (${fmtPct(qmt.pct_existing)}), changed by less than their interval can separate from zero. Hugh L. Carey is coverage-limited.`, dwell: LONG },
      { at: { layer: 'bt_facility', id: 'whitestone' }, side: 'left', camera: { center: [-73.86, 40.8], zoom: 10.8 }, text: `The rush hours differ from the daily totals: the morning rush rose ${fmtPct(white.peak?.am?.pct)} at Whitestone and ${fmtPct(hh.peak?.am?.pct)} at Henry Hudson, while the Queens Midtown evening rush fell ${fmtPct(qmt.peak?.pm?.pct)}. Click any crossing for its intervals.`, dwell: LONG },
    ],
    // 4 · Street level
    [
      { at: first1 ? { layer: 'dot_segment', id: first1.id } : [-73.99, 40.72], side: 'right', state: Y2025, text: `NYC DOT's street counters are one-week samples. ${fmtInt(rc.dot?.matched_total)} spots were counted before and after the toll; only ${fmtInt(tier1.length)} in the same month of 2024 and 2025, mostly at the East River bridge approaches, where counts fell.`, dwell: LONG },
      { at: null, text: 'A strict matched-month analysis found no pair that qualifies for a citywide estimate, so these squares describe their own spots, not the city, and prove nothing about rerouting.', dwell: DWELL },
    ],
    // 5 · Air: first 2024 levels, then the 2025 verdicts
    [
      { at: null, state: Y2024, text: 'The air monitors in 2024: grey dots, before the toll. Now watch which ones change once the toll is in.', dwell: 5000 },
      { at: strongest.id ? { layer: 'aq_monitor', id: strongest.id } : [-73.986, 40.718], side: 'right', state: Y2025, camera: { center: [-73.985, 40.725], zoom: 11.6 }, text: `Green = cleaner air than 2024, supported by the data once weather is accounted for: ${fmtInt(aDec.length)} monitors, strongest at ${strongest.name ?? '—'} (${fmtDelta(strongest.adj_delta, 'µg/m³', 2)}, about ${isNum(strongest.adj_delta) && isNum(strongest.pre_mean) ? Math.round(Math.abs(strongest.adj_delta / strongest.pre_mean) * 100) : '—'}% less fine soot). Most sit in or beside the zone.`, dwell: LONG },
      { at: hamilton.id ? { layer: 'aq_monitor', id: hamilton.id } : [-73.93, 40.85], side: 'right', camera: { center: [-73.92, 40.82], zoom: 10.9 }, text: `Grey = uncertain (${fmtInt(aUnc.length)}), hollow = no eligible 2024 baseline (${fmtInt(aNo.length)}). ${hamilton.name ?? 'Hamilton Bridge'} rose ${fmtDelta(hamilton.delta_raw, 'µg/m³', 2)} raw but is uncertain once weather is accounted for. Only Broadway/35th has all 12 matched months.`, dwell: LONG },
    ],
    // 6 · South Bronx
    [
      { at: mott.id ? { layer: 'aq_monitor', id: mott.id } : [-73.92, 40.81], side: 'right', state: Y2025, text: `Asthma Alley, monitor by monitor. Mott Haven: ${fmtDelta(mott.adj_delta, 'µg/m³', 2)} weather-adjusted, interval ${fmtSigned(mott.adj_ci_low, 2)} to ${fmtSigned(mott.adj_ci_high, 2)}. Uncertain: no clear rise, no clear fall.`, dwell: LONG },
      { at: cross.id ? { layer: 'aq_monitor', id: cross.id } : [-73.906, 40.845], side: 'right', camera: { center: [-73.905, 40.84], zoom: 12 }, text: `Cross Bronx Expressway: ${fmtDelta(cross.adj_delta, 'µg/m³', 2)}, interval ${fmtSigned(cross.adj_ci_low, 2)} to ${fmtSigned(cross.adj_ci_high, 2)}. Also uncertain. Hunts Point has no eligible 2024 baseline at all.`, dwell: LONG },
      { at: hunts.id ? { layer: 'aq_monitor', id: hunts.id } : [-73.886, 40.819], side: 'left', camera: { center: [-73.9, 40.822], zoom: 11.8 }, text: `Purple shading is the pre-existing burden: ${fmtNum(mott.context?.child_asthma_ed, 0)} and ${fmtNum(cross.context?.child_asthma_ed, 0)} child asthma ER visits per 10,000 (2023) here, against a citywide range that reaches ${fmtNum(aDec.length ? Math.min(...aDec.map((r) => r.uhf42_asthma_ed_children).filter(isNum)) : null, 0)} where the air clearly improved.`, dwell: LONG },
    ],
    // 7 · Burden
    [
      { at: null, state: Y2025, text: 'Purple areas are state-designated Disadvantaged Communities: high pollution, poverty and health burdens before the toll.', dwell: DWELL },
      { at: upInDac[0]?.id ? { layer: 'bt_facility', id: upInDac[0].id } : { layer: 'bt_facility', id: 'rfk_manhattan' }, side: 'right', camera: { center: [-73.93, 40.79], zoom: 11 }, text: `${fmtInt(upInDac.length)} of the ${fmtInt(tUp.length)} supported crossing increases ${upInDac.length === 1 ? 'is' : 'are'} inside them: ${joinNames(upInDac.map((r) => shortName(r.name))) || 'none'}. The South Bronx monitors are inside them too, with no clear change either way.`, dwell: LONG },
      { at: strongest.id ? { layer: 'aq_monitor', id: strongest.id } : [-73.986, 40.718], side: 'right', camera: { center: [-73.975, 40.735], zoom: 11.2 }, text: 'The supported air improvements landed in and beside the priced core, in neighborhoods with lower asthma rates. Overlap is what this shows; historical vulnerability is not a new harm caused by the toll.', dwell: LONG },
    ],
    // 8 · 2026: first 2025, then watch Jan–Aug 2026
    [
      { at: null, state: Y2025, text: 'This is 2025 again. Now watch the first eight months of 2026, compared with the same months of 2024.', dwell: 5000 },
      { at: { layer: 'bt_facility', id: 'qmt' }, side: 'right', state: Y2026, camera: { center: [-73.96, 40.72], zoom: 10.8 }, text: `Some patterns persisted: the Queens Midtown decline deepened (${fmtPct(qmtP?.y2025)} → ${fmtPct(qmtP?.y2026)}). One reversed: Cross Bay (${fmtPct(cbP?.y2025)} → ${fmtPct(cbP?.y2026)}). The year-one increases are no longer distinguishable from 2024.`, dwell: LONG },
      { at: { layer: 'aq_monitor', id: 'aq_36061NY08552' }, side: 'right', camera: { center: [-73.975, 40.73], zoom: 11.4 }, text: `Williamsburg Bridge's air kept getting cleaner (${fmtSigned(wbP?.y2025, 2)} → ${fmtSigned(wbP?.y2026, 2)} µg/m³ of fine soot, about a third less than Jan–Aug 2024 by 2026) and Van Wyck's improvement held. Most other locations are inconclusive, and 2026 is not a complete year.`, dwell: LONG },
    ],
    // 9 · What if: the Major Deegan, reasoned from the data
    [
      { at: null, state: Y2025, text: 'One more question from the brief: what if a highway like the Major Deegan were removed or repurposed? These data cannot model it, so this is scenario reasoning, not a forecast.', dwell: LONG },
      { at: { layer: 'bt_facility', id: 'rfk_bronx' }, side: 'right', camera: { center: [-73.92, 40.83], zoom: 11.3 }, text: `The Deegan carries about ${fmtCompact(deegan?.latest_adv)} vehicles a day on one counted roadway (post-toll only). It is fed by the RFK Bronx span (${fmtCompact(rfkBronx.avg_daily_2025)} a day, uncertain change) and Henry Hudson (morning rush ${fmtPct(hh.peak?.am?.pct)}, supported), past monitors that show no clear change.`, dwell: LONG },
      { at: [-73.925, 40.835], side: 'left', text: 'Removing it would take a local exhaust source off blocks with the city\'s highest asthma rates and free land for greenspace; without fewer trips, the same traffic would move onto Bruckner, the Grand Concourse and Third Avenue in the same tracts. No number for that can be supported.', dwell: LONG },
    ],
    // 10 · Caveats
    [
      { at: null, state: Y2025, text: 'Three things to remember: association is not cause, counts are crossing events rather than tracked trips, and most monitors have partial matched-month coverage.', dwell: LONG },
      { at: null, text: `This is a careful comparison from ${fmtInt(s.sources_count ?? 10)} official sources, with 2026 shown only as January–August. Now the map is yours.`, dwell: DWELL },
    ],
  ];
}
