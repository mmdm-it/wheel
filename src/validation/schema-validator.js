import Ajv from 'ajv';

// Creates a validator bound to a registry; stays agnostic to schema contents.
export function createSchemaValidator(registry, ajvOptions = {}) {
  if (!registry || typeof registry.get !== 'function') {
    throw new Error('createSchemaValidator requires a registry with get(id)');
  }
  const ajv = new Ajv({ allErrors: true, strict: false, ...ajvOptions });
  const compiled = new Map();

  const getValidator = id => {
    if (compiled.has(id)) return compiled.get(id);
    const schema = registry.get(id);
    if (!schema) return null;
    const validator = ajv.compile(schema);
    compiled.set(id, validator);
    return validator;
  };

  const validate = (schemaId, data) => {
    const validator = getValidator(schemaId);
    if (!validator) {
      return { ok: false, errors: [`schema '${schemaId}' not found`] };
    }
    const ok = validator(data);
    return { ok, errors: ok ? [] : (validator.errors || []) };
  };

  return { validate };
}
