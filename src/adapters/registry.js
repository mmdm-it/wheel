// Adapter registry with no volume-specific logic.
// Adapters are registered by id (string) and resolved on demand.

export function createAdapterRegistry() {
  const adapters = new Map();

  const register = (id, adapterFactory) => {
    if (!id || typeof id !== 'string') {
      throw new Error('adapter id must be a non-empty string');
    }
    if (typeof adapterFactory !== 'function') {
      throw new Error('adapter factory must be a function');
    }
    adapters.set(id, adapterFactory);
    return () => adapters.delete(id);
  };

  const resolve = id => adapters.get(id) || null;

  const list = () => Array.from(adapters.keys());

  const clear = () => adapters.clear();

  return { register, resolve, list, clear };
}

export function createAdapterLoader(registry) {
  if (!registry || typeof registry.resolve !== 'function') {
    throw new Error('createAdapterLoader requires a registry with resolve(id)');
  }
  return {
    load: id => {
      const factory = registry.resolve(id);
      if (!factory) return null;
      return factory();
    }
  };
}