#!/usr/bin/env node
/**
 * sync-bible-manifest.mjs — re-derive the manifest's book index from the data.
 *
 * manifest.json carries a flat `books` index alongside the `testaments` tree.
 * Nothing in src/ reads it (the reader localises through translations.json's
 * `names`, and counts through each chapter file), so it drifted: 65 of 67 books
 * claimed 0 or 1 verses, and 503 of 603 localised titles were the English name
 * repeated in every language. Both are now derived rather than typed.
 *
 *   node scripts/sync-bible-manifest.mjs           # dry run
 *   node scripts/sync-bible-manifest.mjs --apply
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST = join(ROOT, 'data/gutenberg/manifest.json');
const TRANSLATIONS = join(ROOT, 'data/gutenberg/translations.json');
const CHAPTERS = join(ROOT, 'data/gutenberg/chapters');
const APPLY = process.argv.includes('--apply');

const manifestFile = JSON.parse(readFileSync(MANIFEST, 'utf8'));
const volume = manifestFile.Gutenberg_Bible;
const translations = JSON.parse(readFileSync(TRANSLATIONS, 'utf8'));

// Ground truth: count what is actually on disk.
const counted = {};
for (const bookKey of Object.keys(volume.books)) {
  let verses = 0;
  const chapters = readdirSync(join(CHAPTERS, bookKey)).filter(f => f.endsWith('.json'));
  for (const file of chapters) {
    verses += Object.keys(JSON.parse(readFileSync(join(CHAPTERS, bookKey, file), 'utf8')).verses || {}).length;
  }
  counted[bookKey] = { verses, chapters: chapters.length };
}

const changes = { verses: [], chapters: [], names: 0 };
for (const [bookKey, book] of Object.entries(volume.books)) {
  const { verses, chapters } = counted[bookKey];
  if (book.verses !== verses) { changes.verses.push(`${bookKey}: ${book.verses} → ${verses}`); book.verses = verses; }
  if (book.chapters !== chapters) { changes.chapters.push(`${bookKey}: ${book.chapters} → ${chapters}`); book.chapters = chapters; }

  for (const language of Object.keys(book.languages || {})) {
    const localised = translations.names?.[language]?.books?.[bookKey];
    if (localised && book.languages[language] !== localised) {
      book.languages[language] = localised;
      changes.names++;
    }
  }
}

console.log(APPLY ? '=== APPLIED ===' : '=== DRY RUN (pass --apply to write) ===');
console.log(`verse totals corrected : ${changes.verses.length}`);
console.log(`   ${changes.verses.slice(0, 6).join(', ')}${changes.verses.length > 6 ? ' …' : ''}`);
console.log(`chapter totals corrected: ${changes.chapters.length}`);
console.log(`localised titles filled : ${changes.names}`);
console.log(`total verses on disk    : ${Object.values(counted).reduce((n, b) => n + b.verses, 0)}`);

if (APPLY) writeFileSync(MANIFEST, JSON.stringify(manifestFile, null, 2) + '\n');
