import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import assert from 'assert/strict';
import { describe, it } from 'node:test';
import Ajv from 'ajv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const loadJson = relativePath => JSON.parse(readFileSync(resolve(__dirname, relativePath), 'utf-8'));

const schemas = {
  calendar: loadJson('../schemas/calendar.schema.json'),
  places: loadJson('../schemas/places.schema.json'),
  gutenberg: loadJson('../schemas/gutenberg.schema.json'),
  mmdm: loadJson('../schemas/mmdm.schema.json')
};

const manifests = {
  calendar: loadJson('../data/calendar/manifest.json'),
  places: loadJson('../data/places/manifest.json'),
  gutenberg: loadJson('../data/gutenberg/manifest.json'),
  mmdm: loadJson('../data/mmdm/mmdm_catalog.json')
};

describe('manifest schema validation', () => {
  for (const [name, schema] of Object.entries(schemas)) {
    it(`${name} manifest matches schema`, () => {
      const ajv = new Ajv({ allErrors: true, strict: false });
      const validate = ajv.compile(schema);
      const data = manifests[name];
      const ok = validate(data);
      if (!ok) {
        const message = (validate.errors || []).map(err => `${err.instancePath} ${err.message}`).join('; ');
        assert.fail(`Schema validation failed for ${name}: ${message}`);
      }
    });
  }
});
