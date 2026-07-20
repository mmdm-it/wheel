import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createApp, getViewportInfo } from '../src/index.js';
import { createMockElement, createMockDocument } from './helpers/mock-dom.js';
import { CardDetailPlugin } from '../src/view/detail/plugins/card-plugin.js';
import { isDetailLevel } from '../src/view/detail/detail-level.js';
import { buildBibleVerseChain } from '../src/navigation/cousin-builder.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The detail sector reads the SETTLED selection and holds stale until the
// ring comes to rest (Howell 2026-07-20). Scrubbing never disturbed it —
// the navigation model does not move under a dragging thumb — but a CLICK
// used to commit its destination the instant it was asked to travel, so
// the panel described a date that had not reached the lens yet.

const withMockDom = fn => {
  const originalDocument = globalThis.document;
  const originalRaf = globalThis.requestAnimationFrame;
  const originalCancel = globalThis.cancelAnimationFrame;
  const frames = [];
  globalThis.document = createMockDocument();
  globalThis.requestAnimationFrame = cb => frames.push(cb);
  globalThis.cancelAnimationFrame = () => { frames.length = 0; };
  try {
    // `settle` runs the queued frames far enough past the deadline that the
    // journey finishes, exactly as a real ring arrives.
    return fn({ frames, settle: () => {
      let guard = 0;
      while (frames.length && guard++ < 100) frames.shift()(performance.now() + 1e6);
    } });
  } finally {
    globalThis.document = originalDocument;
    globalThis.requestAnimationFrame = originalRaf;
    globalThis.cancelAnimationFrame = originalCancel;
  }
};

const ringNodes = svgRoot => {
  const out = [];
  const walk = el => { out.push(el); (el.children || []).forEach(walk); };
  walk(svgRoot);
  return out.filter(e => e.attrs?.class === 'focus-ring-node' && typeof e.onclick === 'function');
};

describe('detail sector holds stale until the ring settles', () => {
  const items = Array.from({ length: 9 }, (_, i) => ({
    id: `i${i}`, name: `ITEM ${i}`, order: i, level: 'day'
  }));

  it('a click commits its destination on ARRIVAL, not on the tap', () => {
    withMockDom(({ settle }) => {
      const svgRoot = createMockElement('svg');
      const app = createApp({ svgRoot, items, viewport: getViewportInfo(375, 700) });
      const started = app.nav.getCurrent();

      const target = ringNodes(svgRoot).find(n => n.attrs['aria-label'] !== started.name);
      assert.ok(target, 'a ring node other than the magnified one');
      target.onclick();

      assert.equal(app.nav.getCurrent(), started,
        'the selection has not moved while the ring is still turning');

      settle();
      assert.equal(app.nav.getCurrent().name, target.attrs['aria-label'],
        'and commits once the ring arrives');
    });
  });

  it('a redirected click never commits the journey it abandoned', () => {
    withMockDom(({ settle }) => {
      const svgRoot = createMockElement('svg');
      const app = createApp({ svgRoot, items, viewport: getViewportInfo(375, 700) });
      const started = app.nav.getCurrent();
      const candidates = ringNodes(svgRoot).filter(n => n.attrs['aria-label'] !== started.name);
      assert.ok(candidates.length >= 2, 'two other nodes to aim at');

      candidates[0].onclick();          // set off toward the first...
      candidates[1].onclick();          // ...then change your mind
      settle();

      assert.equal(app.nav.getCurrent().name, candidates[1].attrs['aria-label'],
        'only the journey actually completed commits');
    });
  });

  it('reduced motion still arrives — the commit is not lost with the animation', () => {
    withMockDom(() => {
      const svgRoot = createMockElement('svg');
      const app = createApp({
        svgRoot, items, viewport: getViewportInfo(375, 700),
        contextOptions: { reducedMotion: true }
      });
      const started = app.nav.getCurrent();
      const target = ringNodes(svgRoot).find(n => n.attrs['aria-label'] !== started.name);
      target.onclick();
      assert.equal(app.nav.getCurrent().name, target.attrs['aria-label'],
        'no animation to wait for, so arrival is immediate');
    });
  });
});

describe('the sector lets go of the level above', () => {
  const walkAll = (el, out = []) => { out.push(el); (el.children || []).forEach(c => walkAll(c, out)); return out; };
  const pyramidNodes = root => walkAll(root).filter(e => e.attrs?.class === 'child-pyramid-node');

  it('ascending out of a leaf gives the pyramid straight back', () => {
    // Howell's repro, 2026-07-20: enter the day ring (the sector opens on
    // the leaf), then press the parent button — and the level above came
    // back EMPTY, its pyramid suppressed by a sector that should have
    // closed, until some later tap forced another render.
    //
    // Cause: the one-render collapse freeze armed at expansion was only
    // ever disarmed inside the collapse branch, which a leaf render never
    // reaches. It stayed armed and ate the first real collapse — the
    // ascent itself.
    withMockDom(({ settle }) => {
      const svgRoot = createMockElement('svg');
      const app = createApp({
        svgRoot,
        items: [{ id: 'd1', name: '1', order: 0, level: 'day' },
                { id: 'd2', name: '2', order: 1, level: 'day' }],
        viewport: getViewportInfo(375, 700),
        pyramidNormalized: { meta: { leafLevel: 'day' } },
        pyramid: {
          getChildren: ({ selected }) => (selected?.level === 'month'
            ? [{ id: 'c1', name: 'C1' }, { id: 'c2', name: 'C2' }]
            : [])
        }
      });
      settle(); // the sector expands on the leaf
      assert.equal(pyramidNodes(svgRoot).length, 0, 'no pyramid under an open sector');

      // The ascent.
      app.setPrimaryItems([{ id: 'jul', name: 'JULY', order: 0, level: 'month' },
                           { id: 'aug', name: 'AUGUST', order: 1, level: 'month' }], 1, true);
      settle();

      assert.ok(pyramidNodes(svgRoot).length > 0,
        'the level above draws its pyramid immediately — no stray tap required');
    });
  });
});

describe('only the leaf is described in the detail sector', () => {
  const volume = { meta: { leafLevel: 'day' } };

  it('describes the leaf and nothing above it', () => {
    assert.equal(isDetailLevel({ id: 'd', level: 'day' }, volume), true);
    assert.equal(isDetailLevel({ id: 'm', level: 'month' }, volume), false,
      'the level above owns no payload — painting one flashes it into a closing panel');
    assert.equal(isDetailLevel({ id: 'y', level: 'year' }, volume), false);
    assert.equal(isDetailLevel(null, volume), false, 'a gap under the magnifier describes nothing');
  });

  it('makes no claim when a volume names no leaf', () => {
    assert.equal(isDetailLevel({ id: 'x', level: 'whatever' }, { meta: {} }), true);
    assert.equal(isDetailLevel({ id: 'x', level: 'whatever' }, null), true);
  });

  it('still admits a synthetic leaf built outside the ring', () => {
    // The featured-item boot path hands over an item it constructed itself;
    // it is at the leaf level, so it must pass.
    assert.equal(isDetailLevel({ id: 'b_1_1', level: 'verse' }, { meta: { leafLevel: 'verse' } }), true);
  });
});

describe('the detail sector as a NEXT button', () => {
  // A chain as the ring really holds one: real links with cousin GAPS at
  // the boundaries (2 at a month crossing, more at a year).
  const chain = [
    { id: 'a', name: 'A', order: 0, level: 'day' },
    { id: 'b', name: 'B', order: 1, level: 'day' },
    null, null,                                        // a boundary
    { id: 'c', name: 'C', order: 4, level: 'day' },
    { id: 'd', name: 'D', order: 5, level: 'day' }
  ];
  const leafApp = ({ settle }, opts = {}) => createApp({
    svgRoot: createMockElement('svg'),
    items: chain,
    viewport: getViewportInfo(375, 700),
    pyramidNormalized: { meta: { leafLevel: 'day' } },
    detailTapAdvances: true,
    ...opts
  });

  it('steps OVER empty links instead of landing on one', () => {
    withMockDom(harness => {
      const app = leafApp(harness);
      harness.settle();
      assert.equal(app.nav.getCurrent().id, 'a');

      app.advanceLeaf(); harness.settle();
      assert.equal(app.nav.getCurrent().id, 'b');

      // The next link is a gap, and so is the one after it. One tap must
      // still land on a real day — an empty magnifier is not a page.
      app.advanceLeaf(); harness.settle();
      assert.equal(app.nav.getCurrent().id, 'c', 'one tap crosses the boundary');
    });
  });

  it('accumulates taps made while the ring is still travelling', () => {
    withMockDom(harness => {
      const app = leafApp(harness);
      harness.settle();
      // Three thumb taps in quick succession, none waiting for the ring.
      app.advanceLeaf();
      app.advanceLeaf();
      app.advanceLeaf();
      harness.settle();
      assert.equal(app.nav.getCurrent().id, 'd',
        'three taps advance three leaves — each reckons from where the ring is headed');
    });
  });

  it('stops silently at the end of the chain', () => {
    withMockDom(harness => {
      const app = leafApp(harness);
      harness.settle();
      for (let i = 0; i < 10; i += 1) { app.advanceLeaf(); harness.settle(); }
      assert.equal(app.nav.getCurrent().id, 'd', 'the last link is the last word');
      assert.equal(app.advanceLeaf(), false, 'and says so');
    });
  });

  it('offers no NEXT area to a volume that has not asked for one', () => {
    withMockDom(harness => {
      const app = leafApp(harness, { detailTapAdvances: false });
      harness.settle();
      assert.equal(app.detailAreaAdvances(10, 300), false,
        'the catalog keeps its sector inert');
    });
  });

  it('keeps the ring and the control deck out of the NEXT area', () => {
    withMockDom(harness => {
      const app = leafApp(harness);
      harness.settle();
      const vp = getViewportInfo(375, 700);
      // Deep in the display region: live.
      assert.equal(app.detailAreaAdvances(vp.width * 0.2, vp.SSd * 0.3), true);
      // The control deck, where the magnifier and parent button live.
      assert.equal(app.detailAreaAdvances(vp.width * 0.2, vp.height - 10), false,
        'the deck belongs to its own controls');
      // Off the right edge, past the fence.
      assert.equal(app.detailAreaAdvances(vp.width + 20, vp.SSd * 0.3), false);
    });
  });
});

describe('the e-reader, end to end', () => {
  const bibleManifest = JSON.parse(readFileSync(
    path.resolve(__dirname, '../data/gutenberg/manifest.json'), 'utf-8'));

  it('taps straight out of one chapter and into the next', () => {
    // Howell's report: "when I get to the end of Genesis chapter one, I
    // have to back out to go into chapter two." Now the thumb carries on.
    const { items } = buildBibleVerseChain(bibleManifest, {});
    const start = items.findIndex(v => v && v.id === 'GENE_1_29');
    withMockDom(harness => {
      const app = createApp({
        svgRoot: createMockElement('svg'),
        items,
        selectedIndex: start,
        preserveOrder: true,
        viewport: getViewportInfo(375, 700),
        pyramidNormalized: { meta: { leafLevel: 'verse' } },
        detailTapAdvances: true
      });
      harness.settle();
      assert.equal(app.nav.getCurrent().id, 'GENE_1_29');

      const read = () => { app.advanceLeaf(); harness.settle(); return app.nav.getCurrent().id; };
      assert.equal(read(), 'GENE_1_30');
      assert.equal(read(), 'GENE_1_31', 'the last verse of the chapter');
      assert.equal(read(), 'GENE_2_1', 'and one more tap simply keeps reading');
      assert.equal(read(), 'GENE_2_2');
    });
  });

  it('carries the reader across a book boundary too', () => {
    const { items } = buildBibleVerseChain(bibleManifest, {});
    const lastOfGenesis = items.filter(Boolean).filter(v => v.meta.bookId === 'GENE').pop();
    const start = items.findIndex(v => v && v.id === lastOfGenesis.id);
    withMockDom(harness => {
      const app = createApp({
        svgRoot: createMockElement('svg'),
        items,
        selectedIndex: start,
        preserveOrder: true,
        viewport: getViewportInfo(375, 700),
        pyramidNormalized: { meta: { leafLevel: 'verse' } },
        detailTapAdvances: true
      });
      harness.settle();
      app.advanceLeaf();
      harness.settle();
      assert.equal(app.nav.getCurrent().id, 'EXO_1_1',
        'four empty links crossed in a single tap');
    });
  });
});

describe('a card title may sit on the viewport centre line', () => {
  const bounds = {
    width: 375,
    SSd: 375,
    lineTable: Array.from({ length: 12 }, (_, i) => ({
      y: 40 + i * 16, leftX: 20 + i, availableWidth: 300 - i, maxChars: 30
    }))
  };
  const render = item => new CardDetailPlugin()
    .render(item, bounds, { createElement: tag => createMockElement(tag) });
  const titleOf = node => node.children.find(c => (c.className || '').includes('detail-card-title'));

  it('centers on the full viewport width when asked', () => {
    const title = titleOf(render({ type: 'card', title: 'MONDAY', body: '', titleAlign: 'center' }));
    assert.ok(title, 'title rendered');
    assert.equal(title.style.textAlign, 'center');
    assert.equal(title.style.left, '0px', 'not indented to the arc');
    assert.equal(title.style.width, '375px', 'spans the viewport, so centre is the screen centre');
  });

  it('leaves every other card indented to the arc as before', () => {
    const title = titleOf(render({ type: 'card', title: 'January', body: '1969' }));
    assert.notEqual(title.style.textAlign, 'center');
    assert.equal(title.style.left, '20px', 'still follows the line table');
  });
});
