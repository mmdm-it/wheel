// THE PROOFREAD MARK AT CHAPTER RESOLUTION (W-231), AND THE BANNER OFF THE
// FLAG (O-124). Howell, 2026-09-01, in one line: "1 yes, 2 b, 3 keep, 4 yes,
// 5 yes." The first two of those land here.
//
// What these cells pin, in the order the bugs would arrive:
//
//   - a chapter address is READ off the item, never rebuilt from a verse id;
//   - a book-grain mark covers every chapter of its book (the Hebrew's 39,
//     resting on H-25, keep the banner off without migrating — W-233);
//   - a chapter-grain mark covers that chapter and no sibling;
//   - a book is done when every chapter is, and NOT when it merely has no
//     chapters to ask about — `[].every` is true and a proofread claim may
//     never rest on that;
//   - an edition is done when every book is, at either grain, mixed;
//   - the roll-up survives a chart that cannot be projected, by answering NO;
//   - the visibility filter is gone: unproofread is reachable and marked.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { chapterIdOf, bookIdOf } from '../src/adapters/volume-helpers.js';
import {
  chaptersOf, isChapterConfirmed, isBookConfirmed, isNodeConfirmed,
  isEditionFullyConfirmed, isUnitVisible
} from '../src/adapters/bible-volume.js';

// A two-book volume: GEN with chapters 1..3 over six seats, EXO with chapters
// 1..2 over four. Charts carry the containers the projector demands (O-44).
const chart = groups => ({
  seats: Array.from({ length: groups[groups.length - 1].to }, (_, i) => ({ label: String(i + 1) })),
  groups,
});
const GEN = chart([{ label: '1', from: 1, to: 2 }, { label: '2', from: 3, to: 4 }, { label: '3', from: 5, to: 6 }]);
const EXO = chart([{ label: '1', from: 1, to: 2 }, { label: '2', from: 3, to: 4 }]);

const volumeWith = (marks, extra = {}) => ({
  units: [{ id: 'bGEN' }, { id: 'bEXO' }],
  editions: [{ code: 'E', proofread: false, proofreadUnits: marks, ...extra }],
  chartFor(bookId, edition) {
    if (edition !== 'E') return null;
    return { bGEN: GEN, bEXO: EXO }[bookId] || null;
  },
});

describe('the chapter address is carried, not parsed (W-231, H-2)', () => {
  it('a verse names its chapter through chapterKey, falling back to meta', () => {
    assert.equal(chapterIdOf({ level: 'verse', chapterKey: 'bGEN/3', bookKey: 'bGEN' }), 'bGEN/3');
    assert.equal(chapterIdOf({ level: 'verse', meta: { chapterId: 'bGEN/3' } }), 'bGEN/3');
  });
  it('a chapter item IS the address', () => {
    assert.equal(chapterIdOf({ level: 'chapter', id: 'bGEN/2', parentId: 'bGEN' }), 'bGEN/2');
  });
  it('a book, a testament, the root — no chapter to be in', () => {
    assert.equal(chapterIdOf({ level: 'book', id: 'bGEN' }), null);
    assert.equal(chapterIdOf({ level: 'testament', id: 'T1' }), null);
    assert.equal(chapterIdOf(null), null);
  });
  it('and the book is still read the old way beside it', () => {
    const verse = { level: 'verse', chapterKey: 'bGEN/3', bookKey: 'bGEN' };
    assert.equal(bookIdOf(verse), 'bGEN');
    assert.equal(chapterIdOf(verse), 'bGEN/3');
  });
});

describe('a book enumerates its chapters as the addresses the seats carry', () => {
  it('from the chart\'s own containers', () => {
    assert.deepEqual(chaptersOf(volumeWith([]), 'E', 'bGEN'), ['bGEN/1', 'bGEN/2', 'bGEN/3']);
    assert.deepEqual(chaptersOf(volumeWith([]), 'E', 'bEXO'), ['bEXO/1', 'bEXO/2']);
  });
  it('no chart, no chapters — and NO vacuous truth downstream', () => {
    assert.deepEqual(chaptersOf(volumeWith([]), 'E', 'bNOPE'), []);
    assert.deepEqual(chaptersOf({ units: [] }, 'E', 'bGEN'), [], 'a volume with no chartFor');
  });
  it('a chart the projector refuses answers with no chapters, so the roll-up says NO', () => {
    const v = volumeWith(['bGEN/1']);
    v.chartFor = () => ({ seats: [{ label: '1' }], groups: [] });   // O-44: screams at render
    assert.deepEqual(chaptersOf(v, 'E', 'bGEN'), []);
    assert.equal(isBookConfirmed(v, 'E', 'bGEN'), false, 'the banner must SHOW for a book that cannot be enumerated');
  });
});

describe('marks at two grains, side by side (W-231, W-233)', () => {
  it('a chapter mark confirms its chapter and no sibling', () => {
    const v = volumeWith(['bGEN/2']);
    assert.equal(isChapterConfirmed(v, 'E', 'bGEN', 'bGEN/2'), true);
    assert.equal(isChapterConfirmed(v, 'E', 'bGEN', 'bGEN/1'), false);
    assert.equal(isChapterConfirmed(v, 'E', 'bGEN', 'bGEN/3'), false);
  });
  it('a book mark covers every chapter of its book — the Hebrew stays as it is', () => {
    const v = volumeWith(['bGEN']);
    for (const ch of ['bGEN/1', 'bGEN/2', 'bGEN/3']) {
      assert.equal(isChapterConfirmed(v, 'E', 'bGEN', ch), true, ch);
    }
    assert.equal(isChapterConfirmed(v, 'E', 'bEXO', 'bEXO/1'), false, 'and not the neighbour\'s');
  });
  it('a book is done by its own mark OR by all its chapters, and not by some', () => {
    assert.equal(isBookConfirmed(volumeWith(['bGEN']), 'E', 'bGEN'), true, 'own mark');
    assert.equal(isBookConfirmed(volumeWith(['bGEN/1', 'bGEN/2', 'bGEN/3']), 'E', 'bGEN'), true, 'all chapters');
    assert.equal(isBookConfirmed(volumeWith(['bGEN/1', 'bGEN/2']), 'E', 'bGEN'), false, 'two of three');
    assert.equal(isBookConfirmed(volumeWith(['bGEN/1']), 'E', 'bGEN'), false, 'one of three');
  });
  it('an edition is done when every book is, at either grain', () => {
    assert.equal(isEditionFullyConfirmed(volumeWith(['bGEN', 'bEXO']), 'E'), true, 'two book marks');
    assert.equal(isEditionFullyConfirmed(volumeWith(['bGEN', 'bEXO/1', 'bEXO/2']), 'E'), true, 'mixed grain');
    assert.equal(isEditionFullyConfirmed(volumeWith(['bGEN/1', 'bGEN/2', 'bGEN/3', 'bEXO/1', 'bEXO/2']), 'E'), true, 'all chapters');
    assert.equal(isEditionFullyConfirmed(volumeWith(['bGEN', 'bEXO/1']), 'E'), false, 'Exodus half done');
  });
  it('an edition with NO marks still falls back to its flag, at every grain', () => {
    const yes = volumeWith(undefined, { proofread: true });
    const no = volumeWith(undefined, { proofread: false });
    delete yes.editions[0].proofreadUnits; delete no.editions[0].proofreadUnits;
    assert.equal(isChapterConfirmed(yes, 'E', 'bGEN', 'bGEN/1'), true);
    assert.equal(isBookConfirmed(yes, 'E', 'bGEN'), true);
    assert.equal(isChapterConfirmed(no, 'E', 'bGEN', 'bGEN/1'), false);
    assert.equal(isBookConfirmed(no, 'E', 'bGEN'), false);
  });
});

describe('the one question the banner asks, at the finest grain in hand', () => {
  const v = volumeWith(['bGEN/1', 'bGEN/2', 'bEXO']);
  it('a chapter in hand asks about the chapter', () => {
    assert.equal(isNodeConfirmed(v, 'E', { bookId: 'bGEN', chapterId: 'bGEN/1' }), true);
    assert.equal(isNodeConfirmed(v, 'E', { bookId: 'bGEN', chapterId: 'bGEN/3' }), false, 'chapter 3 unread');
  });
  it('a book in hand asks about the book', () => {
    assert.equal(isNodeConfirmed(v, 'E', { bookId: 'bGEN' }), false, 'one chapter short');
    assert.equal(isNodeConfirmed(v, 'E', { bookId: 'bEXO' }), true, 'book-grain mark');
  });
  it('nothing in hand asks about the edition', () => {
    assert.equal(isNodeConfirmed(v, 'E', {}), false);
    assert.equal(isNodeConfirmed(volumeWith(['bGEN', 'bEXO']), 'E'), true);
  });
  it('so turning the ring through chapters toggles the answer — the ruling\'s own picture', () => {
    const answers = ['bGEN/1', 'bGEN/2', 'bGEN/3'].map(ch => isNodeConfirmed(v, 'E', { bookId: 'bGEN', chapterId: ch }));
    assert.deepEqual(answers, [true, true, false]);
  });
});

describe('unproofread is reachable, and marked (O-124)', () => {
  it('the visibility filter answers yes to everything now', () => {
    assert.equal(isUnitVisible(volumeWith([]), 'E', 'bGEN'), true);
    assert.equal(isUnitVisible(volumeWith([]), 'E', 'bGEN', { includeUnconfirmed: false }), true,
      'even asked the way the old public path asked');
  });
});
