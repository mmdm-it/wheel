// BOOKMARKS (O-126, Howell 2026-09-14): what the basement's ring holds.
//
// "The basement's Focus Ring will store and hold bookmarks, along with any
// other features we choose to add." The basement is the Zero Stratum — the
// floor below the text, reached by sliding the globe DOWN — and unlike the
// floors above it, it is about the reader's own use of the volume rather than
// about which text: from the main floor and the upper floors it is never
// visible, and from the basement nothing is visible above.
//
// A BOOKMARK IS A LEAF IN AN EDITION. The leaf (leaf-and-shard, W-129) is
// what every edition shares, so the seat can be found in any of them; the
// edition is which tongue the reader was in, and the return goes there.
// Both together are the bookmark's identity (Howell, 2026-09-14: "I should
// be able to have 3 separate bookmarks for GENESIS 1:1 — one in Greek, one
// in Italian, and one in English. It is good that duplicate bookmarks are
// not permitted WITHIN an edition"). The label is QUOTED at the moment of
// keeping — the name the ring showed then, in that edition.
//
// ON-DEVICE ONLY, like session memory: localStorage, nothing transmitted, no
// account, no identifier. Private browsing, disabled storage or corrupt JSON
// degrade to "no bookmarks", never to a broken basement.

const KEY = 'wheel-bookmarks-v1';

function readAll() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return {};
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return (parsed && typeof parsed === 'object') ? parsed : {};
  } catch (_) {
    return {};
  }
}

function writeAll(all) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(KEY, JSON.stringify(all));
  } catch (_) { /* quota or private mode: the bookmark simply isn't kept */ }
}

const clean = list => (Array.isArray(list) ? list : [])
  .filter(b => b && typeof b === 'object' && typeof b.id === 'string' && b.id);

/** The kept bookmarks of a volume, in the order they were kept: `[{ id, label, edition, kept }]`. */
export function bookmarksOf(volume) {
  if (!volume) return [];
  return clean(readAll()[volume]);
}

const same = (b, id, edition) => b.id === id && (b.edition ?? null) === (edition ?? null);

export function isBookmarked(volume, id, edition = null) {
  return bookmarksOf(volume).some(b => same(b, id, edition));
}

/**
 * Keep a leaf in an edition. Idempotent within the edition: keeping a kept
 * one writes nothing. `at` is the seat's PLACE for ordering (O-128, Howell
 * 2026-09-14: sorted by the volume's levels from the widest down, then by
 * edition) — { rank: [...numbers, widest level first], tail, edition } as
 * the volume's adapter ranks them, recorded at the moment of keeping; a
 * bookmark without one sorts last.
 */
export function keep(volume, { id, label = '', edition = null, at = null } = {}) {
  if (!volume || !id) return false;
  const all = readAll();
  const list = clean(all[volume]);
  if (list.some(b => same(b, id, edition))) return true;
  list.push({ id, label: String(label ?? ''), edition: edition ?? null, at: at && typeof at === 'object' ? at : null, kept: new Date().toISOString() });
  all[volume] = list;
  writeAll(all);
  return true;
}

/** Drop a kept leaf from an edition. Returns whether anything was dropped. */
export function drop(volume, id, edition = null) {
  if (!volume || !id) return false;
  const all = readAll();
  const list = clean(all[volume]);
  const next = list.filter(b => !same(b, id, edition));
  if (next.length === list.length) return false;
  if (next.length) all[volume] = next; else delete all[volume];
  writeAll(all);
  return true;
}

/**
 * The ring's order: the volume's levels from the widest down, then the
 * edition — so every bookmark of one leaf stands together, one seat per
 * tongue. The widest rank is the shard the leaf lives in (leaf-and-shard,
 * W-129), which every edition shares, so an edition's own placing of a unit
 * cannot scatter its bookmarks from another's: one order for the whole
 * basement, the volume's declared order of shards. The narrower ranks are
 * the numbers the seat was kept under; a lettered leaf (62a) follows its
 * number by its tail. Bookmarks kept before places were recorded come last,
 * in the order kept.
 */
export function inOrder(list) {
  const num = v => (Number.isFinite(v) ? v : Number.POSITIVE_INFINITY);
  const ranks = at => (Array.isArray(at?.rank) ? at.rank : []);
  return [...list].sort((a, b) => {
    if (!a.at && !b.at) return String(a.kept || '').localeCompare(String(b.kept || ''));
    if (!a.at) return 1;
    if (!b.at) return -1;
    const ra = ranks(a.at), rb = ranks(b.at);
    for (let i = 0; i < Math.max(ra.length, rb.length); i += 1) {
      const d = num(ra[i]) - num(rb[i]);
      if (d) return d;
    }
    return String(a.at.tail || '').localeCompare(String(b.at.tail || ''))
      || (num(a.at.edition) - num(b.at.edition))
      || String(a.edition || '').localeCompare(String(b.edition || ''));
  });
}

/** Forget one volume's bookmarks, or every volume's. Diagnostics and a future "start over". */
export function forgetBookmarks(volume = null) {
  if (!volume) { try { window.localStorage.removeItem(KEY); } catch (_) { /* ignore */ } return; }
  const all = readAll();
  if (!(volume in all)) return;
  delete all[volume];
  writeAll(all);
}
