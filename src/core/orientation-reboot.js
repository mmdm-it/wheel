// THE WHEEL IS LAID OUT FOR THE VIEWPORT IT BOOTED IN (O-259, Howell
// 2026-11-01, two photographs, one per volume: "When either … are loaded in
// landscape mode and then rotated to portrait, they are cropped").
//
// Every seat on the ring, the lens, the parent vessel and the detail sector
// are computed from the viewport's short and long sides at the boot (the
// constitutional arc: hub and radius from SSd and LSd), and nothing in the
// engine re-lays them when those sides swap. A phone that opened the page
// sideways — which the landscape page (O-258) now invites — booted a wheel
// shaped for a short, wide screen, and turning it upright showed that wheel
// cropped across the top of a tall one.
//
// The honest fix at this grain is a REBOOT: the moment a touch device that
// booted in landscape comes to portrait, the page reloads and boots the
// wheel for the viewport it is actually in. The other direction needs
// nothing — in landscape the page is the volume's plain sheet, the wheel
// under it keeps its portrait shape, and coming back finds it unchanged. A
// phone that booted upright therefore never reloads. The address survives
// the reload, and so does everything the session remembers.
//
// A fine pointer never arms this: a desktop window dragged tall is not a
// phone turned, and the desktop gate covers it anyway.

/**
 * Arm the reboot. Returns a description of what was done, for the tests:
 * `{ armed, reason }`. `reload` is called when the orientation comes to
 * portrait from a landscape boot.
 */
export function armOrientationReboot({ bootPortrait, win = (typeof window !== 'undefined' ? window : null), reload } = {}) {
  if (!win || typeof win.matchMedia !== 'function') return { armed: false, reason: 'no matchMedia' };
  if (bootPortrait) return { armed: false, reason: 'booted upright' };
  let coarse = null;
  try { coarse = win.matchMedia('(pointer: coarse)'); } catch { coarse = null; }
  if (!coarse || !coarse.matches) return { armed: false, reason: 'fine pointer' };
  let portrait = null;
  try { portrait = win.matchMedia('(orientation: portrait)'); } catch { portrait = null; }
  if (!portrait) return { armed: false, reason: 'no orientation query' };
  const go = reload || (() => { try { win.location.reload(); } catch { /* nothing to do */ } });
  const onChange = e => { if (e && e.matches) go(); };
  if (typeof portrait.addEventListener === 'function') portrait.addEventListener('change', onChange);
  else if (typeof portrait.addListener === 'function') portrait.addListener(onChange);
  else return { armed: false, reason: 'no change event' };
  // Already upright by the time the boot got here (a turn during the load):
  // reload now rather than wait for a change that will not come.
  if (portrait.matches) { go(); return { armed: true, reason: 'already upright' }; }
  return { armed: true, reason: 'landscape boot on a touch device' };
}
