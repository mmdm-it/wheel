#!/usr/bin/env node
// Stamp every chapter in the Gutenberg manifest with its verse_count.
//
// WHY: the verse ring is a CONTINUOUS chain across the whole volume — the
// reader finishes a chapter and keeps reading — so the chain has to know
// how many verses every chapter holds WITHOUT fetching 1,215 chapter files
// to find out. Verse keys are contiguous 1..N, so a single count per
// chapter is the whole skeleton. Text still arrives per chapter, on demand.
//
// Idempotent: re-run after any chapter file changes.
//
//   node scripts/add-verse-counts.mjs

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const MANIFEST = 'data/gutenberg/manifest.json';

const raw = readFileSync(MANIFEST, 'utf-8');
// Preserve the file's own formatting. These manifests are checked-in data:
// one is minified, the other is indented and 9,600 lines long, and
// reformatting either turns an additive change into an unreviewable
// rewrite of the whole file.
const sourceIndent = /^\{\r?\n([ \t]+)"/.exec(raw)?.[1]?.length ?? 0;
const trailingNewline = raw.endsWith('\n');
const manifest = JSON.parse(raw);
const bible = manifest?.Gutenberg_Bible;
if (!bible?.testaments) {
  console.error('add-verse-counts: no Gutenberg_Bible.testaments in', MANIFEST);
  process.exit(1);
}

let chapters = 0;
let verses = 0;
let missing = 0;
let changed = 0;

for (const testament of Object.values(bible.testaments)) {
  for (const section of Object.values(testament?.sections || {})) {
    for (const book of Object.values(section?.books || {})) {
      for (const [chapterKey, chapter] of Object.entries(book?.chapters || {})) {
        chapters += 1;
        const file = chapter?._external_file || chapter?.external_file;
        if (!file || !existsSync(file)) {
          missing += 1;
          console.warn(`  ! ${book.book_key}/${chapterKey}: no chapter file (${file || 'none'})`);
          continue;
        }
        const data = JSON.parse(readFileSync(path.resolve(file), 'utf-8'));
        const keys = Object.keys(data?.verses || {});
        const count = keys.length;
        // The chain synthesizes ids 1..N, so a chapter numbered otherwise
        // would silently lose verses. Say so rather than guess.
        const contiguous = keys.map(Number).every((n, i) => n === i + 1);
        if (!contiguous) {
          console.warn(`  ! ${book.book_key}/${chapterKey}: verse keys are not 1..${count}`);
        }
        if (chapter.verse_count !== count) changed += 1;
        chapter.verse_count = count;
        verses += count;
      }
    }
  }
}

writeFileSync(MANIFEST, JSON.stringify(manifest, null, sourceIndent || undefined) + (trailingNewline ? '\n' : ''));
console.log(`add-verse-counts: ${chapters} chapters, ${verses} verses (${changed} counts written, ${missing} chapters without a file)`);
