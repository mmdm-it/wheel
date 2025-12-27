import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createSchemaRegistry } from '../src/validation/schema-registry.js';
import { createSchemaValidator } from '../src/validation/schema-validator.js';
import placeholderSchema from '../schemas/placeholder.schema.json' assert { type: 'json' };

describe('schema harness (agnostic)', () => {
  it('validates data against a registered schema', () => {
    const registry = createSchemaRegistry();
    registry.register('placeholder', placeholderSchema);
    const validator = createSchemaValidator(registry);

    const manifest = { id: 'demo', name: 'demo', items: [{ foo: 'bar' }] };
    const result = validator.validate('placeholder', manifest);
    assert.equal(result.ok, true);
    assert.deepEqual(result.errors, []);
  });

  it('reports missing schema IDs gracefully', () => {
    const registry = createSchemaRegistry();
    const validator = createSchemaValidator(registry);
    const manifest = { id: 'demo' };
    const result = validator.validate('missing', manifest);
    assert.equal(result.ok, false);
    assert.ok(Array.isArray(result.errors));
    assert.ok(String(result.errors[0]).includes('schema'));
  });

  it('surfaces validation errors', () => {
    const registry = createSchemaRegistry();
    registry.register('placeholder', placeholderSchema);
    const validator = createSchemaValidator(registry);
    const manifest = { name: 'no-id' }; // missing required id
    const result = validator.validate('placeholder', manifest);
    assert.equal(result.ok, false);
    assert.ok(result.errors.length > 0);
  });
});
