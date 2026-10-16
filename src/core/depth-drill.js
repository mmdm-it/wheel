// THE DEPTH DRILL (O-203, Howell 2026-10-15: "the drill action is nowhere
// near as smooth as the rotation action ... swiping one's thumb back and
// forth along a radius line should cause the focus ring nodes to drill out
// and in across the focus ring ... without lifting one's thumb").
//
// Depth is a number. Whole numbers are the levels of the volume, and the
// thumb's travel along the radial line moves the reader between them: one
// notch of travel is one level, outward is +1. Between two levels the
// migration that joins them plays as far as the thumb has come, exactly as
// the single scrubbed drill did (O-138); this module is what makes several
// of those one stroke. It is pure: the host hands it the three things it
// cannot know — how to LAUNCH the next level's flight in a direction, how
// to COMMIT or ABORT one instantly at a boundary, and how to SETTLE the one
// under the thumb at release — and it keeps the arithmetic.
//
// The arithmetic. `travel` is the gated radial travel of the stroke in px,
// counted only while the segment under way is held (a segment that is still
// launching does not count the thumb's travel — the picture does not jump to
// catch up, the thumb re-bases, as the single drill did). `level` is how
// many whole levels the stroke has crossed, +outward. The segment under way
// runs from `level` toward `level + dir`, and its progress e is where the
// thumb stands between the two. Crossing e = 1 commits the segment at once
// and, if the thumb is still beyond, opens the next in the same direction;
// crossing back over e = 0 aborts it at once and, if the thumb is beyond the
// other way, opens the opposite one — so a stroke that goes out and comes
// back is out and back, with nothing lifted. Where there is nothing beyond
// (a leaf below, the top above) the launch declines and the travel is
// clamped there, so the way back begins the moment the thumb turns.
//
// Release settles the segment under the thumb: past halfway it goes through,
// short of it, it springs back — the host animates both, as before.

const MAX_CROSSINGS = 6;   // a bound on one move event's level crossings
const EPS = 1e-6;

/**
 * @param {Object}   o
 * @param {number}   o.notchPx       — radial travel per level, in px
 * @param {Function} o.launch        — (dir) → segment handle { scrubTo(e), captured() }, or null when nothing lies that way
 * @param {Function} o.commit        — (handle) finish a segment at its far end, instantly
 * @param {Function} o.abort         — (handle) strike a segment at its near end, instantly, undoing its navigation
 * @param {Function} o.settle        — (handle, commit) animate the release of the segment under the thumb
 */
export function createDepthDrill({ notchPx, launch, commit, abort, settle }) {
  const notch = Number(notchPx) > 0 ? Number(notchPx) : 80;
  let level = 0;
  let seg = null;       // { dir, handle, e }
  let travel = 0;
  let ends = { 1: false, [-1]: false };   // directions found closed at this level

  const open = dir => {
    if (ends[dir]) return false;
    const handle = launch(dir);
    if (!handle) { ends[dir] = true; return false; }
    seg = { dir, handle, e: 0 };
    return true;
  };

  const apply = () => {
    for (let n = 0; n < MAX_CROSSINGS; n += 1) {
      const d = travel / notch;
      if (!seg) {
        const dir = d > level + EPS ? 1 : d < level - EPS ? -1 : 0;
        if (!dir) return;
        if (!open(dir)) { travel = level * notch; return; }   // the end: the thumb may go on, the depth does not
      }
      const e = (d - level) * seg.dir;
      if (e >= 1) { const s = seg; seg = null; commit(s.handle); level += s.dir; ends = { 1: false, [-1]: false }; continue; }
      if (e <= 0) { const s = seg; seg = null; abort(s.handle); continue; }
      seg.e = e;
      seg.handle.scrubTo(e);
      return;
    }
  };

  return {
    /** Open the stroke's first segment in the decided direction (+1 out, -1 in). False when nothing lies that way. */
    begin(dir) {
      if (seg) return true;
      return open(dir > 0 ? 1 : -1);
    },
    /**
     * The thumb moved `px` along the radial line (+ outward); the host has
     * already gated it. Counted only when the segment under way is held.
     * Returns whether it counted.
     */
    move(px) {
      if (!Number.isFinite(px)) return false;
      if (seg && typeof seg.handle.captured === 'function' && !seg.handle.captured()) return false;
      travel += px;
      apply();
      return true;
    },
    /** The thumb lifted: settle what is under it. Returns { level, committed, e }. */
    release({ cancelled = false } = {}) {
      const s = seg;
      seg = null;
      if (!s) return { level, committed: false, e: null };
      const go = !cancelled && s.e >= 0.5;
      settle(s.handle, go);
      if (go) level += s.dir;
      return { level, committed: go, e: s.e };
    },
    /** Where the reader stands: whole levels crossed plus the segment's progress, +outward. */
    depth: () => level + (seg ? seg.dir * seg.e : 0),
    /** Whole levels crossed since the stroke began. */
    level: () => level,
    /** The segment under the thumb, or null between levels' flights. */
    segment: () => (seg ? { dir: seg.dir, e: seg.e, held: typeof seg.handle.captured !== 'function' || seg.handle.captured() } : null),
  };
}
