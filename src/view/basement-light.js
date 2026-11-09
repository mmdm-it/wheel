// THE BASEMENT'S LIGHT (O-277, Howell 2026-11-08: "the basement background
// should definitely be a different color than the primary, secondary, and
// tertiary strata, simply because it serves an entirely different purpose.
// The basement is a perfect name for it, and basements are generally
// darker").
//
// The same tan, a good deal deeper — never a second hue the reader has to
// learn. The ground is the volume's own declared colour scaled toward black,
// which keeps its hue and saturation exactly (search mode dims the same way,
// for close work; this is the floor below). THE GROUND ALONE: the band and
// the nodes keep the theme's own colours (Howell, the same evening, after a
// cut that dimmed them with the room: "You've been changing the darkness of
// the focus ring band. It should return to its original setting. We want to
// darken the background"). The band is barely darker than the tan upstairs,
// so on a ground this deep it reads LIGHTER than its room — the ring lit in
// a dark basement — and the depth is set past the point where the two would
// match and the ring vanish. It is driven by DEPTH, 0 on the
// floors above and 1 in the basement, and a glide hands it the floor's own
// dissolve, so the ground deepens exactly as the floor goes and lightens
// exactly as it returns — the reader passes through into a darker room,
// rather than watching the room darken around a floor still under foot.
//
// It writes the legacy `--color-bg` on the root, which the body and every
// knock-out stroke already read; the theme's own `--theme-color-bg` is left
// alone and re-read at every call, so a volume change under the basement
// deepens the new ground and not the old.

const BASEMENT_DIM = 0.5;    // how far the ground travels toward black at full depth
// legacy variable → the theme variable it is scaled from
const DIMMED = [['--color-bg', '--theme-color-bg']];

function parseColor(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  if (s[0] === '#') {
    const h = s.slice(1);
    const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
    if (full.length < 6) return null;
    const n = parseInt(full.slice(0, 6), 16);
    return Number.isFinite(n) ? [(n >> 16) & 255, (n >> 8) & 255, n & 255] : null;
  }
  const m = s.match(/rgba?\(([^)]+)\)/i);
  if (!m) return null;
  const parts = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
  return parts.length >= 3 && parts.slice(0, 3).every(Number.isFinite) ? parts.slice(0, 3) : null;
}

// The ground at a depth, as rgb(), or null when the theme has not spoken.
export function basementGround(themeBg, depth) {
  const bg = parseColor(themeBg);
  if (!bg) return null;
  const t = Math.max(0, Math.min(1, Number(depth) || 0)) * BASEMENT_DIM;
  const c = bg.map(v => Math.round(v * (1 - t)));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

let lastDepth = 0;
export function setBasementDepth(depth, root = typeof document !== 'undefined' ? document.documentElement : null) {
  if (!root?.style) return;
  const d = Math.max(0, Math.min(1, Number(depth) || 0));
  lastDepth = d;
  if (d <= 0.001) { for (const [v] of DIMMED) root.style.removeProperty(v); return; }
  const cs = typeof getComputedStyle === 'function' ? getComputedStyle(root) : null;
  for (const [v, from] of DIMMED) {
    const theme = root.style.getPropertyValue(from) || (cs ? cs.getPropertyValue(from) : '');
    const dimmed = basementGround(theme, d);
    if (dimmed) root.style.setProperty(v, dimmed); else root.style.removeProperty(v);
  }
}
export const basementDepth = () => lastDepth;
