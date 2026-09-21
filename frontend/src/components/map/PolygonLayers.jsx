import { memo } from 'react';
import { Layer, Source } from 'react-map-gl/maplibre';
import { useData } from '../../lib/data.jsx';
import { useAppState } from '../../state/AppState.jsx';
import { COLORS, violetExpression } from '../../lib/scales.js';

export const POLYGON_LAYER_IDS = { dac: 'dac-fill', uhf42: 'uhf-fill' };

/** DAC tracts and UHF42 asthma choropleths (mutually exclusive). Flat purple fills, no outlines. */
function PolygonLayers() {
  const { geo, indexes } = useData();
  const { layerVisibility, dacMode } = useAppState();
  const dacOn = Boolean(layerVisibility.dac);
  const uhfOn = Boolean(layerVisibility.uhf42);
  const [lo, hi] = indexes?.asthmaRange ?? [0, 1];
  const dacColor = dacMode === 'percentile'
    ? violetExpression('combined_pct', 0, 1)
    : ['case', ['==', ['get', 'dac'], true], COLORS.dacFill, 'rgba(0,0,0,0)'];

  return (
    <>
      <Source id="dac" type="geojson" data={geo.dac}>
        <Layer id="dac-fill" type="fill" beforeId="anchor-lines" paint={{ 'fill-color': dacColor, 'fill-opacity': dacOn ? 1 : 0, 'fill-opacity-transition': { duration: 150 }, 'fill-antialias': false }} />
      </Source>
      <Source id="uhf" type="geojson" data={geo.uhf42}>
        <Layer id="uhf-fill" type="fill" beforeId="anchor-lines" paint={{ 'fill-color': violetExpression('asthma_ed_children', lo, hi), 'fill-opacity': uhfOn ? 1 : 0, 'fill-opacity-transition': { duration: 150 }, 'fill-antialias': false }} />
      </Source>
    </>
  );
}

export default memo(PolygonLayers);
