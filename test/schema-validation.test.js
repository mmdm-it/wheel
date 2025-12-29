import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import { createSchemaService } from '../src/validation/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const loadJson = relativePath => JSON.parse(readFileSync(resolve(__dirname, relativePath), 'utf-8'));

const schemaEntries = [
  { id: 'calendar', schema: loadJson('../schemas/calendar.schema.json') },
  { id: 'places', schema: loadJson('../schemas/places.schema.json') },
  { id: 'gutenberg', schema: loadJson('../schemas/gutenberg.schema.json') },
  { id: 'mmdm', schema: loadJson('../schemas/mmdm.schema.json') }
];

const manifests = {
  calendar: loadJson('../data/calendar/manifest.json'),
  places: loadJson('../data/places/manifest.json'),
  gutenberg: loadJson('../data/gutenberg/manifest.json'),
  mmdm: loadJson('../data/mmdm/mmdm_catalog.json')
};

const formatErrors = errors => (errors || [])
  .map(err => {
    const path = err.instancePath || err.schemaPath || '';
    const msg = err.message || JSON.stringify(err);
    return `${path} ${msg}`.trim();
  })
  .join('; ');

describe('manifest schema validation (registry)', () => {
  const { validator, registerSchemas } = createSchemaService();
  registerSchemas(schemaEntries);

  for (const { id } of schemaEntries) {
    it(`${id} manifest matches schema`, () => {
      const data = manifests[id];
      const result = validator.validate(id, data);
      if (!result.ok) {
        assert.fail(`Schema validation failed for ${id}: ${formatErrors(result.errors)}`);
      }
    });
  }

  it('gutenberg manifest uses languages (not translations) for the language portal', () => {
    const cfg = manifests.gutenberg?.Gutenberg_Bible?.display_config;
    assert.ok(cfg, 'display_config missing');
    assert.ok(cfg.languages, 'display_config.languages missing');
    assert.ok(!cfg.translations, 'display_config.translations should be renamed to languages');
    assert.ok(Array.isArray(cfg.languages.available) && cfg.languages.available.length > 0, 'languages.available missing or empty');
    assert.ok(typeof cfg.languages.default === 'string', 'languages.default missing');
    assert.ok(cfg.languages.labels && typeof cfg.languages.labels === 'object', 'languages.labels missing');
  });

  it('gutenberg manifest declares edition registry for tertiary portal', () => {
    const cfg = manifests.gutenberg?.Gutenberg_Bible?.display_config;
    assert.ok(cfg, 'display_config missing');
    const ed = cfg.editions;
    assert.ok(ed, 'display_config.editions missing');
    assert.equal(ed.registry, 'data/gutenberg/translations.json', 'editions.registry should point to translations registry');
    assert.ok(ed.available && typeof ed.available === 'object', 'editions.available missing');
    assert.ok(ed.default && typeof ed.default === 'object', 'editions.default missing');
    assert.ok(ed.labels && typeof ed.labels === 'object', 'editions.labels missing');

    const languages = Array.isArray(cfg.languages?.available) ? cfg.languages.available : [];
    assert.ok(languages.length > 0, 'languages.available missing or empty');

    for (const lang of languages) {
      const avail = ed.available?.[lang];
      assert.ok(Array.isArray(avail) && avail.length > 0, `editions.available missing for language ${lang}`);
      assert.ok(typeof ed.default?.[lang] === 'string', `editions.default missing for language ${lang}`);
    }

    for (const [editionId, label] of Object.entries(ed.labels)) {
      assert.equal(typeof label, 'string', `label for edition ${editionId} missing`);
    }
  });
});
