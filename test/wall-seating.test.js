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

// CONTAINER RANGES MOVED FROM SPINE ORDINALS TO SEAT INDICES (W-96, ruled by
// Howell 2026-08-18; engine half O-69). Every `groups` range below is now
// counted in the EDITION'S OWN SEATS, so a chart with seven seats declares
// 1..7 and not 1..8. The CASES are untouched — a weld is still a weld — but
// the coordinate their ranges are written in has changed, and these fixtures
// had them in the old one.

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
      groups: [{ label: '1', from: 1, to: 7 }],   // SEVEN SEATS, not eight utterances
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
      groups: [{ label: '1', from: 1, to: 3 }],   // three seats over five utterances
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

  // SUPERSEDED BY W-96, AND REWRITTEN RATHER THAN DELETED (O-69).
  //
  // This cell asserted: "a fold across a container boundary belongs to its
  // FIRST utterance." That was TRUE and it was load-bearing — a seat placed by
  // its last utterance would appear one container away from the words it
  // holds, and the cell was written after breaking the expander that way and
  // watching nothing go red.
  //
  // THE RULE IS GONE FROM THE ENGINE BECAUSE ITS MECHANISM IS. Placement was
  // by spine ordinal, and under a superset spine the engine has no business
  // reading order out of the spine at all (Howell, W-96). A seat's container
  // is now decided by its position in the edition's own `seats[]`, which the
  // chart declares.
  //
  // SO THE GUARANTEE MOVED ACROSS THE WALL, and that is the part worth
  // saying out loud: the engine can no longer put a straddling seat with its
  // own words, because it no longer knows where those words sit. The CHART
  // must place it, by where the generator draws the group boundary in seat
  // space. Neither W-96's proposal nor my three-dependency review named this
  // transfer; it fell out of running the cells.
  it('THE CHART PLACES A STRADDLING SEAT — the engine no longer infers it (W-96)', () => {
    // Seat 2 gathers utterances from either side of what WAS the spine's
    // division (ordinals 4 and 5). The chart puts the boundary after seat 2,
    // so seat 2 is in container 1 — the same outcome the old rule produced,
    // but now because the edition SAID so rather than because the engine
    // worked it out.
    const seats = expandVolumeSeats(volumeWith({
      groups: [{ label: '1', from: 1, to: 2 }, { label: '2', from: 3, to: 3 }],
      seats: [
        { label: '1', utterances: [U[0]] },
        { label: '2', utterances: [U[3], U[4]] },  // straddles the old spine boundary
        { label: '3', utterances: [U[5]] }
      ]
    }), 'ED');
    const straddler = seats.find(s => s.name === '2');
    assert.equal(straddler.meta.chapterLabel, '1', 'placed where the CHART put it');
    assert.equal(straddler.parentId, 'ALPH/1');
    assert.equal(seats.filter(s => s.name === '2').length, 1,
      'and ONCE — a seat counted in both containers would read twice');
  });

  it('AND THE CHART WINS EVEN WHEN IT DISAGREES WITH THE UTTERANCES', () => {
    // The mechanism, proved rather than described. The same straddling seat,
    // with the boundary drawn BEFORE it instead: the engine places it in
    // container 2, though its first utterance sits where the old rule would
    // have put it in container 1. This is exactly the freedom W-96 grants and
    // exactly the responsibility it hands to whoever generates the chart —
    // draw this boundary wrongly and the seat reads a container away from its
    // words, silently, with nothing in the engine able to notice.
    const seats = expandVolumeSeats(volumeWith({
      groups: [{ label: '1', from: 1, to: 1 }, { label: '2', from: 2, to: 3 }],
      seats: [
        { label: '1', utterances: [U[0]] },
        { label: '2', utterances: [U[3], U[4]] },
        { label: '3', utterances: [U[5]] }
      ]
    }), 'ED');
    assert.equal(seats.find(s => s.name === '2').meta.chapterLabel, '2',
      'the chart decides, and the engine does not second-guess it from the spine');
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
      groups: [{ label: '1', from: 1, to: 4 }],   // four seats; the absent one has none
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

  it('ORDER COMES FROM THE EDITION\'S SEATS, never from the ids (W-96)', () => {
    // THIS CELL SAID "order comes from the SPINE" AND PASSED BY COINCIDENCE.
    // Its fixture seats eight utterances in spine order, so seat index and
    // spine ordinal were the same number and either rule produced the answer.
    // The comment claimed the seat was placed by "its first utterance's
    // ORDINAL in the spine", which W-96 abolished — a green cell asserting a
    // retired doctrine, kept honest by nothing.
    //
    // What SURVIVES unchanged is the half that was always the point: the ids
    // are opaque and no order may be recovered from them (H-11). The order is
    // the edition's, declared by the sequence of `seats[]`.
    const seats = expandVolumeSeats(volumeWith({
      groups: [{ label: '1', from: 1, to: 4 }, { label: '2', from: 5, to: 8 }],
      seats: U.map((u, i) => ({ label: String(i + 1), utterances: [u] }))
    }), 'ED');
    assert.deepEqual(seats.slice(0, 4).map(s => s.meta.chapterLabel), ['1', '1', '1', '1']);
    assert.deepEqual(seats.slice(4).map(s => s.meta.chapterLabel), ['2', '2', '2', '2']);
    const alphabetical = [...U].sort();
    assert.notDeepEqual(alphabetical, U, 'the fixture must disagree with the alphabet or it proves nothing');

    // AND THE DISCRIMINATING HALF, which the old fixture could not show: seat
    // the same utterances in a DIFFERENT order and the containers follow the
    // seats, not the spine. Under the retired rule these would come back in
    // spine order and this would fail.
    const shuffled = expandVolumeSeats(volumeWith({
      groups: [{ label: '1', from: 1, to: 2 }, { label: '2', from: 3, to: 4 }],
      seats: [U[5], U[7], U[0], U[2]].map((u, i) => ({ label: String(i + 1), utterances: [u] }))
    }), 'ED');
    assert.deepEqual(shuffled.map(s => s.name), ['1', '2', '3', '4'],
      'the edition\'s reading order is what the reader gets');
    assert.deepEqual(shuffled.map(s => s.meta.chapterLabel), ['1', '1', '2', '2'],
      'and its containers follow that order, not the spine\'s');
  });
});
