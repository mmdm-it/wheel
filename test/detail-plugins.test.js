import assert from 'assert/strict';
import { describe, it } from 'node:test';
import { DetailPluginRegistry } from '../src/view/detail/plugin-registry.js';
import { TextDetailPlugin } from '../src/view/detail/plugins/text-plugin.js';
import { CardDetailPlugin } from '../src/view/detail/plugins/card-plugin.js';
import { computeDetailSectorBounds } from '../src/geometry/detail-sector-geometry.js';

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

  // THE SECTOR SAYS HOW MANY SCREENS IT DREW (Howell, 2026-09-14, Esther
  // 8:9 "appears to be truncated"): the host reads data-parts off the
  // rendered verse and holds the ring's cached count to it.
  it('a uniform verse carries the part count it was laid out in', () => {
    const plugin = new TextDetailPlugin();
    const mk = tag => {
      const el = { tag, className: '', textContent: '', style: {}, dataset: {}, children: [], attrs: {},
        appendChild(c) { this.children.push(c); }, setAttribute(k, v) { this.attrs[k] = v; },
        querySelector() { return null; } };
      return el;
    };
    const bounds = computeDetailSectorBounds(412, 915, null, null);
    const short = plugin.render({ type: 'text', text: 'In the beginning God created heaven, and earth.', uniform: true }, bounds, { createElement: mk });
    assert.equal(short.dataset.parts, '1');
    const long = plugin.render({ type: 'text', text: Array.from({ length: 60 }, (_, i) => `word${i} and more words of a very long verse that cannot fit`).join(' '), uniform: true }, bounds, { createElement: mk });
    assert.equal(long.dataset.parts, '2', 'two screens, never more (O-84)');
  });

  it('A LONG VERSE IS NEVER CUT: two screens, the size stepped down if it must, every word set', () => {
    const plugin = new TextDetailPlugin();
    const mk = tag => ({ tag, className: '', textContent: '', style: {}, dataset: {}, children: [], attrs: {},
      appendChild(c) { this.children.push(c); }, setAttribute(k, v) { this.attrs[k] = v; }, querySelector() { return null; } });
    const bounds = computeDetailSectorBounds(412, 915, null, null);
    const words = Array.from({ length: 140 }, (_, i) => `w${i}`);
    const text = words.join(' ');
    const seen = [];
    for (const part of [0, 1]) {
      const node = plugin.render({ type: 'text', text, uniform: true, part }, bounds, { createElement: mk });
      assert.equal(node.dataset.parts, '2');
      const lines = node.children.map(c => c.textContent || c.children?.map(x => x.textContent).join('') || '');
      seen.push(...lines.join(' ').split(/\s+/).filter(Boolean));
    }
    assert.deepEqual(seen, words, 'both halves together carry every word, in order');
  });
});
