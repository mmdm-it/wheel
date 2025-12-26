import assert from 'assert/strict';
import { describe, it } from 'node:test';
import { DetailPluginRegistry } from '../src/view/detail/plugin-registry.js';
import { TextDetailPlugin } from '../src/view/detail/plugins/text-plugin.js';
import { CardDetailPlugin } from '../src/view/detail/plugins/card-plugin.js';

const mkFactory = () => {
  return tag => {
    const style = {};
    const el = {
      tag,
      className: '',
      textContent: '',
      style,
      children: [],
      appendChild(child) {
        this.children.push(child);
      },
      querySelector(selector) {
        const cls = selector.replace('.', '');
        return this.children.find(c => c.className === cls) || null;
      }
    };
    return el;
  };
};

describe('detail plugins', () => {
  it('renders text plugin', () => {
    const registry = new DetailPluginRegistry();
    const createElement = mkFactory();
    registry.register(new TextDetailPlugin());
    const plugin = registry.getPlugin({ type: 'text', text: 'hello' });
    const node = plugin.render({ type: 'text', text: 'hello' }, { width: 200, height: 100 }, { createElement });
    assert.equal(node.textContent, 'hello');
    assert.equal(node.style.maxWidth, '200px');
  });

  it('renders card plugin with optional image', () => {
    const registry = new DetailPluginRegistry();
    const createElement = mkFactory();
    registry.register(new CardDetailPlugin());
    const plugin = registry.getPlugin({ type: 'card', title: 'T', body: 'B', image: 'x.png' });
    const node = plugin.render({ type: 'card', title: 'T', body: 'B', image: 'x.png' }, { width: 300 }, { createElement });
    const titleEl = node.querySelector('.detail-card-title');
    const bodyEl = node.querySelector('.detail-card-body');
    const imgEl = node.children.find(c => c.tag === 'img');
    assert.equal(titleEl.textContent, 'T');
    assert.equal(bodyEl.textContent, 'B');
    assert.ok(imgEl);
  });
});
