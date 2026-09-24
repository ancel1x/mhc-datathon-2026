import { lazy, Suspense, useEffect, useState } from 'react';
import { useAppState, useDispatch } from '../../state/AppState.jsx';
import { useData } from '../../lib/data.jsx';
import { usePhone } from '../../hooks/useMediaQuery.js';
import { LAYER_HINTS, LAYER_KEYS, LAYER_LABELS, LAYER_SYMBOL } from '../../content/chapters.js';
import { fmtHour } from '../../lib/format.js';
import Segmented from '../Segmented.jsx';
import CloseButton from '../CloseButton.jsx';
import KeyLegend from './KeyLegend.jsx';
import { loadJson } from '../../lib/api.js';

const DetailContent = lazy(() => import('./DetailPanel.jsx'));
const SERIES_FILE = { aq_monitor: 'aq_series', bt_facility: 'bt_series', crz_entry: 'crz_series', dot_segment: 'dot_matched' };

function FeatureDetail(props) {
  // Start the series request alongside the chart chunk, rather than after it has loaded.
  useEffect(() => {
    const file = SERIES_FILE[props.layer];
    if (file) loadJson(file).catch(() => {}); // DetailContent displays a request failure.
  }, [props.layer]);
  return <Suspense fallback={<p className="detail__hint" role="status">Loading detail…</p>}><DetailContent {...props} /></Suspense>;
}

const PERIOD_OPTIONS = [
  { value: 'pre_2024', label: '2024 · before' },
  { value: 'post_2025', label: '2025' },
  { value: 'post_2026_ytd', label: '2026 so far' },
];

export function Chevron({ dir = 'down' }) {
  const d = { up: 'M2 8.5L6 4.5l4 4', down: 'M2 4.5l4 4 4-4', left: 'M7.5 2L3.5 6l4 4', right: 'M4.5 2l4 4-4 4' }[dir];
  return <svg className="chev" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;
}

function ThemeToggle() {
  const { theme } = useAppState();
  const dispatch = useDispatch();
  const next = theme === 'dark' ? 'light' : 'dark';
  return (
    <button type="button" className="icon-btn" aria-label={`Switch to ${next} theme`} title={`Switch to ${next} theme`} onClick={() => dispatch({ type: 'TOGGLE_THEME' })}>
      {theme === 'dark' ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" /></svg>
      )}
    </button>
  );
}

function Section({ title, children }) {
  return (
    <section className="side__section">
      <h3 className="side__section-title">{title}</h3>
      {children}
    </section>
  );
}

function Switch({ on, accent = 'blue' }) {
  return <span className="switch" data-on={on ? 'true' : 'false'} data-accent={accent} aria-hidden="true"><i /></span>;
}

/** Layer row: label + hint on the panel's text line, then a small switch. */
function LayerRow({ label, hint, on, onClick, sub = false, accent = 'blue' }) {
  return (
    <li>
      <button type="button" className={sub ? 'row row--sub' : 'row'} role="switch" aria-checked={on} onClick={onClick}>
        <span className="row__text">
          <span className="row__label">{label}</span>
          <span className="row__hint">{hint}</span>
        </span>
        <Switch on={on} accent={accent} />
      </button>
    </li>
  );
}

/**
 * Layers and Key; in Explore mode also "Year shown" (during the story the timeline sets the year).
 * "Color by" and "Hour of day" live under Advanced. Every control is always live.
 */
function ControlsContent({ onCollapse, onClose, hasFeatured }) {
  const { period, metric, hour, layerVisibility, dotAll, dacMode, exploreMode } = useAppState();
  const dispatch = useDispatch();
  const [view, setView] = useState('layers');
  return (
    <>
      <header className="side__head">
        <div>
          <h2 className="panel__title">Map controls</h2>
          <div className="panel__sub">{exploreMode ? 'Year · layers · key' : 'Layers · key'}</div>
        </div>
        <div className="side__actions">
          <ThemeToggle />
          {onCollapse ? <button type="button" className="icon-btn" aria-label="Collapse controls" title="Collapse" onClick={onCollapse}><Chevron dir="up" /></button> : null}
          {onClose ? <CloseButton label="Close controls" onClick={onClose} /> : null}
        </div>
      </header>

      <div className="side__body">
      {exploreMode ? (
        <Section title="Year shown">
          <Segmented label="Year shown" options={PERIOD_OPTIONS} value={period} onChange={(p) => dispatch({ type: 'SET_PERIOD', period: p })} />
          <p className="side__hint">{period === 'pre_2024' ? 'The year before the toll: symbols are sized by amount, with nothing to compare yet.' : 'Colors compare this year with 2024, the year before the toll.'}</p>
        </Section>
      ) : null}

      <Segmented
        label="Panel view"
        value={view}
        options={[{ value: 'layers', label: 'Layers' }, { value: 'key', label: 'Key' }]}
        onChange={setView}
      />

      {view === 'layers' ? <Section title="Layers">
        <ul className="rows">
          {LAYER_KEYS.flatMap((k) => {
            const on = Boolean(layerVisibility[k]);
            const accent = k === 'dac' || k === 'uhf42' ? 'purple' : 'blue';
            const rows = [<LayerRow key={k} kind={LAYER_SYMBOL[k].kind} label={LAYER_LABELS[k]} hint={LAYER_HINTS[k]} on={on} accent={accent} onClick={() => dispatch({ type: 'TOGGLE_LAYER', layer: k })} />];
            // sub-options only appear while their parent layer is on, to keep the list short
            if (k === 'dot_segment' && on) rows.push(<LayerRow key="dot-all" sub label="All DOT sites" hint="Also spots counted only once" on={dotAll} onClick={() => dispatch({ type: 'TOGGLE_DOT_ALL' })} />);
            if (k === 'dac' && on) rows.push(<LayerRow key="dac-pct" sub accent="purple" label="Shade by burden score" hint="0 = lower burden · 100 = higher burden" on={dacMode === 'percentile'} onClick={() => dispatch({ type: 'SET_DAC_MODE', mode: dacMode === 'percentile' ? 'designated' : 'percentile' })} />);
            return rows;
          })}
        </ul>
      </Section> : <Section title="Key">
        <KeyLegend hasFeatured={hasFeatured} />
      </Section>}
      </div>

      <footer className="side__foot">
      <details className="disclosure disclosure--adv">
        <summary className="text-btn disclosure__summary">Advanced <Chevron /></summary>
        <div className="disclosure__body">
          <Section title="Color by">
            <Segmented
              label="Color by"
              value={metric}
              options={[
                { value: 'change', label: 'Change since 2024', title: period === 'pre_2024' ? 'Switches the year to 2025' : undefined },
                { value: 'absolute', label: 'Amount only' },
              ]}
              onChange={(m) => dispatch({ type: 'SET_METRIC', metric: m })}
            />
            <p className="side__hint">{metric === 'change' ? 'Green = less traffic or cleaner air than 2024, red = more or dirtier.' : 'No colors; symbol size and line thickness show how much.'}</p>
          </Section>
          <Section title="Hour of day">
            <div className="hour">
              <input id="hour-slider" className="slider" type="range" min={0} max={23} step={1} value={hour ?? 0} aria-label="Hour of day" aria-valuetext={fmtHour(hour)} onChange={(e) => dispatch({ type: 'SET_HOUR', hour: Number(e.target.value) })} />
              <span className="hour__val num">{fmtHour(hour)}</span>
              <button type="button" className="chip" aria-pressed={hour == null} onClick={() => dispatch({ type: 'SET_HOUR', hour: null })}>All</button>
            </div>
          </Section>
        </div>
      </details>
      </footer>
    </>
  );
}

/**
 * The right-hand panel. Shows the controls, or — when a feature is selected — that feature's detail in the
 * same box. Desktop: collapses to a 32 px "Controls" button. Phone: a button that opens a sheet from the right.
 */
export default function SidePanel({ hasFeatured }) {
  const { controlsCollapsed, controlsOpen, selectedFeature } = useAppState();
  const { indexes } = useData();
  const dispatch = useDispatch();
  const isPhone = usePhone();
  const live = selectedFeature ? indexes?.byId?.[selectedFeature.layer]?.get(selectedFeature.id) ?? null : null;
  const closeDetail = () => dispatch({ type: 'SELECT_FEATURE', feature: null });

  if (isPhone) {
    const open = controlsOpen || Boolean(live);
    if (!open) {
      return <button type="button" className="side-btn panel" aria-expanded="false" onClick={() => dispatch({ type: 'TOGGLE_CONTROLS', open: true })}>Map controls <Chevron /></button>;
    }
    return (
      <aside className="side panel side--sheet" aria-label={live ? 'Feature detail' : 'Map controls'}>
        {live ? <FeatureDetail layer={selectedFeature.layer} feature={live} onClose={closeDetail} /> : <ControlsContent onClose={() => dispatch({ type: 'TOGGLE_CONTROLS', open: false })} hasFeatured={hasFeatured} />}
      </aside>
    );
  }

  // The panel stays mounted while collapsed so it can slide out of view; the pill fades in beside it.
  const collapsed = controlsCollapsed && !live;
  return (
    <>
      <aside className="side panel" data-collapsed={collapsed ? 'true' : 'false'} aria-hidden={collapsed} aria-label={live ? 'Feature detail' : 'Map controls'}>
        {live ? <FeatureDetail layer={selectedFeature.layer} feature={live} onClose={closeDetail} /> : <ControlsContent onCollapse={() => dispatch({ type: 'TOGGLE_COLLAPSE', collapsed: true })} hasFeatured={hasFeatured} />}
      </aside>
      {collapsed ? (
        <button type="button" className="side-btn panel" aria-expanded="false" onClick={() => dispatch({ type: 'TOGGLE_COLLAPSE', collapsed: false })}>Map controls <Chevron /></button>
      ) : null}
    </>
  );
}
