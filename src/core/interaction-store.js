// Minimal interaction store skeleton for v4 architecture.
// Provides a single source of truth for UI state with basic event handling.

const defaultState = Object.freeze({
  volume: null,
  language: null,
  edition: null,
  dimensions: null,
  rotation: 0,
  focusId: null,
  hoverId: null,
  animation: 'idle',
  modal: null,
  error: null
});

export const interactionEvents = Object.freeze({
  SET_VOLUME: 'SET_VOLUME',
  SET_DIMENSIONS: 'SET_DIMENSIONS',
  SET_LANGUAGE: 'SET_LANGUAGE',
  SET_EDITION: 'SET_EDITION',
  SET_ROTATION: 'SET_ROTATION',
  FOCUS: 'FOCUS',
  HOVER: 'HOVER',
  ANIMATION_START: 'ANIMATION_START',
  ANIMATION_END: 'ANIMATION_END',
  SET_MODAL: 'SET_MODAL',
  SET_ERROR: 'SET_ERROR'
});

const reducer = (state, action) => {
  switch (action?.type) {
    case 'SET_DIMENSION':
      return { ...state, volume: action.dimension ?? action.volume ?? null, hoverId: null };
    case interactionEvents.SET_VOLUME:
      return { ...state, volume: action.volume ?? null, hoverId: null, language: null, edition: null, dimensions: null };
    case interactionEvents.SET_DIMENSIONS:
      return { ...state, dimensions: action.dimensions ?? null };
    case interactionEvents.SET_LANGUAGE: {
      const nextLanguage = action.language ?? null;
      const defaultEdition = action.defaultEdition ?? null;
      return { ...state, language: nextLanguage, edition: defaultEdition ?? (state.language === nextLanguage ? state.edition : null) };
    }
    case interactionEvents.SET_EDITION:
      return { ...state, edition: action.edition ?? null };
    case interactionEvents.SET_ROTATION:
      return { ...state, rotation: Number.isFinite(action.rotation) ? action.rotation : state.rotation };
    case interactionEvents.FOCUS:
      return { ...state, focusId: action.focusId ?? null };
    case interactionEvents.HOVER:
      return { ...state, hoverId: action.hoverId ?? null };
    case interactionEvents.ANIMATION_START:
      return { ...state, animation: action.animation ?? 'transitioning' };
    case interactionEvents.ANIMATION_END:
      return { ...state, animation: 'idle' };
    case interactionEvents.SET_MODAL:
      return { ...state, modal: action.modal ?? null };
    case interactionEvents.SET_ERROR:
      return { ...state, error: action.error ?? null };
    default:
      return state;
  }
};

export const createInteractionStore = (options = {}) => {
  const provided = options.initialState || {};
  const normalizedInitial = {
    ...provided,
    volume: provided.volume ?? provided.dimension ?? defaultState.volume,
    language: provided.language ?? defaultState.language,
    edition: provided.edition ?? defaultState.edition,
    dimensions: provided.dimensions ?? defaultState.dimensions
  };
  const initial = { ...defaultState, ...normalizedInitial };
  let state = initial;
  let pendingRotation = null;
  const listeners = new Set();

  const getState = () => state;

  const subscribe = fn => {
    if (typeof fn !== 'function') return () => {};
    listeners.add(fn);
    return () => listeners.delete(fn);
  };

  const dispatch = action => {
    if (!action?.type) return state;

    if (action.type === interactionEvents.SET_ROTATION && state.animation !== 'idle') {
      pendingRotation = action;
      return state;
    }

    if (action.type === interactionEvents.SET_VOLUME || action.type === 'SET_DIMENSION') {
      pendingRotation = null;
    }

    state = reducer(state, action);

    if (action.type === interactionEvents.ANIMATION_END && pendingRotation) {
      state = reducer(state, pendingRotation);
      pendingRotation = null;
    }

    listeners.forEach(fn => fn(state, action));
    return state;
  };

  return { getState, dispatch, subscribe };
};

export const getDefaultInteractionState = () => ({ ...defaultState });
