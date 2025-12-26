import { catalogAdapter } from '../adapters/catalog-adapter.js';
import { createInteractionStore, interactionEvents } from './interaction-store.js';
import { NavigationState } from '../navigation/navigation-state.js';
import { safeEmit } from './telemetry.js';

// Wires the interaction store to a volume adapter and navigation state.
// Returns { store, nav, normalized, items, focusById, getFocusedId, setVolume, getVolumeId }.
export async function createStoreNavigationBridge({ adapter = catalogAdapter, initialFocusId = null, onEvent = null } = {}) {
  const store = createInteractionStore();
  const nav = new NavigationState();

  let normalized = null;
  let items = [];
  let indexById = new Map();
  let currentVolumeId = null;

  const deriveVolumeId = (volAdapter, volNormalized) =>
    volAdapter.volumeId || volNormalized?.meta?.volumeId || volNormalized?.meta?.id || volNormalized?.meta?.name || 'volume';

  const rebuildIndex = list => {
    indexById = new Map();
    list.forEach((item, idx) => {
      if (item?.id) indexById.set(item.id, idx);
    });
  };

  nav.onChange(evt => {
    if (evt?.item?.id) {
      store.dispatch({ type: interactionEvents.FOCUS, focusId: evt.item.id });
    } else {
      store.dispatch({ type: interactionEvents.FOCUS, focusId: null });
    }
  });

  const focusById = id => {
    if (!indexById.has(id)) return false;
    nav.selectIndex(indexById.get(id));
    // nav change handler will dispatch focus
    return true;
  };

  const emit = payload => safeEmit(onEvent, payload);

  const loadVolume = async (volAdapter, { requestedFocusId = null } = {}) => {
    emit({ type: 'volume-load:start', adapter: volAdapter, requestedFocusId });

    let manifest;
    try {
      manifest = await volAdapter.loadManifest();
    } catch (err) {
      emit({ type: 'volume-load:error', error: err });
      throw err;
    }

    const validation = volAdapter.validate(manifest);
    if (!validation.ok) {
      const msg = (validation.errors || []).join('; ');
      const err = new Error(`manifest validation failed: ${msg}`);
      emit({ type: 'volume-load:error', error: err, validation });
      throw err;
    }

    const nextNormalized = volAdapter.normalize(manifest);
    const nextItems = nextNormalized.items || [];
    const volumeId = deriveVolumeId(volAdapter, nextNormalized);

    nav.setItems(nextItems, 0);
    rebuildIndex(nextItems);

    if (requestedFocusId && indexById.has(requestedFocusId)) {
      nav.selectIndex(indexById.get(requestedFocusId));
    }

    store.dispatch({ type: interactionEvents.SET_VOLUME, volume: volumeId });

    normalized = nextNormalized;
    items = nextItems;
    currentVolumeId = volumeId;

    emit({ type: 'volume-load:success', volumeId, itemCount: items.length });
  };

  await loadVolume(adapter, { requestedFocusId: initialFocusId });

  const setVolume = async (nextAdapter, { focusId = null } = {}) => {
    emit({ type: 'volume-switch:start', from: currentVolumeId, toAdapter: nextAdapter });
    await loadVolume(nextAdapter, { requestedFocusId: focusId });
    emit({ type: 'volume-switch:complete', to: currentVolumeId });
    return { volumeId: currentVolumeId, items, normalized };
  };

  const getFocusedId = () => store.getState().focusId;
  const getVolumeId = () => store.getState().volume;

  return {
    store,
    nav,
    get normalized() {
      return normalized;
    },
    get items() {
      return items;
    },
    focusById,
    getFocusedId,
    setVolume,
    getVolumeId
  };
}
