import { useAppState } from '../../state/AppState.jsx';
import { useData } from '../../lib/data.jsx';
import { CHANGE_KEY, CLASS_COLORS, PURPLE_STEPS } from '../../lib/scales.js';
import { PERIOD_LABELS } from '../../lib/metrics.js';
import { fmtHour, fmtInt } from '../../lib/format.js';
import { LayerSymbol } from '../Swatch.jsx';

function Steps({ colors, from, to }) {
  return (
    <div className="key__steps">
      <span className="key__end">{from}</span>
      <span className="key__swatches">{colors.map((c, i) => <i key={i} style={{ background: c }} />)}</span>
      <span className="key__end key__end--right">{to}</span>
    </div>
  );
}

const CLASS_TEXT = { decrease: 'supported decrease: cleaner than 2024', uncertain: 'uncertain: no clear change (range of doubt includes zero)', increase: 'supported increase: dirtier than 2024' };

/**
 * "Key" section of the control panel: what the colors, sizes and moving lines mean, only for the layers
 * currently visible. One meaning system: green = less traffic / cleaner air, red = more / dirtier; purple = equity.
 * Rings mean "not supported": a crossing whose 95% interval includes zero (or is coverage-limited), a monitor
 * without an eligible baseline.
 */
export default function KeyLegend({ hasFeatured = false }) {
  const { layerVisibility: v, period, metric, hour, dacMode, glyphMode } = useAppState();
  const { indexes, geo } = useData();
  const asthmaPeriod = geo?.uhf42?.features?.[0]?.properties?.health_period ?? null;
  const traffic = v.crz_entry || v.bt_facility || v.dot_segment;
  const points = traffic || v.aq_monitor;
  const isChange = metric === 'change' && period !== 'pre_2024';
  const purplePct = v.dac && dacMode === 'percentile';
  const [lo, hi] = indexes?.asthmaRange ?? [0, 1];
  const when = `${PERIOD_LABELS[period] ?? period}${hour != null ? ` · ${fmtHour(hour)}` : ''}`;
  const frame = period === 'post_2026_ytd' ? 'Jan–Aug 2026 with Jan–Aug 2024' : 'Jan 5–Dec 31, 2025 with the same window of 2024';
  const compareNote = [
    v.bt_facility || v.aq_monitor ? `${v.bt_facility ? 'Crossings' : ''}${v.bt_facility && v.aq_monitor ? ' and ' : ''}${v.aq_monitor ? 'monitors' : ''} compare ${frame}.` : null,
    v.crz_entry ? (period === 'post_2026_ytd' ? 'Entry points compare Jan–Aug 2026 with Jan–Aug 2025; nobody counted them before the toll.' : 'Entry points were first counted the day the toll began, so 2025 has nothing earlier to compare with: they stay grey.') : null,
    v.dot_segment ? 'Street counters compare one sampled week before the toll with one after; filled squares only.' : null,
  ].filter(Boolean).join(' ');

  if (!points && !v.dac && !v.uhf42 && !v.flow) return <p className="key__empty">Turn on a layer to see what its colors mean.</p>;

  return (
    <div className="key">
      {points ? (
        <div className="key__block">
          <div className="key__label">Marker type</div>
          <div className="key__classes">
            {v.crz_entry ? <span className="key__class"><LayerSymbol kind="entry" />diamond = zone entry</span> : null}
            {v.bt_facility ? <span className="key__class"><LayerSymbol kind="disc" />disc = bridge or tunnel</span> : null}
            {v.dot_segment ? <span className="key__class"><LayerSymbol kind="square" />square = street counter</span> : null}
            {v.aq_monitor ? <span className="key__class"><LayerSymbol kind="disc" />disc = air monitor</span> : null}
          </div>
          {v.crz_entry || v.bt_facility ? <div className="key__note">Larger zone-entry diamonds and bridge/tunnel discs represent more vehicles.</div> : null}
        </div>
      ) : null}
      {traffic && isChange ? (
        <div className="key__block">
          <div className="key__label">Color = change since the toll · {when}</div>
          <Steps colors={CHANGE_KEY} from="fewer vehicles than 2024" to="more vehicles than 2024" />
          {v.bt_facility ? (
            <div className="key__classes" style={{ marginTop: 8 }}>
              <span className="key__class"><LayerSymbol kind="hollow" />ring = no clear change (the range of doubt includes zero) or too few complete days</span>
            </div>
          ) : null}
          <div className="key__note">{compareNote}</div>
        </div>
      ) : null}
      {points && !isChange ? (
        <div className="key__block">
          <div className="key__label">Amount only · {when}</div>
          <div className="key__note">Bigger symbol{v.flow ? ' or thicker line' : ''} = more vehicles{v.aq_monitor ? ' or higher pollution' : ''}. No colors, because there is nothing to compare yet.</div>
        </div>
      ) : null}
      {v.aq_monitor && isChange ? (
        <div className="key__block">
          <div className="key__label">Air monitors, weather-adjusted PM2.5 · {when}</div>
          <div className="key__classes">
            {['decrease', 'uncertain', 'increase'].map((k) => <span key={k} className="key__class"><LayerSymbol kind="disc" color={CLASS_COLORS[k]} />{CLASS_TEXT[k]}</span>)}
            <span className="key__class"><LayerSymbol kind="hollow" />no eligible baseline: nothing to compare with</span>
          </div>
          {!traffic ? <div className="key__note">{compareNote}</div> : null}
        </div>
      ) : null}
      {v.flow && (v.bt_facility || v.crz_entry) ? (
        <div className="key__note"><LayerSymbol kind="line" size={12} /> Moving lines show which way traffic goes; thicker = more vehicles{isChange && v.bt_facility ? '; grey = change not supported' : ''}.</div>
      ) : null}
      {v.dac && !purplePct ? (
        <div className="key__block">
          <div className="key__classes"><span className="key__class"><LayerSymbol kind="fill" />Disadvantaged community (state-designated)</span></div>
        </div>
      ) : null}
      {purplePct ? (
        <div className="key__block">
          <div className="key__label">Combined burden score · 0–100</div>
          <Steps colors={PURPLE_STEPS} from="0 · lower burden" to="100 · higher burden" />
          <div className="key__note">Higher scores indicate greater combined environmental, health, and socioeconomic burden. The statewide percentile ranks each tract relative to other New York State tracts.</div>
        </div>
      ) : null}
      {v.uhf42 ? (
        <div className="key__block">
          <div className="key__label">Child asthma ER visits per 10,000 children{asthmaPeriod ? ` · ${asthmaPeriod}, newest published` : ''}</div>
          <Steps colors={PURPLE_STEPS} from={fmtInt(lo)} to={fmtInt(hi)} />
          <div className="key__note">Click a neighborhood for its poverty and asthma context.</div>
        </div>
      ) : null}
      {hasFeatured && points ? <div className="key__note">Bright = the ones this step is about; the rest are faded.</div> : null}
      {glyphMode && points ? (
        <div className="key__note">
          <LayerSymbol kind="ring-grey" size={12} /> before the toll (2024{v.crz_entry ? '; Jan–Aug 2025 for entry points' : ''}) &nbsp; <LayerSymbol kind="ring-color" color="var(--blue)" size={12} /> {PERIOD_LABELS[period] ?? period} — each point is a 24-hour clock, midnight at the top.
        </div>
      ) : null}
    </div>
  );
}
