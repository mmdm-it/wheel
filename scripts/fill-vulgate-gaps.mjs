// Phase B: fill missing VUL verse text from the Clementine corpus for all
// books EXCEPT Psalms (which is rebuilt to Vulgate numbering by
// rebuild-psalms-vulgate.mjs). Same-numbered chapter:verse fills only;
// anything unmappable is reported, never guessed.
// Usage: node scripts/fill-vulgate-gaps.mjs [--dry-run]
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CHAPTERS_DIR, BOOK_TO_LAT, parseLat, detectTransform } from './vulgate-lib.mjs';

const dryRun = process.argv.includes('--dry-run');
const readChapterFile = (book, f) => JSON.parse(readFileSync(join(CHAPTERS_DIR, book, f), 'utf8'));

const transform = detectTransform(readChapterFile);
console.log(`transform: ${transform.name} (${transform.match}/${transform.total} baseline matches; all: ${transform.all.join(' ')})`);
if (transform.rate < 0.995) {
  console.error('ABORT: no candidate transform reproduces existing text faithfully');
  process.exit(1);
}

let filled = 0, alreadyPresent = 0, residual = [];
for (const book of readdirSync(CHAPTERS_DIR).sort()) {
  if (book === 'PSAL') continue;
  const latName = BOOK_TO_LAT[book];
  if (!latName) { residual.push(`${book}: no corpus mapping`); continue; }
  const lat = parseLat(latName);
  for (const f of readdirSync(join(CHAPTERS_DIR, book)).sort()) {
    const path = join(CHAPTERS_DIR, book, f);
    const data = readChapterFile(book, f);
    const chNum = String(Number.parseInt(f, 10));
    let dirty = false;
    for (const [vk, verse] of Object.entries(data.verses || {})) {
      const existing = verse?.text?.VUL;
      if (typeof existing === 'string' && existing.trim()) { alreadyPresent++; continue; }
      const corpus = lat[chNum]?.[vk];
      if (typeof corpus === 'string') {
        verse.text = verse.text || {};
        verse.text.VUL = transform.fn(corpus);
        if (verse.v_in && verse.v_in.VUL === undefined) verse.v_in.VUL = Number(vk);
        filled++;
        dirty = true;
      } else {
        residual.push(`${book} ${chNum}:${vk}`);
      }
    }
    if (dirty && !dryRun) writeFileSync(path, JSON.stringify(data, null, 1) + '\n');
  }
}

console.log(`filled: ${filled} | already present: ${alreadyPresent} | residual (unmappable): ${residual.length}${dryRun ? ' [DRY RUN — nothing written]' : ''}`);
if (residual.length) {
  console.log('residuals:');
  for (const r of residual.slice(0, 40)) console.log('  ' + r);
  if (residual.length > 40) console.log(`  … and ${residual.length - 40} more`);
}
