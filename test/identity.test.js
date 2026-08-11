// core/identity.js — and the cells that matter most are the REFUSALS.
//
// The module's whole job is to stop the engine reading meaning out of the text
// of an id. So the tests that earn their keep are the ones proving it declines
// to guess: no order function, no ordering; an unknown id, no placement; a
// chapter path, no answer.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createScheme, mint, parse, parentOf, isAncestor, compare, resolvePath
} from '../src/core/identity.js';

// Two volumes, declared differently on purpose. If a cell below passes for
// scripture and fails for the calendar, the module is not volume-general and
// the calendar will pay for its own migration later (audit N40).
const bible = createScheme({ levels: ['book', 'chapter', 'verse'], separator: '/' });
const calendar = createScheme({ levels: ['year', 'month', 'day'], separator: ':' });

describe('identity — mint and parse are positional, never patterned', () => {
  it('mints and parses a full id, both volumes', () => {
    assert.equal(mint(bible, { book: 'b7f3a', chapter: 'c1', verse: 'u1' }), 'b7f3a/c1/u1');
    assert.equal(mint(calendar, { year: 'y2026', month: 'm08', day: 'd11' }), 'y2026:m08:d11');
    assert.deepEqual(parse(bible, 'b7f3a/c1/u1'),
      { book: 'b7f3a', chapter: 'c1', verse: 'u1', depth: 3, level: 'verse' });
    assert.deepEqual(parse(calendar, 'y2026:m08'),
      { year: 'y2026', month: 'm08', depth: 2, level: 'month' });
  });

  it('a partial id is legitimate — the reader stands at a book more often than a verse', () => {
    assert.equal(mint(bible, { book: 'b7f3a' }), 'b7f3a');
    assert.equal(parse(bible, 'b7f3a').level, 'book');
  });

  it('reads NOTHING from the spelling — an opaque id parses like any other', () => {
    // The old regex demanded /^[A-Z][A-Z_]*_\d+_\d+$/. These ids satisfy no
    // such shape and must parse identically, or `bookId` is not opaque.
    assert.equal(parse(bible, 'x7f3a/9q/zz').book, 'x7f3a');
    assert.equal(parse(bible, '000/111/222').verse, '222');
  });

  it('REFUSES an id with more segments than the scheme has levels', () => {
    // Truncating would land the reader somewhere plausible and wrong.
    assert.equal(parse(bible, 'a/b/c/d'), null);
  });

  it('REFUSES to mint a value containing the separator', () => {
    assert.throws(() => mint(bible, { book: 'a/b' }), /contains the separator/);
    assert.throws(() => mint(calendar, { year: 'y:1' }), /contains the separator/);
  });
});

describe('identity — containment', () => {
  it('parentOf climbs one level and stops at the top', () => {
    assert.equal(parentOf(bible, 'b7f3a/c1/u1'), 'b7f3a/c1');
    assert.equal(parentOf(bible, 'b7f3a/c1'), 'b7f3a');
    assert.equal(parentOf(bible, 'b7f3a'), null, 'an id with no parent is a fact, not a failure');
  });

  it('isAncestor is prefix-with-separator, not bare prefix', () => {
    assert.equal(isAncestor(bible, 'b7f3a', 'b7f3a/c1'), true);
    // The bug this guards: 'b7' is a string-prefix of 'b7f3a' and is NOT its
    // ancestor. Bare startsWith would say yes.
    assert.equal(isAncestor(bible, 'b7', 'b7f3a/c1'), false);
    assert.equal(isAncestor(bible, 'b7f3a', 'b7f3a'), false);
  });
});

describe('identity — compare REFUSES to guess, and that is the point', () => {
  const spine = ['b3', 'b1', 'b2'];                  // declared order, not alphabetical
  const order = id => spine.indexOf(id);

  it('orders by the spine, which disagrees with the alphabet', () => {
    const sorted = ['b1', 'b2', 'b3'].sort((a, b) => compare(bible, order, a, b));
    assert.deepEqual(sorted, ['b3', 'b1', 'b2'],
      'the spine says b3 first; an alphabetical sort would say b1 and be wrong');
  });

  it('THROWS without an order function rather than falling back to string order', () => {
    // A lexicographic fallback would pass on any fixture and seat a reader
    // wrongly the first time a real corpus disagreed with the alphabet — the
    // derived-view failure: correct-looking, wrong about the shape.
    assert.throws(() => compare(bible, undefined, 'b1', 'b2'), /needs an order function/);
  });

  it('THROWS on an id the spine does not contain', () => {
    assert.throws(() => compare(bible, order, 'b1', 'ghost'), /no declared order/);
  });
});

describe('identity — resolvePath speaks the H-11 layout', () => {
  const at = p => ({ base: './data/gutenberg', version: 'v42', ...p });

  it('the five real kinds', () => {
    assert.equal(resolvePath(at({ kind: 'volume' })), './data/gutenberg/v42/volume.json');
    assert.equal(resolvePath(at({ kind: 'spine', bookId: 'b7f3a' })),
      './data/gutenberg/v42/spine/b7f3a.json');
    assert.equal(resolvePath(at({ kind: 'text', edition: 'DRA', bookId: 'b7f3a' })),
      './data/gutenberg/v42/text/DRA/b7f3a.json');
    assert.equal(resolvePath(at({ kind: 'chart', edition: 'VUL', bookId: 'b7f3a' })),
      './data/gutenberg/v42/charts/VUL/b7f3a.json');
    assert.equal(resolvePath(at({ kind: 'names', lang: 'fi' })),
      './data/gutenberg/v42/names/fi.json');
  });

  it('the version rides the path — that is what makes the files immutable (H-11 item 4)', () => {
    const a = resolvePath(at({ kind: 'spine', bookId: 'b7f3a' }));
    const b = resolvePath({ base: './data/gutenberg', version: 'v43', kind: 'spine', bookId: 'b7f3a' });
    assert.notEqual(a, b, 'a data push must change the path, not the world');
  });

  it('THROWS when asked for a chapter file — chapters are not a storage level', () => {
    assert.throws(() => resolvePath(at({ kind: 'chapter', bookId: 'b7f3a' })),
      /render-time projection/);
  });

  it('THROWS on a missing required part rather than building a path with a hole in it', () => {
    assert.throws(() => resolvePath(at({ kind: 'text', bookId: 'b7f3a' })), /needs edition/);
    assert.throws(() => resolvePath(at({ kind: 'chart', edition: 'VUL' })), /needs bookId/);
  });
});
