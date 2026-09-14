// BOOKMARKS (O-126): the basement's stock, on the device and nowhere else.
import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
import { bookmarksOf, keep, drop, isBookmarked, forgetBookmarks, inOrder } from '../src/core/bookmarks.js';

// A localStorage that behaves, and one that refuses — private browsing, a
// full quota — because the basement must degrade to "no bookmarks", never to
// a broken floor.
const storage = () => {
  const m = new Map();
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: k => { m.delete(k); },
    _map: m
  };
};

describe('bookmarks (O-126)', () => {
  beforeEach(() => { globalThis.window = { localStorage: storage() }; });

  it('keeps a leaf once, in the order kept, with its quoted label', () => {
    assert.deepEqual(bookmarksOf('bible'), []);
    assert.equal(keep('bible', { id: 'u1', label: 'Genesis 1:1', edition: '1592lat' }), true);
    assert.equal(keep('bible', { id: 'u2', label: 'Ruth 1:16' }), true);
    assert.equal(keep('bible', { id: 'u1', label: 'renamed', edition: '1592lat' }), true);   // idempotent within the edition: no second seat, label untouched
    const kept = bookmarksOf('bible');
    assert.deepEqual(kept.map(b => b.id), ['u1', 'u2']);
    assert.equal(kept[0].label, 'Genesis 1:1');
    assert.equal(kept[0].edition, '1592lat');
    assert.equal(kept[1].edition, null);
    assert.ok(kept[0].kept, 'the moment of keeping is recorded');
    assert.equal(isBookmarked('bible', 'u2'), true);
    assert.equal(isBookmarked('bible', 'u9'), false);
  });

  it('drops a leaf, and says whether anything was dropped', () => {
    keep('bible', { id: 'u1', label: 'a' });
    assert.equal(drop('bible', 'u1'), true);
    assert.equal(drop('bible', 'u1'), false);
    assert.deepEqual(bookmarksOf('bible'), []);
  });

  it('THE SAME LEAF IN THREE EDITIONS IS THREE BOOKMARKS, and twice in one is one (Howell, 2026-09-14)', () => {
    assert.equal(keep('bible', { id: 'u1', label: 'ΓΕΝΕΣΙΣ α′:1', edition: '250BCgrc' }), true);
    assert.equal(keep('bible', { id: 'u1', label: 'GENESI I:1', edition: '1471ita' }), true);
    assert.equal(keep('bible', { id: 'u1', label: 'GENESIS 1:1', edition: '1899eng' }), true);
    assert.equal(keep('bible', { id: 'u1', label: 'again', edition: '1471ita' }), true, 'idempotent within the edition');
    assert.deepEqual(bookmarksOf('bible').map(b => `${b.edition}:${b.label}`), ['250BCgrc:ΓΕΝΕΣΙΣ α′:1', '1471ita:GENESI I:1', '1899eng:GENESIS 1:1']);
    assert.equal(isBookmarked('bible', 'u1', '1471ita'), true);
    assert.equal(isBookmarked('bible', 'u1', '1592lat'), false, 'not kept in the Latin');
    assert.equal(drop('bible', 'u1', '1471ita'), true, 'the Italian one goes');
    assert.deepEqual(bookmarksOf('bible').map(b => b.edition), ['250BCgrc', '1899eng'], 'the others stay');
    assert.equal(drop('bible', 'u1'), false, 'no edition names no bookmark here');
  });

  it('THE RING\'S ORDER: book, chapter, verse, then edition — every Genesis 1:1 together (Howell, 2026-09-14)', () => {
    const at = (book, chapter, verse, edition, tail = '') => ({ rank: [book, chapter, verse], tail, edition });
    keep('bible', { id: 'ruth', label: 'RUTH I:1', edition: 'lat', at: at(7, 1, 1, 3) });
    keep('bible', { id: 'gen11', label: 'ΓΕΝΕΣΙΣ α′:1', edition: 'grc', at: at(0, 1, 1, 1) });
    keep('bible', { id: 'old', label: 'kept before places were recorded', edition: 'lat' });
    keep('bible', { id: 'gen11', label: 'GENESIS 1:1', edition: 'eng', at: at(0, 1, 1, 5) });
    keep('bible', { id: 'gen13', label: 'GENESIS I:3', edition: 'lat', at: at(0, 1, 3, 3) });
    keep('bible', { id: 'gen11', label: 'GENESI I:1', edition: 'ita', at: at(0, 1, 1, 4) });
    keep('bible', { id: 'gen2a', label: 'GENESIS 1:2a', edition: 'eng', at: at(0, 1, 2, 5, 'a') });
    keep('bible', { id: 'gen2', label: 'GENESIS 1:2', edition: 'eng', at: at(0, 1, 2, 5) });
    assert.deepEqual(inOrder(bookmarksOf('bible')).map(b => b.label),
      ['ΓΕΝΕΣΙΣ α′:1', 'GENESI I:1', 'GENESIS 1:1', 'GENESIS 1:2', 'GENESIS 1:2a', 'GENESIS I:3', 'RUTH I:1', 'kept before places were recorded'],
      'book, chapter, verse, letter, edition; a placeless bookmark last');
  });

  it('keeps each volume\'s bookmarks apart, and forgets them apart', () => {
    keep('bible', { id: 'u1', label: 'a' });
    keep('calendar', { id: 'd1', label: 'b' });
    forgetBookmarks('bible');
    assert.deepEqual(bookmarksOf('bible'), []);
    assert.deepEqual(bookmarksOf('calendar').map(b => b.id), ['d1']);
  });

  it('refuses nothing loudly: no id, no volume, no storage, corrupt storage', () => {
    assert.equal(keep('bible', { label: 'no id' }), false);
    assert.equal(keep(null, { id: 'u1' }), false);
    globalThis.window.localStorage.setItem('wheel-bookmarks-v1', '{not json');
    assert.deepEqual(bookmarksOf('bible'), []);
    globalThis.window.localStorage.setItem('wheel-bookmarks-v1', JSON.stringify({ bible: [{ id: 'u1' }, { nope: 1 }, null, { id: 7 }] }));
    assert.deepEqual(bookmarksOf('bible').map(b => b.id), ['u1'], 'only well-formed seats survive');
    globalThis.window = { localStorage: { getItem() { throw new Error('private'); }, setItem() { throw new Error('quota'); }, removeItem() {} } };
    assert.deepEqual(bookmarksOf('bible'), []);
    assert.equal(keep('bible', { id: 'u1', label: 'a' }), true, 'a refused write is not an error the reader sees');
    delete globalThis.window;
    assert.deepEqual(bookmarksOf('bible'), []);
  });
});
