import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  applyPyramidNodeAppearance, labelRotationDeg, NOW_NODE_FILL, NOW_LABEL_FILL
} from '../src/view/node-appearance.js';
import { createApp, getViewportInfo } from '../src/index.js';
import { createMockElement, createMockDocument } from './helpers/mock-dom.js';
import { getCalendarMonths } from '../src/adapters/volume-helpers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Minimal stand-ins for the SVG elements both render paths hand over.
const stubEl = () => ({
  style: {},
  attrs: {},
  setAttribute(name, value) { this.attrs[name] = String(value); }
});

describe('pyramid node appearance', () => {
  it('dresses the present moment in its own colors', () => {
    const circle = stubEl();
    const label = stubEl();
    applyPyramidNodeAppearance({ circle, label, instr: { now: true } });
    assert.equal(circle.style.fill, NOW_NODE_FILL);
    assert.equal(label.style.fill, NOW_LABEL_FILL);
  });

  it('leaves ordinary nodes to the theme', () => {
    const circle = stubEl();
    const label = stubEl();
    applyPyramidNodeAppearance({ circle, label, instr: { labelFontPx: 14 } });
    assert.equal(circle.style.fill, undefined, 'no inline fill — the stylesheet owns it');
    assert.equal(label.style.fill, undefined);
    assert.equal(label.style.fontSize, '14px', 'absolute px, never em');
  });

  it('dims ribbon neighbors on both circle and label', () => {
    const circle = stubEl();
    const label = stubEl();
    applyPyramidNodeAppearance({ circle, label, instr: { dim: true } });
    assert.equal(circle.attrs.opacity, '0.35');
    assert.equal(label.attrs.opacity, '0.35');
  });

  it('survives a missing element or instruction', () => {
    assert.doesNotThrow(() => applyPyramidNodeAppearance({}));
    assert.doesNotThrow(() => applyPyramidNodeAppearance({ instr: { now: true } }));
    const label = stubEl();
    applyPyramidNodeAppearance({ label, instr: { now: true } });
    assert.equal(label.style.fill, NOW_LABEL_FILL, 'a lone label still dresses');
  });

  it('marks the month being lived through, and only inside its own year', () => {
    const manifest = JSON.parse(readFileSync(
      path.resolve(__dirname, '../data/calendar/manifest.json'), 'utf-8'));
    const wallClock = new Date();
    const thisYear = getCalendarMonths(manifest, { id: String(wallClock.getFullYear()) }, 'year');
    const marked = thisYear.filter(m => m.now);
    assert.equal(marked.length, 1, 'one month carries the present moment');
    // `order` is re-indexed to a 0-based seat before the items are handed
    // out, so the month we are living through sits at getMonth().
    assert.equal(marked[0].order, wallClock.getMonth(), 'and it is the current one');
    assert.ok(marked[0].id.startsWith(`${wallClock.getFullYear()}:`), 'in this year');
    // Every other year is an ordinary year.
    assert.equal(getCalendarMonths(manifest, { id: '1969' }, 'year').filter(m => m.now).length, 0);
    assert.equal(getCalendarMonths(manifest, { id: '1582' }, 'year').filter(m => m.now).length, 0);
  });

  it('is the ONLY place that knows these colors', () => {
    // The bug this guards: a node is drawn once live and once as a
    // migration clone, so any appearance a single render path knows about
    // pops on when the transit ends. Both paths must ask the dresser.
    const srcDir = path.resolve(__dirname, '../src');
    const offenders = [];
    const walk = dir => {
      readdirSync(dir).forEach(name => {
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) return walk(full);
        if (!name.endsWith('.js')) return;
        if (full.endsWith(path.join('view', 'node-appearance.js'))) return;
        const text = readFileSync(full, 'utf-8');
        if (text.includes(NOW_NODE_FILL) || text.includes(NOW_LABEL_FILL)) {
          offenders.push(path.relative(srcDir, full));
        }
      });
    };
    walk(srcDir);
    assert.deepEqual(offenders, [],
      'today\'s colors must come from the shared dresser, not be re-stated per render path');
  });

  it('tilts labels along their ray', () => {
    assert.equal(labelRotationDeg(0), 180);
    assert.equal(labelRotationDeg(Math.PI), 360);
    assert.equal(labelRotationDeg(Math.PI / 2), 270);
  });

  it('a label wears its tilt for the whole migration, in both directions', () => {
    // The pop Howell caught (2026-07-20): the wedge flew in from the hub
    // with flat labels that snapped upright once the real pyramid unhid,
    // while the outbound clones kept their rotation the whole way. In and
    // out must be mirror images.
    const src = readFileSync(path.resolve(__dirname, '../src/view/migration-animation.js'), 'utf-8');
    assert.ok(!/rotate\(0,/.test(src),
      'no clone label may start flat and acquire its tilt at settle');
    // Both hub builders rotate by the node's own angle.
    const hubRotations = src.split('labelRotationDeg(pn.angle)').length - 1;
    assert.equal(hubRotations, 3, 'animateIn, from-hub and to-hub all tilt by the node angle');
  });

  it('carries the mark from the item all the way to the drawn node', () => {
    // The seam that has broken before: a field the data declares has to
    // survive the star-field instruction builder to reach the dresser.
    const originalDocument = globalThis.document;
    globalThis.document = createMockDocument();
    try {
      const svgRoot = createMockElement('svg');
      createApp({
        svgRoot,
        items: [{ id: 'p', name: 'PARENT', order: 0 }],
        viewport: getViewportInfo(375, 700),
        pyramid: {
          getChildren: () => ([
            { id: 'a', name: 'AAA', order: 0 },
            { id: 'b', name: 'BBB', order: 1, now: true },
            { id: 'c', name: 'CCC', order: 2 }
          ])
        }
      });
      const walk = (el, out = []) => { out.push(el); (el.children || []).forEach(ch => walk(ch, out)); return out; };
      const drawn = walk(svgRoot);
      const circles = drawn.filter(e => e.attrs?.class === 'child-pyramid-node');
      const labels = drawn.filter(e => e.attrs?.class === 'child-pyramid-label');
      assert.equal(circles.length, 3, 'all three children drawn');
      assert.equal(circles.filter(c => c.style.fill === NOW_NODE_FILL).length, 1,
        'exactly one node wears the present moment');
      const marked = labels.filter(l => l.style.fill === NOW_LABEL_FILL);
      assert.equal(marked.length, 1);
      assert.equal(marked[0].textContent, 'BBB', 'and it is the one the data marked');
    } finally {
      globalThis.document = originalDocument;
    }
  });

  it('marks the present moment in the ring but never in the magnifier', () => {
    // Howell 2026-07-20: the year/month/day being lived through is a RING
    // NODE that wears the colors; when it settles into the magnifier the
    // vessel stays its ordinary self, like every other node's turn there.
    const originalDocument = globalThis.document;
    globalThis.document = createMockDocument();
    try {
      const svgRoot = createMockElement('svg');
      createApp({
        svgRoot,
        items: [
          { id: 'y2025', name: '2025', order: 0 },
          { id: 'y2026', name: '2026', order: 1, now: true },
          { id: 'y2027', name: '2027', order: 2 }
        ],
        viewport: getViewportInfo(375, 700)
      });
      const walk = (el, out = []) => { out.push(el); (el.children || []).forEach(ch => walk(ch, out)); return out; };
      const drawn = walk(svgRoot);
      const ringNodes = drawn.filter(e => e.attrs?.class === 'focus-ring-node');
      assert.ok(ringNodes.length >= 2, 'ring drew its nodes');
      const lit = ringNodes.filter(n => n.style.fill === NOW_NODE_FILL);
      assert.equal(lit.length, 1, 'exactly the marked year is lit in the ring');
      assert.equal(lit[0].attrs['aria-label'], '2026');
      // The unmarked ones must be actively cleared, not merely left alone:
      // ring elements are recycled between renders.
      ringNodes.filter(n => n !== lit[0]).forEach(n => {
        assert.equal(n.style.fill, '', 'ordinary nodes carry no inline fill');
      });
      // The vessel itself, whatever is settled in it.
      const vessel = drawn.find(e => e.attrs?.class === 'focus-ring-magnifier-circle');
      assert.ok(vessel, 'magnifier drawn');
      assert.notEqual(vessel.style.fill, NOW_NODE_FILL, 'the magnifier never wears it');
      const vesselLabel = drawn.find(e => e.attrs?.class === 'focus-ring-magnifier-label');
      assert.notEqual(vesselLabel?.style?.fill, NOW_LABEL_FILL);
    } finally {
      globalThis.document = originalDocument;
    }
  });

  it('both render paths go through the dresser', () => {
    const read = rel => readFileSync(path.resolve(__dirname, '..', rel), 'utf-8');
    const live = read('src/view/detail/pyramid-view.js');
    const clones = read('src/view/migration-animation.js');
    assert.ok(live.includes('applyPyramidNodeAppearance'), 'the live pyramid dresses its nodes');
    // Every clone builder — animateIn, from-hub, to-hub — must dress too,
    // or a node changes face mid-flight.
    const dressed = clones.split('applyPyramidNodeAppearance(').length - 1;
    assert.equal(dressed, 3, 'all three migration clone builders dress their nodes');
  });
});
