import { createInteractionStore, interactionEvents } from './interaction-store.js';
import { NavigationState } from '../navigation/navigation-state.js';
import { safeEmit } from './telemetry.js';

// Wires the interaction store to a volume adapter and navigation state.
// Returns { store, nav, normalized, items, focusById, getFocusedId, setVolume, getVolumeId }.
export async function createStoreNavigationBridge({ adapter, adapterLoader = null, initialFocusId = null, onEvent = null, onError = null } = {}) {
  if (!adapter && !adapterLoader) {
    throw new Error('createStoreNavigationBridge requires an adapter or an adapterLoader');
  }
  const store = createInteractionStore();
  const nav = new NavigationState();

  let normalized = null;
  let items = [];
  let indexById = new Map();
  let currentVolumeId = null;
  const resolveAdapter = maybeId => {
    if (maybeId && typeof maybeId !== 'string') return maybeId;
    if (!maybeId || !adapterLoader) return null;
    return adapterLoader.load(maybeId);
  };

  const initialAdapter = resolveAdapter(adapter) || adapter;
  if (!initialAdapter) {
    throw new Error('createStoreNavigationBridge could not resolve initial adapter');
  }

  let currentAdapter = initialAdapter;
  let lastError = store.getState().error;

  const deriveVolumeId = (volAdapter, volNormalized) =>
    volAdapter.volumeId || volNormalized?.meta?.volumeId || volNormalized?.meta?.id || volNormalized?.meta?.name || 'volume';

  const extractDimensions = manifest => {
    const firstVolume = manifest && typeof manifest === 'object' ? Object.values(manifest)[0] : null;
    const display = firstVolume?.display_config || manifest?.display_config || null;
    const languages = display?.languages || null;
    const editions = display?.editions || null;
    const languageDefault = languages?.default || (Array.isArray(languages?.available) ? languages.available[0] : null);
    const editionDefault = languageDefault && editions?.default ? editions.default[languageDefault] ?? null : null;
    const editionFallback = languageDefault && editions?.available && Array.isArray(editions.available[languageDefault])
      ? editions.available[languageDefault][0]
      : null;
    return {
      meta: languages || editions ? { languages, editions } : null,
      language: languageDefault || null,
      edition: editionDefault || editionFallback || null,
      editionDefault
    };
  };

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
  const now = () => (typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now());

  const notifyError = (error, meta = {}) => {
    if (error === lastError) return;
    lastError = error;
    const payload = {
      ...meta,
      error,
      adapter: meta.adapter ?? currentAdapter,
      volumeId: meta.volumeId ?? currentVolumeId,
      cleared: !error
    };
    emit({ type: 'store:error', ...payload });
    if (typeof onError === 'function') onError(error, payload);
  };

  const deferred = () => {
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };

  let switching = false;
  let queuedSwitch = null;

  const hydrateDeepLink = async (link, { adapter: linkAdapter = adapter } = {}) => {
    emit({ type: 'deep-link:start', link, adapter: linkAdapter });
    try {
      const resolver = typeof linkAdapter.resolveDeepLink === 'function' ? linkAdapter.resolveDeepLink : null;
      let resolvedFocusId = null;

      if (resolver) {
        const resolved = await resolver(link);
        resolvedFocusId = resolved?.focusId ?? resolved?.id ?? resolved ?? null;
      } else if (typeof link === 'string') {
        resolvedFocusId = link;
      }

      if (!resolvedFocusId) {
        emit({ type: 'deep-link:error', link, adapter: linkAdapter, error: new Error('unable to resolve deep link') });
        return false;
      }

      if (linkAdapter !== adapter) {
        await setVolume(linkAdapter, { focusId: resolvedFocusId });
      } else {
        focusById(resolvedFocusId);
      }

      emit({ type: 'deep-link:success', link, adapter: linkAdapter, focusId: resolvedFocusId });
      return true;
    } catch (error) {
      emit({ type: 'deep-link:error', link, adapter: linkAdapter, error });
      throw error;
    }
  };

  const loadVolume = async (volAdapter, { requestedFocusId = null } = {}) => {
    emit({ type: 'volume-load:start', adapter: volAdapter, requestedFocusId });

    const perfContext = { adapter: volAdapter, volumeId: volAdapter?.volumeId || currentVolumeId };

    const loadStart = now();
    let manifest;
    try {
      manifest = await volAdapter.loadManifest();
    } catch (err) {
      store.dispatch({ type: interactionEvents.SET_ERROR, error: err });
      notifyError(err, { adapter: volAdapter, volumeId: volAdapter.volumeId || currentVolumeId, phase: 'load' });
      emit({ type: 'volume-load:error', error: err, adapter: volAdapter });
      throw err;
    }
    emit({ type: 'perf:manifest', phase: 'load', durationMs: now() - loadStart, ...perfContext });

    emit({ type: 'volume-load:validate:start', adapter: volAdapter });
    const validateStart = now();
    const validation = volAdapter.validate(manifest);
    if (!validation.ok) {
      const msg = (validation.errors || []).join('; ');
      const err = new Error(`manifest validation failed: ${msg}`);
      emit({ type: 'volume-load:error', error: err, validation });
      throw err;
    }
    emit({ type: 'volume-load:validate:success', adapter: volAdapter });
    emit({ type: 'perf:manifest', phase: 'validate', durationMs: now() - validateStart, ...perfContext });

    const normalizeStart = now();
    const nextNormalized = volAdapter.normalize(manifest);
    const nextItems = nextNormalized.items || [];
    const volumeId = deriveVolumeId(volAdapter, nextNormalized);
    emit({ type: 'perf:manifest', phase: 'normalize', durationMs: now() - normalizeStart, adapter: volAdapter, volumeId });

    const dimensionInfo = extractDimensions(manifest);

    nav.setItems(nextItems, 0);
    rebuildIndex(nextItems);

    if (requestedFocusId && indexById.has(requestedFocusId)) {
      nav.selectIndex(indexById.get(requestedFocusId));
    }

    store.dispatch({ type: interactionEvents.SET_VOLUME, volume: volumeId });
    if (dimensionInfo.meta) {
      store.dispatch({ type: interactionEvents.SET_DIMENSIONS, dimensions: dimensionInfo.meta });
    }
    if (dimensionInfo.language) {
      store.dispatch({ type: interactionEvents.SET_LANGUAGE, language: dimensionInfo.language, defaultEdition: dimensionInfo.edition });
    }
    if (dimensionInfo.edition) {
      store.dispatch({ type: interactionEvents.SET_EDITION, edition: dimensionInfo.edition });
    }

    currentAdapter = volAdapter;
    currentVolumeId = volumeId;

    normalized = nextNormalized;
    items = nextItems;

    store.dispatch({ type: interactionEvents.SET_ERROR, error: null });
    notifyError(null, { adapter: volAdapter, volumeId, phase: 'recover' });
    emit({ type: 'volume-load:success', volumeId, itemCount: items.length });
  };

  await loadVolume(initialAdapter, { requestedFocusId: initialFocusId });

  const runVolumeSwitch = async (nextAdapter, { focusId = null } = {}) => {
    switching = true;
    emit({ type: 'volume-switch:start', from: currentVolumeId, toAdapter: nextAdapter });
    try {
      await loadVolume(nextAdapter, { requestedFocusId: focusId });
      emit({ type: 'volume-switch:complete', to: currentVolumeId });
      return { volumeId: currentVolumeId, items, normalized };
    } catch (error) {
      emit({ type: 'volume-switch:error', error, toAdapter: nextAdapter });
      throw error;
    } finally {
      switching = false;
      if (queuedSwitch) {
        const next = queuedSwitch;
        queuedSwitch = null;
        runVolumeSwitch(next.adapter, next.options).then(next.resolve, next.reject);
      }
    }
  };

  const setVolume = (nextAdapter, { focusId = null } = {}) => {
    const resolvedAdapter = resolveAdapter(nextAdapter);
    if (!resolvedAdapter) {
      return Promise.reject(new Error('adapter not found'));
    }
    if (switching) {
      if (queuedSwitch) {
        emit({ type: 'volume-switch:cancelled', reason: 'replaced-queued', toAdapter: queuedSwitch.adapter });
        queuedSwitch.resolve({ cancelled: true, volumeId: currentVolumeId });
      }
      emit({ type: 'volume-switch:queued', from: currentVolumeId, toAdapter: nextAdapter });
      const next = deferred();
      queuedSwitch = { adapter: resolvedAdapter, options: { focusId }, resolve: next.resolve, reject: next.reject };
      return next.promise;
    }
    return runVolumeSwitch(resolvedAdapter, { focusId });
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
    hydrateDeepLink,
    getVolumeId
  };
}
