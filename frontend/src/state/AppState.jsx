import { createContext, useContext, useEffect, useMemo, useReducer } from 'react';
import { CHAPTERS, EXPLORE_LAYERS } from '../content/chapters.js';

const AppStateContext = createContext(null);
const DispatchContext = createContext(() => {});

function readStoredTheme() {
  try {
    const q = new URLSearchParams(window.location.search).get('theme');
    if (q === 'dark' || q === 'light') return q;
    const t = window.localStorage.getItem('crz-theme');
    if (t === 'dark' || t === 'light') return t;
  } catch {
    /* storage unavailable */
  }
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

/**
 * Deep links: ?chapter=1..11 starts on that step, ?chapter=explore (or 12) on the explore step; either skips
 * the intro. ?intro=0 skips the intro, ?intro=hold keeps it on screen. ?play=1 starts the guided tour
 * (?play=N from step N). ?feature=<layer>:<id> opens that feature's detail (layers: bt_facility, aq_monitor,
 * crz_entry, dot_segment, uhf42); ?controls=1 opens the controls sheet on phones.
 */
function readUrlState() {
  const out = { chapter: 0, explore: false, controlsOpen: false, controlsCollapsed: false, selectedFeature: null, skipIntro: false, introHold: false, play: null };
  try {
    const q = new URLSearchParams(window.location.search);
    const raw = q.get('chapter');
    if (raw === 'explore' || Number(raw) === CHAPTERS.length + 1) out.explore = true;
    else if (raw && Number.isFinite(Number(raw))) out.chapter = Math.max(0, Math.min(CHAPTERS.length - 1, Number(raw) - 1));
    if (raw) out.skipIntro = true;
    const intro = q.get('intro');
    if (intro === '0' || intro === 'skip') out.skipIntro = true;
    if (intro === 'hold') out.introHold = true;
    const play = q.get('play');
    if (play != null && play !== '' && play !== '0') { out.play = Math.max(0, Math.min(CHAPTERS.length - 1, (Number(play) || 1) - 1)); out.skipIntro = true; }
    const [layer, ...rest] = (q.get('feature') ?? '').split(':');
    const id = rest.join(':');
    if (layer && id) { out.selectedFeature = { layer, id }; out.skipIntro = true; }
    out.controlsOpen = q.get('controls') === '1';
    out.controlsCollapsed = q.get('controls') === 'collapsed';
  } catch {
    /* no window */
  }
  return out;
}
const fromUrl = readUrlState();
const startIndex = fromUrl.play ?? fromUrl.chapter;
const startChapter = CHAPTERS[startIndex] ?? CHAPTERS[0];

const OFF_TOUR = { on: false, paused: false, step: 0, beat: 0, startedAt: 0, elapsed: 0 };
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/** The year / metric a step opens on: its `from` state when it has one (so the change can be watched), else its own. */
const opening = (ch) => ({ period: ch.from?.period ?? ch.period ?? 'post_2025', metric: ch.from?.metric ?? ch.metric ?? 'change' });

export const initialState = {
  intro: fromUrl.skipIntro && !fromUrl.introHold ? 'done' : 'show', // 'show' | 'leaving' | 'done'
  introHold: fromUrl.introHold,
  autoplay: fromUrl.play != null ? { ...OFF_TOUR, on: true, step: fromUrl.play, startedAt: now() } : OFF_TOUR,
  period: fromUrl.explore ? 'post_2025' : opening(startChapter).period,
  metric: fromUrl.explore ? 'change' : opening(startChapter).metric,
  hour: null,
  activeChapter: fromUrl.explore ? CHAPTERS.length : startIndex,
  exploreMode: fromUrl.explore,
  selectedFeature: fromUrl.selectedFeature,
  hovered: null,
  layerVisibility: fromUrl.explore ? { ...EXPLORE_LAYERS } : { ...startChapter.layers },
  dotAll: !fromUrl.explore && Boolean(startChapter.dotAll), // show the single-count DOT sites too (default: matched only)
  theme: readStoredTheme(),
  sourcesOpen: false,
  controlsOpen: fromUrl.controlsOpen, // phone: controls sheet open
  controlsCollapsed: Boolean(fromUrl.controlsCollapsed), // desktop: control panel collapsed to a pill (?controls=collapsed)
  dacMode: 'percentile', // 'designated' | 'percentile'; burden score is the primary presentation
  glyphMode: false, // map zoom >= 11 (clock glyphs on)
};

const clampStep = (i) => Math.max(0, Math.min(CHAPTERS.length - 1, Number(i) || 0));

/**
 * Paged story along a timeline. Entering a step applies that step's preset (layers, year, metric, hour);
 * anything the reader changes afterwards sticks until the next step. Explore never resets.
 * The guided tour ("autoplay") walks the steps on its own; any step change while it runs restarts it there.
 */
export function reducer(state, action) {
  switch (action.type) {
    case 'INTRO_LEAVE':
      return state.intro === 'show' ? { ...state, intro: 'leaving' } : state;
    case 'INTRO_DONE':
      return state.intro === 'done' ? state : { ...state, intro: 'done' };
    case 'SET_CHAPTER': {
      const ch = CHAPTERS[action.index];
      if (!ch) return state;
      if (state.activeChapter === action.index && !state.exploreMode) return state;
      return { ...state, activeChapter: action.index, exploreMode: false, layerVisibility: { ...ch.layers }, dotAll: Boolean(ch.dotAll), ...opening(ch), hour: null, selectedFeature: null, sourcesOpen: false };
    }
    case 'SET_STEP_STATE':
      // Used by step transitions and tour beats: sets the year / metric directly, no coupling rules.
      return { ...state, period: action.period ?? state.period, metric: action.metric ?? state.metric };
    case 'ENTER_EXPLORE':
      if (state.exploreMode) return state.autoplay.on ? { ...state, autoplay: OFF_TOUR } : state;
      return { ...state, exploreMode: true, activeChapter: CHAPTERS.length, layerVisibility: { ...EXPLORE_LAYERS }, metric: 'change', period: state.period === 'pre_2024' ? 'post_2025' : state.period, selectedFeature: null, sourcesOpen: false, autoplay: OFF_TOUR };
    case 'NEXT_STEP':
      if (state.autoplay.on) return reducer(state, state.autoplay.step >= CHAPTERS.length - 1 ? { type: 'AUTOPLAY_END' } : { type: 'AUTOPLAY_START', step: state.autoplay.step + 1 });
      if (state.exploreMode) return state;
      if (state.activeChapter >= CHAPTERS.length - 1) return reducer(state, { type: 'ENTER_EXPLORE' });
      return reducer(state, { type: 'SET_CHAPTER', index: state.activeChapter + 1 });
    case 'PREV_STEP':
      if (state.autoplay.on) return reducer(state, { type: 'AUTOPLAY_START', step: Math.max(0, state.autoplay.step - 1) });
      if (state.exploreMode) return reducer(state, { type: 'SET_CHAPTER', index: CHAPTERS.length - 1 });
      if (state.activeChapter <= 0) return state;
      return reducer(state, { type: 'SET_CHAPTER', index: state.activeChapter - 1 });
    case 'RESTART':
      return reducer({ ...state, exploreMode: true, autoplay: OFF_TOUR }, { type: 'SET_CHAPTER', index: 0 });

    // ---- guided tour ----
    case 'AUTOPLAY_START': {
      const step = clampStep(action.step ?? 0);
      const base = reducer({ ...state, exploreMode: true }, { type: 'SET_CHAPTER', index: step });
      return { ...base, autoplay: { on: true, paused: false, step, beat: 0, startedAt: now(), elapsed: 0 }, selectedFeature: null, sourcesOpen: false };
    }
    case 'AUTOPLAY_BEAT':
      return state.autoplay.on ? { ...state, autoplay: { ...state.autoplay, beat: Math.max(0, Number(action.beat) || 0), startedAt: now(), elapsed: 0 } } : state;
    case 'AUTOPLAY_SKIP': {
      // Skip to the next / previous callout without waiting for its bar; past the last one, move on to the next
      // step (or Explore); before the first, back to the previous step. Skipping resumes a paused tour.
      if (!state.autoplay.on) return state;
      const n = Math.max(1, Number(action.count) || 1);
      const next = state.autoplay.beat + (action.dir < 0 ? -1 : 1);
      if (next >= n) return reducer(state, state.autoplay.step >= CHAPTERS.length - 1 ? { type: 'AUTOPLAY_END' } : { type: 'AUTOPLAY_START', step: state.autoplay.step + 1 });
      if (next < 0) return reducer(state, { type: 'AUTOPLAY_START', step: Math.max(0, state.autoplay.step - 1) });
      return { ...state, autoplay: { ...state.autoplay, beat: next, paused: false, startedAt: now(), elapsed: 0 } };
    }
    case 'AUTOPLAY_TOGGLE_PAUSE': {
      if (!state.autoplay.on) return state;
      const a = state.autoplay;
      return a.paused
        ? { ...state, autoplay: { ...a, paused: false, startedAt: now() } }
        : { ...state, autoplay: { ...a, paused: true, elapsed: a.elapsed + (now() - a.startedAt) } };
    }
    case 'AUTOPLAY_STOP':
      return state.autoplay.on ? { ...state, autoplay: OFF_TOUR } : state;
    case 'AUTOPLAY_END':
      return { ...reducer({ ...state, autoplay: OFF_TOUR }, { type: 'ENTER_EXPLORE' }), autoplay: OFF_TOUR };

    case 'SET_PERIOD': {
      const metric = action.period === 'pre_2024' ? 'absolute' : state.metric;
      return { ...state, period: action.period, metric };
    }
    case 'SET_METRIC': {
      // The 2024 baseline has no change to show: asking for "change" moves the year to 2025.
      if (action.metric === 'change' && state.period === 'pre_2024') return { ...state, metric: 'change', period: 'post_2025' };
      return { ...state, metric: action.metric };
    }
    case 'SET_HOUR':
      return { ...state, hour: action.hour == null ? null : Math.max(0, Math.min(23, Number(action.hour))) };
    case 'TOGGLE_LAYER': {
      const on = action.on ?? !state.layerVisibility[action.layer];
      const next = { ...state.layerVisibility, [action.layer]: on };
      if (on && action.layer === 'dac') next.uhf42 = false;
      if (on && action.layer === 'uhf42') next.dac = false;
      return { ...state, layerVisibility: next };
    }
    case 'TOGGLE_DOT_ALL': {
      const on = action.on ?? !state.dotAll;
      return { ...state, dotAll: on, layerVisibility: on ? { ...state.layerVisibility, dot_segment: true } : state.layerVisibility };
    }
    case 'SET_DAC_MODE':
      return { ...state, dacMode: action.mode === 'percentile' ? 'percentile' : 'designated', layerVisibility: { ...state.layerVisibility, dac: true, uhf42: false } };
    case 'SELECT_FEATURE':
      // Clicking something during the tour hands control back to the reader so the detail panel can show.
      return { ...state, selectedFeature: action.feature ?? null, autoplay: action.feature && state.autoplay.on ? OFF_TOUR : state.autoplay };
    case 'SET_HOVER':
      return { ...state, hovered: action.hovered ?? null };
    case 'SET_THEME':
      return { ...state, theme: action.theme };
    case 'TOGGLE_THEME':
      return { ...state, theme: state.theme === 'dark' ? 'light' : 'dark' };
    case 'TOGGLE_SOURCES':
      return { ...state, sourcesOpen: action.open ?? !state.sourcesOpen };
    case 'TOGGLE_CONTROLS':
      return { ...state, controlsOpen: action.open ?? !state.controlsOpen };
    case 'TOGGLE_COLLAPSE':
      return { ...state, controlsCollapsed: action.collapsed ?? !state.controlsCollapsed };
    case 'SET_GLYPH_MODE':
      return state.glyphMode === Boolean(action.on) ? state : { ...state, glyphMode: Boolean(action.on) };
    default:
      return state;
  }
}

export function AppStateProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    document.documentElement.dataset.theme = state.theme;
    try {
      window.localStorage.setItem('crz-theme', state.theme);
    } catch {
      /* ignore */
    }
  }, [state.theme]);

  const value = useMemo(() => state, [state]);
  return (
    <DispatchContext.Provider value={dispatch}>
      <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>
    </DispatchContext.Provider>
  );
}

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState must be used inside AppStateProvider');
  return ctx;
}

export function useDispatch() {
  return useContext(DispatchContext);
}
