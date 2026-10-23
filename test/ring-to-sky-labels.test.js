import assert from 'node:assert/strict';
import { describe, it, before, after } from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMockElement, createMockDocument } from './helpers/mock-dom.js';
import { animateRingToSky } from '../src/view/migration-animation.js';

// THE NUMERAL TAKES OFF FROM WHERE IT SITS (Howell 2026-10-22, four
// photographs of a drill out of Matthew 16). A verse numeral sits ON its ring
// node; the clone that flies it to the sky seats its take-off label where the
// ring's own rule puts it — on the node, or beside it for a name — and that
// rule travels with the seat as `labelCentered`. The drill-out seats were
// built without it, so every numeral left from BESIDE its node, up and to
// the right, and a second numeral faded in on the star over the last third:
// "10 10" in the sky until the barrier.

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const texts = el => (el.children || []).flatMap(c => (c.tag === 'text' ? [c] : texts(c)));

let saved;
before(() => {
  saved = { document: globalThis.document, requestAnimationFrame: globalThis.requestAnimationFrame };
  globalThis.document = createMockDocument();
  globalThis.requestAnimationFrame = fn => setTimeout(fn, 0);
});
after(() => { globalThis.document = saved.document; globalThis.requestAnimationFrame = saved.requestAnimationFrame; });

// The clone overlay is built at once and retired at the barrier, so it is
// read the instant the flight launches; the completion is awaited only so
// the animation's own state is at rest for the next test.
const fly = async (ringNode, skyNode) => {
  const svgRoot = createMockElement('g');
  let done;
  const finished = new Promise(resolve => { done = resolve; });
  animateRingToSky({
    svgRoot, ringNodes: [ringNode], pyramidNodes: [skyNode], hubX: 900, hubY: 0, nodeRadius: 12, durationMs: 1,
    onComplete: done
  });
  const overlay = svgRoot.children[0];
  await finished;
  return overlay;
};

describe('the ring-to-sky flight seats its take-off label where the ring did', () => {
  it('a numeral on its node leaves from the node, one label, centred', async () => {
    const overlay = await fly(
      { item: { id: 'v18' }, x: 100, y: 200, angle: 1.0, label: '18', labelCentered: true },
      { item: { id: 'v18' }, x: 300, y: 400, angle: 0.5, r: 6, label: '18' });
    const labels = texts(overlay.children[0]);
    assert.equal(labels.length, 1, 'the same numeral, the same seat: no landing name to fade in');
    assert.deepEqual([labels[0].getAttribute('x'), labels[0].getAttribute('y'), labels[0].getAttribute('text-anchor')], ['100', '200', 'middle']);
    assert.equal(labels[0].textContent, '18');
  });

  it('a name beside its node leaves from beside it and lands its abbreviation on the star', async () => {
    const overlay = await fly(
      { item: { id: 'gn' }, x: 100, y: 200, angle: 1.0, label: 'Genesis', labelCentered: false },
      { item: { id: 'gn' }, x: 300, y: 400, angle: 0.5, r: 6, label: 'Gn' });
    const labels = texts(overlay.children[0]);
    assert.equal(labels.length, 2, 'the take-off name and the landing name');
    const [takeoff, landing] = labels;
    assert.equal(takeoff.textContent, 'Genesis');
    assert.equal(takeoff.getAttribute('text-anchor'), 'end', 'beside the node, as the ring seats it');
    assert.notEqual(takeoff.getAttribute('x'), '100');
    assert.equal(landing.textContent, 'Gn');
    assert.deepEqual([landing.getAttribute('x'), landing.getAttribute('y'), landing.getAttribute('text-anchor')], ['100', '200', 'middle'], 'the landing name sits on the node, in the take-off frame');
  });

  it('every ring seat the controller labels carries where that label sits', () => {
    // The seat builder for a drill out was the one that did not (O-154's
    // builder, written for speed, forgot the flag O-204 later came to need).
    const src = readFileSync(path.resolve(__dirname, '../src/index.js'), 'utf-8').split('\n');
    const missing = [];
    src.forEach((line, i) => {
      // A ring seat's item is the seat's own (`item`, `node.item`, `t.item`);
      // the sky's labels (`child`) are placed by the pyramid view and carry no seat.
      if (!/formatLabel\(\{ item(: \w+\.item)?, context: 'node'/.test(line)) return;
      const window = src.slice(i, i + 8).join('\n');
      if (!/labelCentered/.test(window)) missing.push(i + 1);
    });
    assert.deepEqual(missing, [], `ring seats labelled without labelCentered at src/index.js lines ${missing.join(', ')}`);
  });
});
