// Detail Sector plugin registry for v4 adapters.
// Manages plugin instances and selects a handler per item type.

export class DetailPluginRegistry {
  constructor() {
    this.plugins = [];
    this.cache = new Map();
  }

  register(plugin) {
    if (!plugin || typeof plugin.canHandle !== 'function' || typeof plugin.render !== 'function') {
      throw new Error('DetailPluginRegistry.register: plugin must implement canHandle and render');
    }
    this.plugins.push(plugin);
    this.cache.clear();
  }

  unregister(pluginName) {
    if (!pluginName) return;
    this.plugins = this.plugins.filter(p => (p.getMetadata?.().name ?? p.name) !== pluginName);
    this.cache.clear();
  }

  getPlugin(item) {
    if (!item || !item.type) return null;
    if (this.cache.has(item.type)) return this.cache.get(item.type);
    const match = this.plugins.find(p => {
      try {
        return p.canHandle(item);
      } catch {
        return false;
      }
    }) || null;
    if (match) this.cache.set(item.type, match);
    return match;
  }

  list() {
    return this.plugins.map(p => (p.getMetadata?.() ?? { name: p.name ?? 'unknown', version: '0.0.0' }));
  }
}

export class BaseDetailPlugin {
  canHandle() {
    throw new Error('BaseDetailPlugin.canHandle must be implemented');
  }

  render() {
    throw new Error('BaseDetailPlugin.render must be implemented');
  }

  onResize() {}
  cleanup() {}
  getMetadata() {
    return { name: this.constructor.name || 'DetailPlugin', version: '0.0.0' };
  }
}
