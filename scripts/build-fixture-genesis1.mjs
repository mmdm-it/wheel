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
const MANIFEST = '/media/howell/dev_workspace/wheel-cargo/gutenberg/manifest.json';
const REGISTRY = '/media/howell/dev_workspace/wheel-cargo/gutenberg/translations.json';
const OUT = new URL('../test/fixtures/h11/gutenberg', import.meta.url).pathname;
const VERSION = 'v1';

// WHAT IS ON DISK AND WHAT IS OFFERED ARE NOW DIFFERENT QUESTIONS (H-14).
//
// Both editions are granted (H-1, H-5) and both are written, because the pair
// is what exercises the per-edition machinery. But under the wall
// `volume.json` is the SOLE enumeration, and Howell ruled 1a's done condition
// as Douay-Rheims alone — so only DRA is enumerated, and the Vulgate sits on
// disk unreachable.
//
// That gap is deliberate and it is a TEST, not an oversight: a reader that
// can reach VUL is a reader consulting something other than volume.json, and
// the suite asserts it cannot. An enumeration is only "sole" if something
// present is provably invisible.
const GRANTED = ['VUL', 'DRA'];
const OFFERED = ['DRA'];

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

// THE GROUPING IS REAL, READ FROM THE CORPUS, NEVER INVENTED (Howell ruled
// 2026-08-12: volume.json carries it). The wall must not quietly flatten the
// reader's world — the feel is frozen for the whole of phase 1.
//
// THE READER'S LEVELS ARE TESTAMENT, BOOK, CHAPTER, VERSE (Howell, 2026-08-12,
// correcting me). **There is no section level**, and this fixture briefly
// carried one because I read the level list off the corpus's
// `hierarchy_levels`, which still declares `section` with a display name and
// focus-ring properties as though it were navigable. The ENGINE is the truth
// here and it is unambiguous: it builds items at root, testament, book,
// chapter and verse, ascends from a book straight to its testament, and has
// no section ring anywhere. `sectionId` survives only as data the seating
// chart walks, never as a place the reader can stand.
//
// So the section is deliberately NOT carried. Emitting it would have put a
// dead level into the sole enumeration on the strength of a stale
// declaration — a derived-view failure with a straight face.
//
// The testament id goes OPAQUE like every other id (H-11 item 2). The corpus
// spells it `Vetus_Testamentum`, which is the filesystem writing down what a
// thing IS.
const manifest = JSON.parse(readFileSync(MANIFEST, 'utf-8'));
const registry = JSON.parse(readFileSync(REGISTRY, 'utf-8'));

let placement = null;
for (const [testamentKey, testament] of Object.entries(manifest.Gutenberg_Bible?.testaments || {})) {
  for (const section of Object.values(testament.sections || {})) {
    if (section.books?.GENE) placement = { testamentKey };
  }
}
if (!placement) throw new Error('the corpus does not place GENE — the fixture cannot invent a home for it');

const testamentId = opaque('t', placement.testamentKey);

const write = (rel, data) => {
  const file = path.join(OUT, VERSION, rel);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
  return rel;
};

// volume.json — the slim boot. No chapter level anywhere: chapters are the
// render-time projection H-11 says they are, so nothing here stores one.
// volume.json — THE SOLE ENUMERATION (H-14), and it grows as increments land.
// Nothing else says what the volume contains: not a manifest, not a directory
// listing, not an index derived from either. Today it holds one book, which is
// the whole of the Bible the engine can see.
//
// The grouping is carried here rather than derived, so the reader keeps the
// six levels it has always had. With one book every group has one child, which
// is degenerate but correct — and it is the shape 79 books will hang from.
// THE PRESENTATION CONFIG COMES WITH THE VOLUME (H-14).
//
// The engine reads `display_config` for colours, level styling, startup and
// leaf level, and under the wall it cannot reach the legacy manifest to get
// it. So the fixture carries its own, derived from the corpus's rather than
// retyped — a hand-copy would drift the day either changed.
//
// THREE THINGS ARE NARROWED, and each is the wall showing through:
//   - `editions.registry` is REMOVED. It points at translations.json, which
//     is exactly the pre-doctrine file the engine may no longer read.
//     Servability now lives in volume.json's own `editions` array.
//   - languages and editions narrow to what is actually OFFERED. Listing ten
//     languages the volume cannot serve would put nine dead seats on the
//     reader's shelf.
//   - `hierarchy_levels.section` is DROPPED. The corpus still declares it
//     with a display name and focus-ring positioning as though a reader could
//     stand there; the engine has no section ring and never had one.
const sourceConfig = manifest.Gutenberg_Bible?.display_config || {};
const offeredLanguages = [...new Set(OFFERED.map(c => registry.translations?.[c]?.language || 'english'))];
const { section, ...levelsWithoutSection } = sourceConfig.hierarchy_levels || {};

const displayConfig = {
  ...sourceConfig,
  volume_data_version: VERSION,
  // `split_chapters` DESCRIBES THE STORAGE THE WALL REMOVED. It is the
  // pre-doctrine layout — one file per chapter — and H-11 abolished the
  // chapter as a storage level, so carrying it forward would be a stale
  // assertion riding along inside the config. Found by a test that refuses
  // any retired term in the internal root, which caught it in a value rather
  // than in a key; only the validator reads it, and it warns rather than
  // requires.
  structure_type: 'per_unit',
  hierarchy_levels: levelsWithoutSection,
  languages: {
    available: offeredLanguages,
    default: offeredLanguages[0],
    labels: Object.fromEntries(offeredLanguages
      .map(l => [l, sourceConfig.languages?.labels?.[l] || l.toUpperCase()]))
  },
  editions: {
    available: Object.fromEntries(offeredLanguages.map(lang => [
      lang, OFFERED.filter(c => (registry.translations?.[c]?.language || 'english') === lang)
    ])),
    default: Object.fromEntries(offeredLanguages.map(lang => [
      lang, OFFERED.find(c => (registry.translations?.[c]?.language || 'english') === lang)
    ])),
    labels: Object.fromEntries(OFFERED.map(c => [c, registry.translations?.[c]?.name || c]))
  }
};

write('volume.json', {
  _schema_version: '4.0',
  _note: 'H-11 layout fixture under the H-14 wall. Genesis 1, Douay-Rheims offered.',
  display_config: displayConfig,
  testaments: [{
    id: testamentId,
    books: [{ id: unitId, leaves: utterances.length }]
  }],
  // SERVABILITY LIVES HERE NOW, because the wall forbids reading the legacy
  // registry. `proofread: false` is the corpus's own value for DRA, verified
  // rather than assumed — and it is what makes H-14's stated behaviour true:
  // the volume is dark without `?proofread=true` and offers Genesis 1 with it.
  editions: OFFERED.map(code => ({
    code,
    hasChart: true,
    proofread: registry.translations?.[code]?.proofread === true,
    language: registry.translations?.[code]?.language || 'english',
    direction: registry.translations?.[code]?.direction || 'ltr',
    name: registry.translations?.[code]?.name || code
  }))
});

// names/{lang}.json — the display names, in the reader's tongue (H-11 item 1).
// Under the wall these cannot come from the legacy registry, so the fixture
// carries its own. Every name here is a QUOTATION from the corpus (H-2); none
// is manufactured, and an id with no name would display unnamed rather than
// wearing its own id.
for (const code of OFFERED) {
  const lang = registry.translations?.[code]?.language || 'english';
  const names = registry.names?.[lang] || {};
  write(`names/${lang}.json`, {
    testaments: { [testamentId]: names.testaments?.[placement.testamentKey] || null },
    books: { [unitId]: names.books?.GENE || null },
    // Latin short forms are the volume's own tongue and the near-universal
    // citation; they stand in for wayfinding until each language carries its
    // own, exactly as the engine already treats them.
    book_abbreviations: { [unitId]: registry.names?.latin?.book_abbreviations?.GENE || null }
  });
}

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
  write(`charts/${code}/index.json`, { edition: code, units: [unitId] });
}

console.log(`fixture: ${OUT}/${VERSION}`);
console.log(`  book ${unitId} · ${utterances.length} utterances`);
console.log(`  on disk:  ${GRANTED.join(', ')}`);
console.log(`  OFFERED:  ${OFFERED.join(', ')}  (volume.json is the sole enumeration — H-14)`);
console.log(`  levels:   testament ${testamentId} › book ${unitId} › chapter › verse`);
const alphabetical = [...utterances].sort();
const same = alphabetical.every((id, i) => id === utterances[i]);
console.log(`  alphabetical order matches spine order: ${same}`
  + (same ? '  ⚠ the fixture proves nothing — reshuffle' : '  (good: the engine cannot fake it)'));
