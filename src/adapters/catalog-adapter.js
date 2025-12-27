import { getViewportInfo } from '../geometry/focus-ring-geometry.js';
import { calculatePyramidCapacity, sampleSiblings, placePyramidNodes } from '../geometry/child-pyramid.js';

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
      levels: ['market', 'country', 'manufacturer', 'cylinder', 'model']
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

export const catalogAdapter = {
  loadManifest,
  validate,
  normalize,
  layoutSpec,
  capabilities: {
    search: false,
    deepLink: false,
    theming: true
  }
};
