import { Marker } from 'react-map-gl/maplibre';
import { useAppState } from '../../state/AppState.jsx';
import { useData } from '../../lib/data.jsx';

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
 */
export default function GuideCallouts({ guide }) {
  const { autoplay } = useAppState();
  const { indexes } = useData();
  if (!autoplay.on) return null;
  const beats = guide?.[autoplay.step] ?? [];
  const b = beats[autoplay.beat];
  if (!b) return null;
  const key = `${autoplay.step}-${autoplay.beat}`;
  const bar = <span className="callout__progress" aria-hidden="true" style={{ animationDuration: `${b.dwell ?? 6500}ms`, animationPlayState: autoplay.paused ? 'paused' : 'running' }} />;
  const coords = resolve(b.at, indexes);
  const counter = `${autoplay.beat + 1} / ${beats.length}`;

  if (!coords) {
    return (
      <div key={key} className="callout callout--screen panel" role="status" aria-live="polite">
        <p>{b.text}</p>
        <span className="callout__count num">{counter}</span>
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
      <Marker key={`${key}-card`} longitude={coords[0]} latitude={coords[1]} anchor={ANCHOR[side]} offset={OFFSET[side]} style={{ zIndex: 8 }}>
        <div className="callout panel" data-side={side} role="status" aria-live="polite">
          <p>{b.text}</p>
          <span className="callout__count num">{counter}</span>
          {bar}
        </div>
      </Marker>
    </>
  );
}
