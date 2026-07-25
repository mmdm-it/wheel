#!/usr/bin/env node
/**
 * clean-bible-text.mjs — repair source-markup damage in the Bible chapter JSON.
 *
 * Each source edition arrived with the scaffolding of its own digital format
 * still attached: CP1252 bytes never decoded, HTML entities never unescaped,
 * USFM tags, morphological dividers, typesetting rules. The adapter passes verse
 * text through verbatim (bible-adapter.js detailFor), so every one of these
 * renders literally in the reader.
 *
 *   node scripts/clean-bible-text.mjs            # dry run: report + samples
 *   node scripts/clean-bible-text.mjs --apply    # rewrite the chapter files
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHAPTERS = join(ROOT, 'data/gutenberg/chapters');
const APPLY = process.argv.includes('--apply');

// Deliberately conservative. Runs of spaces and a space before a comma are
// always damage; a space before ; : ! ? is house style (and mandatory in
// French), so it is left exactly as the edition set it.
const squash = s => s.replace(/[ \t]{2,}/g, ' ').replace(/ +,/g, ',').trim();

// Per-edition repairs. Each returns cleaned text; `squash` runs after all of them.
const CLEANERS = {
  // Westminster Leningrad Codex ships the morphological edition, where '/'
  // separates prefixes and suffixes from the stem (בְּ/רֵאשִׁית). The consonantal
  // text is what a reader wants.
  WLC: t => t.replace(/\//g, ''),

  // Clementine Vulgate, VulSearch-style electronic text:
  //   U+009C  a raw CP1252 byte for 'œ' that was never decoded (fœderis, cœlum)
  //   /       end-of-line rule in poetry
  //   [ ]     poetic-section delimiters, spanning verses so they rarely balance
  //   \       paragraph rule
  //   <X>     speaker and acrostic rubrics (<Sponsa>, <Aleph>) — kept as text
  VUL: t => t
    .replace(//g, 'œ')
    .replace(/<([^>]+)>/g, '$1. ')
    .replace(/[/[\]\\]/g, ''),

  // Bible Crampon arrived as raw USFM with the footnote apparatus inlined.
  // Order matters: unwrap the tagged spans first so the only '*' left in the
  // string is a footnote terminator.
  NEO: t => t
    .replace(/\\\+w\s+([^|\\]*?)\|strong="[^"]*"\\\+w\*{0,2}/g, '$1') // \+w Yahweh|strong="H3068"\+w**
    .replace(/\|(?:lemma|strong)="[^"]*"(\s*(?:lemma|strong)="[^"]*")*/g, '') // same, tag wrapper lost
    .replace(/\\\+\w+\*{1,2}/g, '')                                   // closers: \+qt* \+it*
    .replace(/\\\+\w+\s*/g, '')                                       // openers: \+qt \+it
    .replace(/\[\[[^\]]*\]\]/g, '')                                   // [[Bible_Crampon_1923/…]]
    .replace(/\+\s*\d+:\d+\s[\s\S]*?\*/g, '')                         // + 1:3 3. <footnote>*
    .replace(/\*/g, '')                                               // mis-terminated remnants
    // 76 footnotes lost their '*' terminator, so the rule above cannot see
    // where they end. Where the verse before the marker already closes on
    // terminal punctuation the note is a trailing one and the rest of the
    // string is all apparatus (verified by hand over all 76). The other 36
    // interrupt a sentence that resumes afterwards; guessing the resumption
    // point would mean cutting scripture, so they are deliberately left.
    .replace(/([.!?»:;’"])\s*\+\s*\d+:\d+\s[\s\S]*$/, '$1'),

  // Vatican Spanish was HTML-escaped and never unescaped, so every inverted
  // question and exclamation mark in the edition is broken.
  VAT_ES: t => t
    .replace(/&iquest;/g, '¿')
    .replace(/&iexcl;/g, '¡')
    .replace(/&uuml;/g, 'ü')
    .replace(/\s*\/\s*/g, ' '),

  NAB: t => t.replace(/&copy;/g, '©')
};

const stats = {};
const samples = {};
// A repair should delete scaffolding, not scripture. Anything that removes an
// unusual share of a verse gets listed so it can be eyeballed.
const suspicious = [];
const bump = (code, key, before, after) => {
  stats[code] ??= {};
  stats[code][key] = (stats[code][key] || 0) + 1;
  const bucket = (samples[code] ??= []);
  if (bucket.length < 3) bucket.push({ before, after });
};

let filesChanged = 0;
for (const book of readdirSync(CHAPTERS).sort()) {
  for (const file of readdirSync(join(CHAPTERS, book)).sort()) {
    if (!file.endsWith('.json')) continue;
    const path = join(CHAPTERS, book, file);
    const raw = readFileSync(path, 'utf8');
    const chapter = JSON.parse(raw);
    let touched = false;

    for (const verse of Object.values(chapter.verses || {})) {
      for (const [code, text] of Object.entries(verse.text || {})) {
        if (typeof text !== 'string') continue;
        const cleaned = squash(CLEANERS[code] ? CLEANERS[code](text) : text);
        if (cleaned === text) continue;
        if (!cleaned) { // never let a repair empty a verse
          bump(code, 'REFUSED-would-empty', text, cleaned);
          continue;
        }
        // NEO footnotes are bounded by a bare '*'; a footnote whose terminator
        // went missing would let the match run on into real scripture.
        const kept = cleaned.length / text.length;
        if (kept < 0.5 && text.length > 60) {
          suspicious.push({ code, book, file, kept: kept.toFixed(2), before: text, after: cleaned });
        }
        verse.text[code] = cleaned;
        bump(code, 'cleaned', text, cleaned);
        touched = true;
      }
    }

    if (touched) {
      filesChanged++;
      if (APPLY) writeFileSync(path, JSON.stringify(chapter));
    }
  }
}

console.log(APPLY ? '=== APPLIED ===' : '=== DRY RUN (pass --apply to write) ===');
console.log(`files ${APPLY ? 'rewritten' : 'that would change'}: ${filesChanged}\n`);
for (const [code, counts] of Object.entries(stats).sort()) {
  console.log(`${code.padEnd(8)} ${JSON.stringify(counts)}`);
  for (const { before, after } of samples[code]) {
    console.log(`    -  ${JSON.stringify(before.slice(0, 150))}`);
    console.log(`    +  ${JSON.stringify(after.slice(0, 150))}`);
  }
  console.log();
}

console.log(`=== verses that shrank by more than half: ${suspicious.length} ===`);
for (const s of suspicious.slice(0, 25)) {
  console.log(`  ${s.code} ${s.book}/${s.file} kept=${s.kept}`);
  console.log(`    -  ${JSON.stringify(s.before.slice(0, 240))}`);
  console.log(`    +  ${JSON.stringify(s.after.slice(0, 240))}`);
}
