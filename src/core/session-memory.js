// SESSION MEMORY (Howell rulings 2-3, 2026-07-30): what the instrument
// remembers between launches — the reader's language, their edition, and the
// verse they were last on. Boot restores all three, so the funnel through the
// strata CONFIRMS a returning reader's choices rather than asking again, and
// the text waiting behind the glass is the one they left off at.
//
// ON-DEVICE ONLY. localStorage, nothing transmitted, no account, no
// identifier, nothing that could name a reader — consistent with the
// free/no-harvesting commitment. The same mechanism the boot splash already
// uses for its "seen" flag. It also carries forward to the Android port,
// where a resumable reader is table stakes.
//
// Everything here is guarded: private browsing, disabled storage, a full
// quota, or corrupt JSON must degrade to "no memory", never to a broken boot.

const KEY = 'wheel-session-v1';

function readAll() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return {};
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return (parsed && typeof parsed === 'object') ? parsed : {};
  } catch (_) {
    return {}; // private mode, or someone else's key at ours — forget it
  }
}

function writeAll(all) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(KEY, JSON.stringify(all));
  } catch (_) { /* quota or private mode: the reader simply isn't remembered */ }
}

/** What we remember for a volume: `{ language, edition, itemId }` (any absent). */
export function recall(volume) {
  if (!volume) return {};
  const entry = readAll()[volume];
  return (entry && typeof entry === 'object') ? entry : {};
}

/**
 * Merge a patch into a volume's memory. Undefined fields are left alone, so a
 * caller may record just the reading position without disturbing the edition.
 * `null` clears a field.
 */
export function remember(volume, patch) {
  if (!volume || !patch || typeof patch !== 'object') return;
  const all = readAll();
  const next = { ...(all[volume] || {}) };
  let changed = false;
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    if (next[k] === v) continue;
    if (v === null) delete next[k]; else next[k] = v;
    changed = true;
  }
  if (!changed) return; // never touch storage on a no-op write
  all[volume] = next;
  writeAll(all);
}

/** Forget one volume, or everything. Diagnostics and a future "start over". */
export function forget(volume = null) {
  if (!volume) { try { window.localStorage.removeItem(KEY); } catch (_) { /* ignore */ } return; }
  const all = readAll();
  if (!(volume in all)) return;
  delete all[volume];
  writeAll(all);
}
