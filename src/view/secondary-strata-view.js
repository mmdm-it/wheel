// A stratum's static ring (Phase D). Draws a chooser focus ring — band,
// nodes, magnifier — into its own SVG group, in the primary's own colors,
// band width, node size, and rotated-centered labels. Any stratum can be
// standard or mirrored. No blur here; the depth (scale + blur + z-order) is
// applied to the group by the stack (main.js). Rotation comes next.

import { computeStrataLayout } from '../geometry/secondary-strata-geometry.js';
import { standardBandCenterline, pointsToPath, getNodeSpacing, chainSpanPoints, bandEdges, bandBounds, STRATA_REACH } from '../geometry/focus-ring-geometry.js';

const NS = 'http://www.w3.org/2000/svg';
const NODE_RADIUS_RATIO = 0.035;      // matches the primary (index.js)
const MAGNIFIER_RADIUS_RATIO = 0.060; // matches the primary
// THE WORD BESIDE THE LENS (O-280, Howell 2026-11-09, two screenshots with
// the word drawn in: "I don't like adding rotated labels along the focus
// ring. They clutter the verse labels and are confusing"). ONE upright word
// — BOOKMARK for the candidate under the lens, DISCARD for a kept seat — in
// the open ground to the right of the lens at the lens's height, the only
// upright text on the glass, so it reads as a control and not as a seat.
// Its left edge stands this many lens radii right of the lens's centre, and
// it is SIZED TO THE ROOM between there and the glass's right edge (Howell,
// the first look: "it runs a little wide for 'bookmark'" — the word's end
// was off the phone): the lens label's size where the word fits at it, and
// smaller where it does not, so BOOKMARK, ENTFERNEN and the Russian word
// all land whole on any phone.
const CAPTION_REACH = 2.2;
const CAPTION_EM_PER_GLYPH = 0.82;   // bold caps with the sheet's letter-spacing
const CAPTION_MARGIN = 0.03;         // of the short side, kept clear at the right edge
const CAPTION_MIN_PX = 12;
const BAND_THICKNESS_RATIO = 0.02;    // the primary band spans 0.99r–1.01r
// The magnified label starts one fraction-of-a-node BACK from its centre and
// runs inward (start-anchored), so the name spans the node weighted to one
// side — the primary ring's unselected-node look — instead of sitting hard
// against the left edge. Higher = reaches further back (Howell 2026-07-21).
const MAG_LABEL_SPAN_PULL = 0.7;
// THE PRIMARY'S LABEL MANNERS, for a ring that asks for them (O-128, Howell
// 2026-09-14: the basement's bookmarks "should react to passing through the
// Magnifier in the same way that the name nodes do in the Primary
// Stratum Focus Ring"): a name sits BESIDE its node — left-aligned, starting
// just past the node on its outward side (Howell, the same day: "switch the
// alignment of the unselected node labels in the basement Focus Ring from
// Right to Left. The Magnifier label should stay centered"); passing the
// lens it swells on a bell — the primary's own curve,
// peak 2.0, sigma 0.3 of a node spacing (focus-ring-view.js) — centred on
// the node and scaled with it; settled in the lens it wears the magnified
// label, centred, at the lens's own size.
const BESIDE_OFFSET = 1.3;           // node radii, along the node's angle (outward): the name starts here and runs on
// THE MIRRORED PLANE'S LABEL MANNERS (O-254, Howell 2026-10-30): the plane's
// seats sit against the left edge, so a name centred on its node lost its
// first half there. Every name is start-anchored at the node's OUTWARD rim
// and runs inward toward the hub, covering the node and spilling past it on
// the hub's side — the primary ring's unselected-node look, mirrored. His
// first cut started the name past the node on the hub's side: "none of the
// labels even touch the focus ring nodes... They need to be moved back such
// that they overlap the focus ring node and extend a bit past it." The name
// starts the same fraction of a radius back from its node's centre as the
// lens label does from the lens's (MAG_LABEL_SPAN_PULL), so the seats and
// the lens share one manner — and it stays there even where the node has
// gone half off the left edge (the lowest calendars on a short phone): a
// first cut clamped the start to the glass, and Howell struck it the same
// night: "Don't bother shifting the Secondary Stratum Focus Ring Labels as
// they approach the bottom of the screen. All label should remain fixed
// over their nodes except when passing through the magnifier." No centring
// on this plane at any time, not passing the lens either: "the magnifier in
// the secondary stratum is a little closer to the viewport edge and
// therefore should not be centered at all at any time."
const COVER_PULL = MAG_LABEL_SPAN_PULL; // node radii, outward from the centre: the name starts here and runs over the node
const LENS_SCALE_PEAK = 2.0;
// The legend's arcs (O-276), measured off Howell's second sketch (2026-11-08,
// red strokes over the basement on his phone, read back against the ring's
// hub and radius for that viewport): each word's arc stands so far from the
// ring's centreline, as a fraction of the short side, and each word is
// centred so many seats from the lens along the arc. The outer word sits
// level with the lens, well clear of the names; the inner word four and a
// half seats below it, deep in the open hub side. The half-span is the room
// a long tongue's word may take.
// THEN MADE WATERMARKS (O-277, Howell the same evening, with the words in
// place: "Much larger letters, as big as they can be and still fit on the
// page, but at 50% opacity. Similar to the way we did language watermarks"
// in the other volume): each word is centred on the stretch of its arc that the
// glass shows and sized to fill it, so it is as large as its field allows
// on whatever phone is in hand; the faintness is the stylesheet's. The
// outer word's reach came in from the sketch's 0.33 — a watermark lies
// under the names rather than beside them, and the corner wedge at 0.33
// has room for a title, not a watermark. His third sketch (the same
// evening) brought the inner word nearer the band and put the outer one
// on two lines: a word breaks at its spaces and after its hyphens, each
// line on its own concentric arc, the first line farthest from the hub
// (the top line as the reader holds the phone, on either side), all at
// the one size the narrowest line's run allows.
const LEGEND_OUTER_REACH = 0.2;    // × SSd outward from the centreline, the line nearest the band
const LEGEND_INNER_REACH = 0.34;   // × SSd inward, likewise
const LEGEND_FILL = 0.92;          // of the visible arc a line may take
const LEGEND_EM_PER_GLYPH = 0.8;   // a bold capital's advance plus the tracking, in em
const LEGEND_CAP = 0.72;           // a capital's height, in em
const LEGEND_LINE_PITCH = 1.15;    // em, arc to arc
const LEGEND_MAX_EM = 0.17;        // × SSd — the ceiling on a wide glass
const LEGEND_MIN_EM = 0.05;        // × SSd — the floor, a running title's size
// "Oft-quoted" → ["OFT-", "QUOTED"]; "Usein lainatut" → two lines; no lookbehind (older WebKit).
export const legendLines = word => String(word).split(/\s+/).filter(Boolean)
  .flatMap(w => w.split('-').map((part, i, all) => (i < all.length - 1 ? `${part}-` : part)).filter(Boolean));

// The stretch of a circle about (hubX, hubY) of radius r that lies on a
// w × h glass: the longest run of angles whose points fall inside it, as
// [a0, a1] with a1 > a0 (the direction the legend reads), or null if none.
export function visibleArc(hubX, hubY, r, w, h, steps = 720) {
  const inside = a => { const x = hubX + r * Math.cos(a), y = hubY + r * Math.sin(a); return x >= 0 && x <= w && y >= 0 && y <= h; };
  const step = (2 * Math.PI) / steps;
  let best = null, start = null;
  // Walk twice round so a run crossing the seam is seen whole.
  for (let i = 0; i <= steps * 2; i++) {
    const a = -Math.PI + i * step;
    if (i < steps * 2 && inside(a)) { if (start === null) start = a; continue; }
    if (start !== null) {
      const run = [start, a - step];
      if (!best || run[1] - run[0] > best[1] - best[0]) best = run;
      start = null;
    }
  }
  return best && best[1] - best[0] >= step ? best : null;
}
const LENS_SCALE_SIGMA = 0.3;        // × node spacing

const svgEl = (tag, attrs) => {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  return n;
};

// Uppercase Latin-script labels (as the ring always has), but leave every
// other script in its given form: uppercasing strips polytonic Greek's
// breathings/accents, is meaningless for Hebrew/Arabic/CJK/Indic, and can
// mangle scripts with their own casing (Howell 2026-07-22). With 50 languages
// now on the ring, invert the test: uppercase ONLY when a label is pure Latin
// (Basic + Latin-1 + Extended-A/B + Additional + combining marks \u2014 covers
// Vietnamese, Turkish, Czech, Welsh, \u2026), otherwise leave it untouched.
const LATIN_SCRIPT_ONLY = /^[\u0020-\u024F\u0300-\u036F\u1E00-\u1EFF]+$/;
const displayCase = s => (LATIN_SCRIPT_ONLY.test(s) ? s.toUpperCase() : s);
export function hideStratum(svg, id) {
  const g = svg?.querySelector?.(`#${id}`);
  if (g) g.remove();
}

export function renderStratum(svg, { id, viewport, items, selectedIndex = 0, mirrored = false, labelFor, centerMagnified = false, rotating = false, classFor = null, allowEmpty = false, labelsBeside = false, lensShift = 0, markFor = null, sideFor = null, legend = null, caption = null } = {}) {
  if (!svg || !Array.isArray(items)) return null;
  // An EMPTY ring is a real state for the basement (O-126): a reader with no
  // bookmarks yet sees the band and the hollow lens and nothing on them —
  // the floor exists before anything is put on it. The choosers above never
  // ask for this: an empty language plane is an error, not a state.
  if (!items.length && !allowEmpty) return null;

  // THE RING KEEPS ITS ELEMENTS (O-185, Howell 2026-09-30: the chooser rings
  // "not nearly as smooth as the primary stratum focus ring"). This used to
  // throw away every circle and every label whenever anything about the
  // render differed — and while a finger turns the ring, the centre differs
  // on every pointer move, so the whole ring was rebuilt, text shaping and
  // all, several times a frame. The primary never did that: it keeps its
  // node elements and moves them. So does this now. Two signatures: the
  // MEMBERSHIP (which seats, in which dress, on which viewport) rebuilds the
  // subtree; the POSE (where the centre is, whether the ring is turning)
  // only re-seats what is there.
  //
  // The membership skip is also what keeps iOS honest: Safari does not
  // reliably apply a CSS `filter` to freshly-inserted SVG content (a receded
  // stratum rebuilt in the beat its blur was set stayed SHARP on iPhone —
  // Howell 2026-07-22), and a subtree that persists across the filter change
  // blurs as the primary's does.
  const classes = typeof classFor === 'function' ? items.map(it => classFor(it) || '') : null;
  // THE MARKS (O-188, Howell 2026-09-30): a seat's NAME may wear a class of
  // its own — on the basement's ring, one for a bookmark and one for a
  // landmark ("any symbol is too busy"). They were colours; since O-275
  // (2026-11-08) they colour nothing and face nothing — the SIDE below is
  // what the reader sees — and every label is the app's ink. The legend, in
  // the volume's own words, sits in the open ground beside the ring. Both
  // are the host's to name;
  // this only draws.
  // THE SIDE (O-275, Howell's sketch 2026-11-08): a name beside its disc may
  // stand on either side of the ring's line — a bookmark's outward, starting
  // at the disc and running on; a landmark's MIRRORED about the line, ending
  // at the disc and running inward, "shifted far to the left". The host says
  // which (sideFor: +1 outward, -1 inward; a legend row's third element the
  // same), and the legend's words stand the same way about one axis.
  const marks = typeof markFor === 'function' ? items.map(it => markFor(it) || '') : null;
  const sides = typeof sideFor === 'function' ? items.map(it => (Number(sideFor(it)) < 0 ? -1 : 1)) : null;
  const legendRows = Array.isArray(legend) ? legend.filter(r => Array.isArray(r) && r[1]) : null;
  const membership = JSON.stringify([items, mirrored, Boolean(centerMagnified), viewport.width, viewport.height, classes, Boolean(labelsBeside), lensShift, marks, sides, legendRows]);
  const pose = JSON.stringify([selectedIndex, Boolean(rotating)]);
  let outer = svg.querySelector(`#${id}`);
  if (outer && outer.dataset.signature === membership && outer.dataset.pose === pose) return outer;
  const layout = computeStrataLayout(viewport, Math.max(1, items.length), selectedIndex, mirrored, { lensShift });
  if (!items.length) layout.nodes = [];   // the band and the lens, no seats
  const nodeR = viewport.SSd * NODE_RADIUS_RATIO;
  const magR = viewport.SSd * MAGNIFIER_RADIUS_RATIO;
  let seats = outer && outer.dataset.signature === membership ? outer.__seats : null;
  let g;
  if (seats) {
    g = outer.__inner;
  } else {
    if (outer) {
      g = outer.querySelector('.stratum-inner') || outer.__inner;
      while (g.firstChild) g.removeChild(g.firstChild);
    } else {
      // A nested <svg> per stratum, NOT a bare <g> (Howell 2026-07-27):
      // iOS/WebKit honors a CSS `filter` on an <svg> element (as on the #app
      // root and the HTML verse panel) but SILENTLY DROPS it on a <g>. So the
      // recede BLUR rides this outer <svg>; the recede TRANSFORM rides the
      // inner <g> (O-185 moved it to a CSS transform on this element and
      // O-187 moved it back the same day: composited, a ring flying in from
      // six times scale is a layer no phone can tile).
      outer = svgEl('svg', { id, class: 'secondary-strata' });
      // A TOP-LEVEL svg overlaying the strata-layer div (all strata stacked at
      // inset:0). WebKit blurs an svg root but not a <g> or a nested svg, so
      // each stratum is its own root here.
      outer.style.position = 'absolute';
      outer.style.left = '0';
      outer.style.top = '0';
      outer.style.width = '100%';
      outer.style.height = '100%';
      outer.style.overflow = 'visible'; // clip at the strata layer, as the bare <g> did
      g = svgEl('g', { class: 'stratum-inner' });
      outer.appendChild(g);
      svg.appendChild(outer);
    }
    outer.__inner = g;
    // A ring with the primary's manners says so on its root, for the styles:
    // its lens label is larger, not bolder (Howell, 2026-09-14).
    outer.classList?.toggle?.('labels-beside', Boolean(labelsBeside));
    outer.setAttribute('x', '0');
    outer.setAttribute('y', '0');
    outer.setAttribute('width', String(viewport.width));
    outer.setAttribute('height', String(viewport.height));

    // The band is the sprocket-chain centreline (arc + straight tangents),
    // shared with the primary. A mirrored stratum reflects it across the
    // horizontal centreline, which turns the vertical-UP exit into vertical-DOWN
    // and the SE tangent into NE — the mirror this stratum needs (Howell
    // 2026-07-21). This matches the mirrored nodes from computeStrataLayout.
    let bandPts = standardBandCenterline(viewport);
    if (mirrored) bandPts = bandPts.map(([x, y]) => [x, viewport.height - y]);
    // THE CHAIN HAS ENDS HERE TOO (O-272, Howell 2026-11-07, after O-271 on
    // the primary: "do we apply it to the secondary and tertiary strata? …
    // I agree. Proceed."): the bare sprocket — the band's two edges, inked
    // like an empty vessel and lying wholly inside the band's width — is
    // drawn once under the band; the band itself is cut to the chain at
    // every pose, since the chain turns with the seats. A tongue with one
    // edition is one bead on bare sprocket, which is the fact.
    const bandWidth = layout.arc.radius * BAND_THICKNESS_RATIO;
    const ink = 1; // one pixel, as on the primary (Howell 2026-11-07)
    const hollow = svgEl('path', {
      d: bandEdges(bandPts, bandWidth / 2 - ink / 2 - 0.3).map(pointsToPath).join(' '),
      class: 'secondary-strata-band-hollow',
      'stroke-width': ink.toFixed(2)
    });
    g.appendChild(hollow);
    const band = svgEl('path', {
      d: pointsToPath(bandPts),
      class: 'secondary-strata-band',
      'stroke-width': bandWidth.toFixed(1)
    });
    g.appendChild(band);
    outer.__band = band;
    outer.__bandHollow = hollow;
    outer.__bandWhole = pointsToPath(bandPts);

    // One circle and one label per seat, in seat order, made once. The
    // label's TEXT is the seat's own and never changes with the pose; where
    // it sits and how it is anchored does.
    seats = items.map((item, index) => {
      const circle = svgEl('circle', { class: `secondary-strata-node${classes?.[index] ? ` ${classes[index]}` : ''}` });
      circle.dataset.index = String(index);
      const label = svgEl('text', { class: 'secondary-strata-label', 'dominant-baseline': 'middle' });
      const raw = typeof labelFor === 'function' ? labelFor(item, false) : item;
      label.textContent = displayCase(String(raw ?? ''));
      g.appendChild(circle);
      g.appendChild(label);
      return { circle, label, mark: marks?.[index] || '', side: sides?.[index] ?? 1 };
    });
    // THE LODESTAR (docs/archive/DESIGN_CLARIFICATIONS.md): the magnifier is
    // a FIXED point at magA — the reference everything rotates around. Drawn
    // last, so a node sliding through passes behind it.
    const lens = svgEl('circle', { cx: layout.magnifier.x.toFixed(1), cy: layout.magnifier.y.toFixed(1), r: magR.toFixed(1) });
    const lensLabel = svgEl('text', { y: '0', 'dominant-baseline': 'middle', class: 'secondary-strata-label is-magnified' });
    g.appendChild(lens);
    g.appendChild(lensLabel);
    // The word beside the lens (O-280): placed and worded at every settle
    // below; hidden while the ring turns.
    const captionWord = svgEl('text', { 'dominant-baseline': 'middle', 'text-anchor': 'start', class: 'secondary-strata-caption', display: 'none' });
    g.appendChild(captionWord);
    g.__caption = captionWord;
    if (legendRows && legendRows.length) {
      // THE LEGEND RUNS ALONG THE BAND (O-276, Howell's sketch 2026-11-08:
      // the two words "on either side of the focus ring band, rotated ...
      // curved to follow the arc"). Each word rides an arc concentric with
      // the ring, read UP the arc with its letters' tops away from the hub,
      // on the side of the band its names lie on: a bookmark's name runs
      // hubward of its disc, so its word is on the inner arc, below the
      // lens, where that side is open; the other word on the outer arc,
      // level with the lens, where the outer side is. Each at the reach his
      // sketch gave it — the inner word hangs from its arc, the outer stands
      // on it.
      //
      // AS WATERMARKS (O-277): each word fills the stretch of its arc the
      // glass shows, and is drawn FIRST in the group, under the band and
      // every name — a watermark lies beneath the page, never on it.
      const { hubX, hubY, radius } = layout.arc;
      const at = (r, a) => `${(hubX + r * Math.cos(a)).toFixed(1)} ${(hubY + r * Math.sin(a)).toFixed(1)}`;
      const first = g.firstChild;
      legendRows.forEach(([mark, word, side], row) => {
        const inner = Number(side) > 0;
        const r = inner ? radius - viewport.SSd * LEGEND_INNER_REACH : radius + viewport.SSd * LEGEND_OUTER_REACH;
        const lines = legendLines(displayCase(String(word)));
        if (!lines.length) return;
        // Each line's arc: the LAST line on the base arc at the word's reach,
        // each earlier line a pitch farther from the hub — so a lead line (the
        // "&" before the bookmarks word, O-277) stands between the word and
        // the band, and the word itself keeps the place his sketch gave it,
        // on either side. Sized to the visible run of the arc
        // where each line's letters' BODY lies (outward of its path standing,
        // inward hanging), the narrowest line ruling; the radii depend on the
        // size through the pitch, so the fit is taken a few times over.
        const clampEm = s => Math.max(LEGEND_MIN_EM * viewport.SSd, Math.min(LEGEND_MAX_EM * viewport.SSd, s));
        const lineR = (i, size) => r + (lines.length - 1 - i) * size * LEGEND_LINE_PITCH;
        const bodyR = (rr, size) => (inner ? rr - size * LEGEND_CAP / 2 : rr + size * LEGEND_CAP / 2);
        const fit = (rr, line) => { const v = visibleArc(hubX, hubY, rr, viewport.width, viewport.height); return v ? (LEGEND_FILL * rr * (v[1] - v[0])) / (Math.max(1, [...line].length) * LEGEND_EM_PER_GLYPH) : 0; };
        let size = clampEm(Math.min(...lines.map(line => fit(r, line))));
        for (let pass = 0; pass < 3; pass++) size = clampEm(Math.min(...lines.map((line, i) => fit(bodyR(lineR(i, size), size), line))));
        const t = svgEl('text', { class: `secondary-strata-legend${mark ? ` ${mark}` : ''}`, 'dominant-baseline': inner ? 'hanging' : 'alphabetic' });
        t.dataset.side = inner ? 'inner' : 'outer';
        t.dataset.lines = String(lines.length);
        t.style.fontSize = `${size.toFixed(1)}px`;
        lines.forEach((line, i) => {
          const ri = lineR(i, size);
          const run = visibleArc(hubX, hubY, bodyR(ri, size), viewport.width, viewport.height)
            || [layout.magA - 2 * layout.spacing, layout.magA + 2 * layout.spacing];
          const pid = `${id}-legend-${row}-${i}`;
          const path = svgEl('path', { id: pid, class: 'stratum-legend-arc', d: `M ${at(ri, run[0])} A ${ri.toFixed(1)} ${ri.toFixed(1)} 0 0 1 ${at(ri, run[1])}`, fill: 'none' });
          const tp = svgEl('textPath', { href: `#${pid}`, startOffset: '50%', 'text-anchor': 'middle' });
          tp.textContent = line;
          t.appendChild(tp);
          g.insertBefore(path, first);
        });
        g.insertBefore(t, first);
      });
    }
    outer.__seats = seats;
    outer.__lens = lens;
    outer.__lensLabel = lensLabel;
    outer.dataset.signature = membership;
  }

  // THE POSE, first the chain itself (O-272): solid from the centre of the
  // first seat to the centre of the last, in this pose's angles; hollow
  // beyond. A chain that reaches past both exits is the whole band, drawn
  // as before; an empty ring (the basement before its first bookmark) is
  // all bare sprocket.
  const show = (el, on) => { if (on) el.removeAttribute('display'); else el.setAttribute('display', 'none'); };
  // THE WORD BESIDE THE LENS (O-280): `word` is a string or null. Upright,
  // start-anchored, its left edge CAPTION_REACH lens radii right of the
  // lens's centre, at the lens's height. It records its anchor on the glass
  // (data-cx/data-cy) so the host can count a tap on it as a tap on the lens.
  const placeCaption = (el, word, mag, magR) => {
    if (!el) return;
    if (!word) { show(el, false); return; }
    const x = mag.x + magR * CAPTION_REACH, y = mag.y;
    el.setAttribute('x', x.toFixed(1));
    el.setAttribute('y', y.toFixed(1));
    el.removeAttribute('transform');
    // The size: the lens label's (the sheet's clamp, 21..39 px at 2.4 of
    // the short side's hundredths), cut to what the room allows.
    const text = displayCase(String(word));
    const glyphs = Math.max(1, Array.from(text).length);
    const base = Math.max(21, Math.min(39, 0.024 * viewport.SSd));
    const room = viewport.width - x - viewport.SSd * CAPTION_MARGIN;
    const size = Math.max(CAPTION_MIN_PX, Math.min(base, room / (glyphs * CAPTION_EM_PER_GLYPH)));
    el.style.fontSize = `${size.toFixed(1)}px`;
    el.dataset.cx = x.toFixed(1);
    el.dataset.cy = y.toFixed(1);
    el.textContent = displayCase(String(word));
    show(el, true);
  };
  if (outer.__band) {
    const n = items.length;
    const span = n
      ? chainSpanPoints(layout.arc, layout.startAngle, layout.endAngle,
          layout.magA - (n - 1 - selectedIndex) * layout.spacing,
          layout.magA + selectedIndex * layout.spacing,
          bandBounds(viewport.width, viewport.height, STRATA_REACH))
      : { whole: false, points: [] };
    outer.__band.setAttribute('d', span.whole ? outer.__bandWhole : pointsToPath(span.points));
    show(outer.__bandHollow, !span.whole);
  }

  // THE POSE: every seat to its place for this centre. While turning, EVERY
  // node is drawn (they stream through the empty lens, as on the primary);
  // settled, the node in the lens (magIndex) is hidden and the filled
  // lodestar shows it instead, so nothing floats where the lens is anchored.
  const sigma = getNodeSpacing(viewport) * LENS_SCALE_SIGMA;
  const magAngle = layout.magnifier?.angle ?? null;
  const posed = new Set();
  layout.nodes.forEach(node => {
    const seat = seats[node.index];
    if (!seat) return;
    posed.add(node.index);
    const inLens = !rotating && node.index === layout.magIndex;
    show(seat.circle, !inLens);
    show(seat.label, !inLens);
    if (inLens) return;
    // Passing the lens: the primary's bell, on the angle — every ring's, not
    // the basement's alone (O-186, Howell 2026-09-30: the languages "need to
    // enlarge, have the same action feedback that it does in the primary
    // stratum"). Same peak (2.0) and width (0.3 of a node spacing) as the
    // primary's; the label rides the same scale as its circle.
    let magScale = 1;
    if (rotating && magAngle != null) {
      const dist = Math.abs(node.angle - magAngle);
      magScale = 1 + (LENS_SCALE_PEAK - 1) * Math.exp(-(dist * dist) / (2 * sigma * sigma));
    }
    seat.circle.setAttribute('cx', node.x.toFixed(1));
    seat.circle.setAttribute('cy', node.y.toFixed(1));
    seat.circle.setAttribute('r', (nodeR * magScale).toFixed(1));
    const rotDeg = (node.angle * 180) / Math.PI + 180;
    const label = seat.label;
    const side = seat.side ?? 1;   // +1 outward from the disc, -1 mirrored about the ring's line (O-275)
    if (labelsBeside && magScale <= 1.01) {
      // Beside the node: outward, the name starts just past the node and
      // runs on; inward (side -1), it ends just short of the node and runs
      // the other way — the same distance, the mirror anchor.
      const lx = node.x + side * Math.cos(node.angle) * nodeR * BESIDE_OFFSET;
      const ly = node.y + side * Math.sin(node.angle) * nodeR * BESIDE_OFFSET;
      label.setAttribute('x', lx.toFixed(1));
      label.setAttribute('y', ly.toFixed(1));
      label.setAttribute('text-anchor', side < 0 ? 'end' : 'start');
      label.setAttribute('class', `secondary-strata-label is-beside${seat.mark ? ` ${seat.mark}` : ''}`);
      label.setAttribute('transform', `rotate(${rotDeg.toFixed(1)}, ${lx.toFixed(1)}, ${ly.toFixed(1)})`);
    } else if (mirrored && !centerMagnified) {
      // Over the node, from COVER_PULL radii out toward the hub, wherever
      // the node is. Passing the lens it swells about that same start,
      // never centred.
      const lx = node.x + side * Math.cos(node.angle) * nodeR * COVER_PULL;
      const ly = node.y + side * Math.sin(node.angle) * nodeR * COVER_PULL;
      label.setAttribute('x', '0');
      label.setAttribute('y', '0');
      label.setAttribute('text-anchor', side < 0 ? 'end' : 'start');
      label.setAttribute('class', `secondary-strata-label is-beside${magScale > 1.01 ? ' is-passing' : ''}${seat.mark ? ` ${seat.mark}` : ''}`);
      label.setAttribute('transform', `translate(${lx.toFixed(1)}, ${ly.toFixed(1)}) rotate(${rotDeg.toFixed(1)})${magScale > 1.01 ? ` scale(${magScale.toFixed(3)})` : ''}`);
    } else {
      // On the node — the numeral's seat, and the swelling name passing the lens.
      label.setAttribute('x', '0');
      label.setAttribute('y', '0');
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('class', `secondary-strata-label${magScale > 1.01 ? ' is-passing' : ''}${seat.mark ? ` ${seat.mark}` : ''}`);
      label.setAttribute('transform', `translate(${node.x.toFixed(1)}, ${node.y.toFixed(1)}) rotate(${rotDeg.toFixed(1)})${magScale > 1.01 ? ` scale(${magScale.toFixed(3)})` : ''}`);
    }
  });
  seats.forEach((seat, index) => { if (!posed.has(index)) { show(seat.circle, false); show(seat.label, false); } });

  // The lens: while ROTATING an EMPTY hollow lens the nodes stream through
  // (like the primary's); SETTLED it fills with the item nearest the lens
  // (magIndex), magnified.
  const lens = outer.__lens, lensLabel = outer.__lensLabel;
  const magClass = !rotating && classes?.[layout.magIndex] ? ` ${classes[layout.magIndex]}` : '';
  lens.setAttribute('class', 'secondary-strata-node is-magnified' + (rotating || !items.length ? ' lens-empty' : '') + magClass);
  if (!rotating && items.length) {
    const mag = layout.magnifier;
    const magRotDeg = (mag.angle * 180) / Math.PI + 180;
    // Centred for a central magnifier (the tertiary's) and for a ring with the
    // primary's manners (the basement's), else start-anchored and pulled
    // inward off the left edge (the secondary's, hard against it).
    const pulled = !centerMagnified && !labelsBeside;
    lensLabel.setAttribute('x', (pulled ? -magR * MAG_LABEL_SPAN_PULL : 0).toFixed(1));
    lensLabel.setAttribute('text-anchor', pulled ? 'start' : 'middle');
    lensLabel.setAttribute('transform', `translate(${mag.x.toFixed(1)}, ${mag.y.toFixed(1)}) rotate(${magRotDeg.toFixed(1)})`);
    const magRaw = typeof labelFor === 'function' ? labelFor(items[layout.magIndex], true) : items[layout.magIndex];
    lensLabel.textContent = displayCase(String(magRaw ?? ''));
    lensLabel.setAttribute('class', `secondary-strata-label is-magnified${marks?.[layout.magIndex] ? ` ${marks[layout.magIndex]}` : ''}`);
    show(lensLabel, true);
    placeCaption(g.__caption, typeof caption === 'function' ? caption(items[layout.magIndex]) : null, mag, magR);
  } else {
    show(lensLabel, false);
    placeCaption(g.__caption, null);
  }
  outer.dataset.pose = pose;

  // Already appended on create; a reused stratum stays put so its DOM order
  // (and thus z-order: secondary below, tertiary above) holds without
  // re-inserting. Return the OUTER <svg> — the blur and the recede transform
  // ride it (setStratumVisual).
  return outer;
}
