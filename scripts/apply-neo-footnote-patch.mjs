#!/usr/bin/env node
/**
 * apply-neo-footnote-patch.mjs — apply the hand-read NEO footnote repairs.
 *
 * These 36 verses lost the '*' that closes an inline footnote, so no rule can
 * tell where the note stops and scripture resumes; each was read and cut by
 * hand into scripts/bible-neo-footnote-patch.json.
 *
 * The guard below is the point of this script: a repair may only DELETE. Every
 * word of the replacement must still appear, in order, in the verse as it
 * stands — so the patch cannot quietly introduce scripture that was never in
 * the source. Only sentence-final punctuation may be added, where cutting a
 * trailing note left the verse open.
 *
 *   node scripts/apply-neo-footnote-patch.mjs           # dry run
 *   node scripts/apply-neo-footnote-patch.mjs --apply
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHAPTERS = join(ROOT, 'data/gutenberg/chapters');
const APPLY = process.argv.includes('--apply');

const patch = JSON.parse(readFileSync(join(ROOT, 'scripts/bible-neo-footnote-patch.json'), 'utf8')).verses;

const words = s => s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
// Is `next` reachable from `prev` by deleting words only?
const isDeletionOnly = (prev, next) => {
  const a = words(prev), b = words(next);
  let i = 0;
  for (const w of b) {
    while (i < a.length && a[i] !== w) i++;
    if (i === a.length) return w;   // this word is not in the original
    i++;
  }
  return null;
};

let applied = 0, skipped = 0, rejected = 0;
const touched = new Map();

for (const [ref, replacement] of Object.entries(patch)) {
  const [book, loc] = ref.split(' ');
  const [chapter, verse] = loc.split(':');
  const path = join(CHAPTERS, book, `${String(chapter).padStart(3, '0')}.json`);
  const data = touched.get(path) || JSON.parse(readFileSync(path, 'utf8'));
  touched.set(path, data);

  const current = data.verses?.[verse]?.text?.NEO;
  if (current === undefined) { console.log(`MISSING  ${ref}`); rejected++; continue; }
  if (current === replacement) { skipped++; continue; }

  const invented = isDeletionOnly(current, replacement);
  if (invented) {
    console.log(`REJECTED ${ref} — "${invented}" is not in the source verse`);
    rejected++;
    continue;
  }
  data.verses[verse].text.NEO = replacement;
  applied++;
  console.log(`ok       ${ref}  (${current.length} → ${replacement.length} chars)`);
}

if (APPLY && !rejected) {
  for (const [path, data] of touched) writeFileSync(path, JSON.stringify(data));
}

console.log(`\n${APPLY && !rejected ? 'APPLIED' : 'DRY RUN'}: ${applied} repaired, ${skipped} already clean, ${rejected} rejected`);
if (rejected) { console.log('Nothing written — fix the rejected entries first.'); process.exitCode = 1; }
