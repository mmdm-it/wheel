import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { buildBiblePyramid } from '../src/pyramid/volume-pyramid.js';

// Howell ruling 2026-07-17: book names in the CHILD PYRAMID use the short
// abbreviations of Gutenberg ebook #825 (GN, NM, 2 COR). The focus ring and
// magnifier keep the full names.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const translations = JSON.parse(readFileSync(path.resolve(__dirname, '../data/gutenberg/translations.json'), 'utf-8'));

describe('bible book abbreviations (#825)', () => {
  const latin = translations.names.latin;

  it('covers every Latin book exactly', () => {
    const bookKeys = Object.keys(latin.books);
    const abbrevKeys = Object.keys(latin.book_abbreviations);
    assert.deepEqual(abbrevKeys.sort(), bookKeys.sort());
  });

  it('matches the ruled examples', () => {
    assert.equal(latin.book_abbreviations.GENE, 'GN');
    assert.equal(latin.book_abbreviations.NUME, 'NM');
    assert.equal(latin.book_abbreviations.II_COR, '2 COR');
  });

  it('renames book nodes in the pyramid only — the chain keeps full names', () => {
    const fullName = 'Ad Corinthios II';
    const chainItems = [{ id: 'II_COR', name: fullName, level: 'book' }];
    const pyramid = buildBiblePyramid({
      manifest: { Gutenberg_Bible: {} },
      namesMap: { bookAbbreviations: { II_COR: '2 COR' } },
      getBibleChapters: () => [],
      getBibleBooksForTestament: () => ({ items: chainItems }),
      bibleModeRef: () => 'testament'
    });
    const children = pyramid.getChildren({ selected: { id: 'Novum_Testamentum' } });
    assert.equal(children[0].name, '2 COR', 'pyramid node shows the abbreviation');
    assert.equal(chainItems[0].name, fullName, 'the chain item itself is untouched');
  });
});
