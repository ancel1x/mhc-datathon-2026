import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { loadJson } from './api.js';
import { layerMaxima, LAYER_META } from './metrics.js';

const DataContext = createContext(null);

export const CORE_FILES = [
  'summary', 'tolls', 'sources', 'crz_zone', 'crz_entry_points', 'bt_facilities', 'dot_segments', 'aq_monitors', 'dac_tracts', 'uhf42', 'boroughs',
];

const EMPTY_FC = { type: 'FeatureCollection', features: [] };

function asFC(x) {
  return x && x.type === 'FeatureCollection' && Array.isArray(x.features) ? x : EMPTY_FC;
}

function buildIndexes(data) {
  const byId = {};
  const maxima = {};
  for (const [layer, meta] of Object.entries(LAYER_META)) {
    const fc = asFC(data[meta.file]);
    byId[layer] = new Map(fc.features.map((f) => [f.properties?.id, f]));
    maxima[layer] = layerMaxima(fc, layer);
  }
  // neighborhoods are selectable for their context card; keyed by UHF42 code
  byId.uhf42 = new Map(asFC(data.uhf42).features.map((f) => [String(f.properties?.uhf_code), f]));
  const aqIds = new Map(asFC(data.aq_monitors).features.map((f) => [f.properties?.site_id, f.properties?.id]));
  const asthma = asFC(data.uhf42).features.map((f) => f.properties?.asthma_ed_children).filter((v) => typeof v === 'number');
  const asthmaRange = asthma.length ? [Math.min(...asthma), Math.max(...asthma)] : [0, 1];
  return { byId, maxima, aqIds, asthmaRange };
}

export function DataProvider({ children }) {
  const [state, setState] = useState({ loading: true, progress: 0, data: {}, errors: {} });

  useEffect(() => {
    let alive = true;
    let done = 0;
    const data = {};
    const errors = {};
    Promise.all(
      CORE_FILES.map((name) =>
        loadJson(name)
          .then((d) => { data[name] = d; }, (e) => { errors[name] = String(e?.message ?? e); data[name] = null; })
          .finally(() => {
            done += 1;
            if (alive) setState((s) => ({ ...s, progress: done / CORE_FILES.length }));
          }),
      ),
    ).then(() => {
      if (alive) setState({ loading: false, progress: 1, data, errors });
    });
    return () => { alive = false; };
  }, []);

  const value = useMemo(() => {
    const d = state.data;
    return {
      loading: state.loading,
      progress: state.progress,
      errors: state.errors,
      summary: d.summary ?? null,
      reconciled: d.summary?.reconciled ?? null,
      tolls: d.tolls ?? null,
      sources: Array.isArray(d.sources) ? d.sources : [],
      geo: {
        crz_zone: asFC(d.crz_zone),
        crz_entry: asFC(d.crz_entry_points),
        bt_facility: asFC(d.bt_facilities),
        dot_segment: asFC(d.dot_segments),
        aq_monitor: asFC(d.aq_monitors),
        dac: asFC(d.dac_tracts),
        uhf42: asFC(d.uhf42),
        boroughs: asFC(d.boroughs),
      },
      indexes: state.loading ? null : buildIndexes(d),
      isMock: Boolean(d.summary?._mock),
    };
  }, [state]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used inside DataProvider');
  return ctx;
}

/** Lazy-load a bundle file (series etc.). Returns { data, loading, error }. */
export function useLazyJson(name, enabled = true) {
  const [st, setSt] = useState({ data: null, loading: Boolean(enabled && name), error: null });
  useEffect(() => {
    if (!enabled || !name) return undefined;
    let alive = true;
    setSt((s) => (s.data && s.name === name ? s : { data: null, loading: true, error: null, name }));
    loadJson(name).then(
      (d) => alive && setSt({ data: d, loading: false, error: null, name }),
      (e) => alive && setSt({ data: null, loading: false, error: String(e?.message ?? e), name }),
    );
    return () => { alive = false; };
  }, [name, enabled]);
  return st;
}
