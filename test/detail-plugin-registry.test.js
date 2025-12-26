import assert from 'assert/strict';
import { describe, it } from 'node:test';
import { DetailPluginRegistry, BaseDetailPlugin } from '../src/view/detail/plugin-registry.js';

class TextPlugin extends BaseDetailPlugin {
  canHandle(item) {
    return item?.type === 'text';
  }
  render(item) {
    return { rendered: item.id };
  }
  getMetadata() {
    return { name: 'TextPlugin', version: '1.0.0', contentTypes: ['text'] };
  }
}

class CardPlugin extends BaseDetailPlugin {
  canHandle(item) {
    return item?.type === 'card';
  }
  render(item) {
    return { card: item.id };
  }
  getMetadata() {
    return { name: 'CardPlugin', version: '1.0.0', contentTypes: ['card'] };
  }
}

describe('DetailPluginRegistry', () => {
  it('registers and retrieves plugins by item type', () => {
    const registry = new DetailPluginRegistry();
    const text = new TextPlugin();
    const card = new CardPlugin();
    registry.register(text);
    registry.register(card);

    const plugin = registry.getPlugin({ type: 'text', id: 'a' });
    assert.equal(plugin, text);

    const second = registry.getPlugin({ type: 'card', id: 'b' });
    assert.equal(second, card);
  });

  it('caches plugin lookups per type', () => {
    const registry = new DetailPluginRegistry();
    const text = new TextPlugin();
    registry.register(text);

    const first = registry.getPlugin({ type: 'text', id: 'x' });
    const cached = registry.getPlugin({ type: 'text', id: 'y' });
    assert.equal(first, cached);
  });

  it('unregisters by plugin name', () => {
    const registry = new DetailPluginRegistry();
    const text = new TextPlugin();
    registry.register(text);
    assert.equal(registry.getPlugin({ type: 'text', id: 'x' }), text);

    registry.unregister('TextPlugin');
    assert.equal(registry.getPlugin({ type: 'text', id: 'x' }), null);
  });

  it('lists plugin metadata', () => {
    const registry = new DetailPluginRegistry();
    registry.register(new TextPlugin());
    const list = registry.list();
    assert.ok(Array.isArray(list));
    assert.equal(list[0].name, 'TextPlugin');
  });
});
