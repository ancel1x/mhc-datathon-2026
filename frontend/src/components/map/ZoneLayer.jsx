import { Layer, Source } from 'react-map-gl/maplibre';
import { useData } from '../../lib/data.jsx';
import { useAppState } from '../../state/AppState.jsx';
import { themeColors } from '../../lib/scales.js';

/** Congestion Relief Zone: a 1.25 px outline at 70 % (white on dark, ink on light). No fill, no glow. */
export default function ZoneLayer() {
  const { geo } = useData();
  const { layerVisibility, theme } = useAppState();
  const on = layerVisibility.zone !== false;
  const { zone } = themeColors(theme);
  return (
    <Source id="crz-zone" type="geojson" data={geo.crz_zone}>
      <Layer id="zone-line" type="line" beforeId="anchor-points" layout={{ 'line-cap': 'round', 'line-join': 'round' }} paint={{ 'line-color': zone, 'line-width': 1.25, 'line-opacity': on ? 1 : 0, 'line-opacity-transition': { duration: 150 } }} />
    </Source>
  );
}
