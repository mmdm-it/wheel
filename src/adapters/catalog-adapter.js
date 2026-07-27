import { getViewportInfo } from '../geometry/focus-ring-geometry.js';
import { calculatePyramidCapacity, sampleSiblings, placePyramidNodes } from '../geometry/child-pyramid.js';
import { buildCatalogPyramid } from '../pyramid/volume-pyramid.js';
import { buildCatalogCountries, buildCatalogManufacturers } from './volume-helpers.js';

const isBrowser = typeof window !== 'undefined' && typeof fetch === 'function';
const manifestUrl = './data/mmdm/mmdm_catalog.json';
const schemaUrl = './schemas/mmdm.schema.json';

let manifestPath = null;
let schemaPath = null;
let nodeReadFile = null;
let nodeReadFileSync = null;
let AjvCtor = null;
let _nodeReady = null;
function _ensureNode() {
  if (isBrowser) return Promise.resolve();
  if (_nodeReady) return _nodeReady;
  _nodeReady = (async () => {
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    manifestPath = path.resolve(__dirname, '../../data/mmdm/mmdm_catalog.json');
    schemaPath = path.resolve(__dirname, '../../schemas/mmdm.schema.json');
    nodeReadFile = (await import('fs/promises')).readFile;
    nodeReadFileSync = (await import('fs')).readFileSync;
    AjvCtor = (await import('ajv')).default;
  })();
  return _nodeReady;
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

// overridePath (Node) / overrideUrl (browser) lets the test suite point the
// loader at a public-domain fixture — the real corpus lives in wheel-cargo
// now (W-10) and isn't present in a public checkout. Production calls pass
// nothing and read the deployed data as before.
export async function loadManifest(override) {
  if (isBrowser) return fetchJson(override || manifestUrl);
  await _ensureNode();
  const raw = await nodeReadFile(override || manifestPath, 'utf-8');
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
      // Migration grammar (declared, not inferred): descending FROM a ring of
      // one of these levels, the magnifier label merges into the parent label
      // as a suffix ("N CIL" joining the maker's name); ascending back to that
      // ring splits it out again. Absent levels (and volumes that omit the
      // field entirely) get plain replace.
      suffixMerge: ['cylinder'],
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

// C.2 catalog split: graft the separately-fetched prose map back onto the
// lite manifest. detailFor reads model.data at render time, so enrichment
// is invisible to every downstream path; a detail opened before the prose
// arrives simply lacks its description until the post-boot re-render.
export function enrichCatalogProse(manifest, proseMap) {
  if (!proseMap || typeof proseMap !== 'object') return 0;
  let attached = 0;
  (function walk(node) {
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (!node || typeof node !== 'object') return;
    if (node.engine_model !== undefined && node.id && !node.data && proseMap[node.id]) {
      node.data = proseMap[node.id];
      attached++;
    }
    Object.values(node).forEach(walk);
  })(manifest);
  return attached;
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
    const introduced = model.year_introduced ? `Introdotto ${model.year_introduced}` : null;
    const discontinued = model.year_discontinued ? `Fuori produzione ${model.year_discontinued}` : null;
    const yearLine = [introduced, discontinued].filter(Boolean).join(' · ');
    const descText = model.data?.description || null;
    return {
      type: 'card',
      // NO title — the model's name is already in the magnifier (Howell
      // 2026-07-20: the redundancy rule; same law as the day card's date).
      title: null,
      body: yearLine || null,
      image: model.image || model.data?.media?.photo || null,
      // The dossier's media slot (docs/DETAIL_SECTOR_LOADS.md): a video
      // plays inline in the card. Safe by construction — the catalog's
      // sector never claimed the NEXT tap, so player controls collide
      // with nothing.
      video: model.data?.media?.video || null,
      description: descText
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
  createHandlers: ({ chainMeta, manifest } = {}) => {
    let catalogMode = 'manufacturer';

    // C.2 catalog split: fetch the prose map after boot and graft it onto
    // the lite manifest, then refresh whatever detail is showing so an
    // early tap still gets its description.
    const onBoot = ({ app, renderDetail }) => {
      if (!manifest) return;
      fetch('./data/mmdm/catalog-prose.json')
        .then(r => (r.ok ? r.json() : null))
        .then(proseMap => {
          if (!proseMap) return;
          const attached = enrichCatalogProse(manifest, proseMap);
          if (attached && typeof renderDetail === 'function') {
            const current = app?.nav?.getCurrent?.();
            if (current) renderDetail(current);
          }
        })
        .catch(() => { /* prose is an enhancement; boot never depends on it */ });
    };
    const navStack = []; // stack of snapshots for multi-level IN/OUT
    // THE ONE ROAD HOME (Howell 2026-07-24): the globe always delivers the
    // same unique ring — the world's makers, cousins-flat, alphabetical,
    // gapless (the volume's sanctioned exception to cousin-gap grammar),
    // seated at the data-declared boot star. It appears at boot and by this
    // road only.
    const goHome = (app) => {
      const home = manifest?.MMdM?.display_config?.focus_ring_startup?.initial_magnified_item || null;
      const chain = buildCatalogManufacturers(manifest, { initialItemId: home, dataStampLetters: ['M', 'B', 'C'] });
      catalogMode = 'manufacturer';
      navStack.length = 0;
      if (app?.setPrimaryItems) {
        // The homecoming choreography: stars pour onto their world seats,
        // the rest of the world arrives, the departing ring falls away.
        (app.migrateInGathered || app.migrateIn || app.setPrimaryItems)(chain.items, chain.selectedIndex, chain.preserveOrder ?? false);
      }
      if (app?.setParentButtons) app.setParentButtons({ showOuter: true });
      // The rebuilt chain carries placeholder data stamps — ask the host to
      // resolve them again (cached versions apply instantly; see main.js).
      if (typeof app?.refreshDataStamps === 'function') app.refreshDataStamps();
      return true;
    };
    // The scoped makers ring is recognizable by pure state: child mode with
    // an EMPTY stack (the only descent that plants no breadcrumb is the one
    // out of the countries index). Its parent seat wears the globe.
    const atScopedRoot = () => catalogMode === 'child' && navStack.length === 0;
    const parentHandler = ({ app }) => {
      // THE COUNTRIES RING (Howell 2026-07-23, 5b). From the world chain's
      // top, OUT ascends to the index layer: the magnified maker's country
      // rises into the lens, the countries pour in as its siblings, and the
      // parent seat becomes the globe. From the countries ring, the globe
      // pours the whole world chain back — every road out of the index
      // leads down into content.
      if (catalogMode === 'countries' || atScopedRoot()) return goHome(app);
      if (catalogMode === 'manufacturer') {
        const current = app?.nav?.getCurrent?.();
        const parts = typeof current?.id === 'string' ? current.id.split('__') : [];
        const countryKey = parts.length >= 2 ? parts[1] : null;
        if (!countryKey) return true; // no country context (stamp in lens): swallow
        const chain = buildCatalogCountries(manifest, { initialItemId: countryKey });
        catalogMode = 'countries';
        if (app?.setPrimaryItems) {
          // The kinship sort: siblings fold into the starfield, cousins
          // fall away, the country rises into the lens.
          (app.migrateOutFiltered || app.migrateOut || app.setPrimaryItems)(chain.items, chain.selectedIndex, true);
        }
        if (app?.setParentButtons) app.setParentButtons({ showOuter: true });
        return true;
      }
      if (navStack.length === 0) return false;
      const snapshot = navStack.pop();
      // The mode is what the RESTORED RING IS, not how deep the stack was
      // (Howell 2026-07-23: popping back to the countries ring with an empty
      // stack claimed 'manufacturer' — no globe, no label, dead seat).
      const restoredSel = snapshot?.items?.[snapshot.selectedIndex];
      const restoredLevel = restoredSel?.level
        || (typeof restoredSel?.id === 'string' && restoredSel.id.includes('__') ? 'manufacturer' : null);
      catalogMode = restoredLevel === 'country'
        ? 'countries'
        : (navStack.length === 0 ? 'manufacturer' : 'child');
      if (app?.setPrimaryItems) {
        const { items, selectedIndex, preserveOrder } = snapshot;
        // Use migrateOut for animated transition when available; fall back to instant swap.
        const migrateOrSet = app.migrateOut || app.setPrimaryItems;
        migrateOrSet(items || [], selectedIndex ?? 0, preserveOrder ?? false);
      }
      // After the migration starts — an earlier call renders the post-ascent
      // parent state in full view before anything is hidden.
      // At manufacturer level (navStack empty), parent button must stay visible
      // for the country label / shiftLayersOut default behaviour
      if (app?.setParentButtons) app.setParentButtons({ showOuter: true });
      return true;
    };
    // Build the parent button label from the navStack history.
    // depth 0 (manufacturers on ring): label = country name from selected item's compound id
    // depth 1 (cylinders on ring):     label = manufacturer name
    // depth 2+ (family/model on ring): label = "MANUFACTURER N CIL" (frozen)
    // LEVEL-AWARE labels (Howell 2026-07-23): the old depth arithmetic
    // assumed the stack always began at the world's makers — the countries
    // layer at the stack's base shifted every floor ("ITALIA FIAT CIL" at a
    // cylinder ring). Now the stack's SELECTED ITEMS say what they are, and
    // the label reads from what actually stands there. Works for both ring
    // flavors: world chain and country-scoped.
    const getParentLabel = (item) => {
      // On the countries ring the parent seat is the GLOBE — no words.
      if (catalogMode === 'countries') return '';
      if (navStack.length === 0) {
        // World makers ring, no stack — parent label is the passing
        // country, parsed from the compound id "market__country__manu".
        if (!item) return '';
        const id = typeof item.id === 'string' ? item.id : '';
        if (id.includes('__')) {
          const parts = id.split('__');
          if (parts.length >= 2) return parts[1].toUpperCase();
        }
        return '';
      }
      const levelOf = it => it?.level
        || (typeof it?.id === 'string' && it.id.includes('__') ? 'manufacturer' : null);
      const selections = navStack
        .map(s => s?.items?.[s.selectedIndex])
        .filter(Boolean);
      const tail = selections[selections.length - 1] || null;
      const tailLevel = levelOf(tail);
      // One floor down from a country or a maker: the container's own name.
      if (tailLevel === 'country' || tailLevel === 'manufacturer') {
        return (tail.name || '').toUpperCase();
      }
      // Deeper (cylinder ring and beyond): the frozen "MAKER N CIL".
      let maker = null;
      let cyl = null;
      for (const it of selections) {
        const lvl = levelOf(it);
        if (lvl === 'manufacturer') maker = it;
        else if (lvl === 'cylinder') cyl = it;
      }
      const makerName = (maker?.name || '').toUpperCase();
      const cylName = cyl?.name || '';
      return cylName ? `${makerName} ${cylName} CIL` : makerName;
    };

    return {
      onBoot,
      parentHandler,
      childrenHandler: () => false,
      getParentLabel,
      // The vessel shows at every level, the top included (Howell
      // 2026-07-23): the country's disc is about to become the ascent into
      // the countries ring (5b) — it stays present now rather than blinking
      // out for an interim build. The disc-iff-actionable plumbing remains
      // for any future context-only seat.
      getParentActionable: () => true,
      // The globe — the one road home — sits in the parent seat wherever
      // home is elsewhere: the countries index AND the country-scoped
      // makers ring (Howell 2026-07-24). At home it never shows: you don't
      // show the home button when you're home.
      getParentIcon: () => (catalogMode === 'countries' || atScopedRoot() ? 'world' : null),
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
