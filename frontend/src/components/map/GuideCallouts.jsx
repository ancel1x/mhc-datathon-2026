import { memo } from 'react';
import { Marker } from 'react-map-gl/maplibre';
import { useAppState, useDispatch } from '../../state/AppState.jsx';
import { useData } from '../../lib/data.jsx';
import { Chevron } from '../panels/SidePanel.jsx';

const ANCHOR = { right: 'left', left: 'right', top: 'bottom', bottom: 'top' };
const OFFSET = { right: [16, 0], left: [-16, 0], top: [0, -16], bottom: [0, 16] };

function resolve(at, indexes) {
  if (!at) return null;
  if (Array.isArray(at)) return at;
  const f = indexes?.byId?.[at.layer]?.get(at.id);
  const c = f?.geometry?.coordinates;
  return Array.isArray(c) && c.length >= 2 ? c : null;
}

function BeatContent({ beat, chapter }) {
  const total = beat.recordBar ? beat.recordBar.usable + beat.recordBar.unavailable : 0;
  const comparisonMax = Math.max(...(beat.comparison ?? []).map((item) => item.amount), 1);
  return (
    <>
      <div className="comic-card__chapter">{['CHAPTER 1 · BEFORE THE TOLL', 'CHAPTER 2 · THE HEADLINE', 'CHAPTER 3 · WHERE DID THE TRAFFIC GO?', 'CHAPTER 4 · FOLLOW THE AIR', 'CHAPTER 5 · WHO BEARS THE BURDEN?', 'CHAPTER 6 · ASTHMA ALLEY', 'CHAPTER 7 · ONE YEAR LATER', 'CHAPTER 8 · WHAT COULD NYC BECOME?'][chapter]}</div>
      {beat.statusBadge ? <div className="comic-status-badge">{beat.statusBadge}</div> : null}
      {beat.question ? <div className="comic-question"><span>{beat.question}</span></div> : null}
      {beat.captions?.length ? (
        <div className="comic-captions">
          {beat.captions.map((caption) => <div key={caption} className="comic-caption">{caption}</div>)}
        </div>
      ) : null}
      {beat.text ? <p className="comic-card__narration">{beat.text}</p> : null}
      {beat.mapCallout ? (
        <div className="comic-map-callout">
          <strong>{beat.mapCallout[0]}</strong>
          <span>{beat.mapCallout[1]}</span>
        </div>
      ) : null}
      {beat.heroValue ? (
        <div className="comic-hero-wrap">
          <div className="comic-hero"><strong className="num">{beat.heroValue}</strong>{beat.heroLabelOutside ? null : <span>{beat.heroLabel}</span>}</div>
          {beat.heroLabelOutside ? <div className="comic-hero-label">{beat.heroLabel}</div> : null}
          {beat.support ? <div className="comic-hero__support">{beat.support}</div> : null}
          {beat.supportTile ? <div className="comic-mini-tile">{beat.supportTile}</div> : null}
          {beat.secondaryLabel ? <div className="comic-secondary-label">{beat.secondaryLabel}</div> : null}
          {beat.qualifier ? <div className="comic-qualifier">{beat.qualifier}</div> : null}
        </div>
      ) : null}
      {beat.tollEvidence ? (
        <div className="comic-toll-evidence">
          <strong>{beat.tollEvidence.title}</strong>
          <div><span className="num">{beat.tollEvidence.daytime}</span><span className="num">{beat.tollEvidence.overnight}</span></div>
        </div>
      ) : null}
      {beat.comparison?.length ? (
        <div className="comic-comparison">
          {beat.comparison.map((item) => (
            <div className="comic-comparison__row" key={item.title}>
              <span>{item.title}</span><i><b style={{ width: `${(item.amount / comparisonMax) * 100}%` }} /></i><strong className="num">{item.value}</strong>
            </div>
          ))}
        </div>
      ) : null}
      {beat.panels?.length ? (
        <div className="comic-split">
          {beat.panels.map((panel) => (
            <div key={panel.title} className="comic-split__panel">
              <strong>{panel.title}</strong>
              <span>{panel.body}</span>
            </div>
          ))}
        </div>
      ) : null}
      {beat.panels && beat.support ? <div className="comic-support">{beat.support}</div> : null}
      {beat.definition ? <div className="comic-definition">{beat.definition}</div> : null}
      {beat.legend?.length ? (
        <ul className="comic-legend">
          {beat.legend.map((item) => <li key={item}>{item}</li>)}
        </ul>
      ) : null}
      {beat.stats?.length ? (
        <div className="comic-stats">
          {beat.stats.map((stat) => <div key={stat} className="comic-stat num">{stat}</div>)}
        </div>
      ) : null}
      {beat.recordBar ? (
        <div className="comic-records" aria-label={`${beat.recordBar.usable} usable 2024 records and ${beat.recordBar.unavailable} unavailable or insufficient 2024 baseline records`}>
          <div className="comic-records__bar" aria-hidden="true">
            <span className="comic-records__usable" style={{ width: `${(beat.recordBar.usable / total) * 100}%` }} />
            <span className="comic-records__missing" style={{ width: `${(beat.recordBar.unavailable / total) * 100}%` }} />
          </div>
          <div className="comic-records__labels">
            <span><i className="comic-records__key comic-records__key--usable" />Usable 2024 records: 13</span>
            <span><i className="comic-records__key comic-records__key--missing" />Unavailable / insufficient 2024 baseline: 3</span>
          </div>
        </div>
      ) : null}
      {beat.statTile ? <div className="comic-baseline-tile num">{beat.statTile}</div> : null}
      {beat.monitorCard ? (
        <div className="comic-monitor-card" data-tone={beat.monitorCard.tone}>
          <strong>{beat.monitorCard.name}</strong>
          <div className="comic-monitor-values">
            <span><small>2024</small><b className="num">{beat.monitorCard.before} µg/m³</b></span>
            <i aria-hidden="true">→</i>
            <span><small>2025</small><b className="num">{beat.monitorCard.after} µg/m³</b></span>
          </div>
          <div className="comic-monitor-change"><span>Change</span><strong className="num">{beat.monitorCard.change}</strong></div>
          {beat.monitorCard.verdict ? <small>{beat.monitorCard.verdict}</small> : null}
        </div>
      ) : null}
      {beat.explanation ? <div className="comic-explanation">{beat.explanation}</div> : null}
      {beat.supportLine ? <div className="comic-support-line">{beat.supportLine}</div> : null}
      {beat.evidenceLine ? <div className="comic-evidence-line num">{beat.evidenceLine}</div> : null}
      {beat.teaser ? <div className="comic-route-teaser">{beat.teaser}</div> : null}
      {beat.miniLegend?.length ? <div className="comic-mini-legend">{beat.miniLegend.map((item) => <span key={item.label} data-tone={item.tone}><i />{item.label}</span>)}</div> : null}
      {beat.routeStat ? (
        <div className="comic-route-stat" data-tone={beat.routeStat.tone}>
          <strong className="num">{beat.routeStat.value}</strong><span>{beat.routeStat.label}</span>
        </div>
      ) : null}
      {beat.localExamples?.length ? (
        <div className="comic-local-examples">
          {beat.localExamples.map((item) => <div key={item.label}><span>{item.label}</span><strong className="num">{item.value}</strong></div>)}
        </div>
      ) : null}
      {beat.airSummary?.length ? (
        <div className="comic-air-summary">
          {beat.airSummary.map((item) => <div key={item.label} data-tone={item.tone}><strong className="num">{item.value}</strong><span>{item.label}</span></div>)}
        </div>
      ) : null}
      {beat.burdenLegend ? (
        <div className="comic-burden-legend">
          <strong>{beat.burdenLegend.value}</strong>
          <span>{beat.burdenLegend.label}</span>
          {beat.burdenLegend.note ? <small>{beat.burdenLegend.note}</small> : null}
        </div>
      ) : null}
      {beat.combinedEvidence?.length ? (
        <div className="comic-combined-evidence">
          {beat.combinedEvidence.map((item) => (
            <div key={item.label} data-tone={item.tone}>
              <span>{item.label}</span>
              <strong className="num">{item.value}</strong>
            </div>
          ))}
        </div>
      ) : null}
      {beat.trendSeries?.length ? (
        <div className="comic-trends">
          {beat.trendSeries.map((series) => {
            const max = Math.max(...series.values.map((item) => Number(item.amount) || 0), 1);
            return (
              <section key={series.title} className="comic-trend" data-tone={series.tone}>
                <header><strong>{series.title}</strong><b>{series.status}</b></header>
                <div className="comic-trend__values">
                  {series.values.map((item) => (
                    <div key={item.year}><span>{item.year}</span><i><b style={{ width: `${Math.max(8, ((Number(item.amount) || 0) / max) * 100)}%` }} /></i><strong className="num">{item.value}</strong></div>
                  ))}
                </div>
                <small>{series.detail}</small>
              </section>
            );
          })}
        </div>
      ) : null}
      {beat.statusColumns?.length ? (
        <div className="comic-status-columns">
          {beat.statusColumns.map((column) => (
            <section key={column.title} data-tone={column.tone}>
              <strong>{column.title}</strong>
              <ul>{column.items.map((item) => <li key={item}>{item}</li>)}</ul>
            </section>
          ))}
        </div>
      ) : null}
      {beat.scenarioPanels?.length ? (
        <div className="comic-scenario-panels">
          {beat.scenarioPanels.map((panel) => <section key={panel.title}><strong>{panel.title}</strong><span>{panel.body}</span></section>)}
        </div>
      ) : null}
      {beat.opportunityList?.length ? <div className="comic-opportunities">{beat.opportunityList.map((item) => <span key={item}>{item}</span>)}</div> : null}
      {beat.caveatList?.length ? <ul className="comic-caveat-list">{beat.caveatList.map((item) => <li key={item}>{item}</li>)}</ul> : null}
      {beat.note ? <div className="comic-note">{beat.note}</div> : null}
      {beat.closeLine ? <div className="comic-close-line">{beat.closeLine}</div> : null}
      {beat.closingQuestion ? <div className="comic-question"><span>{beat.closingQuestion}</span></div> : null}
      {beat.finalLabel ? <div className="comic-final-label">{beat.finalLabel}</div> : null}
      {beat.transition ? <div className="comic-transition">{beat.transition}</div> : null}
      {beat.footer ? <div className="comic-card__footer">{beat.footer}</div> : null}
    </>
  );
}

/**
 * The tour's callouts: one small card at a time, pinned beside the feature it explains (it follows the map
 * as the camera moves), with a ring on the feature itself. A beat with no place is shown at the top of the map.
 * Each card carries its "2 / 4" counter and a Next button, so the reader can skip ahead instead of waiting
 * for the bar to run out.
 */
function GuideCallouts({ guide }) {
  const { autoplay } = useAppState();
  const { indexes } = useData();
  const dispatch = useDispatch();
  if (!autoplay.on) return null;
  const beats = guide?.[autoplay.step] ?? [];
  const b = beats[autoplay.beat];
  if (!b) return null;
  const key = `${autoplay.step}-${autoplay.beat}`;
  const bar = <span className="callout__progress" aria-hidden="true" style={{ animationDuration: `${b.dwell ?? 6500}ms`, animationPlayState: autoplay.paused ? 'paused' : 'running' }} />;
  const coords = resolve(b.at, indexes);
  const lastOfAll = autoplay.beat >= beats.length - 1 && autoplay.step >= (guide?.length ?? 0) - 1;
  const skip = () => dispatch({ type: 'AUTOPLAY_SKIP', dir: 1, count: beats.length });
  // The card lives inside MapLibre's canvas container, so a click on it would also reach the map's own click
  // handler (which selects the feature under the cursor and ends the tour). Stop it at the marker element.
  const swallow = (e) => { const ev = e?.originalEvent ?? e?.nativeEvent ?? e; ev?.stopPropagation?.(); };
  const foot = (
    <div className="callout__foot">
      <span className="callout__count num">{autoplay.beat + 1} / {beats.length}</span>
      <button type="button" className="callout__skip" onClick={(e) => { swallow(e); skip(); }} onMouseDown={swallow} onTouchStart={swallow} aria-label={lastOfAll ? 'Finish the tour and explore' : 'Skip to the next callout'}>
        {lastOfAll ? 'Explore' : 'Next'} <Chevron dir="right" />
      </button>
    </div>
  );
  const variant = b.variant ? ` callout--${b.variant}` : '';
  const content = <BeatContent beat={b} chapter={autoplay.step} />;

  if (!coords) {
    return (
      <div key={key} className={`callout callout--screen comic-card${variant}`} data-placement={b.placement ?? 'center'} data-size={b.size} data-tone={b.tone} role="status" aria-live="polite" onClick={swallow} onMouseDown={swallow}>
        {content}
        {foot}
        {bar}
      </div>
    );
  }
  const side = b.side ?? 'right';
  return (
    <>
      <Marker key={`${key}-dot`} longitude={coords[0]} latitude={coords[1]} anchor="center" style={{ zIndex: 7 }}>
        <span className="callout__ring" aria-hidden="true" />
      </Marker>
      <Marker key={`${key}-card`} longitude={coords[0]} latitude={coords[1]} anchor={ANCHOR[side]} offset={OFFSET[side]} style={{ zIndex: 8 }} onClick={swallow}>
        <div className={`callout comic-card${variant}`} data-side={side} data-size={b.size} data-tone={b.tone} role="status" aria-live="polite" onMouseDown={swallow} onTouchStart={swallow}>
          {content}
          {foot}
          {bar}
        </div>
      </Marker>
    </>
  );
}

export default memo(GuideCallouts);
