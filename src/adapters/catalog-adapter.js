import { getViewportInfo } from '../geometry/focus-ring-geometry.js';
import { calculatePyramidCapacity, sampleSiblings, placePyramidNodes } from '../geometry/child-pyramid.js';
import { buildCatalogPyramid } from '../pyramid/volume-pyramid.js';

const isBrowser = typeof window !== 'undefined' && typeof fetch === 'function';
const manifestUrl = './data/mmdm/mmdm_catalog.json';
const schemaUrl = './schemas/mmdm.schema.json';

let manifestPath = null;
let schemaPath = null;
let nodeReadFile = null;
let nodeReadFileSync = null;
let AjvCtor = null;
if (!isBrowser) {
  const path = await import('path');
  const { fileURLToPath } = await import('url');
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  manifestPath = path.resolve(__dirname, '../../data/mmdm/mmdm_catalog.json');
  schemaPath = path.resolve(__dirname, '../../schemas/mmdm.schema.json');
  nodeReadFile = (await import('fs/promises')).readFile;
  nodeReadFileSync = (await import('fs')).readFileSync;
  AjvCtor = (await import('ajv')).default;
}
let validateFn = null;
let ajvInstance = null;

const fetchJson = async (url) => {
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
  const displayConfig = volumeData.display_config || {};
  const dimensions = {
    languages: displayConfig.languages || null,
    editions: displayConfig.editions || null
  };

  const addItem = ({ id, name, level, parentId = null, order = 0, meta = {} }) => {
    items.push({ id, name, level, parentId, order, meta });
    if (parentId) links.push({ from: parentId, to: id });
  };

  const rootId = `volume:${volumeKey}`;
  const volumeName = volumeData?.display_config?.volume_name || volumeKey || 'catalog';
  addItem({ id: rootId, name: volumeName, level: 'root', parentId: null, order: 0 });

  const markets = volumeData.markets || {};
  Object.entries(markets).forEach(([marketKey, marketVal], marketIdx) => {
    const marketId = `market:${marketKey}`;
    addItem({ id: marketId, name: marketKey, level: 'market', parentId: rootId, order: marketIdx });

    const countries = marketVal.countries || {};
    Object.entries(countries).forEach(([countryKey, countryVal], countryIdx) => {
      const countryId = `country:${countryKey}`;
      addItem({ id: countryId, name: countryKey, level: 'country', parentId: marketId, order: countryIdx });

      const manufacturers = countryVal.manufacturers || {};
      Object.entries(manufacturers).forEach(([manuKey, manuVal], manuIdx) => {
        const manuId = `manufacturer:${manuKey}`;
        addItem({ id: manuId, name: manuKey, level: 'manufacturer', parentId: countryId, order: manuVal.sort_number ?? manuIdx, meta: { founded: manuVal.year_founded, dissolved: manuVal.year_dissolved } });

        const cylinders = manuVal.cylinders || {};
        Object.entries(cylinders).forEach(([cylKey, cylVal], cylIdx) => {
          const cylId = `cylinder:${manuKey}:${cylKey}`;
          addItem({ id: cylId, name: cylKey, level: 'cylinder', parentId: manuId, order: cylVal.sort_number ?? cylIdx });

          // Helper to add a models array under a given parent
          const addModels = (modelsArr, parentNodeId, idPrefix) => {
            (modelsArr || []).forEach((model, modelIdx) => {
              const modelId = `${idPrefix}${model.engine_model || modelIdx}`;
              addItem({
                id: modelId,
                name: model.engine_model || `model-${modelIdx}`,
                level: 'model',
                parentId: parentNodeId,
                order: model.sort_number ?? modelIdx,
                meta: {
                  year_introduced: model.year_introduced ?? null,
                  year_discontinued: model.year_discontinued ?? null
                }
              });
            });
          };

          // Orphan models at cylinder level (no family)
          addModels(cylVal.models, cylId, `model:${manuKey}:${cylKey}:`);

          // Families
          const families = cylVal.families || {};
          Object.entries(families).forEach(([famName, famVal], famIdx) => {
            const famId = `family:${manuKey}:${cylKey}:${famName}`;
            addItem({ id: famId, name: famName, level: 'family', parentId: cylId, order: famVal.sort_number ?? famIdx });

            // Orphan models at family level (no subfamily)
            addModels(famVal.models, famId, `model:${manuKey}:${cylKey}:${famName}:`);

            // Subfamilies
            const subfamilies = famVal.subfamilies || {};
            Object.entries(subfamilies).forEach(([subName, subVal], subIdx) => {
              const subId = `subfamily:${manuKey}:${cylKey}:${famName}:${subName}`;
              addItem({ id: subId, name: subName, level: 'subfamily', parentId: famId, order: subVal.sort_number ?? subIdx });

              // Models under subfamily
              addModels(subVal.models, subId, `model:${manuKey}:${cylKey}:${famName}:${subName}:`);
            });
          });
        });
      });
    });
  });

  return {
    items,
    links,
    meta: {
      volumeId: volumeKey,
      leafLevel: 'model',
      levels: ['market', 'country', 'manufacturer', 'cylinder', 'family', 'subfamily', 'model'],
      dimensions
    }
  };
}

export function layoutSpec(normalized, viewport) {
  const levels = normalized?.meta?.levels || ['market', 'country', 'manufacturer', 'cylinder', 'model'];
  const vp = viewport?.width && viewport?.height ? viewport : getViewportInfo(1280, 720);
  const pyramidCapacity = calculatePyramidCapacity(vp);
  return {
    rings: levels.map((lvl, idx) => ({ id: lvl, order: idx })),
    label: item => item?.name ?? '',
    colorByLevel: level => {
      const palette = {
        market: '#f1b800',
        country: '#d98d00',
        manufacturer: '#b86c00',
        cylinder: '#8f5200',
        family: '#7a4600',
        subfamily: '#6e3f00',
        model: '#633a00'
      };
      return palette[level] || '#555';
    },
    pyramid: {
      capacity: pyramidCapacity,
      place: (siblings, viewport, opts) => placePyramidNodes(siblings, vp, { capacity: pyramidCapacity, logoBounds: opts?.logoBounds })
    },
  };
}

function getManufacturer(manifest, manufacturerId) {
  const markets = manifest?.MMdM?.markets || {};
  for (const [marketKey, marketVal] of Object.entries(markets)) {
    const countries = marketVal?.countries || {};
    for (const [countryKey, countryVal] of Object.entries(countries)) {
      const manufacturers = countryVal?.manufacturers || {};
      if (manufacturers[manufacturerId]) {
        return {
          marketKey,
          countryKey,
          manufacturer: manufacturers[manufacturerId]
        };
      }
    }
  }
  return null;
}

export function detailFor(selected, manifest) {
  if (!selected) return null;
  const id = selected.id || '';
  const name = selected.name || id;
  const marketCountryId = id.includes('__') ? id.split('__') : null;
  const modelParts = id.startsWith('model:') ? id.split(':') : null;

  // Manufacturer nodes come from the focus ring chain (`market__country__manufacturer`).
  if (marketCountryId && marketCountryId.length === 3) {
    const [, , manufacturerId] = marketCountryId;
    const found = getManufacturer(manifest, manufacturerId);
    const data = found?.manufacturer || {};
    const founded = data.year_founded ? `Founded ${data.year_founded}` : null;
    const dissolved = data.year_dissolved ? `Ended ${data.year_dissolved}` : null;
    const lineItems = [founded, dissolved].filter(Boolean).join(' · ');
    return {
      type: 'card',
      title: name,
      body: lineItems || 'Manufacturer overview',
      image: data?.logo || null
    };
  }

  // Model nodes: model:mfr:cyl:model OR model:mfr:cyl:fam:model OR model:mfr:cyl:fam:sub:model
  if (modelParts && modelParts.length >= 4) {
    const [, manufacturerId, cylinderKey, ...rest] = modelParts;
    const modelKey = rest[rest.length - 1]; // last segment is always the model name
    const found = getManufacturer(manifest, manufacturerId);
    const cylinders = found?.manufacturer?.cylinders || {};
    const cyl = cylinders[cylinderKey] || {};

    // Collect all model arrays this model could live in
    const searchArrays = [];
    // Cylinder-level orphans
    if (Array.isArray(cyl.models)) searchArrays.push(cyl.models);
    // Family/subfamily models
    for (const famVal of Object.values(cyl.families || {})) {
      if (Array.isArray(famVal.models)) searchArrays.push(famVal.models);
      for (const subVal of Object.values(famVal.subfamilies || {})) {
        if (Array.isArray(subVal.models)) searchArrays.push(subVal.models);
      }
    }

    let model = null;
    for (const arr of searchArrays) {
      model = arr.find(m => (m.engine_model || '').toString() === modelKey);
      if (model) break;
    }
    if (!model) model = {};
    const introduced = model.year_introduced ? `Introduced ${model.year_introduced}` : null;
    const discontinued = model.year_discontinued ? `Discontinued ${model.year_discontinued}` : null;
    const body = [introduced, discontinued, cylinderKey ? `${cylinderKey} cylinder` : null].filter(Boolean).join(' · ');
    return {
      type: 'card',
      title: model.engine_model || modelKey || name,
      body: body || 'Model details',
      image: model.image || null
    };
  }

  // Family/subfamily containers — show a simple card
  if (id.startsWith('fam:') || id.startsWith('subfam:')) {
    return {
      type: 'text',
      text: name
    };
  }

  // Fallback detail text for any other level.
  return {
    type: 'text',
    text: name
  };
}

export const catalogAdapter = {
  loadManifest,
  validate,
  normalize,
  layoutSpec,
  detailFor,
  createHandlers: ({ chainMeta } = {}) => {
    let catalogMode = 'manufacturer';
    const navStack = []; // stack of snapshots for multi-level IN/OUT
    const parentHandler = ({ app }) => {
      if (catalogMode === 'manufacturer') return false;
      if (navStack.length === 0) return false;
      const snapshot = navStack.pop();
      catalogMode = navStack.length === 0 ? 'manufacturer' : 'child';
      if (app?.setParentButtons) app.setParentButtons({ showOuter: navStack.length > 0 });
      if (app?.setPrimaryItems) {
        const { items, selectedIndex, preserveOrder } = snapshot;
        app.setPrimaryItems(items || [], selectedIndex ?? 0, preserveOrder ?? false);
      }
      return true;
    };
    return {
      parentHandler,
      childrenHandler: () => false,
      layoutBindings: {
        catalogModeRef: () => catalogMode,
        setCatalogMode: next => { catalogMode = next; },
        savePreInState: snapshot => { navStack.push(snapshot); },
        pyramidBuilder: buildCatalogPyramid
      }
    };
  },
  capabilities: {
    search: false,
    deepLink: false,
    theming: true
  }
};
