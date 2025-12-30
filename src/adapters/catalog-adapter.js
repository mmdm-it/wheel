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
        addItem({ id: manuId, name: manuKey, level: 'manufacturer', parentId: countryId, order: manuIdx, meta: { founded: manuVal.year_founded, dissolved: manuVal.year_dissolved } });

        const cylinders = manuVal.cylinders || {};
        Object.entries(cylinders).forEach(([cylKey, cylVal], cylIdx) => {
          const cylId = `cylinder:${manuKey}:${cylKey}`;
          addItem({ id: cylId, name: `${cylKey} Cyl`, level: 'cylinder', parentId: manuId, order: cylVal.sort_number ?? cylIdx });

          const models = cylVal.models || [];
          models.forEach((model, modelIdx) => {
            const modelId = `model:${manuKey}:${cylKey}:${model.engine_model || modelIdx}`;
            addItem({
              id: modelId,
              name: model.engine_model || `model-${modelIdx}`,
              level: 'model',
              parentId: cylId,
              order: model.sort_number ?? modelIdx,
              meta: {
                year_introduced: model.year_introduced ?? null,
                year_discontinued: model.year_discontinued ?? null
              }
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
      levels: ['market', 'country', 'manufacturer', 'cylinder', 'model'],
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
        model: '#633a00'
      };
      return palette[level] || '#555';
    },
    pyramid: {
      capacity: pyramidCapacity,
      sample: siblings => sampleSiblings(siblings, pyramidCapacity.total),
      place: siblings => placePyramidNodes(siblings, vp, { capacity: pyramidCapacity })
    }
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

  // Model nodes come from pyramid clicks (`model:manufacturer:cyl:modelKey`).
  if (modelParts && modelParts.length >= 4) {
    const [, manufacturerId, cylinderKey, modelKey] = modelParts;
    const found = getManufacturer(manifest, manufacturerId);
    const cylinders = found?.manufacturer?.cylinders || {};
    const cyl = cylinders[cylinderKey] || {};
    const models = Array.isArray(cyl.models) ? cyl.models : [];
    const model = models.find(m => (m.engine_model || '').toString() === modelKey) || models.find((_, idx) => String(idx) === modelKey) || {};
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
    const catalogRoot = chainMeta ? { ...chainMeta } : null;
    const parentHandler = ({ app }) => {
      if (catalogMode !== 'model') return false;
      if (!catalogRoot) return false;
      catalogMode = 'manufacturer';
      if (app?.setParentButtons) app.setParentButtons({ showOuter: true });
      if (app?.setPrimaryItems) {
        const { items: rootItems, selectedIndex: rootSelected, preserveOrder: rootPreserve } = catalogRoot;
        app.setPrimaryItems(rootItems || [], rootSelected ?? 0, rootPreserve ?? false);
      }
      return true;
    };
    return {
      parentHandler,
      childrenHandler: () => false,
      layoutBindings: {
        catalogModeRef: () => catalogMode,
        setCatalogMode: next => { catalogMode = next; },
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
