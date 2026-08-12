import assert from 'node:assert/strict';
import { getBibleChapters } from '../src/adapters/volume-helpers.js';
import { readFileSync as _readFileSyncBible } from 'node:fs';
import { fileURLToPath as _fileURLToPathBible } from 'node:url';
import _pathBible from 'node:path';

import { describe, it } from 'node:test';
import { bibleAdapter, normalize as normalizeBible } from '../src/adapters/bible-adapter.js';
import { makeWallManifest } from './helpers/wall-volume.mjs';

// THE WALL'S ROOT SHAPE (H-14): testaments hold books directly, and there is
// no stored chapter level — a container is projected from the edition's chart
// at render (O-44), so `normalize` has nothing to walk into below a book.
//
// Book names are deliberately ABSENT. They live in `names/{lang}.json` and
// follow the reader's tongue; baking one into the normalized root is the
// stale-language bug class W-16 and W-6 were written for, so an unnamed book
// here is correct rather than incomplete.
const sampleManifest = {
  Gutenberg_Bible: {
    display_config: {
      volume_name: 'Gutenberg Bible',
      hierarchy_levels: {
        testament: { color: '#111' },
        book: { color: '#333' },
        chapter: { color: '#444' }
      }
    },
    testaments: {
      OT: {
        name: 'Old',
        sort_number: 1,
        books: { GEN: { sort_number: 1, leaves: 31, testamentId: 'OT' } }
      }
    }
  }
};

describe('bible adapter', () => {
  it('normalizes bible manifest into items and links', () => {
    const normalized = normalizeBible(sampleManifest);
    assert.equal(normalized.meta.volumeId, 'Gutenberg_Bible');
    assert.equal(normalized.items[0].id, 'volume:Gutenberg_Bible');
    const testaments = normalized.items.filter(i => i.level === 'testament');
    // Sections are no longer a LEVEL (Howell 2026-07-30): they existed only to
    // subdivide a testament for the child pyramid, which the star field
    // solved. Books hang directly off their testament now.
    const sections = normalized.items.filter(i => i.level === 'section');
    const books = normalized.items.filter(i => i.level === 'book');
    const chapters = normalized.items.filter(i => i.level === 'chapter');
    assert.equal(testaments.length, 1);
    assert.equal(sections.length, 0, 'the section level is retired');
    assert.equal(books.length, 1);
    // CHAPTERS ARE NOT NORMALIZED (H-14/O-44). They are not stored, so there
    // is nothing to walk: the rings below a book are projected per edition
    // from its chart, which one stored tree could not express for fourteen
    // traditions at once.
    assert.equal(chapters.length, 0, 'a container is a projection, not an item in the tree');
    assert.equal(normalized.meta.colors.book, '#333');
    assert.ok(normalized.links.find(l => l.to === 'GEN'));
  });

  it('builds layout spec with pyramid config', () => {
    const normalized = normalizeBible(sampleManifest);
    const spec = bibleAdapter.layoutSpec(normalized, { width: 800, height: 600 });
    assert.ok(Array.isArray(spec.rings));
    assert.equal(spec.rings.length, 4); // testament, book, chapter, verse (section hidden from UI)
    const pyramid = spec.pyramid;
    assert.ok(pyramid);
    assert.ok(pyramid.capacity);
    assert.equal(typeof pyramid.place, 'function');
  });

  it('emits detail payloads for book and chapter', () => {
    const bookDetail = bibleAdapter.detailFor({ id: 'GEN', level: 'book', name: 'Genesis' }, sampleManifest);
    assert.equal(bookDetail.type, 'card');
    assert.ok(bookDetail.body.includes('31'), 'a book is sized by its leaves, not by one tradition\'s chapter count');
    const chapterDetail = bibleAdapter.detailFor({ id: 'GEN/1', level: 'chapter', name: '1' }, sampleManifest);
    assert.equal(chapterDetail.type, 'text');
    assert.equal(typeof chapterDetail.text, 'string');
  });

  // THE CHILD PYRAMID'S CHAPTERS, through the binding the HOST actually calls.
  //
  // Howell's phone, 2026-08-12: "I get as far as Genesis in the magnifier, but
  // there are no chapters in the child pyramid." The suite was green while the
  // app was broken, which is the part worth fixing.
  //
  // The cause: containers are projected from the committed edition's chart, so
  // `getBibleChapters` needs an edition — and the host is volume-agnostic by
  // design, so it cannot supply one. Every existing cell called the helper
  // DIRECTLY, passing the edition itself, and so exercised a path no running
  // code takes. This calls it the way the pyramid does: through the adapter's
  // binding, with no edition of its own.
  it('the child pyramid gets a book\'s chapters WITHOUT knowing the edition', () => {
    const wall = makeWallManifest();
    const h = bibleAdapter.createHandlers({
      manifest: wall,
      namesMap: { locale: 'latin', books: { ALPH: 'Alpha' } },
      options: { activeEdition: 'ED', translation: 'ED' }
    });
    const bound = h.layoutBindings.getBibleChapters;
    assert.equal(typeof bound, 'function', 'the adapter must expose it, or the host falls back unbound');
    // Exactly the host's call shape: manifest, selected, namesMap, mode. No edition.
    const chapters = bound(wall, { id: 'ALPH' }, null, 'book');
    assert.equal(chapters.length, 2, 'the sky under a book holds its containers');
    assert.deepEqual(chapters.map(c => c.name), ['1', '2']);
    assert.equal(chapters[0].parentId, 'ALPH');
  });
});


describe('reading on through the volume', () => {
  // RE-POINTED AT THE WALL (H-14). This read the legacy fixture manifest,
  // which is cargo the engine can no longer open. The synthetic volume gives
  // these cells the crossings they need — the real one is a single book with
  // a single container until 1b lands.
  const realManifest = makeWallManifest();

  // The names table carries the reader's tongue (W-16), and since 2026-08-02
  // the chapter numeral is drawn from it too — so a harness with no locale
  // gets digits, correctly. These tests read the volume in Latin.
  const inVerseMode = (namesMap = { locale: 'latin', books: { ALPH: 'Alpha', BETH: 'Beta', GAMM: 'Gamma' }, testaments: { T1: 'First', T2: 'Second' } }) => {
    const h = bibleAdapter.createHandlers({
      manifest: realManifest, namesMap, options: { activeEdition: 'ED', translation: 'ED' }
    });
    h.layoutBindings.setBibleMode('verse');
    return h;
  };

  it('binds the continuous chain for the descent', () => {
    // The binding gauntlet again: dropped by a whitelist, the verse ring
    // would silently fall back to one chapter and dead-end at its end.
    const h = inVerseMode();
    assert.equal(typeof h.layoutBindings.getBibleVerseChain, 'function');
    const chain = h.layoutBindings.getBibleVerseChain('ALPH_2_2');
    assert.equal(chain.items[chain.selectedIndex].id, 'ALPH_2_2', 'entered at the verse tapped');
    assert.equal(chain.items.filter(Boolean).length, 8, 'and the whole volume is in the ring');
  });

  it('ascends to the chapter the READER reached, not the one they entered at', () => {
    // Enter at Genesis, read on into Exodus, then press the parent button.
    const h = inVerseMode();
    const chain = h.layoutBindings.getBibleVerseChain('ALPH_1_1');
    const reached = chain.items.find(v => v && v.id === 'BETH_1_2');
    const state = {};
    const app = {
      setPrimaryItems: (items, idx) => { state.items = items; state.idx = idx; },
      setParentButtons: () => {}
    };
    assert.equal(h.parentHandler({ selected: reached, app }), true);
    assert.equal(state.items[state.idx].id, 'BETH/1', 'lands on the chapter the reader reached');
    // The chapters ring spans the WHOLE volume (cousin chain), the same as on
    // descent and the same as the chapter→book ascent — so rotating out of the
    // landed chapter crosses book boundaries. It used to strand on Exodus's 40
    // chapters alone; that was the cousin-ascent bug (Howell 2026-07-21).
    assert.ok(state.items.some(c => c && c.id === 'ALPH/1'), 'the first book reachable by rotating back');
    assert.ok(state.items.some(c => c && c.id === 'GAMM/1'), 'the last by rotating forward');
  });

  it('names the book and chapter under the magnifier, live', () => {
    // "BOOK NUMERAL" — no word between: the numeral is already the citation
    // form for a chapter, so CAP would only re-state it. The numeral is the
    // READER'S (2026-08-02): Roman here because this table says Latin.
    const h = inVerseMode();
    const chain = h.layoutBindings.getBibleVerseChain('ALPH_1_1');
    const pick = id => chain.items.find(v => v && v.id === id);
    assert.equal(h.getParentLabel(pick('ALPH_1_1')), 'ALPHA I');
    assert.equal(h.getParentLabel(pick('ALPH_2_1')), 'ALPHA II', 'updates as reading crosses over');
    // The ring runs the whole volume, so the BOOK has to move too.
    assert.equal(h.getParentLabel(pick('BETH_1_1')), 'BETA I',
      'crossing into a new book is legible in the header');
    assert.equal(h.getParentLabel(pick('GAMM_1_1')), 'GAMMA I');
  });

  it('the parent button counts in the reader\'s own letters', () => {
    // From the phone, 2026-08-02: 'Αʹ ΣΑΜΟΥΗΛ XVII' — a Greek book name and
    // a Latin numeral in one label, because this site baked Roman. The book
    // followed the reader and the number did not.
    const greek = inVerseMode({ locale: 'greek', books: { ALPH: 'Γένεσις' } });
    const gChain = greek.layoutBindings.getBibleVerseChain('ALPH_1_1');
    const gPick = id => gChain.items.find(v => v && v.id === id);
    assert.equal(greek.getParentLabel(gPick('ALPH_2_1')), 'Γένεσις βʹ',
      'and Greek is left in its own case — uppercasing strips its accents');

    const hebrew = inVerseMode({ locale: 'hebrew', books: { ALPH: 'בראשית' } });
    const hChain = hebrew.layoutBindings.getBibleVerseChain('ALPH_1_1');
    const hPick = id => hChain.items.find(v => v && v.id === id);
    assert.equal(hebrew.getParentLabel(hPick('ALPH_2_1')), 'בראשית ב׳');
  });

  it('binds the chapter chain and names the book under the magnifier, live', () => {
    const h = bibleAdapter.createHandlers({
      manifest: realManifest, namesMap: { locale: 'latin', books: { ALPH: 'Alpha', BETH: 'Beta', GAMM: 'Gamma' }, testaments: { T1: 'First', T2: 'Second' } }, options: { activeEdition: 'ED', translation: 'ED' }
    });
    h.layoutBindings.setBibleMode('chapter');
    assert.equal(typeof h.layoutBindings.getBibleChapterChain, 'function');
    const chain = h.layoutBindings.getBibleChapterChain('ALPH/1');
    assert.equal(chain.items[chain.selectedIndex].id, 'ALPH/1', 'entered at the chapter tapped');
    const pick = id => chain.items.find(c => c && c.id === id);
    assert.equal(h.getParentLabel(pick('ALPH/2')), 'ALPHA');
    assert.equal(h.getParentLabel(pick('BETH/1')), 'BETA', 'the header follows the sweep across books');
    assert.equal(h.getParentLabel(pick('GAMM/1')), 'GAMMA');
  });

  it('ascends from a chapter to the book the READER reached', () => {
    const h = bibleAdapter.createHandlers({
      manifest: realManifest, namesMap: { locale: 'latin', books: { ALPH: 'Alpha', BETH: 'Beta', GAMM: 'Gamma' }, testaments: { T1: 'First', T2: 'Second' } }, options: { activeEdition: 'ED', translation: 'ED' }
    });
    h.layoutBindings.setBibleMode('chapter');
    const chain = h.layoutBindings.getBibleChapterChain('ALPH/1');
    const reached = chain.items.find(c => c && c.id === 'GAMM/1');
    const state = {};
    const app = {
      setPrimaryItems: (items, idx) => { state.items = items; state.idx = idx; },
      setParentButtons: () => {}
    };
    assert.equal(h.parentHandler({ selected: reached, app }), true);
    assert.equal(state.items[state.idx].id, 'GAMM', 'lands on the book the reader reached, not the one they entered at');
    assert.equal(state.items.filter(Boolean).length, 3, 'among every book in the volume');
  });

  it('centres numerals on their nodes but leaves names beside them', () => {
    const h = inVerseMode();
    assert.equal(h.shouldCenterLabel({ item: { level: 'chapter' } }), true);
    assert.equal(h.shouldCenterLabel({ item: { level: 'verse' } }), true);
    assert.equal(h.shouldCenterLabel({ item: { level: 'book' } }), false,
      'book names keep the offset that reads well for words');
    assert.equal(h.shouldCenterLabel({ item: { level: 'testament' } }), false);
    assert.equal(h.shouldCenterLabel({}), false);
  });

  it('sets verses and chapters bare, as numbers — the tongue is added later', () => {
    const h = inVerseMode();
    const chain = h.layoutBindings.getBibleVerseChain('ALPH_2_2');
    const verse = chain.items.find(v => v && v.id === 'ALPH_2_2');
    assert.equal(verse.name, '2', 'no colon, no chapter — the header holds those');
    const chapters = getBibleChapters(realManifest, { id: 'ALPH' }, {}, 'book', 'ED');
    assert.deepEqual(chapters.map(c => c.name), ['1', '2'],
      'the chapter carries its number; the numeral system is chosen at render');
  });
});
