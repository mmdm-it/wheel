// THE BASEMENT'S LIGHT (O-277, Howell 2026-11-08: "the basement background
// should definitely be a different color than the primary, secondary, and
// tertiary strata, simply because it serves an entirely different purpose.
// The basement is a perfect name for it, and basements are generally
// darker").
//
// The same tan, a good deal deeper — never a second hue the reader has to
// learn. The ground is the volume's own declared colour scaled toward black,
// which keeps its hue and saturation exactly (search mode dims the same way,
// for close work; this is the floor below). It is driven by DEPTH, 0 on the
// floors above and 1 in the basement, and a glide hands it the floor's own
// dissolve, so the ground deepens exactly as the floor goes and lightens
// exactly as it returns — the reader passes through into a darker room,
// rather than watching the room darken around a floor still under foot.
//
// THE ROOM IS A NEGATIVE OF THE FLOORS ABOVE (O-278, Howell 2026-11-09, his
// phone in hand: "the focus ring band should not be so dark. Perhaps the
// focus ring band should be the same color as the watermarks. And has the
// background gotten so dark that the labels should have white lettering
// instead of black?"). Three surfaces and two inks:
//   - THE GROUND, the tan half way to black.
//   - THE BAND AND THE WATERMARKS, one tone: the theme's ink laid on that
//     ground at the watermark's own faintness. The first cut scaled the band
//     further toward black than the ground and it came out nearly black, a
//     stroke drawn on the page rather than part of the room; the theme's
//     band itself is within a shade of the deep ground, which is why the
//     ground had erased it. The sheet paints the legend in this very colour,
//     opaque, so the two are the same by construction and not by tuning.
//   - THE INK: the names beside the seats, the lens's caption, the globe in
//     the corner all take the tan the floors above are painted with — dark
//     brown on dark brown read at two to one, and the names were legible
//     only to a reader who knew them. The seats keep their own colour and
//     their on-seat lettering keeps the theme's ink, so the chain is still
//     the same instrument, beads on a quiet band.
// Each of the three is interpolated from the theme's own value at depth 0,
// so the glide is continuous at both ends.
//
// WHAT IT PAINTS: the legacy `--color-band`, `--color-text`,
// `--color-orbital-label`, `--color-globe` and `--color-ground` on the root, and the INLINE
// background colour of the root and the body — the two the theme itself
// paints inline (applyTheme), which is why they, and not a variable, are the
// ground the reader sees. The first cut wrote the legacy `--color-bg`
// variable instead: the inline paint beat it under the basement, and the one
// thing that read the variable was the sideways page, which came up dark
// while the basement stayed tan (Howell, 2026-11-08: "Instead of the
// basement background, you've made landscape background darker"). The
// primary's own svg is left alone: it is the floor that dissolves, and the
// ground shows through it. The theme's `--theme-color-*` are re-read at every
// call, so a volume change under the basement deepens the new ground and not
// the old; at depth 0 the theme's own colour is painted back and every
// override is removed.

const BASEMENT_DIM = 0.5;    // how far the ground travels toward black at full depth
const WATERMARK_INK = 0.18;  // the watermark's faintness: ink over ground, and the band's tone
const GLOBE_GREY = '#363636'; // the globe's line-work upstairs (styles/base.css)

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
const clamp01 = v => Math.max(0, Math.min(1, Number(v) || 0));
const rgb = c => `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

// The ground at a depth, as rgb(), or null when the theme has not spoken.
export function basementGround(themeBg, depth, dim = BASEMENT_DIM) {
  const bg = parseColor(themeBg);
  if (!bg) return null;
  const t = clamp01(depth) * dim;
  return rgb(bg.map(v => Math.round(v * (1 - t))));
}

// The whole room at a depth: { ground, band, ink, globe }, each rgb() or
// null where the theme gave nothing to work from. `theme` carries the
// theme's own bg, band and text.
export function basementPalette(theme, depth) {
  const d = clamp01(depth);
  const bg = parseColor(theme?.bg);
  const text = parseColor(theme?.text);
  const band = parseColor(theme?.band);
  if (!bg) return { ground: null, band: null, ink: null, globe: null };
  const deep = bg.map(v => Math.round(v * (1 - BASEMENT_DIM)));
  const watermark = text ? mix(deep, text, WATERMARK_INK) : null;
  return {
    ground: rgb(bg.map(v => Math.round(v * (1 - d * BASEMENT_DIM)))),   // the same rounding as basementGround
    band: band && watermark ? rgb(mix(band, watermark, d)) : null,
    ink: text ? rgb(mix(text, bg, d)) : null,
    globe: rgb(mix(parseColor(GLOBE_GREY), bg, d))
  };
}

let lastDepth = 0;
export function setBasementDepth(depth, root = typeof document !== 'undefined' ? document.documentElement : null) {
  if (!root?.style) return;
  const d = clamp01(depth);
  lastDepth = d;
  const cs = typeof getComputedStyle === 'function' ? getComputedStyle(root) : null;
  const themed = name => root.style.getPropertyValue(name) || (cs ? cs.getPropertyValue(name) : '');
  const theme = { bg: themed('--theme-color-bg'), band: themed('--theme-color-band'), text: themed('--theme-color-text') };
  const room = basementPalette(theme, d);
  const paint = (name, value) => {
    if (value && d > 0.001) root.style.setProperty(name, value); else root.style.removeProperty(name);
  };
  paint('--color-band', room.band);
  paint('--color-text', room.ink);
  paint('--color-orbital-label', room.ink ? theme.text : null);   // on-seat lettering keeps the theme's ink
  paint('--color-globe', room.globe);
  // (The ground was a variable too, `--color-ground`, from O-280 to O-289:
  // the halo on the word beside the basement's lens stroked in its colour.
  // That halo is a mask now and paints nothing; the ground is inline alone.
  // `--color-bg` stays the theme's: the sideways page reads it.)
  if (!room.ground) return;   // no theme yet: nothing to deepen, nothing to restore
  const body = typeof document !== 'undefined' ? document.body : null;
  for (const el of [root, body]) if (el?.style) el.style.backgroundColor = room.ground;
}
export const basementDepth = () => lastDepth;
