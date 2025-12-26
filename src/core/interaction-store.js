// Minimal interaction store skeleton for v4 architecture.
// Provides a single source of truth for UI state with basic event handling.

const defaultState = Object.freeze({
  dimension: null,
  rotation: 0,
  focusId: null,
  hoverId: null,
  animation: 'idle',
  modal: null,
  error: null
});

export const interactionEvents = Object.freeze({
  SET_DIMENSION: 'SET_DIMENSION',
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
    case interactionEvents.SET_DIMENSION:
      return { ...state, dimension: action.dimension ?? null };
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
  const initial = { ...defaultState, ...(options.initialState || {}) };
  let state = initial;
  const listeners = new Set();

  const getState = () => state;

  const subscribe = fn => {
    if (typeof fn !== 'function') return () => {};
    listeners.add(fn);
    return () => listeners.delete(fn);
  };

  const dispatch = action => {
    state = reducer(state, action);
    listeners.forEach(fn => fn(state, action));
    return state;
  };

  return { getState, dispatch, subscribe };
};

export const getDefaultInteractionState = () => ({ ...defaultState });
