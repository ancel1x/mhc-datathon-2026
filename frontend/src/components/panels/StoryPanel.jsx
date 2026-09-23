import { useEffect, useMemo, useRef } from 'react';
import { buildStory, EXPLORE_CARD } from '../../content/story.js';
import { CHAPTERS, EXPLORE_STEP } from '../../content/chapters.js';
import { useData } from '../../lib/data.jsx';
import { useAppState, useDispatch } from '../../state/AppState.jsx';
import { isNum } from '../../lib/format.js';
import { StatRow } from '../charts/StatTile.jsx';
import IntervalBars from '../charts/IntervalBar.jsx';
import TollTable from './TollTable.jsx';
import { SourcesList } from './SourcesSheet.jsx';
import Segmented from '../Segmented.jsx';
import CloseButton from '../CloseButton.jsx';
import { Chevron } from './SidePanel.jsx';

const TOKEN = /(`[^`]*`|\*\*[^*]+\*\*)/g;
const TOTAL = CHAPTERS.length;

/** Inline markup: `x` -> tabular number, **x** -> strong. */
export function Rich({ text }) {
  if (!text) return null;
  const parts = String(text).split(TOKEN);
  return parts.map((part, i) => {
    if (part.startsWith('`') && part.endsWith('`')) return <span className="num" key={i}>{part.slice(1, -1)}</span>;
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>;
    return <span key={i}>{part}</span>;
  });
}

function ChoroplethToggle() {
  const { layerVisibility, dacMode } = useAppState();
  const dispatch = useDispatch();
  const mode = layerVisibility.uhf42 ? 'uhf42' : layerVisibility.dac ? (dacMode === 'percentile' ? 'pct' : 'dac') : 'none';
  const set = (v) => {
    if (v === 'uhf42') dispatch({ type: 'TOGGLE_LAYER', layer: 'uhf42', on: true });
    else dispatch({ type: 'SET_DAC_MODE', mode: v === 'pct' ? 'percentile' : 'designated' });
  };
  return (
    <div className="chapter__control">
      <span className="chapter__control-label">Purple layer shows</span>
      <Segmented tone="purple" label="Purple layer" value={mode} onChange={set} options={[{ value: 'dac', label: 'Designated areas' }, { value: 'pct', label: 'Burden score' }, { value: 'uhf42', label: 'Asthma visits' }]} />
    </div>
  );
}

const toneClass = (tone) => (isNum(tone) && tone !== 0 ? (tone > 0 ? 'tone-worse' : 'tone-better') : '');
const hasDetails = (d) => Boolean(d && (d.paragraphs?.length || d.bullets?.length || d.list?.rows?.length || d.table?.rows?.length || d.intervals?.rows?.length || d.extra));

/** Compact list: label · value · sub. Rows may carry `tone` (number) or `cls` (result class) for the value color. */
function KList({ list, main = false }) {
  if (!list?.rows?.length) return null;
  return (
    <>
      {list.title ? <div className={main ? 'chapter__section-title chapter__section-title--main' : 'chapter__section-title'}>{list.title}</div> : null}
      <ul className={main ? 'klist klist--main' : 'klist'}>
        {list.rows.map((r, i) => (
          <li key={i}>
            <span>{r.label}</span>
            <span className={`num ${r.cls ? `cls-${r.cls}` : toneClass(r.tone)}`}>{r.value}</span>
            <span className="num sub">{r.sub}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

/** Compact table. Cells are strings or { text, cls } objects; rows may carry `cls` for the whole row. */
function Table({ table, main = false }) {
  if (!table?.rows?.length) return null;
  const foot = table.foot ?? table.note;
  const titleClass = main
    ? 'chapter__section-title chapter__section-title--main'
    : table.className
      ? 'chapter__section-title chapter__section-title--units'
      : 'chapter__section-title';
  const tableClass = [main ? 'tbl--main' : '', table.className ?? ''].filter(Boolean).join(' ');
  return (
    <>
      {table.title ? <div className={titleClass}>{table.title}</div> : null}
      <table className={`tbl${tableClass ? ` ${tableClass}` : ''}`}>
        <thead><tr>{table.head.map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
        <tbody>
          {table.rows.map((r, i) => (
            <tr key={i} className={r.cls ? `cls-${r.cls}` : undefined}>
              {r.cells.map((cell, j) => {
                const obj = cell && typeof cell === 'object';
                return <td key={j} className={obj ? [cell.cls ? `cls-${cell.cls}` : '', cell.strong ? 'cell--strong' : ''].filter(Boolean).join(' ') || undefined : undefined}>{obj ? cell.text : cell}</td>;
              })}
            </tr>
          ))}
        </tbody>
        {foot ? <tfoot><tr><td colSpan={table.head.length}>{foot}</td></tr></tfoot> : null}
      </table>
    </>
  );
}

/** Everything that is not the headline, behind a collapsed "Details" disclosure. */
function Details({ d, tolls, sources }) {
  return (
    <details className="disclosure">
      <summary className="text-btn disclosure__summary">Details <Chevron /></summary>
      <div className="disclosure__body">
        {(d.paragraphs ?? []).map((p, i) => <p key={i} className="chapter__body"><Rich text={p} /></p>)}
        {d.bullets?.length ? <ul className="chapter__bullets">{d.bullets.map((b, i) => <li key={i}><Rich text={b} /></li>)}</ul> : null}
        {d.extra === 'choropleth' ? <ChoroplethToggle /> : null}
        <KList list={d.list} />
        <Table table={d.table} />
        {d.intervals?.rows?.length ? (
          <>
            <div className="chapter__section-title">{d.intervals.title}</div>
            <IntervalBars rows={d.intervals.rows} unit={d.intervals.unit ?? '%'} digits={d.intervals.digits ?? 1} />
            {d.intervals.foot ? <p className="detail__hint">{d.intervals.foot}</p> : null}
          </>
        ) : null}
        {d.extra === 'tolls' ? <TollTable tolls={tolls} /> : null}
        {d.extra === 'sources' ? (
          <>
            <div className="chapter__section-title">Sources</div>
            <SourcesList sources={sources} />
          </>
        ) : null}
      </div>
    </details>
  );
}

/**
 * Step template: optional badge, title, lede, body, bullets, three stat rows, at most one compact table or list,
 * then Details. (The date lives in the footer.)
 */
function ChapterView({ c, step, tolls, sources, onRestart }) {
  const isExplore = step >= TOTAL;
  return (
    <article className="chapter" aria-labelledby="chapter-title">
      {c.badge ? <span className={c.badgeTone === 'warn' ? 'chapter__badge chapter__badge--warn' : 'chapter__badge'}>{c.badge}</span> : null}
      <h2 className="chapter__title" id="chapter-title">{c.title}</h2>
      {c.lede ? <p className="chapter__lede"><Rich text={c.lede} /></p> : null}
      {c.body ? <p className="chapter__body"><Rich text={c.body} /></p> : null}
      {c.bullets?.length ? <ul className="chapter__bullets">{c.bullets.map((b, i) => <li key={i}><Rich text={b} /></li>)}</ul> : null}
      {c.notice ? <p className="chapter__notice"><Rich text={c.notice} /></p> : null}
      {c.stats?.length ? <StatRow items={c.stats.slice(0, 3)} /> : null}
      <Table table={c.table} main />
      <KList list={c.list} main />
      {hasDetails(c.details) ? <Details d={c.details} tolls={tolls} sources={sources} /> : null}
      {isExplore ? <button type="button" className="btn btn--fill" onClick={onRestart}>Start the story again</button> : null}
    </article>
  );
}

function SourcesView({ sources, onClose }) {
  return (
    <div className="chapter">
      <div className="chapter__row">
        <h2 className="chapter__title">Sources</h2>
        <CloseButton label="Close sources" onClick={onClose} />
      </div>
      <SourcesList sources={sources} />
    </div>
  );
}

/**
 * Paged story panel: one step at a time. The footer shows when this step happens plus Back / Next;
 * the Timeline bar under the map shows where it sits in the sequence. Arrow keys also page.
 */
export default function StoryPanel() {
  const { summary, tolls, sources, geo, indexes, isMock } = useData();
  const { activeChapter, exploreMode, sourcesOpen, autoplay } = useAppState();
  const dispatch = useDispatch();
  const bodyRef = useRef(null);

  const story = useMemo(() => {
    try {
      return buildStory({ summary, tolls, sources, geo, indexes });
    } catch (err) {
      console.error('story build failed', err);
      return CHAPTERS.map((c) => ({ title: c.title, kicker: c.when }));
    }
  }, [summary, tolls, sources, geo, indexes]);

  const step = exploreMode ? TOTAL : activeChapter;
  const current = exploreMode ? EXPLORE_CARD : story[activeChapter] ?? {};
  const when = exploreMode ? EXPLORE_STEP.when : CHAPTERS[activeChapter]?.when ?? '';

  useEffect(() => {
    if (autoplay.on) return undefined; // during the tour the arrow keys skip between callouts (GuidePlayer)
    const onKey = (e) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target;
      const tag = t?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'CANVAS' || t?.isContentEditable) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); dispatch({ type: 'NEXT_STEP' }); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); dispatch({ type: 'PREV_STEP' }); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dispatch, autoplay.on]);

  useEffect(() => {
    bodyRef.current?.scrollTo?.({ top: 0 });
  }, [step, sourcesOpen]);

  return (
    <section className="story panel" aria-label="Story">
      <header className="story__head">
        <h1 className="panel__title">
          The real story of congestion pricing
          {isMock ? <span className="badge" title="summary.json carries _mock: true">demo data</span> : null}
        </h1>
        <div className="story__meta">
          <div className="panel__sub">NYC since the $9 toll · official data</div>
          <div className="story__actions">
            <button type="button" className="story__action" aria-pressed={sourcesOpen} onClick={() => dispatch({ type: 'TOGGLE_SOURCES' })}>Sources</button>
          </div>
        </div>
      </header>
      <div className="story__body" ref={bodyRef}>
        <div className="sr-only" aria-live="polite" aria-atomic="true">{exploreMode ? 'Explore the map' : `Step ${step + 1} of ${TOTAL + 1}, ${when}: ${current.title ?? ''}`}</div>
        {sourcesOpen ? (
          <SourcesView sources={sources} onClose={() => dispatch({ type: 'TOGGLE_SOURCES', open: false })} />
        ) : (
          <ChapterView key={step} c={current} step={step} tolls={tolls} sources={sources} onRestart={() => dispatch({ type: 'RESTART' })} />
        )}
      </div>
      <footer className="story__foot">
        <button type="button" className="text-btn" disabled={step === 0} onClick={() => dispatch({ type: 'PREV_STEP' })}><Chevron dir="left" /> Back</button>
        <span className="story__kicker" aria-live="polite">{when}</span>
        <button type="button" className="text-btn" disabled={exploreMode} onClick={() => dispatch({ type: 'NEXT_STEP' })}>{step === TOTAL - 1 ? 'Explore' : 'Next'} <Chevron dir="right" /></button>
      </footer>
    </section>
  );
}
