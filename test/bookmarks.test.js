// BOOKMARKS (O-126): the basement's stock, on the device and nowhere else.
import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
import { bookmarksOf, keep, drop, isBookmarked, forgetBookmarks } from '../src/core/bookmarks.js';

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
    assert.equal(keep('bible', { id: 'u1', label: 'renamed' }), true);   // idempotent: no second seat, label untouched
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
