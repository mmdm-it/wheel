// THE VERSIFICATION DOCTRINE, UNDER THE WALL (H-14).
//
// `test/seating-chart.test.js` holds these same hard cases against the legacy
// chart format, and it dies with `expandChart`. The CASES do not die with it:
// welds, non-contiguous folds, an edition that regroups, a container named
// rather than numbered, an asserted absence, a unit absent from the chart —
// every one is a real shape measured from the corpus in W-30, and every one
// must still behave under H-11 or the migration has quietly lost fidelity.
//
// So these are written BEFORE the legacy path is deleted. If the wall cannot
// carry a case, that has to be visible now, while both readers exist, rather
// than discovered from a phone in 1b with nothing to compare against.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { expandVolumeSeats } from '../src/adapters/bible-volume.js';

// A synthetic wall volume. `expandVolumeSeats` asks for exactly three things
// — the testament/book enumeration, a spine per unit, a chart per (unit,
// edition) — so the double supplies those and nothing else.
const makeVolume = ({ units, spines, charts }) => ({
  testaments: [{ id: 'T1', order: 0, books: units }],
  units,
  spineFor: id => spines[id] || null,
  chartFor: (id, edition) => charts[`${id} ${edition}`] || null
});

// ALPH: eight utterances, opaque and deliberately not in alphabetical order,
// so nothing can recover the spine's order from the ids.
const U = ['u7f3', 'u0a2', 'u9c1', 'u3e8', 'u5b6', 'u1d4', 'u8a0', 'u2c9'];
const ALPH = { id: 'ALPH', leaves: 8, order: 0, testamentId: 'T1' };
const spines = { ALPH: { utterances: U } };

const volumeWith = chart => makeVolume({
  units: [ALPH], spines, charts: { 'ALPH ED': chart }
});

describe('the wall carries the versification doctrine', () => {
  it('A WELD: one seat spans two utterances, and later labels slide', () => {
    // The Genesis 50 shape. The edition runs two of the spine's utterances
    // together into one address, so it has SEVEN seats over eight utterances
    // and every label after the weld sits one ahead of the spine.
    const seats = expandVolumeSeats(volumeWith({
      groups: [{ label: '1', from: 1, to: 8 }],
      seats: [
        { label: '1', utterances: [U[0]] },
        { label: '2', utterances: [U[1], U[2]] },   // the weld
        { label: '3', utterances: [U[3]] },
        { label: '4', utterances: [U[4]] },
        { label: '5', utterances: [U[5]] },
        { label: '6', utterances: [U[6]] },
        { label: '7', utterances: [U[7]] }
      ]
    }), 'ED');
    assert.equal(seats.length, 7, 'seven addresses over eight utterances');
    assert.deepEqual(seats.map(s => s.name), ['1', '2', '3', '4', '5', '6', '7']);
    assert.deepEqual(seats[1].meta.utterances, [U[1], U[2]],
      'the welded seat keeps BOTH utterances — the reader\'s position survives a rotation');
  });

  it('A NON-CONTIGUOUS FOLD: one seat, utterances that are not neighbours', () => {
    // W-30's eleven cases. A seat may gather utterances the spine separates,
    // and it is placed by its FIRST — the only rule stated, and stated once.
    const seats = expandVolumeSeats(volumeWith({
      groups: [{ label: '1', from: 1, to: 8 }],
      seats: [
        { label: '1', utterances: [U[0], U[4]] },   // 1st and 5th
        { label: '2', utterances: [U[1]] },
        { label: '3', utterances: [U[2]] }
      ]
    }), 'ED');
    assert.equal(seats[0].name, '1');
    assert.deepEqual(seats[0].meta.utterances, [U[0], U[4]]);
    assert.deepEqual(seats.map(s => s.name), ['1', '2', '3'],
      'the fold does not disturb the seats around it');
  });

  it('A FOLD ACROSS A CONTAINER BOUNDARY belongs to its FIRST utterance', () => {
    // THE CELL THAT WAS MISSING, found by breaking the expander to place a
    // seat by its LAST utterance and watching nothing go red. Both folds
    // above keep their utterances inside one container, so either end put the
    // seat in the same place and the rule was never exercised.
    //
    // It only bites here: a seat gathering utterances from EITHER SIDE of the
    // edition's own container division. W-30 puts the text whole at the first
    // utterance, so the seat belongs where that utterance is — and a seat
    // placed by its last would appear in the following chapter, one container
    // away from the words it holds.
    const seats = expandVolumeSeats(volumeWith({
      groups: [{ label: '1', from: 1, to: 4 }, { label: '2', from: 5, to: 8 }],
      seats: [
        { label: '1', utterances: [U[0]] },
        { label: '2', utterances: [U[3], U[4]] },  // ordinals 4 and 5 — across the boundary
        { label: '3', utterances: [U[5]] }
      ]
    }), 'ED');
    const straddler = seats.find(s => s.name === '2');
    assert.equal(straddler.meta.chapterLabel, '1',
      'the seat sits in the container holding its FIRST utterance, where its text lives');
    assert.equal(straddler.parentId, 'ALPH/1');
    assert.equal(seats.filter(s => s.name === '2').length, 1,
      'and it appears ONCE — a seat counted in both containers would read twice');
  });

  it('AN EDITION REGROUPS: its containers are its own, not the spine\'s', () => {
    // Hebrew Malachi's shape, one level down. The spine is flat by ruling and
    // declares no containers at all; two editions over the SAME utterances
    // divide them differently and both are right (O-44).
    const wide = expandVolumeSeats(volumeWith({
      groups: [{ label: '1', from: 1, to: 8 }],
      seats: U.map((u, i) => ({ label: String(i + 1), utterances: [u] }))
    }), 'ED');
    const narrow = expandVolumeSeats(volumeWith({
      groups: [{ label: '1', from: 1, to: 3 }, { label: '2', from: 4, to: 8 }],
      seats: U.map((u, i) => ({ label: String(i + 1), utterances: [u] }))
    }), 'ED');

    assert.equal(new Set(wide.map(s => s.meta.chapterLabel)).size, 1);
    assert.equal(new Set(narrow.map(s => s.meta.chapterLabel)).size, 2);
    assert.equal(wide.length, narrow.length, 'same utterances, same seats');
    assert.deepEqual(narrow.filter(s => s.meta.chapterLabel === '2').map(s => s.name),
      ['4', '5', '6', '7', '8'], 'the second container holds exactly its range');
  });

  it('A CONTAINER MAY BE NAMED, NOT NUMBERED — the Prologue shape', () => {
    // ECCLU opens at a container the edition calls Prologus. A label is a
    // QUOTATION (H-2): nothing may parse it, and nothing may renumber it.
    const seats = expandVolumeSeats(volumeWith({
      groups: [{ label: 'Prologus', from: 1, to: 2 }, { label: '1', from: 3, to: 8 }],
      seats: U.map((u, i) => ({ label: String(i + 1), utterances: [u] }))
    }), 'ED');
    assert.equal(seats[0].meta.chapterLabel, 'Prologus');
    assert.equal(seats[0].parentId, 'ALPH/Prologus');
    assert.equal(seats[2].meta.chapterLabel, '1', 'and the next container is its own quotation');
  });

  it('AN ASSERTED ABSENCE is the absence of a seat, and the labels carry the gap', () => {
    // The edition does not attest the third utterance. It gets no seat, and
    // the labels around it are the edition's OWN — the engine may not
    // interpolate the missing number (H-2).
    const seats = expandVolumeSeats(volumeWith({
      groups: [{ label: '1', from: 1, to: 8 }],
      seats: [
        { label: '1', utterances: [U[0]] },
        { label: '2', utterances: [U[1]] },
        { label: '4', utterances: [U[3]] },        // no 3
        { label: '5', utterances: [U[4]] }
      ]
    }), 'ED');
    assert.deepEqual(seats.map(s => s.name), ['1', '2', '4', '5'],
      'the gap is visible in the labels and nothing fills it');
    assert.equal(seats.length, 4, 'and no phantom seat is invented for the absent utterance');
  });

  it('A UNIT ABSENT FROM THE CHART IS ABSENT FROM THE EDITION', () => {
    // Membership is the edition's own. There is no per-unit fallback, and
    // there is no identity chart behind this any more: an edition that does
    // not chart a unit simply does not seat it.
    const seats = expandVolumeSeats(makeVolume({
      units: [ALPH], spines, charts: {}
    }), 'ED');
    assert.deepEqual(seats, [], 'no chart, no seats — and no invented ones');
  });

  it('THERE IS NO IDENTITY FALLBACK, and that is the point', () => {
    // The legacy path manufactured a chart from a verse count whenever one
    // was missing, which H-2 calls manufacture: it invented labels and
    // asserted spans it could not know. A chart with no seats now yields
    // nothing rather than a plausible fiction.
    const seats = expandVolumeSeats(volumeWith({
      groups: [{ label: '1', from: 1, to: 8 }], seats: []
    }), 'ED');
    assert.deepEqual(seats, []);
  });

  it('ORDER COMES FROM THE SPINE, never from the ids', () => {
    // The ids are deliberately unsorted. A seat is placed by its first
    // utterance's ORDINAL in the spine, so an engine sorting by id text would
    // scatter these and fail on the first real book.
    const seats = expandVolumeSeats(volumeWith({
      groups: [{ label: '1', from: 1, to: 4 }, { label: '2', from: 5, to: 8 }],
      seats: U.map((u, i) => ({ label: String(i + 1), utterances: [u] }))
    }), 'ED');
    assert.deepEqual(seats.slice(0, 4).map(s => s.meta.chapterLabel), ['1', '1', '1', '1']);
    assert.deepEqual(seats.slice(4).map(s => s.meta.chapterLabel), ['2', '2', '2', '2']);
    const alphabetical = [...U].sort();
    assert.notDeepEqual(alphabetical, U, 'the fixture must disagree with the alphabet or it proves nothing');
  });
});
