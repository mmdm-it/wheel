import test from 'node:test';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { bookIdOf } from '../src/adapters/volume-helpers.js';
import { NavigationState } from '../src/navigation/navigation-state.js';

test('navigation state selects offsets with wrap', () => {
  const nav = new NavigationState(['a', 'b', 'c']);
  nav.selectOffset(1);
  assert.equal(nav.getCurrent(), 'b');
  nav.selectOffset(2);
  assert.equal(nav.getCurrent(), 'a');
});

test('navigation notifies observers', () => {
  const nav = new NavigationState(['a', 'b']);
  let events = 0;
  nav.onChange(() => { events += 1; });
  nav.selectOffset(1);
  assert.equal(events, 1);
});

// H-25: the badge asks per book, so it must find the book from where the
// reader actually stands. Howell reads at VERSE level for every one of the
// 41 seats — if the resolution misses that shape the feature fails precisely
// where it is used, while every other cell passes. Wilbur's catch on review.
describe('bookIdOf — the book behind the seat (H-25)', () => {
  it('resolves from a CHAIN VERSE, which is where the reader actually is', () => {
    // The shape buildBibleVerseChain produces: expandVolumeSeats carries the
    // book as a TOP-LEVEL bookKey, and meta.bookId is added later and only
    // for chapter items (seating-chart.js).
    const chainVerse = {
      id: 'b372f374a_1_1', name: '1', level: 'verse',
      bookKey: 'b372f374a', chapterKey: 'b372f374a_1', testamentKey: 't1',
      meta: { chapterId: 'b372f374a_1', chapterLabel: 'I' }
    };
    assert.equal(bookIdOf(chainVerse), 'b372f374a');
  });

  it('resolves from a deep-link verse, which carries meta.bookId instead', () => {
    const synthetic = {
      id: 'b372f374a_1_1', level: 'verse', parentId: 'b372f374a_1',
      meta: { bookId: 'b372f374a', chapterId: 'b372f374a_1', verseKey: '1' }
    };
    assert.equal(bookIdOf(synthetic), 'b372f374a');
  });

  it('resolves a book item, a chapter by its parent, and nothing else', () => {
    assert.equal(bookIdOf({ id: 'b372f374a', level: 'book' }), 'b372f374a');
    assert.equal(bookIdOf({ id: 'c1', level: 'chapter', parentId: 'b372f374a' }), 'b372f374a');
    assert.equal(bookIdOf({ id: 't1', level: 'testament' }), null, 'a testament is not in a book');
    assert.equal(bookIdOf(null), null);
  });
});
