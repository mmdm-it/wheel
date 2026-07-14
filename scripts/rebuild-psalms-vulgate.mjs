// Phase B: rebuild the Psalter to native Vulgate numbering (Howell's ruling,
// 2026-07-14). The v0 import matched Masoretic and Vulgate psalm numbers
// naively, so most of the Psalter carried the wrong Latin text.
//
// New structure: 150 chapter files numbered by VULGATE psalm. VUL text comes
// verbatim from the Clementine corpus (correct by construction). LXX text is
// carried by same (psalm, verse) position — Greek numbering matches Vulgate.
// All other editions (WLC/NAB/SYN/...) are Masoretic-numbered sources; their
// verses are carried into the mapped Vulgate psalm positionally, with any
// overflow preserved in a chapter-level `_unaligned_mt` stash (no text is
// ever dropped). Fine realignment of non-VUL editions is dimensions-era work.
// Usage: node scripts/rebuild-psalms-vulgate.mjs [--dry-run]
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { CHAPTERS_DIR, parseLat, detectTransform } from './vulgate-lib.mjs';

const dryRun = process.argv.includes('--dry-run');
const PSAL_DIR = join(CHAPTERS_DIR, 'PSAL');
const pad = n => String(n).padStart(3, '0');
const readChapterFile = (book, f) => JSON.parse(readFileSync(join(CHAPTERS_DIR, book, f), 'utf8'));

const transform = detectTransform(readChapterFile);
if (transform.rate < 0.995) { console.error('ABORT: transform detection failed'); process.exit(1); }
const clean = transform.fn;

// ── Masoretic → Vulgate psalm mapping ────────────────────────────────────
// Each VUL psalm lists its MT source segments in order.
// full: entire MT psalm; [from,to]: inclusive MT verse range.
const VUL_SOURCES = {};
const addSrc = (vul, mt, range = null) => { (VUL_SOURCES[vul] ||= []).push({ mt, range }); };
for (let p = 1; p <= 8; p++) addSrc(p, p);
addSrc(9, 9); addSrc(9, 10);
for (let v = 10; v <= 112; v++) addSrc(v, v + 1);
addSrc(113, 114); addSrc(113, 115);
addSrc(114, 116, [1, 9]);
addSrc(115, 116, [10, 19]);
for (let v = 116; v <= 145; v++) addSrc(v, v + 1);
addSrc(146, 147, [1, 11]);
addSrc(147, 147, [12, 20]);
for (let p = 148; p <= 150; p++) addSrc(p, p);

// ── Load sources ─────────────────────────────────────────────────────────
const latin = parseLat('Ps');
const mtFiles = {};
for (const f of readdirSync(PSAL_DIR).sort()) {
  mtFiles[Number.parseInt(f, 10)] = readChapterFile('PSAL', f);
}
const template = mtFiles[1];

// Ordered MT verse list for a source segment (each: {mtPsalm, mtVerse, verse})
const mtSegment = ({ mt, range }) => {
  const file = mtFiles[mt];
  if (!file) return [];
  const keys = Object.keys(file.verses || {}).map(Number).sort((a, b) => a - b);
  return keys
    .filter(k => !range || (k >= range[0] && k <= range[1]))
    .map(k => ({ mtPsalm: mt, mtVerse: k, verse: file.verses[String(k)] }));
};

// ── Build ────────────────────────────────────────────────────────────────
let vulVerses = 0, mtCarried = 0, mtStashed = 0, lxxCarried = 0;
const anchors = [];
for (let p = 1; p <= 150; p++) {
  const vulChapter = latin[String(p)];
  if (!vulChapter) { console.error(`ABORT: corpus missing psalm ${p}`); process.exit(1); }
  const vulKeys = Object.keys(vulChapter).map(Number).sort((a, b) => a - b);
  const mtSeq = (VUL_SOURCES[p] || []).flatMap(mtSegment);
  const firstSrc = VUL_SOURCES[p]?.[0]?.mt ?? p;
  // LXX rides the old same-numbered file (Greek numbering == Vulgate numbering)
  const lxxDonor = mtFiles[p];

  const verses = {};
  const unaligned = [];
  vulKeys.forEach((vk, i) => {
    vulVerses++;
    const src = mtSeq[i] || null;
    const text = {};
    if (src) {
      for (const [ed, t] of Object.entries(src.verse.text || {})) {
        if (ed === 'VUL' || ed === 'LXX') continue;
        text[ed] = t;
      }
      mtCarried++;
    }
    const lxxText = lxxDonor?.verses?.[String(vk)]?.text?.LXX;
    if (typeof lxxText === 'string' && lxxText.trim()) { text.LXX = lxxText; lxxCarried++; }
    text.VUL = clean(vulChapter[String(vk)]);
    const v_in = { VUL: vk };
    if (src) v_in.MT = src.mtVerse;
    verses[String(vk)] = { seq: i + 1, v_in, text };
  });
  // MT verses beyond the VUL verse count: stash, never drop.
  for (let i = vulKeys.length; i < mtSeq.length; i++) {
    const src = mtSeq[i];
    unaligned.push({ mt_psalm: src.mtPsalm, mt_verse: src.mtVerse, text: src.verse.text });
    mtStashed++;
  }

  const out = {
    _schema_version: template._schema_version,
    chapter_id: `PSAL_${pad(p)}`,
    book_key: 'PSAL',
    sequence: p,
    chapter_in: { VUL: p, LXX: p, MT: firstSrc },
    mt_sources: (VUL_SOURCES[p] || []).map(s => s.range ? `${s.mt}:${s.range[0]}-${s.range[1]}` : String(s.mt)),
    testament: template.testament,
    section: template.section,
    verses
  };
  if (unaligned.length) out._unaligned_mt = unaligned;
  if (!dryRun) writeFileSync(join(PSAL_DIR, `${pad(p)}.json`), JSON.stringify(out, null, 1) + '\n');

  if ([22, 50, 129].includes(p)) anchors.push(`VUL ${p}:1-2 → ${clean(vulChapter['1']).slice(0, 44)} | ${(vulChapter['2'] ? clean(vulChapter['2']) : '').slice(0, 44)}`);
}

console.log(`${dryRun ? '[DRY RUN] ' : ''}rebuilt 150 psalms | VUL verses: ${vulVerses} (100% Latin by construction)`);
console.log(`MT text carried: ${mtCarried} | stashed (unaligned overflow): ${mtStashed} | LXX carried: ${lxxCarried}`);
console.log('anchors:');
anchors.forEach(a => console.log('  ' + a));
