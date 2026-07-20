import assert from 'node:assert/strict';
import { readFileSync as _readFileSyncBible } from 'node:fs';
import { fileURLToPath as _fileURLToPathBible } from 'node:url';
import _pathBible from 'node:path';

import { describe, it } from 'node:test';
import { bibleAdapter, normalize as normalizeBible } from '../src/adapters/bible-adapter.js';

const sampleManifest = {
  Gutenberg_Bible: {
    display_config: {
      volume_name: 'Gutenberg Bible',
      hierarchy_levels: {
        testament: { color: '#111' },
        section: { color: '#222' },
        book: { color: '#333' },
        chapter: { color: '#444' }
      }
    },
    testaments: {
      OT: {
        name: 'Old',
        sort_number: 1,
        sections: {
          torah: {
            name: 'Torah',
            sort_number: 1,
            books: {
              GEN: {
                book_name: 'Genesis',
                book_number: 1,
                sort_number: 1,
                chapters: {
                  '1': { id: 'GEN:1', name: 'Chapter 1', sort_number: 1 },
                  '2': { name: 'Chapter 2', chapter_number: 2 }
                }
              }
            }
          }
        }
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
    const sections = normalized.items.filter(i => i.level === 'section');
    const books = normalized.items.filter(i => i.level === 'book');
    const chapters = normalized.items.filter(i => i.level === 'chapter');
    assert.equal(testaments.length, 1);
    assert.equal(sections.length, 1);
    assert.equal(books.length, 1);
    assert.equal(chapters.length, 2);
    assert.equal(normalized.meta.colors.book, '#333');
    assert.ok(normalized.links.find(l => l.to === 'GEN'));
    assert.ok(normalized.links.find(l => l.to === 'GEN:1'));
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
    assert.ok(bookDetail.body.includes('Book') || bookDetail.body.includes('chapters'));
    const chapterDetail = bibleAdapter.detailFor({ id: 'GEN:1', level: 'chapter', name: 'Chapter 1' }, sampleManifest);
    assert.equal(chapterDetail.type, 'text');
    assert.ok(chapterDetail.text.includes('Genesis'));
  });
});


describe('reading on through the volume', () => {
  const __d = _pathBible.dirname(_fileURLToPathBible(import.meta.url));
  const realManifest = JSON.parse(_readFileSyncBible(
    _pathBible.resolve(__d, '../data/gutenberg/manifest.json'), 'utf-8'));

  const inVerseMode = () => {
    const h = bibleAdapter.createHandlers({ manifest: realManifest, namesMap: {}, options: {} });
    h.layoutBindings.setBibleMode('verse');
    return h;
  };

  it('binds the continuous chain for the descent', () => {
    // The binding gauntlet again: dropped by a whitelist, the verse ring
    // would silently fall back to one chapter and dead-end at its end.
    const h = inVerseMode();
    assert.equal(typeof h.layoutBindings.getBibleVerseChain, 'function');
    const chain = h.layoutBindings.getBibleVerseChain('GENE_1_31');
    assert.equal(chain.items[chain.selectedIndex].id, 'GENE_1_31', 'entered at the verse tapped');
    assert.ok(chain.items.length > 30000, 'and the whole volume is in the ring');
  });

  it('ascends to the chapter the READER reached, not the one they entered at', () => {
    // Enter at Genesis, read on into Exodus, then press the parent button.
    const h = inVerseMode();
    const chain = h.layoutBindings.getBibleVerseChain('GENE_1_31');
    const reached = chain.items.find(v => v && v.id === 'EXO_3_4');
    const state = {};
    const app = {
      setPrimaryItems: (items, idx) => { state.items = items; state.idx = idx; },
      setParentButtons: () => {}
    };
    assert.equal(h.parentHandler({ selected: reached, app }), true);
    assert.equal(state.items[state.idx].id, 'EXO:3', 'lands on Exodus 3');
    assert.equal(state.items.length, 40, 'among Exodus\'s own chapters');
  });

  it('names the chapter under the magnifier, live', () => {
    const h = inVerseMode();
    const chain = h.layoutBindings.getBibleVerseChain('GENE_1_1');
    const pick = id => chain.items.find(v => v && v.id === id);
    assert.equal(h.getParentLabel(pick('GENE_1_1')), 'CAPITULUM I');
    assert.equal(h.getParentLabel(pick('GENE_2_1')), 'CAPITULUM II', 'updates as reading crosses over');
  });
});
