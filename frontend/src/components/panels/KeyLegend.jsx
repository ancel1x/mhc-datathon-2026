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

const CLASS_TEXT = { improved: 'cleaner than the citywide trend', unchanged: 'followed the trend', worsened: 'dirtier than the trend' };

/**
 * "Key" section of the control panel: what the colors, sizes and moving lines mean, only for the layers
 * currently visible. One meaning system: green = less traffic / cleaner air, red = more / dirtier; purple = equity.
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
  const compareNote = [
    v.bt_facility || v.aq_monitor ? `${v.bt_facility ? 'Crossings' : ''}${v.bt_facility && v.aq_monitor ? ' and ' : ''}${v.aq_monitor ? 'monitors' : ''} compare ${period === 'post_2026_ytd' ? 'Jan–Aug 2026' : '2025'} with ${period === 'post_2026_ytd' ? 'Jan–Aug 2024' : '2024'}.` : null,
    v.crz_entry ? (period === 'post_2026_ytd' ? 'Entry points compare Jan–Aug 2026 with Jan–Aug 2025; nobody counted them before the toll.' : 'Entry points were first counted the day the toll began, so 2025 has nothing earlier to compare with: they stay grey.') : null,
    v.dot_segment ? 'Street counters compare the last count before the toll with the first after.' : null,
  ].filter(Boolean).join(' ');

  if (!points && !v.dac && !v.uhf42 && !v.flow) return <p className="key__empty">Turn on a layer to see what its colors mean.</p>;

  return (
    <div className="key">
      {traffic && isChange ? (
        <div className="key__block">
          <div className="key__label">Color = change since the toll · {when}</div>
          <Steps colors={CHANGE_KEY} from="less traffic" to="more traffic" />
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
          <div className="key__label">Air monitors · {when}</div>
          <div className="key__classes">
            {['improved', 'unchanged', 'worsened'].map((k) => <span key={k} className="key__class"><LayerSymbol kind="disc" color={CLASS_COLORS[k]} />{CLASS_TEXT[k]}</span>)}
            <span className="key__class"><LayerSymbol kind="hollow" />not enough data</span>
          </div>
          {!traffic ? <div className="key__note">{compareNote}</div> : null}
        </div>
      ) : null}
      {v.flow && (v.bt_facility || v.crz_entry) ? (
        <div className="key__note"><LayerSymbol kind="line" size={12} /> Moving lines show which way traffic goes; thicker = more vehicles.</div>
      ) : null}
      {v.dac && !purplePct ? (
        <div className="key__block">
          <div className="key__classes"><span className="key__class"><LayerSymbol kind="fill" />Disadvantaged community (state-designated)</span></div>
        </div>
      ) : null}
      {purplePct ? (
        <div className="key__block">
          <div className="key__label">Combined burden score (pollution, poverty, health)</div>
          <Steps colors={PURPLE_STEPS} from="lowest" to="highest" />
        </div>
      ) : null}
      {v.uhf42 ? (
        <div className="key__block">
          <div className="key__label">Child asthma ER visits per 10,000 children{asthmaPeriod ? ` · ${asthmaPeriod}, newest published` : ''}</div>
          <Steps colors={PURPLE_STEPS} from={fmtInt(lo)} to={fmtInt(hi)} />
        </div>
      ) : null}
      {hasFeatured && points ? <div className="key__note">Bright = the ones this step is about; the rest are faded.</div> : null}
      {glyphMode && points ? (
        <div className="key__note">
          <LayerSymbol kind="ring-grey" size={12} /> before the toll (2024{v.crz_entry ? '; Jan–Aug 2025 for entry points' : ''}) &nbsp; <LayerSymbol kind="ring-color" color="var(--text)" size={12} /> {PERIOD_LABELS[period] ?? period} — each point is a 24-hour clock, midnight at the top.
        </div>
      ) : null}
    </div>
  );
}
