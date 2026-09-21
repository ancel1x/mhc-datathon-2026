import { useMemo } from 'react';
import { MapProvider } from 'react-map-gl/maplibre';
import { AppStateProvider, useAppState } from './state/AppState.jsx';
import { DataProvider, useData } from './lib/data.jsx';
import { featuredFor } from './content/chapters.js';
import { buildGuide } from './content/guide.js';
import MapView from './components/map/MapView.jsx';
import StoryPanel from './components/panels/StoryPanel.jsx';
import SidePanel from './components/panels/SidePanel.jsx';
import Timeline from './components/panels/Timeline.jsx';
import Intro from './components/Intro.jsx';
import GuidePlayer from './components/GuidePlayer.jsx';

/**
 * Four things on screen: the map, the story panel (left), the timeline (bottom) and the control / detail
 * panel (right). The intro title card sits over all of them until the data is in, then fades away.
 * During the guided tour the two panels hide and callouts on the map carry the explanation.
 */
function Shell() {
  const data = useData();
  const { activeChapter, exploreMode, intro, autoplay } = useAppState();

  const featured = useMemo(() => {
    if (exploreMode || !data.indexes) return null;
    return featuredFor(activeChapter, { summary: data.summary, aq: data.geo.aq_monitor, bt: data.geo.bt_facility, aqIds: data.indexes.aqIds });
  }, [activeChapter, exploreMode, data.summary, data.geo.aq_monitor, data.geo.bt_facility, data.indexes]);

  const guide = useMemo(() => {
    try {
      return buildGuide({ summary: data.summary, tolls: data.tolls, geo: data.geo });
    } catch (err) {
      console.error('guide build failed', err);
      return [];
    }
  }, [data.summary, data.tolls, data.geo]);

  const ready = !data.loading && Boolean(data.summary);
  const error = !data.loading && !data.summary ? `No data found (${Object.keys(data.errors).join(', ') || 'summary'}). Start the API or run: node scripts/make-mock-data.mjs` : null;

  return (
    <div className="app" data-intro={intro} data-autoplay={autoplay.on ? 'true' : 'false'}>
      {ready ? (
        <MapProvider>
          <MapView featured={featured} guide={guide} />
          <StoryPanel />
          <Timeline guide={guide} />
          <SidePanel hasFeatured={Boolean(featured)} />
          <GuidePlayer guide={guide} />
        </MapProvider>
      ) : null}
      {intro !== 'done' || !ready ? <Intro loading={data.loading} progress={data.progress} error={error} /> : null}
    </div>
  );
}

export default function App() {
  return (
    <AppStateProvider>
      <DataProvider>
        <Shell />
      </DataProvider>
    </AppStateProvider>
  );
}
