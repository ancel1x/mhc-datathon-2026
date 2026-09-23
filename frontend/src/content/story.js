// Story copy, templated with live numbers from summary.json (the existing pipeline) and summary.reconciled
// (the second pipeline's intervals, eligibility and persistence). Inline markup: `...` renders as a tabular
// number span, **...** as strong. Every number falls back to "—" when null.
//
// Each step: one strong title, ONE lede sentence, a short body, up to three stats (label + "so what"), at most
// one compact table or list when it materially helps, then everything else under a collapsed "Details".
// Every step answers one of the brief's requirements or questions; nothing else is in Story Mode.
import { DASH, fmtCompact, fmtDate, fmtDelta, fmtHour, fmtInt, fmtMoney, fmtNum, fmtPct, fmtSigned, isNum, shortName } from '../lib/format.js';
import { plainAir, plainAirShort, plainPct, plainPctShort, plainRate } from '../lib/plain.js';

const n = (s) => `\`${s}\``;
const argmax = (arr) => (Array.isArray(arr) && arr.length ? arr.reduce((bi, v, i, a) => (isNum(v) && (!isNum(a[bi]) || v > a[bi]) ? i : bi), 0) : null);
const joinNames = (list) => (list.length <= 1 ? list.join('') : `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`);
const SUPPORTED = new Set(['increase', 'decrease']);
const cell = (text, cls = null, strong = false) => ({ text, cls, strong });
const pctCell = (v, status) => cell(
  fmtPct(v),
  isNum(v) ? (v > 0 ? 'increase' : v < 0 ? 'decrease' : 'unchanged') : 'insufficient',
  SUPPORTED.has(status),
);
const ci = (lo, hi, digits = 1, unit = '') => (isNum(lo) && isNum(hi) ? `${fmtSigned(lo, digits)} to ${fmtSigned(hi, digits)}${unit}` : 'no interval');
const rangeText = (arr, digits = 0) => (arr.length ? `${fmtNum(Math.min(...arr), digits)}–${fmtNum(Math.max(...arr), digits)}` : DASH);
const ivlRow = (label, v, sub) => (v ? { label, sub, est: v.pct, lo: v.ci_low, hi: v.ci_high, status: v.status } : null);

export function buildStory({ summary, tolls, sources, geo }) {
  const s = summary ?? {};
  const rc = s.reconciled ?? {};
  const crz = s.crz ?? {};
  const bt = s.bt ?? {};
  const aq = s.aq ?? {};
  const eq = s.equity ?? {};
  const t = tolls ?? {};
  const car = t.ezpass_rates?.[0] ?? {};
  const bigTruck = t.ezpass_rates?.[t.ezpass_rates.length - 1] ?? {};
  const startDate = fmtDate(s.cp_start ?? '2025-01-05');

  // ---- reconciled evidence
  const traffic = rc.traffic ?? [];
  const air = rc.air ?? [];
  const tById = (id) => traffic.find((r) => r.id === id) ?? {};
  const aById = (id) => air.find((r) => r.id === id) ?? {};
  const tUp = traffic.filter((r) => r.status === 'increase');
  const tUnc = traffic.filter((r) => r.status === 'uncertain');
  const tLim = traffic.filter((r) => r.status === 'limited');
  const aDec = air.filter((r) => r.class === 'decrease');
  const aInc = air.filter((r) => r.class === 'increase');
  const aUnc = air.filter((r) => r.class === 'uncertain');
  const aNo = air.filter((r) => r.class === 'no_baseline');
  const aRawUp = aUnc.filter((r) => r.raw_status === 'increase');
  const sb = rc.south_bronx ?? [];
  const mott = sb.find((r) => /mott/i.test(r.name)) ?? {};
  const cross = sb.find((r) => /cross bronx/i.test(r.name)) ?? {};
  const hunts = sb.find((r) => /hunts/i.test(r.name)) ?? {};
  const sbUnc = sb.filter((r) => r.class === 'uncertain');
  const pers = rc.persistence_highlights ?? [];
  const persOf = (id) => pers.find((h) => h.id === id);
  const dot = rc.dot ?? {};
  const tier1 = dot.tiers?.same_month_2024?.rows ?? [];
  const tier2 = dot.tiers?.same_month_older?.rows ?? [];
  const tier3 = dot.tiers?.different_month?.rows ?? [];
  const uhf = (geo?.uhf42?.features ?? []).map((f) => f.properties ?? {});
  const asthmaOf = (name) => uhf.find((p) => p.name === name)?.asthma_ed_children;
  const decAsthma = aDec.map((r) => r.uhf42_asthma_ed_children).filter(isNum);
  const sbAsthma = sbUnc.map((r) => r.uhf42_asthma_ed_children).filter(isNum);
  const upInDac = tUp.filter((r) => r.dac_designated);
  const peakHour = argmax(crz.hourly_weekday_2025);
  const mix = crz.class_mix_2025 ?? {};
  const rushRows = traffic.filter((r) => SUPPORTED.has(r.status) || SUPPORTED.has(r.peak?.am?.status) || SUPPORTED.has(r.peak?.pm?.status));
  const amUp = traffic.filter((r) => r.peak?.am?.status === 'increase' && r.status !== 'increase');
  const qmt = tById('qmt');
  const hlc = tById('hlc');
  const hlcEv = (geo?.bt_facility?.features ?? []).find((f) => f.properties?.id === 'hlc')?.properties?.evidence?.full_year ?? {};
  const bronxCrossings = ['rfk_bronx', 'throgs_neck', 'whitestone', 'henry_hudson'].map(tById);

  // ---- the highway scenario (Major Deegan): observed inputs only
  const dotFeats = (geo?.dot_segment?.features ?? []).map((f) => f.properties ?? {});
  const deegan = dotFeats.filter((p) => /major deegan/i.test(p.street ?? '')).sort((a, b) => (b.latest_adv ?? 0) - (a.latest_adv ?? 0))[0];
  const rfkBronx = tById('rfk_bronx');
  const hh = tById('henry_hudson');
  const hamilton = aById('aq_36061NY12380');
  const corridorAsthma = ['High Bridge - Morrisania', 'Hunts Point - Mott Haven', 'Crotona - Tremont'].map(asthmaOf).filter(isNum);

  const monitorsWithBaseline = air.length ? air.length - aNo.length : null;
  const sitesTotal = aq.sites_total ?? (air.length || null);

  return [
    // 0 · Before the toll ------------------------------------------------------------------
    {
      kicker: '2024 · before the toll',
      title: 'Before the toll',
      lede: `In 2024, before any toll, about ${n(fmtCompact(bt.system_avg_daily_2024))} vehicles a day crossed the MTA's nine bridges and tunnels, and the city's street-level monitors averaged ${n(`${fmtNum(aq.citywide_pm25_2024)} µg/m³`)} of fine-particle pollution (PM2.5): fine soot in the air, where lower is better.`,
      body: 'This is the baseline. Every change on the following steps is measured against the same crossing or monitor in 2024, so a place without a usable 2024 record cannot get a verdict; it shows as a hollow ring.',
      stats: [
        { label: 'Vehicles a day on the nine MTA crossings', value: fmtCompact(bt.system_avg_daily_2024), sub: 'the 2024 starting point' },
        { label: 'Monitors with a usable 2024 baseline', value: `${fmtInt(monitorsWithBaseline)} of ${fmtInt(sitesTotal)}`, sub: joinNames(aNo.map((r) => r.name)) ? `no baseline: ${joinNames(aNo.map((r) => r.name))}` : 'all monitors' },
        { label: 'Citywide PM2.5 in 2024', value: `${fmtNum(aq.citywide_pm25_2024)} µg/m³`, sub: 'micrograms of fine soot per cubic metre of air, averaged over the year; the federal annual limit is 9, and a change of 1 is a lot for one street' },
      ],
      details: {
        paragraphs: [
          'PM2.5 is the fine soot from engines, heating, cooking and regional smoke that gets deep into the lungs. It is measured in micrograms per cubic metre (µg/m³): lower is better, and a change of one unit is a lot for a single street.',
          'On the map, bigger discs and thicker lines mean more vehicles; the lines move in the direction traffic travels across each crossing. Click any crossing or monitor for its 2024 record, monthly series and hour-by-hour profile.',
        ],
      },
    },
    // 1 · The toll begins ------------------------------------------------------------------
    {
      kicker: 'January 5, 2025',
      title: 'The toll begins',
      lede: `On ${n(startDate)}, driving into Manhattan below 60th Street started costing most cars ${n(fmtMoney(car.peak))} a day.`,
      body: 'The official topline describes what happened inside this priced core. Our question is what happened across the rest of New York City: the crossings around it, the street-level air, and the neighborhoods that were already carrying the most.',
      stats: [
        { label: 'A car, daytime', value: fmtMoney(car.peak), sub: `once a day · weekdays ${t.peak_hours?.weekday ?? '5 AM – 9 PM'}, weekends ${t.peak_hours?.weekend ?? '9 AM – 9 PM'}` },
        { label: 'A car, overnight', value: fmtMoney(car.overnight), sub: '75% off, 9 PM to 5 AM' },
        { label: 'The largest trucks, daytime', value: fmtMoney(bigTruck.peak), sub: `tunnel crossing credit up to ${fmtMoney(bigTruck.crossing_credit)}` },
      ],
      details: {
        paragraphs: [
          `Taxis pay ${n(fmtMoney(t.per_trip?.[0]?.fee))} and app rides ${n(fmtMoney(t.per_trip?.[1]?.fee))} per trip instead of the daily toll. Drivers arriving through the four tolled tunnels get a credit of up to ${n(fmtMoney(car.crossing_credit))} for a car. The ${(t.excluded_roadways ?? []).slice(0, 2).join(' and ') || 'FDR Drive and West Side Highway'} stay free: you can drive along the island's edges without paying, but not turn into the grid.`,
          `**External context, not our result.** The widely quoted "22% cleaner" figure is a modeled drop in daily-maximum PM2.5 inside the zone against a projected no-toll year (Cornell University, npj Clean Air, Dec 2025), and the MTA reports entry declines against a modeled baseline. Neither compares with a 2024 count. Every figure on the following steps does.`,
        ],
        extra: 'tolls',
      },
    },
    // 2 · Inside the zone -------------------------------------------------------------------
    {
      kicker: '2025 · year one',
      title: 'About 502,000 vehicles entered the zone each weekday',
      lede: `In year one about ${n(fmtCompact(crz.avg_weekday_entries_2025))} vehicles still entered the zone on a typical weekday, ${n(fmtShareText(crz.peak_share_2025))} of them in the tolled daytime hours.`,
      body: 'Nobody counted these gates before the toll, so this dataset shows the level, the daily rhythm and the vehicle mix, not a before/after change. The mixed daily picture the brief asks about starts here: the busiest hour is still the morning rush.',
      stats: [
        { label: 'Vehicles entering, per weekday', value: fmtCompact(crz.avg_weekday_entries_2025), sub: `${fmtShareText(mix.taxi_fhv)} of them taxis and app rides` },
        { label: 'Arriving in the tolled daytime hours', value: fmtShareText(crz.peak_share_2025), sub: `when the full ${fmtMoney(car.peak)} applies` },
        { label: 'Busiest hour', value: fmtHour(peakHour), sub: 'the morning rush' },
      ],
      details: {
        paragraphs: [
          `Cars are ${n(fmtShareText(mix.cars))} of entries, taxis and app rides ${n(fmtShareText(mix.taxi_fhv))}, trucks ${n(fmtShareText((mix.trucks_single ?? 0) + (mix.trucks_multi ?? 0)))}. ${n(fmtShareText(crz.overnight_share_2025))} of entries arrive overnight, when the toll is a quarter of the price.`,
          '**No pre-toll baseline exists at these gates.** The detectors were switched on with the toll, so nothing here is a change since 2024. The crossings, street counters and monitors on the next steps all have a 2024 record; year two at the gates (Jan–Aug 2026 vs 2025) is on the 2026 step.',
        ],
        list: { title: 'Busiest entry points, 2025 weekdays', rows: (crz.top_entry_points_2025 ?? []).map((p) => ({ label: p.name, value: fmtCompact(p.avg_weekday_entries), sub: `${fmtShareText(p.share)} of all entries` })) },
      },
    },
    // 3 · Crossings ------------------------------------------------------------------------
    {
      kicker: '2025 vs 2024 · Jan 5–Dec 31',
      title: 'Traffic went around, not away',
      lede: `Outside the priced core, crossing volumes changed unevenly: ${n(fmtInt(tUp.length))} supported increases, ${n(fmtInt(tUnc.length))} changes too small to separate from zero, ${n(fmtInt(tLim.length))} coverage-limited tunnel.`,
      body: 'Each crossing is compared with itself in 2024 and carries a 95% interval: the range of doubt around the estimate. A change counts as supported only when that whole range sits above or below zero. Red = more vehicles than 2024, supported; grey ring = no clear change. Counts are crossing events, not tracked vehicles, so this cannot say whether the same trips moved from the tunnels to the bridges.',
      stats: [
        { label: 'Supported increases', value: `${fmtInt(tUp.length)} of ${fmtInt(traffic.length)}`, sub: `${joinNames(tUp.map((r) => `${shortName(r.name)} ${fmtPct(r.pct_existing)}`)) || 'none'} · ${plainPct(avg(tUp.map((r) => r.pct_existing)), { status: tUp.length ? 'increase' : null })}`, tone: tUp.length ? 1 : 0 },
        { label: 'Uncertain', value: `${fmtInt(tUnc.length)} of ${fmtInt(traffic.length)}`, sub: `changes of about ${fmtInt(Math.max(1, Math.ceil(Math.max(0, ...tUnc.map((r) => Math.abs(r.pct_existing ?? 0))))))} vehicle${Math.ceil(Math.max(0, ...tUnc.map((r) => Math.abs(r.pct_existing ?? 0)))) > 1 ? 's' : ''} per 100 or less, too small to tell from no change · e.g. ${joinNames(tUnc.slice(0, 2).map((r) => `${shortName(r.name)} ${fmtPct(r.pct_existing)}`)) || DASH}` },
        { label: 'All nine crossings together', value: fmtPct(bt.system_pct_2025_vs_2024), sub: `${plainPct(bt.system_pct_2025_vs_2024)} · observed sum, no range of doubt`, tone: 0 },
      ],
      table: {
        title: 'Rush hours vs the whole day, 2025 vs 2024',
        head: ['Crossing', 'Whole day', 'AM rush', 'PM rush'],
        rows: rushRows.map((r) => ({ cells: [shortName(r.name), pctCell(r.pct_existing, r.status), pctCell(r.peak?.am?.pct, r.peak?.am?.status), pctCell(r.peak?.pm?.pct, r.peak?.pm?.status)] })),
        foot: `AM = weekdays 7–10 AM, PM = 4–7 PM. +4.7% means about 5 more vehicles for every 100 that crossed in 2024. Green = decreased traffic; red = increased traffic; bold = supported (the range of doubt stays on one side of zero); grey = no change. Hugh L. Carey is coverage-limited and not listed.`,
      },
      details: {
        paragraphs: [
          `**The rush hours tell a different story from the daily totals.** ${amUp.length ? `The morning rush rose at ${joinNames(amUp.map((r) => `${shortName(r.name)} (${fmtPct(r.peak.am.pct)})`))} even though ${amUp.length === 1 ? 'its' : 'their'} whole-day change is uncertain` : 'No crossing shows a supported morning-rush rise beyond its whole-day change'}${qmt.peak?.pm?.status === 'decrease' ? `, and the Queens Midtown Tunnel's evening rush fell (${fmtPct(qmt.peak.pm.pct)}) while its full day is uncertain` : ''}. The topline's "less traffic" is not what the commuting hours on the crossings around the zone show.`,
          `**Hugh L. Carey Tunnel: coverage warning.** Its all-days average fell ${n(fmtPct(hlc.pct_existing))}, but only ${n(fmtInt(hlcEv.complete_days_2024))} days in 2024 and ${n(fmtInt(hlcEv.complete_days_2025))} in 2025 met the completeness rule, and only weekends could be matched (${n(fmtPct(hlc.pct))}, ${ci(hlc.ci_low, hlc.ci_high, 1, '%')}). Treat it as a selected-day comparison, not a full-year change.`,
          `The Marine Parkway Bridge out by the Rockaways, far from the zone, is one of the ${n(fmtInt(tUp.length))} supported increases, so part of the growth around Manhattan is ordinary growth rather than diversion. Click any crossing for its interval, monthly series, rush windows and 2026 status.`,
        ],
        intervals: {
          title: 'Each crossing, 2025 vs 2024 · 95% interval',
          unit: '%',
          rows: traffic.map((r) => ivlRow(shortName(r.name), r, r.status === 'limited' ? 'complete weekend days only' : `${fmtCompact(r.avg_daily_2025)} a day`)),
          foot: 'Matched-day analysis, equal month × weekday weights, seven-day-cluster bootstrap (200 draws).',
        },
      },
    },
    // 4 · Street level ---------------------------------------------------------------------
    {
      kicker: '2025 · sampled street counts',
      title: 'Street level: what DOT counters add',
      lede: `NYC DOT counted ${n(fmtInt(dot.matched_total))} of ${n(fmtInt(dot.on_map))} mapped street locations both before and after the toll; a strict matched-month analysis found none that qualify for a citywide estimate.`,
      body: 'These are one-week samples at rotating spots, so they describe those spots, not the city. The most comparable pairs (same calendar month, 2024 against 2025) sit at the East River bridge approaches and around 60th Street, where the counts fell.',
      stats: [
        { label: 'Counted before and after the toll', value: `${fmtInt(dot.matched_total)} of ${fmtInt(dot.on_map)}`, sub: 'filled squares; hollow squares were counted once' },
        { label: 'Same month, 2024 vs 2025', value: fmtInt(tier1.length), sub: tier1.length ? `${fmtInt(tier1.filter((r) => r.pct_change < 0).length)} fell, ${fmtInt(tier1.filter((r) => r.pct_change > 0).length)} rose` : 'none' },
        { label: 'Citywide street-level change', value: 'not estimable', sub: 'strict matched-month rule found no eligible pairs' },
      ],
      list: {
        title: 'Same calendar month, 2024 → 2025 (sampled)',
        rows: tier1.map((r) => ({ label: `${titleStreet(r.street)} · ${r.boro}`, value: fmtPct(r.pct_change), sub: `${fmtCompact(r.pre_adv)} → ${fmtCompact(r.post_adv)} a day`, tone: r.pct_change })),
      },
      details: {
        paragraphs: [
          `The other ${n(fmtInt(tier2.length + tier3.length))} pairs compare a 2025 week with an older or different-month baseline (${joinNames(tier3.slice(0, 3).map((r) => `${titleStreet(r.street)} ${fmtPct(r.pct_change)}`))}${tier3.length > 3 ? ', …' : ''}). They are kept in Explore and in each square's detail, labelled by how comparable the pair is, but they carry no interval and are not evidence of citywide rerouting.`,
          `Post-toll-only snapshots exist for the Major Deegan (${n(fmtCompact(dot.post_only_context?.find((p) => /DEEGAN/.test(p.street))?.latest_adv))} vehicles a day on one roadway), the Deegan entrance at the Willis Avenue Bridge and Bruckner Boulevard. They have no "before", so they appear only as context in the highway step; switch on "All DOT sites" under Layers to see every sampled spot.`,
        ],
      },
    },
    // 5 · Air --------------------------------------------------------------------------------
    {
      kicker: '2025 vs 2024 · matched months',
      title: 'Air quality improved at two monitors near the congestion zone, but not in the South Bronx',
      lede: `${n(fmtInt(aDec.length))} monitors show a supported decrease in fine-particle pollution once weather is accounted for, ${n(fmtInt(aUnc.length))} are uncertain, ${n(fmtInt(aInc.length))} show a supported increase, and ${n(fmtInt(aNo.length))} have no eligible 2024 baseline.`,
      body: `Two numbers per monitor: the raw change in fine soot, and a weather-adjusted change that removes what wind and temperature would explain. Each comes with a 95% interval, the range of doubt; a result is "supported" only when that range stays on one side of zero. Only ${joinNames((rc.air_full_coverage_ids ?? []).map((id) => aById(id).name).filter(Boolean)) || 'one monitor'} has all 12 matched months; every other estimate is a partial-year window.`,
      stats: [
        { label: 'Supported decreases', value: `${fmtInt(aDec.length)} of ${fmtInt(air.length)}`, sub: `cleaner air than 2024, supported by the data · ${fmtInt(aDec.filter((r) => r.crz_status !== 'outside').length)} in or beside the zone, ${joinNames(aDec.filter((r) => r.crz_status === 'outside').map((r) => r.name)) || 'none'} outside`, tone: aDec.length ? -1 : 0 },
        { label: 'Uncertain', value: fmtInt(aUnc.length), sub: `no clear change either way · incl. ${joinNames(sbUnc.map((r) => r.name))}${aRawUp.length ? `; ${joinNames(aRawUp.map((r) => `${r.name} read ${fmtDelta(r.delta_raw, '', 2)} µg/m³ higher raw (${plainAirShort(r.delta_raw, r.pre_mean)}) but is uncertain once weather is accounted for`))}` : ''}` },
        { label: 'No eligible 2024 baseline', value: fmtInt(aNo.length), sub: `nothing to compare with · ${joinNames(aNo.map((r) => r.name)) || 'none'}` },
      ],
      table: {
        title: 'Supported decreases, 2025 vs 2024',
        head: ['Monitor', 'Months', 'Raw', 'Adjusted', 'In plain words'],
        rows: aDec.map((r) => ({ cells: [r.name, `${fmtInt(r.month_count)} / 12`, cell(fmtDelta(r.delta_raw, '', 2), r.raw_status), cell(fmtDelta(r.adj_delta, '', 2), 'decrease', true), cell(plainAirShort(r.adj_delta, r.pre_mean), 'decrease')] })),
        foot: 'Raw and adjusted are changes in µg/m³ (micrograms of fine soot per cubic metre of air); adjusted = after weather adjustment, and "≈29% less soot" compares it with that monitor’s own 2024 level. Months = months with enough data in both years; 12 / 12 is a complete year, anything less is a partial window.',
      },
      details: {
        paragraphs: [
          `**May have worsened.** ${aRawUp.length ? `${joinNames(aRawUp.map((r) => `${r.name} (${r.uhf42_name}) read ${fmtDelta(r.delta_raw, 'µg/m³', 2)} higher on ${fmtInt(r.month_count)} matched months, an interval above zero, but ${fmtDelta(r.adj_delta, 'µg/m³', 2)} (${ci(r.adj_ci_low, r.adj_ci_high, 2)}) after weather adjustment, which does not survive correction for testing ${fmtInt(air.length)} monitors at once`))}. It is the one place the data hint at a worsening; the map shows it as uncertain.` : 'No monitor shows a supported increase, raw or adjusted.'}`,
          `**Why two numbers.** Our own method compares each monitor with the Health Department's control site on the Van Wyck Expressway (which itself fell ${n(fmtDelta(aById('aq_36081NY07615').delta_raw, 'µg/m³', 2))}); the independent analysis instead adjusts for weather and reports an interval. Where a monitor "tracked the control" but its own interval excludes zero, the plain-English verdict is a decrease, and the control reading is shown beside it in the inspector.`,
        ],
        table: {
          title: 'Every monitor, 2025 vs 2024',
          head: ['Monitor', 'Months', 'Raw µg/m³', 'Adjusted', 'Verdict'],
          rows: air.map((r) => ({ cells: [r.name, r.class === 'no_baseline' ? '—' : `${fmtInt(r.month_count)} / 12`, r.class === 'no_baseline' ? '—' : fmtDelta(r.delta_raw, '', 2), r.class === 'no_baseline' ? '—' : isNum(r.adj_delta) ? fmtDelta(r.adj_delta, '', 2) : 'n/a', cell(r.class === 'no_baseline' ? 'nothing to compare' : r.class === 'uncertain' ? 'no clear change' : r.class === 'decrease' ? `cleaner (${plainAirShort(r.adj_delta ?? r.delta_raw, r.pre_mean)})` : `dirtier (${plainAirShort(r.adj_delta ?? r.delta_raw, r.pre_mean)})`, r.class, SUPPORTED.has(r.class))] })),
          foot: 'Raw and adjusted are changes in µg/m³ of fine soot against each monitor’s own 2024 level. Missing data are shown as unavailable, never as zero. Port Richmond ran only May–Aug 2024.',
        },
      },
    },
    // 6 · South Bronx ------------------------------------------------------------------------
    {
      kicker: '2025 vs 2024 · "Asthma Alley"',
      title: 'The South Bronx, monitor by monitor',
      lede: `The available monitor-level evidence does not show a statistically clear PM2.5 increase or decrease at ${mott.name ?? 'Mott Haven'} or ${cross.name ?? 'Cross Bronx'}, while ${hunts.name ?? 'Hunts Point'} lacks an eligible 2024 baseline.`,
      body: 'Read on their own rather than through the citywide average, the South Bronx monitors sit in the middle: no supported improvement like the sites beside the zone, no supported worsening either. The question is whether the clearest gains reached the neighborhoods already carrying the highest asthma burden. Here they did not show up.',
      stats: [
        { label: `${mott.name ?? 'Mott Haven'}: no clear change`, value: fmtDelta(mott.adj_delta, 'µg/m³', 2), sub: `${plainAir(mott.adj_delta, mott.pre_mean)} after weather adjustment, but the range of doubt (${ci(mott.adj_ci_low, mott.adj_ci_high, 2)}) includes zero · ${fmtInt(mott.month_count)} matched months`, tone: 0 },
        { label: `${cross.name ?? 'Cross Bronx Expressway'}: no clear change`, value: fmtDelta(cross.adj_delta, 'µg/m³', 2), sub: `${plainAir(cross.adj_delta, cross.pre_mean)} after weather adjustment, but the range of doubt (${ci(cross.adj_ci_low, cross.adj_ci_high, 2)}) includes zero · ${fmtInt(cross.month_count)} matched months`, tone: 0 },
        { label: `${hunts.name ?? 'Hunts Point'}: nothing to compare with`, value: 'no baseline', sub: 'the monitor was offline Sep 2023 – Mar 2025, so there is no 2024 level and no before/after verdict' },
      ],
      table: {
        title: 'Pre-existing burden, not caused by the toll',
        head: ['Neighborhood', 'Poverty', 'Child asthma ED', 'Adult asthma ED'],
        rows: dedupe(sb.map((r) => r.context).filter(Boolean), (c) => c.neighborhood).map((c) => ({ cells: [c.neighborhood, `${fmtNum(c.poverty_pct, 1)}%`, fmtNum(c.child_asthma_ed, 1), fmtNum(c.adult_asthma_ed, 1)] })),
        foot: `Poverty: % of residents below the line, ACS 2019–23. Asthma: emergency-room visits per 10,000 people in 2023 (children 5–17; adults age-adjusted), the newest year published; ${fmtNum(mott.context?.child_asthma_ed, 1)} per 10,000 means ${plainRate(mott.context?.child_asthma_ed)} children visited the ER for asthma that year. NYC Health Dept.`,
      },
      details: {
        paragraphs: [
          `**Raw readings.** ${mott.name ?? 'Mott Haven'} ${n(fmtNum(mott.pre_mean, 2))} → ${n(fmtNum(mott.post_mean, 2))} µg/m³ (${fmtDelta(mott.delta_raw, '', 2)}, ${ci(mott.ci_low, mott.ci_high, 2)}); ${cross.name ?? 'Cross Bronx'} ${n(fmtNum(cross.pre_mean, 2))} → ${n(fmtNum(cross.post_mean, 2))} (${fmtDelta(cross.delta_raw, '', 2)}, ${ci(cross.ci_low, cross.ci_high, 2)}). Both intervals include zero.`,
          `**Against the citywide trend.** Our own control-site reading says both monitors fell less than the Van Wyck control by about ${n(fmtDelta(avg([mott.existing?.delta_adj_control, cross.existing?.delta_adj_control]), 'µg/m³', 2))}. That difference carries no interval and is not statistically supported; it is consistent with "no clear change", not evidence of harm.`,
          `**The Bronx crossings.** ${joinNames(bronxCrossings.map((r) => `${shortName(r.name)} ${fmtPct(r.pct_existing)} (${CLASS_WORD[r.status] ?? DASH}${r.peak?.am?.status === 'increase' ? `, morning rush ${fmtPct(r.peak.am.pct)} supported` : ''})`))}. Whether any of that traffic reached the Bruckner or the Deegan cannot be measured: DOT has only post-toll counts there.`,
        ],
      },
    },
    // 7 · Burden -----------------------------------------------------------------------------
    {
      kicker: '2025 · overlap with vulnerable communities',
      title: 'Traffic and air-quality burdens were concentrated in already disadvantaged communities',
      lede: 'The clearest air improvements landed in and beside the priced core, in neighborhoods with lower pre-existing asthma burden; the highest-burden monitored neighborhoods saw no statistically clear change either way.',
      body: `Purple areas are state-designated Disadvantaged Communities. ${upInDac.length ? `The ${upInDac.length === 1 ? 'one supported traffic increase' : `${fmtInt(upInDac.length)} supported traffic increases`} inside them ${upInDac.length === 1 ? 'is' : 'are'} ${joinNames(upInDac.map((r) => `the ${shortName(r.name)} (${r.uhf42_name})`))}.` : 'No supported traffic increase falls inside them.'} Historical vulnerability is not the same as new harm caused by the toll: this step shows where the patterns overlap, not what caused them.`,
      stats: [
        { label: 'Supported crossing increases in Disadvantaged Communities', value: `${fmtInt(upInDac.length)} of ${fmtInt(tUp.length)}`, sub: joinNames(upInDac.map((r) => `${shortName(r.name)} ${fmtPct(r.pct_existing)}`)) || 'none', tone: upInDac.length ? 1 : 0 },
        { label: 'Child asthma ER visits where PM2.5 fell', value: rangeText(decAsthma), sub: `per 10,000 children in 2023, i.e. ${plainRate(Math.min(...(decAsthma.length ? decAsthma : [NaN])))} to ${plainRate(Math.max(...(decAsthma.length ? decAsthma : [NaN])))} children · ${fmtInt(aDec.length)} monitors, from ${aDec.length ? shortName(aDec.reduce((a, b) => ((a.uhf42_asthma_ed_children ?? 1e9) < (b.uhf42_asthma_ed_children ?? 1e9) ? a : b)).uhf42_name) : DASH} to ${aDec.length ? aDec.reduce((a, b) => ((a.uhf42_asthma_ed_children ?? -1) > (b.uhf42_asthma_ed_children ?? -1) ? a : b)).uhf42_name : DASH}` },
        { label: 'Where the South Bronx result is uncertain', value: rangeText(sbAsthma), sub: `per 10,000 children in 2023, i.e. ${plainRate(Math.max(...(sbAsthma.length ? sbAsthma : [NaN])))} children · ${joinNames(sbUnc.map((r) => r.uhf42_name))}` },
      ],
      details: {
        paragraphs: [
          `${n(fmtShareText(eq.dac_share))} of the city's census tracts (${n(fmtInt(eq.dac_designated_tracts))} of ${n(fmtInt(eq.nyc_tracts))}) carry the state designation. Switch the purple layer to the asthma rate to see where the health burden already sits, and click any neighborhood for its poverty and asthma figures with their source and period.`,
          'Health data lag about two years: 2023 is the newest year published, so there are no post-toll asthma figures. The asthma rate is all emergency visits for asthma, not only the pollution-linked ones.',
        ],
        extra: 'choropleth',
      },
    },
    // 8 · 2026 -------------------------------------------------------------------------------
    {
      kicker: 'Jan 5–Aug 31 · 2024 vs 2025 vs 2026',
      title: 'Traffic declined further in 2026',
      lede: `Some year-one patterns persisted, ${pers.filter((h) => h.label === 'reversed').length === 1 ? 'one reversed' : `${fmtInt(pers.filter((h) => h.label === 'reversed').length)} reversed`}, and most are still inconclusive after eight months of 2026.`,
      body: `Only January–August is compared, against the same months of 2024, so nothing here is a full-year result. ${persText(pers, tById, aById)} The ${fmtInt(tUp.length)} supported increases of year one (${joinNames(tUp.map((r) => shortName(r.name)))}) are no longer distinguishable from 2024.`,
      notice: '2026 is incomplete, so comparisons use matched available periods: zone entries compare the available 2026 period with the same 2025 period; MTA bridge and tunnel traffic compares January–August 2026 with January–August 2024.',
      stats: pers.slice(0, 3).map((h) => ({
        label: `${shortName(h.name)}${h.kind === 'air' ? ' PM2.5' : ''}: ${h.label}`,
        value: h.kind === 'air' ? `${fmtSigned(h.y2025, 2)} → ${fmtSigned(h.y2026, 2)}` : `${fmtPct(h.y2025)} → ${fmtPct(h.y2026)}`,
        sub: h.kind === 'air'
          ? `µg/m³ of fine soot vs Jan–Aug 2024 (${h.basis ?? 'raw'}) · by 2026 ${plainAirShort(h.y2026, (aById(h.id).jan_aug?.['2026']?.pct_raw && h.basis !== 'weather-adjusted') ? h.y2026 / (aById(h.id).jan_aug['2026'].pct_raw / 100) : aById(h.id).pre_mean)}`
          : `vs Jan–Aug 2024 · by 2026 ${plainPctShort(h.y2026)}`,
        tone: h.label === 'reversed' ? 0 : (h.y2026 ?? 0) < 0 ? -1 : 1,
      })),
      table: {
        title: 'Persistence verdicts, Jan–Aug',
        head: ['Location', '2025 vs 2024', '2026 vs 2024', 'Verdict'],
        rows: [
          ...pers.map((h) => ({ cells: [shortName(h.name), h.kind === 'air' ? fmtDelta(h.y2025, '', 2) : fmtPct(h.y2025), h.kind === 'air' ? fmtDelta(h.y2026, '', 2) : fmtPct(h.y2026), cell(h.label, h.label === 'reversed' ? 'uncertain' : 'decrease', true)] })),
          { cells: [`All other crossings and monitors (${fmtInt(traffic.length + air.length - pers.length)})`, '', '', cell('inconclusive', 'uncertain')] },
        ],
        foot: `Traffic in % of vehicles per day${pers.find((h) => h.kind === 'traffic') ? ` (${fmtPct(pers.find((h) => h.kind === 'traffic').y2026)} means ${plainPctShort(pers.find((h) => h.kind === 'traffic').y2026)} than in Jan–Aug 2024)` : ''}; air in µg/m³ of fine soot, translated in the rows above. A verdict needs both years’ ranges of doubt on one side of zero; "inconclusive" means at least one includes zero.`,
      },
      details: {
        paragraphs: [
          `Entries into the zone kept falling: weekday entries ${n(fmtPct(crz.yoy_weekday_pct))} and trucks ${n(fmtPct(crz.trucks_yoy_pct))} in Jan–Aug 2026 against Jan–Aug 2025 (the gates have no 2024 count). The nine crossings together sit ${n(fmtPct(bt.system_pct_2026ytd_vs_2024ytd))} below Jan–Aug 2024, an observed sum without an interval. Data run to ${n(fmtDate(crz.last_date))} for entries and ${n(fmtDate(bt.last_date))} for the crossings.`,
        ],
        intervals: {
          title: 'Each crossing, Jan–Aug 2026 vs 2024 · 95% interval',
          unit: '%',
          rows: traffic.map((r) => ivlRow(shortName(r.name), r.jan_aug?.['2026'], r.persistence)),
          foot: 'The sub-line is the persistence verdict; 2026 is not a complete year.',
        },
      },
    },
    // 9 · What if ----------------------------------------------------------------------------
    {
      kicker: 'What if · one corridor, reasoned from the data',
      badge: 'Data-grounded scenario reasoning · not a forecast',
      badgeTone: 'warn',
      title: 'What if the Deegan or BQE were removed?',
      lede: 'The brief asks what would happen if a highway like the Major Deegan or the BQE were removed or repurposed. These data cannot model it, so this step reasons through one corridor, the Deegan, from what was observed.',
      bullets: [
        `**Traffic burden today.** DOT counted ${n(fmtCompact(deegan?.latest_adv))} vehicles a day on one roadway of the Deegan at High Bridge (${(deegan?.months ?? []).map(monthShort).join('–') || 'after the toll'}, post-toll only, no "before"). The crossings that feed it: ${shortName(rfkBronx.name ?? 'RFK Bronx')} ${n(fmtCompact(rfkBronx.avg_daily_2025))} a day (${fmtPct(rfkBronx.pct_existing)}, ${CLASS_WORD[rfkBronx.status] ?? DASH}), Henry Hudson ${n(fmtCompact(hh.avg_daily_2025))} (morning rush ${fmtPct(hh.peak?.am?.pct)}, ${CLASS_WORD[hh.peak?.am?.status] ?? DASH}).`,
        `**Air beside it.** ${mott.name ?? 'Mott Haven'} and ${cross.name ?? 'Cross Bronx'} are uncertain; the ${hamilton.name ?? 'Hamilton Bridge'} monitor at the Cross Bronx–Deegan junction rose ${n(fmtDelta(hamilton.delta_raw, 'µg/m³', 2))} raw (uncertain after weather adjustment).`,
        `**Who lives beside it.** High Bridge–Morrisania, Hunts Point–Mott Haven and Crotona–Tremont: ${n(rangeText(corridorAsthma))} child asthma ER visits per 10,000 in 2023, i.e. ${plainRate(Math.max(...(corridorAsthma.length ? corridorAsthma : [NaN])))} to ${plainRate(Math.min(...(corridorAsthma.length ? corridorAsthma : [NaN])))} children; all Disadvantaged Community tracts.`,
        '**Possible benefit.** Removing or capping the road takes a local exhaust source away from these blocks and frees land for greenspace; but vehicle exhaust is only part of PM2.5, so the local gap would narrow, not close.',
        `**The risk.** Without trip suppression, the same volumes would move to Bruckner Boulevard, the Grand Concourse and Third Avenue, streets inside the same tracts. Year two shows trips can fall when a charge persists (zone entries ${n(fmtPct(crz.yoy_weekday_pct))}); nothing observed says how many of the Deegan's would.`,
      ],
      stats: [
        { label: 'Major Deegan at High Bridge', value: fmtCompact(deegan?.latest_adv), sub: 'vehicles a day, one roadway · after the toll only, no before' },
        { label: 'Feeder crossings, 2025', value: `${fmtCompact(rfkBronx.avg_daily_2025)} + ${fmtCompact(hh.avg_daily_2025)}`, sub: `${shortName(rfkBronx.name ?? 'RFK Bronx')} (${CLASS_WORD[rfkBronx.status] ?? DASH}) + Henry Hudson (AM rush ${fmtPct(hh.peak?.am?.pct)}, ${CLASS_WORD[hh.peak?.am?.status] ?? DASH})` },
        { label: 'Child asthma ER visits along the corridor', value: rangeText(corridorAsthma), sub: `per 10,000 children in 2023, i.e. ${plainRate(Math.max(...(corridorAsthma.length ? corridorAsthma : [NaN])))} to ${plainRate(Math.min(...(corridorAsthma.length ? corridorAsthma : [NaN])))} children · pre-existing burden` },
      ],
      details: {
        paragraphs: [
          '**Why this is reasoning, not a model.** None of these sources record where trips start and end, so the counts cannot say how many Deegan trips would vanish and how many would divert, or by how much PM2.5 would fall on which block. No percentage reduction, diversion path or health outcome is stated because none can be supported.',
          '**Why the Deegan and not the BQE.** The Deegan corridor has the strongest combination of feeder-crossing evidence (two of the supported rush-hour increases), adjacent monitors (three, one with a raw rise), DOT snapshots and pre-existing burden. The BQE at Joralemon Street was counted at about 129,000 vehicles a day in May 2025 (−10 to −13% against 2019), beside a monitor that is uncertain and neighborhoods with lower asthma rates; it stays in Explore.',
        ],
      },
    },
    // 10 · Caveats ---------------------------------------------------------------------------
    {
      kicker: 'Before you draw conclusions',
      title: 'What this can’t say',
      lede: 'This is a careful before-and-after comparison with intervals, not proof that congestion pricing caused any of it.',
      bullets: [
        'Association is not cause. Every change here is the same place compared with itself in 2024; other things changed between the two years too.',
        'Traffic counts are crossing events, not tracked trips: nothing here shows the same vehicles moving from one route to another.',
        `Many air monitors have partial matched-month coverage: only ${joinNames((rc.air_full_coverage_ids ?? []).map((id) => aById(id).name).filter(Boolean)) || 'one monitor'} has all 12 months, so most PM2.5 results are partial-year windows.`,
        `Hugh L. Carey Tunnel: complete records for only ${fmtInt(hlcEv.complete_days_2024)} days in 2024 and ${fmtInt(hlcEv.complete_days_2025)} in 2025, weekends only; its change is coverage-limited.`,
        `${hunts.name ?? 'Hunts Point'} has no eligible 2024 baseline; Glendale has no eligible matched baseline; Midtown West moved on July 23, 2026, so it has no eligible Jan–Aug 2026 comparison.`,
        `DOT street counts are one-week samples at rotating spots: ${fmtInt(dot.matched_total)} matched pairs, ${fmtInt(tier1.length)} in the same month of 2024 and 2025, no citywide street estimate.`,
        'Zone-entry detectors only exist since the toll started, so they have no 2024 baseline; their year-two change is 2026 against 2025.',
        '2026 is January–August only and is never presented as a complete year.',
        `All ${n(fmtInt(sources?.length ?? 0))} sources are official NYC Open Data, New York State Open Data or NYC Health Department publications. Crossing and gate locations are approximate.`,
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
  body: 'Pick the year on the right, turn layers on or off, and click any crossing, monitor, street counter or neighborhood for its full evidence: intervals, matched months, rush windows, monthly series and 2026 status. Zoom in past level 11 and the points become 24-hour clocks: grey ring = 2024, colored ring = the year shown.',
};

// ---- small helpers -------------------------------------------------------------------------
const CLASS_WORD = { increase: 'supported increase', decrease: 'supported decrease', uncertain: 'uncertain', limited: 'coverage-limited', no_baseline: 'no eligible baseline' };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function monthShort(ym) {
  if (!ym || typeof ym !== 'string') return '';
  const [y, m] = ym.split('-').map(Number);
  return y && m ? `${MONTHS[m - 1]} ${y}` : ym;
}
function fmtShareText(v, digits = 0) {
  return isNum(v) ? `${fmtNum(v * 100, digits)}%` : DASH;
}
function avg(arr) {
  const v = (arr ?? []).filter(isNum);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}
function dedupe(list, keyOf) {
  const seen = new Set();
  return list.filter((x) => { const k = keyOf(x); if (seen.has(k)) return false; seen.add(k); return true; });
}
const SMALL = new Set(['of', 'and', 'the', 'at', 'to', 'in', 'on', 'for']);
function titleStreet(s) {
  if (!s) return DASH;
  return String(s).toLowerCase().split(/(\s+)/).map((w, i) => (i > 0 && SMALL.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1))).join('').replace(/\bBr\b/g, 'Bridge').replace(/\bAve\b/g, 'Avenue');
}
function persText(pers, tById, aById) {
  const parts = [];
  for (const h of pers) {
    const short = shortName(h.name);
    if (h.kind === 'traffic') {
      if (h.label === 'strengthened') parts.push(`the ${short}'s decline deepened (${fmtPct(h.y2025)} → ${fmtPct(h.y2026)})`);
      else if (h.label === 'reversed') parts.push(`the ${short} flipped (${fmtPct(h.y2025)} → ${fmtPct(h.y2026)})`);
      else if (h.label === 'confirmed') parts.push(`the ${short}'s change held (${fmtPct(h.y2025)} → ${fmtPct(h.y2026)})`);
    } else if (h.label === 'strengthened') parts.push(`${short}'s PM2.5 drop grew (${fmtSigned(h.y2025, 2)} → ${fmtSigned(h.y2026, 2)} µg/m³)`);
    else if (h.label === 'confirmed') parts.push(`${short}'s PM2.5 drop held (${fmtSigned(h.y2025, 2)} → ${fmtSigned(h.y2026, 2)})`);
    else if (h.label === 'reversed') parts.push(`${short}'s PM2.5 change reversed`);
  }
  if (!parts.length) return 'No location has a supported verdict in both years yet.';
  const s = joinNames(parts);
  return `${s.charAt(0).toUpperCase()}${s.slice(1)}.`;
}
