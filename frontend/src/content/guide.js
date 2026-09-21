// The guided tour ("Play the story"): for each step, a list of beats. Each beat is one short callout placed
// next to the thing it explains (`at` = [lon, lat] or { layer, id } for a map feature; null = top of the
// screen), an optional camera move, an optional `state` (year / metric the map switches to when the beat
// starts, so the reader watches the change happen), and how long it stays (ms). Numbers come from summary.json.
import { fmtCompact, fmtInt, fmtMoney, fmtPct, fmtShare, isNum, shortName } from '../lib/format.js';

const DWELL = 6500;
const LONG = 8000;
const Y2024 = { period: 'pre_2024', metric: 'absolute' };
const Y2025 = { period: 'post_2025', metric: 'change' };
const Y2026 = { period: 'post_2026_ytd', metric: 'change' };

export function buildGuide({ summary, tolls, geo }) {
  const s = summary ?? {};
  const crz = s.crz ?? {};
  const bt = s.bt ?? {};
  const aq = s.aq ?? {};
  const t = tolls ?? {};
  const car = t.ezpass_rates?.[0] ?? {};
  const up = bt.facilities_up ?? [];
  const down = bt.facilities_down ?? [];
  const upInDac = up.filter((f) => f.dac_designated);
  const upById = (id) => up.find((f) => f.id === id);
  const control = aq.control ?? {};
  const inside = (aq.inside_sites ?? []).filter((x) => x?.classification === 'improved');
  const lagged = (aq.south_bronx ?? []).filter((r) => r?.relative_to_control === 'lagged control');
  const monitors = (geo?.aq_monitor?.features ?? []).map((f) => f.properties ?? {});
  const worsened = monitors.filter((p) => p.classification === 'worsened');
  const worsenedDac = worsened.find((p) => p.dac_designated) ?? worsened[0];
  const worsenedOther = worsened.find((p) => p !== worsenedDac);
  const pmDrop = isNum(aq.citywide_pm25_2009) && isNum(aq.citywide_pm25_2024) ? Math.abs((aq.citywide_pm25_2024 - aq.citywide_pm25_2009) / aq.citywide_pm25_2009) * 100 : null;
  const uhfAll = (geo?.uhf42?.features ?? []).map((f) => f.properties ?? {});
  const has2023 = uhfAll.some((p) => isNum(p.asthma_ed_children));
  const asthmaOf = (p) => (has2023 ? p?.asthma_ed_children : p?.asthma_ed_pm25_children);
  const asthmaUnit = has2023 ? 'per 10,000 children in 2023' : 'per 100,000 children';
  const uhf = uhfAll.filter((p) => isNum(asthmaOf(p))).sort((a, b) => asthmaOf(b) - asthmaOf(a));
  const asthmaHi = uhf[0];
  const asthmaLo = uhf[uhf.length - 1];
  const ratio = asthmaHi && asthmaLo && asthmaOf(asthmaLo) > 0 ? Math.round(asthmaOf(asthmaHi) / asthmaOf(asthmaLo)) : null;
  const maxUp = up.reduce((m, f) => (isNum(f.pct_2025_vs_2024) && f.pct_2025_vs_2024 > m ? f.pct_2025_vs_2024 : m), 0);
  const minDown = down.reduce((m, f) => (isNum(f.pct_2025_vs_2024) && f.pct_2025_vs_2024 < m ? f.pct_2025_vs_2024 : m), 0);
  const tunnelNames = down.map((f) => shortName(f.name)).join(' and ');

  return [
    // 0 · Before the toll
    [
      { at: null, state: Y2024, text: 'This is New York in 2024, the year before the toll. The moving lines are traffic; thicker lines carry more, and the arrows show which way it goes.', dwell: DWELL },
      { at: { layer: 'bt_facility', id: 'verrazzano' }, side: 'right', camera: { center: [-74.0, 40.66], zoom: 10.6 }, text: `About ${fmtCompact(bt.system_avg_daily_2024)} vehicles a day use the MTA's nine bridges and tunnels. This is the starting line everything is measured against.`, dwell: LONG },
      { at: control.id ? { layer: 'aq_monitor', id: control.id } : [-73.82, 40.72], side: 'left', camera: { center: [-73.9, 40.73], zoom: 10.4 }, text: `${fmtInt(aq.sites_total)} street-level monitors measure fine-particle pollution (PM2.5). Citywide it is already ${fmtPct(pmDrop, { signed: false, digits: 0 })} lower than in 2009, so only a change that beats that trend counts.`, dwell: LONG },
    ],
    // 1 · The toll begins
    [
      { at: [-73.985, 40.742], side: 'right', state: Y2025, text: `January 5, 2025. Driving into Manhattan below 60th Street now costs a car ${fmtMoney(car.peak)} a day, the first charge of its kind in the United States.`, dwell: LONG },
      { at: [-73.97, 40.765], side: 'right', camera: { center: [-73.975, 40.762], zoom: 12.2 }, text: 'The line is 60th Street. The FDR Drive and West Side Highway along the edges stay free, but turning into the grid is tolled.', dwell: DWELL },
    ],
    // 2 · Half a million a day still come in
    [
      { at: { layer: 'crz_entry', id: 'east_60th' }, side: 'right', text: `In year one about ${fmtCompact(crz.avg_weekday_entries_2025)} vehicles a day still drove in. The moving lines show where; thicker means more, and East 60th Street is the biggest gate.`, dwell: LONG },
      { at: { layer: 'crz_entry', id: 'lincoln_tunnel' }, side: 'left', camera: { center: [-73.99, 40.75], zoom: 12 }, text: `${fmtShare(crz.peak_share_2025)} of them arrive in the tolled daytime hours, and ${fmtShare(crz.class_mix_2025?.taxi_fhv)} are taxis and app rides.`, dwell: DWELL },
    ],
    // 3 · Traffic went around, not away: first 2024, then watch 2025 color in
    [
      { at: null, state: Y2024, text: 'Here is how traffic flowed in 2024, before the toll: white lines, sized by volume. Watch what the toll does to them.', dwell: 5500 },
      { at: { layer: 'bt_facility', id: 'qmt' }, side: 'right', state: Y2025, camera: { center: [-73.985, 40.72], zoom: 11 }, text: `Now 2025. Green means less than 2024: the two tunnels straight into the zone, ${tunnelNames}, lost traffic, down as much as ${fmtPct(minDown)}.`, dwell: LONG },
      { at: { layer: 'bt_facility', id: 'whitestone' }, side: 'left', camera: { center: [-73.86, 40.79], zoom: 10.8 }, text: `Red means more. Every bridge that lets drivers go around Manhattan got busier, up to ${fmtPct(maxUp)} at the ${shortName(up[0]?.name ?? 'RFK')} span.`, dwell: LONG },
      { at: { layer: 'bt_facility', id: 'rfk_manhattan' }, side: 'right', camera: { center: [-73.925, 40.73], zoom: 10.4 }, text: `Add it up and the nine crossings carried ${fmtPct(bt.system_pct_2025_vs_2024)}: almost exactly as many vehicles as before. The toll moved traffic more than it removed it.`, dwell: LONG },
    ],
    // 4 · Cleaner by the bridges, not in the Bronx: first 2024 levels, then the 2025 verdicts
    [
      { at: null, state: Y2024, text: 'The air monitors in 2024: grey dots, before the toll. Now watch which ones change once the toll is in.', dwell: 5000 },
      { at: inside[0]?.id ? { layer: 'aq_monitor', id: inside[0].id } : [-73.993, 40.714], side: 'right', state: Y2025, camera: { center: [-73.985, 40.72], zoom: 11.8 }, text: `Green monitors beat the citywide trend. The two beside the bridges into the zone, ${inside.map((x) => x.name).join(' and ')}, did: the air there got cleaner.`, dwell: LONG },
      { at: lagged[0]?.id ? { layer: 'aq_monitor', id: lagged[0].id } : [-73.92, 40.81], side: 'right', camera: { center: [-73.9, 40.815], zoom: 11.6 }, text: `In the South Bronx, beside the highways that carry traffic around Manhattan, ${lagged.map((r) => r.name).join(' and ')} stood still while the rest of the city improved.`, dwell: LONG },
      { at: worsenedDac?.id ? { layer: 'aq_monitor', id: worsenedDac.id } : [-73.93, 40.85], side: 'right', camera: { center: [-73.93, 40.84], zoom: 11.4 }, text: `Red monitors got worse: ${worsened.length ? `${shortName(worsenedDac?.name)}${worsenedOther ? ` and the ${shortName(worsenedOther.name)}` : ''}` : 'none'}. Both sit outside the zone, on routes around it.`, dwell: LONG },
    ],
    // 5 · Who bears it
    [
      { at: null, state: Y2025, text: 'Purple areas are Disadvantaged Communities: neighborhoods the state flags for high pollution, poverty and health burdens.', dwell: DWELL },
      { at: { layer: 'bt_facility', id: 'rfk_bronx' }, side: 'right', camera: { center: [-73.9, 40.8], zoom: 11 }, text: `${fmtInt(upInDac.length)} of the ${fmtInt(up.length)} bridges that got busier are in them, and so are the South Bronx monitors that stood still.`, dwell: LONG },
      { at: [-73.94, 40.795], side: 'left', camera: { center: [-73.92, 40.8], zoom: 11.4 }, text: `Children in ${asthmaHi?.name ?? 'East Harlem'} visit the ER for asthma ${ratio ? `${ratio} times as often` : 'far more often'} as in ${asthmaLo?.name ?? 'the least affected neighborhood'}: ${fmtInt(asthmaOf(asthmaHi))} against ${fmtInt(asthmaOf(asthmaLo))} ${asthmaUnit}. Health data lag, so this is the newest year published.`, dwell: LONG },
    ],
    // 6 · Year two: first 2025 (red around the zone), then watch 2026 turn green
    [
      { at: null, state: Y2025, text: 'This is 2025 again: red around the zone, where traffic had moved. Now watch year two.', dwell: 5000 },
      { at: { layer: 'crz_entry', id: 'east_60th' }, side: 'right', state: Y2026, camera: { center: [-73.975, 40.76], zoom: 11.8 }, text: `2026 so far: weekday entries are ${fmtPct(crz.yoy_weekday_pct)} on a year earlier, and trucks ${fmtPct(crz.trucks_yoy_pct)}. Green lines mean less traffic than before.`, dwell: LONG },
      { at: { layer: 'bt_facility', id: 'whitestone' }, side: 'left', camera: { center: [-73.9, 40.77], zoom: 10.7 }, text: `The crossings around the zone are down too, ${fmtPct(bt.system_pct_2026ytd_vs_2024ytd)} below the same months of 2024. The rerouting of year one is fading.`, dwell: LONG },
    ],
    // 7 · If the Deegan or the BQE came down: reasoned from year one, not modeled
    [
      { at: null, state: Y2025, text: 'One more question: what if a highway like the Major Deegan or the BQE were removed? These data cannot model it, but year one shows the mechanism: traffic goes around a costlier route, not away.', dwell: LONG },
      { at: { layer: 'bt_facility', id: 'rfk_bronx' }, side: 'right', camera: { center: [-73.92, 40.82], zoom: 11.2 }, text: `The Deegan is fed by the RFK Bronx span (${fmtCompact(upById('rfk_bronx')?.avg_daily_2025)} a day) and runs past the Mott Haven and Cross Bronx monitors that stood still, through neighborhoods with the city's highest child asthma rates after Harlem.`, dwell: LONG },
      { at: { layer: 'bt_facility', id: 'verrazzano' }, side: 'right', camera: { center: [-73.99, 40.67], zoom: 10.8 }, text: `The BQE carries the Verrazzano's ${fmtCompact(upById('verrazzano')?.avg_daily_2025)} a day north through Brooklyn. Removed without a charge, both roads would push traffic onto local streets in the same neighborhoods; kept with a charge, year two shows trips disappear.`, dwell: LONG },
    ],
    // 8 · What this can't say
    [
      { at: null, state: Y2025, text: 'Three things to remember: nobody counted the gates before the toll, street counts are one-week samples, and air moves with the weather.', dwell: LONG },
      { at: null, text: `This is a careful comparison from ${fmtInt(s.sources_count ?? 9)} official sources, not proof of cause. Now the map is yours.`, dwell: DWELL },
    ],
  ];
}
