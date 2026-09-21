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

  if (!coords) {
    return (
      <div key={key} className="callout callout--screen panel" role="status" aria-live="polite" onClick={swallow} onMouseDown={swallow}>
        <p>{b.text}</p>
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
        <div className="callout panel" data-side={side} role="status" aria-live="polite" onMouseDown={swallow} onTouchStart={swallow}>
          <p>{b.text}</p>
          {foot}
          {bar}
        </div>
      </Marker>
    </>
  );
}

export default memo(GuideCallouts);
