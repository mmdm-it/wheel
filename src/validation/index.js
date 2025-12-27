import { createSchemaRegistry } from './schema-registry.js';
import { createSchemaValidator } from './schema-validator.js';

// Factory for an agnostic schema validation service.
export function createSchemaService({ ajvOptions } = {}) {
  const registry = createSchemaRegistry();
  const validator = createSchemaValidator(registry, ajvOptions);

  const registerSchemas = entries => {
    if (!Array.isArray(entries)) return registry.list();
    entries.forEach(({ id, schema }) => {
      if (id && schema) registry.register(id, schema);
    });
    return registry.list();
  };

  return { registry, validator, registerSchemas };
}
