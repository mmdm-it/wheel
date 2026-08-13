// FORBIDDEN VOLUME VOCABULARY (O-43, Howell 2026-08-11).
//
// The name lint beside this one polices volume NAMES — `bible`, `calendar`.
// This polices volume VOCABULARY: the words a volume uses for its own levels.
// The gap was found the expensive way. `core/identity.js` shipped taking a
// `bookId` and speaking of books and verses in engine-general code, passed the
// name lint cleanly, and was only caught when Howell read it and ruled the
// engine surface volume-neutral. A rule remembered is a rule that fails on the
// day everyone is busy.
//
// THE BANNED LIST IS DERIVED, NEVER TYPED (Howell's instruction, and the same
// principle as W-48's hasChart and O-42's chart index). It is read from the
// volumes' own `hierarchy_levels` declarations, so a volume that invents a new
// level is policed the day it declares one — a hand-typed list would go stale
// silently, which is the derived-view failure this month keeps meeting.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const fixtures = path.join(repoRoot, 'test', 'fixtures', 'data');

// Same scope and exemption structure as the name lint, deliberately: one line
// to reason about, not two.
const skipDirs = new Set(['node_modules', 'data', 'docs', 'scripts', 'styles', 'test']);
const skipPaths = new Set([
  path.join('src', 'adapters'),        // adapters own semantics (Howell)
  path.join('src', 'pyramid'),
  path.join('src', 'navigation', 'cousin-builder.js'),
  path.join('src', 'volume-configs.js'),
  'index.html'
]);
const allowedExtensions = new Set(['.js', '.mjs']);

// COLLISIONS WITH GENERIC PROGRAMMING VOCABULARY, each with its reason.
// A level name that is also an ordinary English word of the trade cannot be
// banned outright without making the lint useless — but every exemption is a
// hole, so each is named and justified rather than waved through as a group.
const EXEMPT = new Map([
  ['section', 'a section of a file, a spec or a document — unavoidable in prose and in code that slices anything'],
  ['year', 'dates are generic: any timestamp, copyright line or version window says year'],
  ['month', 'as above — generic date vocabulary long before it was a level'],
  ['day', 'as above, and also "day" in cache and expiry arithmetic'],
  ['star', 'the star field is a RENDERING concept shared by every volume, not one volume\'s level']
]);

async function declaredLevels() {
  const found = new Set();
  const volumes = await fs.readdir(fixtures, { withFileTypes: true });
  for (const v of volumes) {
    if (!v.isDirectory()) continue;
    const manifest = path.join(fixtures, v.name, 'manifest.json');
    let raw;
    try { raw = JSON.parse(await fs.readFile(manifest, 'utf8')); } catch { continue; }
    for (const root of Object.values(raw)) {
      const levels = root?.display_config?.hierarchy_levels;
      if (levels && typeof levels === 'object') {
        for (const name of Object.keys(levels)) found.add(name.toLowerCase());
      }
    }
  }
  return found;
}

async function walk(dir) {
  const out = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const entryPath = path.join(dir, entry.name);
    const rel = path.relative(repoRoot, entryPath);
    if (entry.isDirectory()) {
      if (skipDirs.has(entry.name)) continue;
      // NOTE the `rel === s`: the name lint beside this one tests only
      // `startsWith(s + sep)`, which never matches the directory itself — so
      // its `src/adapters` entry does nothing there and is compensated for by
      // a filter at the assertion. Copying that shape scanned two exempt
      // trees here. Same bug, found by porting it.
      if ([...skipPaths].some(s => rel === s || rel.startsWith(s + path.sep))) continue;
      out.push(...await walk(entryPath));
    } else if (entry.isFile()) {
      if (!allowedExtensions.has(path.extname(entry.name).toLowerCase())) continue;
      if (skipPaths.has(rel)) continue;
      out.push(rel);
    }
  }
  return out;
}

export async function scanForVocabulary() {
  const levels = await declaredLevels();
  const banned = [...levels].filter(l => !EXEMPT.has(l)).sort();
  const files = await walk(path.join(repoRoot, 'src'));
  const results = [];
  for (const rel of files) {
    const content = await fs.readFile(path.join(repoRoot, rel), 'utf8');
    // Word-boundary matched, so `bookId` is a hit and `bookkeeping` is not.
    const hits = banned.filter(term => new RegExp(`\\b${term}s?\\b`, 'i').test(content));
    if (hits.length) results.push({ rel, hits });
  }
  return { banned, results };
}

describe('forbidden volume vocabulary (O-43)', () => {
  it('derives its banned words from the volumes own level declarations', async () => {
    const { banned } = await scanForVocabulary();
    assert.ok(banned.length, 'no levels were read — the derivation is broken, not the code clean');
    // If a volume declares a new level tomorrow, it is policed tomorrow.
    assert.ok(banned.includes('book'), 'the level that motivated this rule must be banned');
  });

  // THE BASELINE IS A RATCHET, NOT AN AMNESTY.
  //
  // Ten files spoke volume vocabulary the day this rule was written. Cleaning
  // them is real work (O-43) and could not honestly ride the commit that
  // discovered them — but a lint that only reports is a rule remembered, which
  // is exactly what failed here the first time. So: any file NOT on this list
  // fails immediately, and any file on it that goes clean must be REMOVED from
  // the list, which is what stops the baseline from quietly becoming permanent.
  // It can only ever shrink.
  // 8 → 5. The three FEEL-BEARING files came off on 2026-08-12, once Howell's
  // thumb had spoken on the fixture and the dark state and the window was
  // cleared: focus-ring-view, migration-animation, child-pyramid-geometry.
  //
  // Every hit in them was a COMMENT — an incidental example ("26 chapters",
  // "January, Chapter 1", "the one-testament sky"), a label description, and
  // one metaphor about an expanding galaxy that was never the level at all.
  // No functional line changed, and the proof is stronger than a reading:
  // minification strips comments, so the bundle came out BYTE-IDENTICAL.
  //
  // That is why they were parked rather than rushed. Nobody could have known
  // they were comment-only without looking, and the files render the ring,
  // the migration and the sky — so the cost of being wrong was the one thing
  // the freeze exists to prevent.
  const BASELINE = new Set([
    'src/core/dimension-bridge.js',
    'src/geometry/focus-ring-geometry.js',
    'src/index.js',
    'src/main.js',
    'src/navigation/seating-chart.js'
  ]);

  it('no NEW file speaks a volume level name', async () => {
    const { results } = await scanForVocabulary();
    const fresh = results.filter(r => !BASELINE.has(r.rel.split(path.sep).join('/')));
    if (fresh.length) {
      const detail = fresh.map(r => `${r.rel}: ${r.hits.join(', ')}`).join('\n');
      assert.fail(
        `Volume vocabulary in engine-general code (O-43):\n${detail}\n\n`
        + 'A volume\'s words for its own levels belong to its adapter. Rename to the '
        + 'neutral term (unit, container, leaf), or move the code into the adapter '
        + 'that owns those semantics.');
    }
  });

  it('the baseline only shrinks — a cleaned file must leave it', async () => {
    const { results } = await scanForVocabulary();
    const dirty = new Set(results.map(r => r.rel.split(path.sep).join('/')));
    const stale = [...BASELINE].filter(f => !dirty.has(f));
    assert.deepEqual(stale, [],
      `these are clean now and must be REMOVED from BASELINE, or the ratchet stops ratcheting:\n  ${stale.join('\n  ')}`);
  });

  it('every exemption carries its reason on the page', () => {
    // An exemption without a reason is a hole nobody can audit later.
    for (const [term, reason] of EXEMPT) {
      assert.ok(reason && reason.length > 20, `${term} is exempt with no real reason given`);
    }
  });
});
