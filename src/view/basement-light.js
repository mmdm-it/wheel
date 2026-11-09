// THE BASEMENT'S LIGHT (O-277, Howell 2026-11-08: "the basement background
// should definitely be a different color than the primary, secondary, and
// tertiary strata, simply because it serves an entirely different purpose.
// The basement is a perfect name for it, and basements are generally
// darker").
//
// The same tan, a good deal deeper — never a second hue the reader has to
// learn. The ground is the volume's own declared colour scaled toward black,
// which keeps its hue and saturation exactly (search mode dims the same way,
// for close work; this is the floor below). AND THE BAND GOES DARKER STILL:
// the band is barely darker than the tan upstairs, so a ground half way to
// black erased it (Howell, the same evening: "the dark background seems
// fine, but it has erased the focus ring band. The focus ring band needs to
// be given a new darker color as well"); it is scaled further toward black
// than the ground, to stand against it as it stands against the tan
// upstairs. The seats keep the theme's own colour, beads on a dark band. It
// is driven by DEPTH, 0 on the
// floors above and 1 in the basement, and a glide hands it the floor's own
// dissolve, so the ground deepens exactly as the floor goes and lightens
// exactly as it returns — the reader passes through into a darker room,
// rather than watching the room darken around a floor still under foot.
//
// WHAT IT PAINTS: the band's legacy `--color-band` on the root (the band
// strokes read it), and the INLINE background colour of the root and the body —
// the two the theme itself paints inline (applyTheme), which is why they,
// and not a variable, are the ground the reader sees. The first cut wrote
// the legacy `--color-bg` variable instead: the inline paint beat it under
// the basement, and the one thing that read the variable was the sideways
// page, which came up dark while the basement stayed tan (Howell,
// 2026-11-08: "Instead of the basement background, you've made landscape
// background darker"). The primary's own svg is left alone: it is the floor
// that dissolves, and the ground shows through it. The theme's
// `--theme-color-bg` is re-read at every call, so a volume change under
// the basement deepens the new ground and not the old; at depth 0 the
// theme's own colour is painted back.

const BASEMENT_DIM = 0.5;    // how far the ground travels toward black at full depth
const BAND_DIM = 0.7;        // and the band, further, to stand against it

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
export function basementGround(themeBg, depth, dim = BASEMENT_DIM) {
  const bg = parseColor(themeBg);
  if (!bg) return null;
  const t = Math.max(0, Math.min(1, Number(depth) || 0)) * dim;
  const c = bg.map(v => Math.round(v * (1 - t)));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

let lastDepth = 0;
export function setBasementDepth(depth, root = typeof document !== 'undefined' ? document.documentElement : null) {
  if (!root?.style) return;
  const d = Math.max(0, Math.min(1, Number(depth) || 0));
  lastDepth = d;
  const cs = typeof getComputedStyle === 'function' ? getComputedStyle(root) : null;
  const themed = name => root.style.getPropertyValue(name) || (cs ? cs.getPropertyValue(name) : '');
  const band = basementGround(themed('--theme-color-band'), d, BAND_DIM);
  if (band && d > 0.001) root.style.setProperty('--color-band', band); else root.style.removeProperty('--color-band');
  const ground = basementGround(themed('--theme-color-bg'), d);
  if (!ground) return;   // no theme yet: nothing to deepen, nothing to restore
  const body = typeof document !== 'undefined' ? document.body : null;
  for (const el of [root, body]) if (el?.style) el.style.backgroundColor = ground;
}
export const basementBand = (themeBand, depth) => basementGround(themeBand, depth, BAND_DIM);
export const basementDepth = () => lastDepth;
