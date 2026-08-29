// EVERYTHING ON THE PRIMARY PLANE TRAVELS TOGETHER (W-179).
//
// When a dimension stratum comes forward the primary recedes: a scale about
// the viewport centre and a rack-focus blur, so it reads as a plane moving
// away rather than a picture shrinking. The SVG ring does it, and so must every
// HTML overlay drawn on top of the same plane.
//
// WHY THIS TEST EXISTS. The verse panel was the only overlay when the recede
// was written, so `setPrimaryVisual` named it directly. Two more arrived later
// — the margin's notes and the sigla beside the verse — and neither was added
// to that line, so they stayed sharp and full-size, floating in front of a ring
// that had travelled away. Howell caught it on the glass: "the sigla, margin
// notes, and legend do not recede and blur as the other primary stratum
// elements do."
//
// NOTHING HERE CHECKS THAT THE RECEDE LOOKS RIGHT — that is an eye's job. What
// it checks is that no overlay is LEFT BEHIND, which is a list that grows and
// is exactly the kind of thing that rots silently.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const main = readFileSync(path.join(root, 'src', 'main.js'), 'utf-8');
const html = readFileSync(path.join(root, 'index.html'), 'utf-8');

/** The ids `setPrimaryVisual` scales and blurs. */
function recededIds() {
  const m = /for \(const id of \[([^\]]+)\]\) \{\s*\n\s*const panel = document\.getElementById\(id\)/.exec(main);
  if (!m) return null;
  return m[1].split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
}

/** Every fixed, full-viewport overlay the page declares. */
function overlayIds() {
  const css = readFileSync(path.join(root, 'styles', 'base.css'), 'utf-8');
  const ids = [...html.matchAll(/<div id="([a-z-]+)"[^>]*class="([a-z-]+)"/g)]
    .map(([, id, cls]) => ({ id, cls }));
  return ids.filter(({ cls }) => {
    const rule = new RegExp(`\\.${cls}\\s*\\{[^}]*\\}`).exec(css);
    if (!rule) return false;
    return /position:\s*fixed/.test(rule[0])
      && (/inset:\s*0/.test(rule[0]) || /top:\s*0/.test(rule[0]));
  }).map(({ id }) => id);
}

describe('the primary plane recedes as one (W-179)', () => {
  it('names the overlays it moves, in a list a reader can check', () => {
    const ids = recededIds();
    assert.ok(ids, 'setPrimaryVisual no longer carries a list of overlay ids');
    assert.ok(ids.includes('detail-panel'), 'the verse panel does not recede');
    assert.ok(ids.includes('margin-panel'), 'the margin does not recede');
    assert.ok(ids.includes('margin-marks'), 'the marks beside the verse do not recede');
  });

  it('LEAVES NO FIXED OVERLAY BEHIND — the check that catches the next one', () => {
    // The failure this exists for is not a wrong value, it is an OMISSION: a
    // new overlay lands, looks right at rest, and is discovered months later
    // hanging in front of a receded plane. So the page's own overlays are
    // enumerated and every one must be accounted for — either it travels, or
    // it is named here as deliberately staying put.
    const STAYS_PUT = new Set([
      // These belong to the reader's FRAME, not to the primary plane, and the
      // distinction is what the whole recede means: the plane travels away
      // from the reader, and the frame is where the reader is standing.
      'strata-layer',        // what the primary is receding BEHIND
      'copyright-notice',    // a statement about the app, not about the text
      // (`incomplete-mark` is built in JS rather than declared here, and is
      // frame too: a warning about the edition, which must not soften just
      // because the reader has stepped into a dimension.)
    ]);
    const moving = new Set(recededIds() || []);
    const stranded = overlayIds().filter(id => !moving.has(id) && !STAYS_PUT.has(id));
    assert.deepEqual(stranded, [],
      `overlay(s) neither receding nor declared stationary: ${stranded.join(', ')}`);
  });

  it('scales about the VIEWPORT CENTRE, so nothing slides out of formation', () => {
    // The ring and the logo scale about the viewport centre. An overlay that
    // scaled about its own box would keep its size relative to itself and lose
    // its place relative to the magnifier — which is the half of Howell's
    // instruction that is easy to miss: "while maintaining their positions
    // relative to the focus ring and magnifier".
    assert.match(main, /transformOrigin = `\$\{cx\}px \$\{cy\}px`/);
    assert.match(main, /const cx = viewport\.width \/ 2, cy = viewport\.height \/ 2/);
  });
});

describe('the half a verse is showing has ONE source (W-184)', () => {
  // Howell: "making sure that the text in the details sector always aligns
  // with the partial eclipse effect of the magnifier."
  //
  // It did not, and the cause was not a wrong assignment — it was TWO SOURCES
  // for one fact. `renderDetail` took an optional `part` and fell back to
  // reading the app's own `versePart` when a caller omitted it, so the text
  // showed whatever that variable happened to hold at that instant, set by a
  // different code path at a different moment. The ring could be seating the
  // second half of a verse while the sector drew the first.
  //
  // Every caller now says which half out loud. This is the cell that makes a
  // new one say it too, because the failure is silent and intermittent: it
  // needs a split verse, and most verses are not.
  it('every renderDetail call names the half it wants', () => {
    const calls = [...main.matchAll(/renderDetail\(/g)].map(m => m.index);
    const missing = [];
    for (const at of calls) {
      const window = main.slice(at, at + 340);
      if (/^renderDetail\(selected, adapterInstance, manifest, adapterNormalized, \{ translation, wrapAttempt/.test(main.slice(at, at + 110))) continue;
      if (/function renderDetail/.test(main.slice(Math.max(0, at - 20), at + 14))) continue;
      const close = window.indexOf('});');
      const args = close > 0 ? window.slice(0, close) : window;
      if (!/\bpart\b/.test(args)) missing.push(main.slice(0, at).split('\n').length);
    }
    assert.deepEqual(missing, [],
      `renderDetail called without naming the half, at line(s): ${missing.join(', ')}`);
  });
});
