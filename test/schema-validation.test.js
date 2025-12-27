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
});
