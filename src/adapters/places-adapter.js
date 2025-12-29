import { getViewportInfo } from '../geometry/focus-ring-geometry.js';
import { calculatePyramidCapacity, sampleSiblings, placePyramidNodes } from '../geometry/child-pyramid.js';
import { getPlacesLevels, buildPlacesLevel } from './volume-helpers.js';
import { buildPlacesPyramid } from '../pyramid/volume-pyramid.js';

const isBrowser = typeof window !== 'undefined' && typeof fetch === 'function';
const manifestUrl = './data/places/manifest.json';
const schemaUrl = './schemas/places.schema.json';

let manifestPath = null;
let schemaPath = null;
let nodeReadFile = null;
let nodeReadFileSync = null;
let AjvCtor = null;

if (!isBrowser) {
  const path = await import('path');
  const { fileURLToPath } = await import('url');
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  manifestPath = path.resolve(__dirname, '../../data/places/manifest.json');
  schemaPath = path.resolve(__dirname, '../../schemas/places.schema.json');
  nodeReadFile = (await import('fs/promises')).readFile;
  nodeReadFileSync = (await import('fs')).readFileSync;
  AjvCtor = (await import('ajv')).default;
}

let validateFn = null;
let ajvInstance = null;

const fetchJson = async url => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return res.json();
};

const getValidator = () => {
  if (isBrowser) return null;
  if (validateFn) return validateFn;
  if (!nodeReadFileSync || !schemaPath || !AjvCtor) return null;
  if (!ajvInstance) ajvInstance = new AjvCtor({ allErrors: true, strict: false });
  const schemaJson = JSON.parse(nodeReadFileSync(schemaPath, 'utf-8'));
  validateFn = ajvInstance.compile(schemaJson);
  return validateFn;
};

export async function loadManifest() {
  if (isBrowser) return fetchJson(manifestUrl);
  const raw = await nodeReadFile(manifestPath, 'utf-8');
  return JSON.parse(raw);
}

export function validate(raw) {
  const validator = getValidator();
  if (!validator) return { ok: true, errors: [] };
  const ok = validator(raw);
  const errors = ok ? [] : (validator.errors || []).map(err => `${err.instancePath} ${err.message}`.trim());
  return { ok, errors };
}

export function normalize(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('normalize: manifest is required');
  const [volumeKey, volumeData] = Object.entries(raw)[0] || [];
  if (!volumeData) throw new Error('normalize: manifest missing volume data');
  const items = [];
  const links = [];
  const levelPalette = {};
  const displayConfig = volumeData.display_config || {};
  const dimensions = {
    languages: displayConfig.languages || null,
    editions: displayConfig.editions || null
  };

  const hierarchyLevels = volumeData?.display_config?.hierarchy_levels || {};
  Object.entries(hierarchyLevels).forEach(([level, cfg]) => {
    if (cfg?.color) levelPalette[level] = cfg.color;
  });

  const addItem = ({ id, name, level, parentId = null, order = 0, meta = {} }) => {
    items.push({ id, name, level, parentId, order, meta });
    if (parentId) links.push({ from: parentId, to: id });
  };

  const levels = getPlacesLevels(raw);
  const rootId = `volume:${volumeKey}`;
  const volumeName = volumeData?.display_config?.volume_name || volumeKey || 'places';
  addItem({ id: rootId, name: volumeName, level: 'root', parentId: null, order: 0 });

  levels.forEach((levelName, levelIndex) => {
    const { items: levelItems } = buildPlacesLevel(raw, levels, levelIndex, {});
    levelItems.forEach((entry, idx) => {
      const order = Number.isFinite(entry?.order) ? entry.order : idx;
      const parentId = entry?.parentId || rootId;
      addItem({
        id: entry.id,
        name: entry.name || entry.id,
        level: levelName,
        parentId,
        order,
        meta: { parentName: entry.parentName || null }
      });
    });
  });

  const levelOrder = ['root', ...levels];
  items.sort((a, b) => {
    const lo = levelOrder.indexOf(a.level);
    const ro = levelOrder.indexOf(b.level);
    if (lo === ro) {
      if (a.order === b.order) return (a.name || '').localeCompare(b.name || '');
      return a.order - b.order;
    }
    return lo - ro;
  });
  items.forEach((item, idx) => { item.order = idx; });

  return {
    items,
    links,
    meta: {
      volumeId: volumeKey,
      leafLevel: levels[levels.length - 1] || 'leaf',
      levels,
      colors: levelPalette,
      dimensions
    }
  };
}

export function layoutSpec(normalized, viewport) {
  const levels = normalized?.meta?.levels || [];
  const vp = viewport?.width && viewport?.height ? viewport : getViewportInfo(1280, 720);
  const pyramidCapacity = calculatePyramidCapacity(vp);
  const palette = normalized?.meta?.colors || {};
  return {
    rings: levels.map((lvl, idx) => ({ id: lvl, order: idx })),
    label: item => item?.name ?? '',
    colorByLevel: level => palette[level] || '#4b6f8d',
    pyramid: {
      capacity: pyramidCapacity,
      sample: siblings => sampleSiblings(siblings, pyramidCapacity.total),
      place: siblings => placePyramidNodes(siblings, vp, { capacity: pyramidCapacity })
    }
  };
}

export function detailFor(selected) {
  if (!selected) return null;
  const title = selected.name || selected.id || '';
  const parent = selected.meta?.parentName || selected.parentName || '';
  const level = selected.level ? selected.level.charAt(0).toUpperCase() + selected.level.slice(1) : '';
  const body = [level, parent].filter(Boolean).join(' · ');
  return {
    type: 'card',
    title,
    body: body || 'Detail'
  };
}

export function createHandlers({ manifest, chainMeta } = {}) {
  const baseState = chainMeta?.meta ? chainMeta.meta : chainMeta || {};
  let placesState = { ...baseState, manifest };

  const parentHandler = ({ selected, setItems, app }) => {
    if (!placesState?.levels?.length) return false;
    if (placesState.levelIndex <= 0) return false;
    const parentLevelIndex = placesState.levelIndex - 1;
    const parentLevelName = placesState.levels[parentLevelIndex];
    placesState.selections[placesState.levels[placesState.levelIndex]] = selected?.id || placesState.selections[placesState.levels[placesState.levelIndex]];
    const { items: parentItems, selectedIndex: parentSelected, preserveOrder } = buildPlacesLevel(
      placesState.manifest,
      placesState.levels,
      parentLevelIndex,
      {
        selectedId: placesState.selections[parentLevelName] || null
      }
    );
    if (!parentItems.length) return false;
    placesState.levelIndex = parentLevelIndex;
    placesState.selections[parentLevelName] = parentItems[parentSelected]?.id || placesState.selections[parentLevelName] || null;
    const apply = typeof setItems === 'function' ? setItems : app?.setPrimaryItems;
    if (apply) apply(parentItems, parentSelected, preserveOrder);
    return true;
  };

  const childrenHandler = ({ selected, setItems, app }) => {
    if (!placesState?.levels?.length) return false;
    if (placesState.levelIndex >= placesState.levels.length - 1) return false;
    if (!selected?.id) return false;
    const nextLevelIndex = placesState.levelIndex + 1;
    const nextLevelName = placesState.levels[nextLevelIndex];
    const { items: childItems, selectedIndex: childSelected, preserveOrder } = buildPlacesLevel(
      placesState.manifest,
      placesState.levels,
      nextLevelIndex,
      {
        parentItem: selected,
        selectedId: placesState.selections[nextLevelName] || null,
        contextParentId: selected.id
      }
    );
    if (!childItems.length) return false;
    placesState.levelIndex = nextLevelIndex;
    placesState.selections[nextLevelName] = childItems[childSelected]?.id || placesState.selections[nextLevelName] || null;
    const apply = typeof setItems === 'function' ? setItems : app?.setPrimaryItems;
    if (apply) apply(childItems, childSelected, preserveOrder);
    return true;
  };

  return {
    parentHandler,
    childrenHandler,
    layoutBindings: {
      placesState,
      buildPlacesLevel,
      placesChildrenHandler: params => childrenHandler(params),
      pyramidBuilder: buildPlacesPyramid
    }
  };
}

export const placesAdapter = {
  loadManifest,
  validate,
  normalize,
  layoutSpec,
  detailFor,
  createHandlers,
  capabilities: {
    search: false,
    deepLink: false,
    theming: true
  }
};