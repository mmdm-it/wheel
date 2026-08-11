// THE GENESIS 1 FIXTURE, IN THE H-11 LAYOUT (phase 1a, H-1's grant).
//
// Howell granted Genesis 1 in the Douay-Rheims and the Vulgate as a PUBLIC
// test fixture under WF-14, and NOTICE §1b makes that the only scripture a
// published document or this repository may carry. So this reads those two
// editions and NO others: the source chapter also holds WLC, LXX, SYN and
// more, and copying them here would publish corpus text the grant does not
// cover. The filter is the point, not an optimisation.
//
// Run:  node scripts/build-fixture-genesis1.mjs
//
// It reads the corpus READ-ONLY across the wall and writes only into this
// repository's own test/fixtures tree (WF-15).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const SOURCE = '/media/howell/dev_workspace/wheel-cargo/gutenberg/chapters/GENE/001.json';
const OUT = new URL('../test/fixtures/h11/gutenberg', import.meta.url).pathname;
const GRANTED = ['VUL', 'DRA'];
const VERSION = 'v1';

// OPAQUE IDS, AND DELIBERATELY ADVERSARIAL TO THE OLD ASSUMPTION.
//
// H-11 makes ids opaque; W-32 says position may order but may not identify.
// The tempting shortcut is `u1 … u31`, which is opaque in form and ordered in
// fact — and a fixture built that way would let an engine that still sorts by
// id text pass every test, then fail on the first real book. So the ids here
// are hashed: their alphabetical order does NOT match their spine order.
//
// That makes this fixture a PROOF rather than a demonstration. If Genesis 1
// renders in the right order against these ids, the engine is reading order
// from the spine, because there is nowhere else to get it.
const opaque = (kind, n) =>
  kind + createHash('sha1').update(`gen1:${kind}:${n}`).digest('hex').slice(0, 5);

const src = JSON.parse(readFileSync(SOURCE, 'utf-8'));
const verses = src.verses || {};
const ordinals = Object.keys(verses)
  .filter(k => /^\d+$/.test(k))
  .sort((a, b) => Number(a) - Number(b));

const unitId = opaque('b', 'GENE');
const utterances = ordinals.map(n => opaque('u', n));

const write = (rel, data) => {
  const file = path.join(OUT, VERSION, rel);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
  return rel;
};

// volume.json — the slim boot. No chapter level anywhere: chapters are the
// render-time projection H-11 says they are, so nothing here stores one.
write('volume.json', {
  _schema_version: '4.0',
  _note: 'H-11 layout fixture. Genesis 1 only, Douay-Rheims and Vulgate only (H-1 grant).',
  books: [{ id: unitId, leaves: utterances.length }],
  editions: GRANTED.map(code => ({ code, hasChart: true, proofread: true }))
});

// spine/{unitId}.json — the ORDER, which is the only place order lives.
write(`spine/${unitId}.json`, {
  book: unitId,
  utterances,                      // ordered; their text does not sort this way
  absent: {},
  lost: {}
});

// text/{EDITION}/{unitId}.json — text belongs to an (edition, address) pair,
// never to the utterance: the string IS that tradition's own cutting.
for (const code of GRANTED) {
  const text = {};
  for (const n of ordinals) {
    const t = verses[n]?.text?.[code];
    if (typeof t === 'string' && t.length) text[n] = t;
  }
  write(`text/${code}/${unitId}.json`, { book: unitId, edition: code, text });
}

// charts/{EDITION}/{unitId}.json — which seats exist, and what each spans.
// Genesis 1 is an identity run 1..31 in every edition: no merge, no sub-slot,
// no divergence. That is exactly why the fixture cannot demonstrate a merge
// (W-52) — there is none in it to show.
for (const code of GRANTED) {
  // CONTAINERS ARE THE CHART'S, PER EDITION (O-44, ruled 2026-08-11).
  //
  // `groups` is the chapter division, declared by THIS edition over the unit's
  // own ordinals — not inherited from the spine, which stays flat. The real
  // charts already work this way: an edition whose tradition gathers into one
  // container what another divides into two declares a different number of
  // groups, and both are correct.
  //
  // The range is a BOOK-ORDINAL range (H-11 item 3), not a spine chapter plus
  // an offset — that was the last Vulgate residue, and it leaves here.
  //
  // The label is a QUOTATION (H-2): what this edition calls the container, and
  // nothing the engine may parse for structure. The range says which utterances
  // belong; the label says only what to print.
  write(`charts/${code}/${unitId}.json`, {
    unit: unitId,
    edition: code,
    groups: [{ label: '1', from: 1, to: ordinals.length }],
    seats: ordinals.map((n, i) => ({ label: n, utterances: [utterances[i]] }))
  });
  write(`charts/${code}/index.json`, { edition: code, books: [unitId] });
}

console.log(`fixture: ${OUT}/${VERSION}`);
console.log(`  book ${unitId} · ${utterances.length} utterances · editions ${GRANTED.join(', ')}`);
const alphabetical = [...utterances].sort();
const same = alphabetical.every((id, i) => id === utterances[i]);
console.log(`  alphabetical order matches spine order: ${same}`
  + (same ? '  ⚠ the fixture proves nothing — reshuffle' : '  (good: the engine cannot fake it)'));
