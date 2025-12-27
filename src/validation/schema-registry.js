// Lightweight schema registry with no domain assumptions.
export function createSchemaRegistry() {
  const schemas = new Map();

  const register = (id, schema) => {
    if (!id || typeof id !== 'string') {
      throw new Error('Schema id must be a non-empty string');
    }
    if (!schema || typeof schema !== 'object') {
      throw new Error('Schema must be an object');
    }
    schemas.set(id, schema);
    return () => schemas.delete(id);
  };

  const get = id => schemas.get(id) || null;

  const list = () => Array.from(schemas.keys());

  const clear = () => schemas.clear();

  return { register, get, list, clear };
}
