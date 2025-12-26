import { readFile } from 'fs/promises';
import { readFileSync as readFileSyncCompat } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import Ajv from 'ajv';

const __dirname = dirname(fileURLToPath(import.meta.url));
const manifestPath = resolve(__dirname, '../../data/mmdm/mmdm_catalog.json');
const schemaPath = resolve(__dirname, '../../schemas/mmdm.schema.json');

const ajv = new Ajv({ allErrors: true, strict: false });
let validateFn = null;

const getValidator = () => {
  if (validateFn) return validateFn;
  const schemaJson = readFileSyncCompat(schemaPath, 'utf-8');
  validateFn = ajv.compile(JSON.parse(schemaJson));
  return validateFn;
};

export async function loadManifest() {
  const raw = await readFile(manifestPath, 'utf-8');
  return JSON.parse(raw);
}

export function validate(raw) {
  const validate = getValidator();
  const ok = validate(raw);
  const errors = ok ? [] : (validate.errors || []).map(err => `${err.instancePath} ${err.message}`.trim());
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

export function layoutSpec(normalized) {
  const levels = normalized?.meta?.levels || ['market', 'country', 'manufacturer', 'cylinder', 'model'];
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
