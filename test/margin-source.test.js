// THE MARGIN'S ADDRESS SPACE (W-165, O-100).
//
// WHY THIS TEST EXISTS, and it is the whole reason: the first build of the
// margin shipped with the lookup pointed at the wrong address space, and
// NOTHING SAID SO. A chart's seat labels are flat ordinals within the unit —
// "1", "2", "3" — while a margin block is addressed "container:seat". Every
// lookup missed, every lookup correctly returned null, and null is the
// ordinary answer for a unit that has no apparatus at all. The screen was
// blank, the console was clean, the suite was green, and the defect was
// indistinguishable from the normal case.
//
// So the two halves are pinned separately: that the order is composed the way
// a reader's own position is composed, and that a range lookup over it lands.
//
// THE FIXTURES ARE INVENTED. No corpus content crosses into this repository
// (WF-14), and none is needed — the shapes are what is under test.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { addressOrder, blockAt, entriesAt, apparatusRuns, manuscriptsIn } from '../src/core/margin-source.js';
import { settleRow, flow, renderMarginNote } from '../src/view/margin-panel.js';

const chart = {
  seats: [
    { label: '1' }, { label: '2' }, { label: '3' },   // container 1
    { label: '1' }, { label: '2' },                   // container 2
    { label: '1' },                                   // container 10
  ],
  groups: [
    { label: '1', from: 1, to: 3 },
    { label: '2', from: 4, to: 5 },
    { label: '10', from: 6, to: 6 },
  ],
};

describe('margin address order', () => {
  it('composes the address the way a reader position is composed', () => {
    assert.deepEqual(addressOrder(chart), ['1:1', '1:2', '1:3', '2:1', '2:2', '10:1']);
  });

  it('is NOT the bare seat labels — the bug this file exists for', () => {
    const bare = chart.seats.map(s => s.label);
    assert.notDeepEqual(addressOrder(chart), bare);
    // And the miss is total rather than partial, which is why it was silent:
    // not one composed address appears in the flat list.
    for (const address of addressOrder(chart)) assert.ok(!bare.includes(address));
  });

  it('survives a chart with no groups, returning nothing rather than guessing', () => {
    assert.deepEqual(addressOrder({ seats: chart.seats }), []);
    assert.deepEqual(addressOrder(null), []);
  });
});

describe('margin range lookup', () => {
  const order = addressOrder(chart);
  const margin = {
    blocks: [
      { from: '1:1', to: '1:3', text: 'first' },
      { from: '2:1', to: '10:1', text: 'second' },
    ],
  };

  it('finds the block covering an address anywhere in its run', () => {
    for (const a of ['1:1', '1:2', '1:3']) assert.equal(blockAt(margin, a, order)?.text, 'first');
    for (const a of ['2:1', '2:2', '10:1']) assert.equal(blockAt(margin, a, order)?.text, 'second');
  });

  it('orders by the chart, never by the label as a string', () => {
    // "10:1" sorts BEFORE "2:1" as text, and after it in the chart. A lookup
    // that compared labels would put the last container's verse in the first
    // container's block, which reads as a plausible page of the wrong notes.
    assert.ok(order.indexOf('10:1') > order.indexOf('2:1'));
    assert.equal(blockAt(margin, '10:1', order)?.text, 'second');
  });

  it('answers null for an address no block covers, and for nonsense', () => {
    assert.equal(blockAt(margin, '9:9', order), null);
    assert.equal(blockAt(margin, '1:1', []), null);
    assert.equal(blockAt(null, '1:1', order), null);
  });
});

describe('the notes standing against one address (W-166)', () => {
  const order = addressOrder(chart);
  const block = {
    from: '1:1', to: '2:2',
    lead: 'a fragment belonging to no verse',
    entries: [
      { at: '1:1', text: 'first' },
      { at: '1:2', to: '1:3', text: 'a note about two verses' },
      { at: '1:3', text: 'and one about the second alone' },
      { at: '2:2', text: 'last' },
    ],
  };

  it('returns a verse its own notes', () => {
    assert.deepEqual(entriesAt(block, '1:1', order).map(e => e.text), ['first']);
    assert.deepEqual(entriesAt(block, '2:2', order).map(e => e.text), ['last']);
  });

  it('returns a RANGE note at every verse it covers', () => {
    // "4—5 …" is one note about two verses, and a reader on either of them
    // should meet it. 54 entries corpus-wide are addressed this way.
    assert.deepEqual(entriesAt(block, '1:2', order).map(e => e.text), ['a note about two verses']);
    assert.deepEqual(entriesAt(block, '1:3', order).map(e => e.text),
      ['a note about two verses', 'and one about the second alone']);
  });

  it('gives a verse with no note an empty list, not the whole page', () => {
    assert.deepEqual(entriesAt(block, '2:1', order), []);
    assert.deepEqual(entriesAt(block, '10:1', order), []);
  });

  it('never hands back the lead — it belongs to no verse', () => {
    // The fragment before a page's first address is usually a note on the
    // unit's title, sometimes a sentence carried over from the page before.
    // Attaching it to a verse would be filing it on a guess, which is the one
    // thing this design refuses.
    for (const a of order) {
      for (const e of entriesAt(block, a, order)) assert.notEqual(e.text, block.lead);
    }
  });
});

describe('the hands are raised by the app, not by font luck (O-108)', () => {
  // Howell's phone, Genesis 1:6, twice over. First the fonts: EB Garamond has
  // no superscript glyphs, so the hand marks were drawn by whatever fallback
  // font the device found — the app raises them itself now, in the note's own
  // face. Then the queries: the first fix left them on the floor, from a
  // misreading of Howell's report — and his photograph shows Swete printing
  // the WHOLE compound raised, each query qualifying the hand before it. No
  // computer alphabet has a raised question mark, which is the deepest reason
  // this raising can only ever be the app's: the data cannot carry it.
  it('raises the whole hand compound, queries riding with their hands', () => {
    assert.deepEqual(apparatusRuns('ras A¹?ᵃ?'), [
      { text: 'ras A', sup: false },
      { text: '1?a?', sup: true },
    ]);
  });

  it('leaves a query standing on its own down on the line', () => {
    assert.deepEqual(apparatusRuns('sub ?? Q? | (? απο)'),
      [{ text: 'sub ?? Q? | (? απο)', sup: false }]);
  });

  it('folds an adjacent pair into one raised run', () => {
    assert.deepEqual(apparatusRuns('Qᵐᵍ'), [
      { text: 'Q', sup: false },
      { text: 'mg', sup: true },
    ]);
  });

  it('leaves the occurrence marker alone — Garamond owns the degree sign', () => {
    assert.deepEqual(apparatusRuns('υδατος 2°...εποιησεν'),
      [{ text: 'υδατος 2°...εποιησεν', sup: false }]);
  });

  it('passes plain text through as one run', () => {
    assert.deepEqual(apparatusRuns('ειδεν AD] ωστε φαινειν επι E'),
      [{ text: 'ειδεν AD] ωστε φαινειν επι E', sup: false }]);
  });
});

describe('a note settles against the bottom of the lens (O-109)', () => {
  // Howell, 2026-08-28: the top rows of the lens are its narrowest and exist
  // for long notes; a short note must not begin there while the wide rows
  // below stand empty. The note flows from the lowest starting row that
  // still holds all of it. Geometry only — a synthetic lens, no DOM.
  const lens = {
    fontPx: 10,   // maxChars per row = availableWidth / 4.6
    lineTable: [
      { availableWidth: 28 },   // ~6 chars — the narrow ceiling
      { availableWidth: 37 },   // ~8
      { availableWidth: 92 },   // ~20
      { availableWidth: 92 },   // ~20
    ],
  };

  it('drops a short note past the narrow ceiling rows', () => {
    // 17 characters fit in the bottom row alone.
    assert.equal(settleRow('υδατος εποιησεν', lens), 3);
  });

  it('uses exactly as many low rows as the note needs', () => {
    // ~36 characters need the two wide rows, not the ceiling.
    assert.equal(settleRow('υδατος εποιησεν sup ras και εγενετο', lens), 2);
  });

  it('surrenders the ceiling only to a note that cannot fit without it', () => {
    const long = 'ενας δυο τρια τεσσερα πεντε εξι επτα οκτω εννεα δεκα εντεκα δωδεκα';
    assert.equal(settleRow(long, lens), 0);
  });
});

describe('nothing is eaten at the row edge (O-110)', () => {
  // Howell circled three losses on one Leviticus screen — a lemma's bracket
  // among them — and every one stood in the data: the wrap's width estimate
  // flattered Garamond's Greek, the overfull lines painted into the clip,
  // and the tail vanished in silence. In the browser the wrap now MEASURES
  // with the note's own face; here, with no glass, the estimate stands in —
  // and a word longer than its row breaks with a hyphen instead of painting
  // past the edge.
  const lens = { fontPx: 10, lineTable: [
    { availableWidth: 46 },    // 10 chars by the estimate
    { availableWidth: 46 },
    { availableWidth: 92 },    // 20
  ] };

  it('breaks an overlong word with a hyphen and loses nothing', () => {
    const { lines, remaining } = flow('επιστοιβασουσιν] στοι', lens, 0);
    assert.equal(remaining, '');
    assert.ok(lines[0].text.endsWith('-'), 'the break carries no hyphen');
    const glued = lines.map(l => l.text).join('').replace(/-/g, '') +
      (lines.length > 1 ? '' : '');
    assert.equal(lines.map(l => l.text.replace(/-$/, '')).join(''),
      'επιστοιβασουσιν] στοι'.replace(/ /g, ''),
      'characters were lost at the row edge');
  });

  it('never emits a line its row cannot hold', () => {
    const { lines } = flow('διχοτομηματα] pr επι A', lens, 0);
    for (const l of lines) {
      const max = Math.max(4, Math.floor(l.row.availableWidth / (lens.fontPx * 0.46)));
      assert.ok(l.text.length <= max, `"${l.text}" exceeds its row`);
    }
  });
});

describe('a note half that overflows the lens shrinks, never loses its tail (O-113)', () => {
  // Genesis 25:3: the Raguel clause stood in the data and appeared on
  // NEITHER screen — the half exceeded the lens's rows and the tail dropped
  // in silence. The lens now recomputes at a smaller register until the
  // half fits, floored at the legibility floor Howell set on the glass
  // (2026-08-29): 14.4px on his phone, four hundredths of the short side,
  // stated absolutely so a future change to the base cannot move it.
  it('seats every word of a half that the floor can still hold', () => {
    const mk = () => { const el = { style: {}, kids: [], className: '', _t: '' };
      el.appendChild = c => el.kids.push(c); el.setAttribute = () => {};
      Object.defineProperty(el, 'textContent', { get() { return el._t; }, set(v) { el._t = v; } });
      return el; };
    // Forty words: past what the lens holds at the base size, still inside
    // what it holds at the legibility floor. The fixture was seventy while
    // the floor was six tenths; raising the floor to Howell's 14.4px shrank
    // what shrinking can rescue, which is the trade he took knowingly, and
    // the cell now measures the guarantee that survives rather than one that
    // does not. What lies past the floor is O-116's open problem.
    const words = Array.from({ length: 40 }, (_, i) => `σημειον${i + 1}`);
    const entry = { at: '1:1', text: words.join(' ') };
    let shown = '';
    for (const part of [0, 1]) {
      const out = renderMarginNote([entry], { width: 360, height: 800, create: mk, part,
        manuscripts: [{ siglum: 'A', name: 'x' }] });
      for (const k of out.kids) if (k.className === 'margin-note-line')
        shown += k.kids.map(x => x._t).join('') + ' ';
    }
    const got = shown.replace(/-\s/g, '').replace(/\s+/g, '');
    for (const w of words) assert.ok(got.includes(w), `${w} never reached the glass`);
  });
});

describe('the apparatus is never set below the legibility floor (O-116)', () => {
  // Howell, reading the floor cases: "10.8 px is too small. I'd like to make
  // 14.4 the floor." The floor is now its own ratio of the short side rather
  // than six tenths of whatever the base happens to be — so lowering the base
  // to cut the split count cannot silently lower the smallest type as well.
  it('sets no line smaller than four hundredths of the short side', () => {
    const mk = () => { const el = { style: {}, kids: [], className: '', _t: '' };
      el.appendChild = c => el.kids.push(c); el.setAttribute = () => {};
      Object.defineProperty(el, 'textContent', { get() { return el._t; }, set(v) { el._t = v; } });
      return el; };
    // A note far past anything the lens can hold, so the shrink loop runs to
    // its floor and stops there.
    const entry = { at: '1:1', text: Array.from({ length: 600 }, (_, i) => `λογος${i}`).join(' ') };
    const out = renderMarginNote([entry], { width: 360, height: 800, create: mk, part: 0,
      manuscripts: [{ siglum: 'A', name: 'x' }] });
    const sizes = [];
    for (const k of out.kids) {
      const px = parseFloat(String(k.style?.fontSize || ''));
      if (Number.isFinite(px)) sizes.push(px);
    }
    assert.ok(sizes.length, 'no sized line was rendered');
    assert.ok(Math.min(...sizes) >= 360 * 0.04 - 0.001,
      `the apparatus was set at ${Math.min(...sizes)}px, below the floor`);
  });
});

describe('the italic witness reaches the glass (W-212/O-114)', () => {
  it('renders the italic capital as an italic run in the note face', () => {
    assert.deepEqual(apparatusRuns('Ζομβραν 𝐷ˢⁱˡ | Μαδαν D'), [
      { text: 'Ζομβραν ', sup: false },
      { text: 'D', italic: true },
      { text: 'sil', sup: true },
      { text: ' | Μαδαν D', sup: false },
    ]);
  });

  it('still names the Cotton Genesis for an italic citation', () => {
    const legend = { volumes: [{ volume: 1, units: ['u1'], books: ['GENE'],
      sigla: { D: 'Codex Cottonianus Geneseos' } }] };
    const out = manuscriptsIn('Μαδαν 𝐷E', legend, 'u1');
    assert.ok(out.some(m => m.siglum === 'D'), 'the italic D went unnamed');
  });
});
