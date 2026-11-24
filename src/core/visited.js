// WHERE THE READER HAS BEEN (O-328, Howell 2026-11-22): a branch in which
// a leaf has been opened never again shows its first leaf as the default,
// which gives the reader a permanent record of which branches they have
// touched, even partially, and which are untouched. (His words are in the
// ledger; they name a volume's levels, and this file may not.)
//
// One number per leaf the reader came to rest on: the order in which it was
// visited, so "the last one visited under this branch" is a maximum. The
// leaf is the VOLUME's own (an utterance, not an edition's own numbering), so
// a leaf read in one edition is marked in every edition that holds it.
//
// ON-DEVICE ONLY, like the bookmarks and the session memory: localStorage,
// nothing transmitted, no account, no identifier. Guarded the same way: no
// storage, a full quota or corrupt JSON degrade to "no record", never to a
// broken sky.

const KEY = 'wheel-visited-v1';

let cache = null;      // the parsed store, read once
let version = 0;       // bumps on every change, for whoever memoizes over it

function load() {
  if (cache) return cache;
  cache = {};
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const parsed = JSON.parse(window.localStorage.getItem(KEY) || 'null');
      if (parsed && typeof parsed === 'object') cache = parsed;
    }
  } catch (_) { cache = {}; }
  return cache;
}

function save() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(KEY, JSON.stringify(cache));
  } catch (_) { /* quota or private mode: this visit is simply not kept */ }
}

function shelf(volume, make = false) {
  const all = load();
  let entry = all[volume];
  if (!entry || typeof entry !== 'object' || !entry.at || typeof entry.at !== 'object') {
    if (!make) return null;
    entry = all[volume] = { n: 0, at: {} };
  }
  return entry;
}

/** When this leaf was last rested on (a rising count), or 0 for never. */
export function visitedSeq(volume, leaf) {
  if (!volume || leaf == null) return 0;
  const n = shelf(volume)?.at[leaf];
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Changes whenever the record does. */
export function visitedVersion() { return version; }

/**
 * The reader came to rest on `leaves` (one seat, as the volume's own
 * leaves). `superseded` are the leaves this visit replaces — the rest of the
 * same parent — which keeps the record to one place per parent.
 */
export function markVisited(volume, leaves, superseded = []) {
  const mine = (Array.isArray(leaves) ? leaves : [leaves]).filter(l => l != null);
  if (!volume || !mine.length) return;
  const entry = shelf(volume, true);
  const keep = new Set(mine.map(String));
  for (const old of superseded || []) if (old != null && !keep.has(String(old))) delete entry.at[old];
  entry.n = (Number.isFinite(entry.n) ? entry.n : 0) + 1;
  for (const leaf of mine) entry.at[leaf] = entry.n;
  version += 1;
  save();
}

/** Forget one volume's record, or all of it. Diagnostics and a future "start over". */
export function forgetVisited(volume = null) {
  load();
  if (!volume) cache = {}; else delete cache[volume];
  version += 1;
  save();
}
