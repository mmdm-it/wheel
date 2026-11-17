// THE SWAP (O-292, O-293, Howell 2026-11-11). The seal at the foot of the
// glass is the door between the two halves of the app. Tapping it, the two
// drawings trade corners across the diagonal: the seal travels up to the
// corner badge, growing, while the badge's drawing travels down to the foot,
// shrinking, and they cross in the middle of the glass. Howell had first
// pictured the old corner's drawing continuing up and away; he chose the
// trade ("your idea is much better").
//
// NOTHING FADES (O-293). The first build drained the old half's nodes and
// let the new ones appear, and Howell refused it: "The only nodes that should
// ever fade away are cousin nodes in the focus ring, which have nowhere to
// go. But in this case, all of these nodes have somewhere to go." So the
// contents MIGRATE along the drawings' own diagonal. Everything the old half
// shows (ring nodes, pyramid, the lens's and the parent button's fills and
// names, the leaf's text) is driven off the lower left ahead of the badge's
// drawing as it comes down ("pushing these nodes ahead of it"), and
// everything the new half shows comes in from off the lower left behind the
// seal as it goes up ("pulled behind the church icon"), landing as the
// drawing settles. The fixed vessels keep the migration doctrine: the band
// and the two outlined seats never move; they empty and refill.
//
// The old half is a GHOST from the moment of the tap: the frozen SVG snapshot
// (gateway-wipe.js) plus copies of the HTML overlays that the boot clears.
// The new half is LIVE: its own content group and overlays are carried in, so
// whatever arrives late (a leaf still loading) arrives in flight.

export const SWAP_MS = 1500;

// A sine in and out, gentler than the cubic the first build used: the cubic
// held everything still for the first fifth of the crossing and had it all
// landed by four fifths, which left the eye nothing to follow at either end.
const ease = t => (1 - Math.cos(Math.PI * t)) / 2;
const clamp01 = x => Math.max(0, Math.min(1, x));

const SVG_NS = 'http://www.w3.org/2000/svg';

// How far the contents travel, in diagonals of the glass: a little more than
// one, so the corner farthest from the foot clears the edge, and so the
// contents always move faster than the drawing behind them.
export const SWAP_CLEAR = 1.1;

// The line the contents travel: from the badge's corner to the seal's, the
// upper right to the lower left. Pure, so a test can walk it.
export function swapAxis(width, height, clear = SWAP_CLEAR) {
  const len = Math.hypot(width, height);
  if (!(len > 0)) return { ux: 0, uy: 0, reach: 0 };
  return { ux: -width / len, uy: height / len, reach: len * clear };
}

// Where the contents stand at eased progress e. The old half ('out') starts
// at rest and ends off the lower left; the new half ('in') starts there and
// ends at rest.
export function contentShift(axis, e, way) {
  const k = way === 'out' ? e : 1 - e;
  return { x: axis.ux * axis.reach * k + 0, y: axis.uy * axis.reach * k + 0 };   // + 0: never a negative zero
}

export function rectOf(el) {
  const r = el?.getBoundingClientRect?.();
  return r && r.width > 0 && r.height > 0 ? { left: r.left, top: r.top, width: r.width, height: r.height } : null;
}

// The HTML overlays of the old half, copied in place at the tap. Ids are
// stripped from the copies so nothing can find them by name.
export function ghostOverlays(ids) {
  const ghosts = [];
  for (const id of ids) {
    const el = document.getElementById(id);
    if (!el || el.hidden || !el.parentNode) continue;
    const copy = el.cloneNode(true);
    copy.removeAttribute('id');
    copy.querySelectorAll('[id]').forEach(n => n.removeAttribute('id'));
    copy.style.pointerEvents = 'none';
    el.parentNode.insertBefore(copy, el.nextSibling);
    ghosts.push(copy);
  }
  return ghosts;
}

// A drawing as it stands: its centre, its own width and height, and its turn.
// A leaf's watermark is a turned image (O-268), and its bounding rectangle is
// neither its size nor its shape; the image's own box and angle are read from
// its attributes. Anything else is its rectangle, unturned.
export function boxOf(el) {
  const r = rectOf(el);
  if (!r) return null;
  const centre = { cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
  const w = Number(el.getAttribute?.('width')), h = Number(el.getAttribute?.('height'));
  const m = /rotate\(\s*(-?[\d.]+)/.exec(el.getAttribute?.('transform') || '');
  const rot = m ? Number(m[1]) : 0;
  if (rot && w > 0 && h > 0) return { ...centre, w, h, rot };
  return { ...centre, w: r.width, h: r.height, rot: 0 };
}

// A DRAWING KEEPS ITS OWN PROPORTIONS INSIDE ITS BOX (O-308). The badge's
// image and the seal both fit their drawing whole inside the box they are
// given, centred, and the box is seldom the drawing's shape: a leaf's sky is
// boxed about a seventh wider than the crown drawn in it. A flyer stretched
// to the box was therefore wider than the drawing it took over from, and
// Howell saw it (2026-11-16: "an annoying jump in the crown of thorns at the
// beginning of the transition ... does not settle at the end in the same
// position as the established crown"). The flight is reckoned on the drawing
// as drawn: its box fitted to the drawing's own width over height. Pure.
export function contentBox(box, aspect) {
  if (!box || !(aspect > 0) || !(box.w > 0) || !(box.h > 0)) return box;
  const w = Math.min(box.w, box.h * aspect);
  return { ...box, w, h: w / aspect };
}

// A drawing's own width over height, learnt by loading it once; null until
// it is known. The badge primes it when it is given its drawing, so it is in
// hand long before a tap on the seal.
const aspects = new Map();
const absolute = src => { try { return new URL(src, document.baseURI).href; } catch (_) { return String(src); } };
export function primeAspect(src) {
  if (!src || typeof Image !== 'function' || typeof document === 'undefined') return;
  const key = absolute(src);
  if (aspects.has(key)) return;
  aspects.set(key, null);
  const probe = new Image();
  const learn = () => { if (probe.naturalWidth > 0 && probe.naturalHeight > 0) aspects.set(key, probe.naturalWidth / probe.naturalHeight); };
  probe.addEventListener('load', learn);
  probe.src = key;
  if (probe.complete) learn();
}
export function aspectOf(src) {
  if (!src || typeof document === 'undefined') return null;
  const key = absolute(src);
  if (!aspects.has(key)) primeAspect(src);
  return aspects.get(key) || null;
}

// A flying copy of a drawing, laid exactly over where it stood. It flies IN
// the glass, beneath the contents, so the pushed and pulled nodes and the
// leaf's text are always drawn over it; the svg draws in px with no viewBox,
// so a page position is an svg position. It is drawn once, at `base`, and
// carried from there by a transform.
function flyer(src, base) {
  const img = document.createElementNS(SVG_NS, 'image');
  img.setAttribute('href', src);
  img.setAttribute('x', String(base.cx - base.w / 2));
  img.setAttribute('y', String(base.cy - base.h / 2));
  img.setAttribute('width', String(base.w));
  img.setAttribute('height', String(base.h));
  img.setAttribute('preserveAspectRatio', 'none');
  img.setAttribute('aria-hidden', 'true');
  img.style.pointerEvents = 'none';
  return img;
}

// How inked a drawing is at eased progress e. A drawing that changes size
// changes ink with its size, not with the clock: the badge's drawing on a
// leaf is the whole sky at a tenth of its ink, and at the seal's half ink it
// would black out the glass half way down. A drawing wider than the glass
// (that sky) is not flown at its full size, which would spill past the band:
// the drawing in place hands over to the flyer in the first quarter of the
// flight, and the flyer to the drawing in place in the last.
export function flightInk(fromW, toW, fromOp, toOp, e, glassW = Infinity) {
  // The ink is a property of the size alone, the same whichever way the
  // drawing travels: s runs 0 at the smaller end to 1 at the larger on a
  // scale of size, and the ink leans to the larger end's, so a drawing half
  // way grown is already nearly as faint as the sky (the first build's
  // straight line left it as dark as a node at middle sizes).
  let op;
  if (fromW > 0 && toW > 0 && Math.abs(Math.log(toW / fromW)) > 1e-6) {
    // The drawing's size runs geometrically (boxAt), so on a scale of size
    // it is simply as far along as the crossing is.
    const sz = fromW < toW ? clamp01(e) : clamp01(1 - e);
    const inkSmall = fromW < toW ? fromOp : toOp, inkLarge = fromW < toW ? toOp : fromOp;
    op = inkSmall + (inkLarge - inkSmall) * (1 - (1 - sz) * (1 - sz));
  } else {
    op = fromOp + (toOp - fromOp) * e;
  }
  if (fromW > glassW) op *= clamp01(e / 0.25);
  if (toW > glassW) op *= clamp01((1 - e) / 0.25);
  return op;
}

// A drawing in flight at eased progress e, between two boxes ({cx, cy, w, h,
// rot}): its centre runs straight, its turn evenly, and ITS SIZE
// GEOMETRICALLY, the way its disc's radius does (discAt) — so a drawing and
// the disc behind it shrink and grow together (O-306, Howell 2026-11-16, of
// a size that ran evenly while the disc's ran geometrically: "the crown of
// thorns has a life of its own. It separates from the blue circle ... they
// should stay generally aligned as they head down to the lower left corner
// and become concentric again"). Its own mirror, as discAt is. Pure.
export function boxAt(a, b, e) {
  const geo = (x, y) => (x > 0 && y > 0 ? x * Math.pow(y / x, e) : x + (y - x) * e);
  return {
    cx: a.cx + (b.cx - a.cx) * e,
    cy: a.cy + (b.cy - a.cy) * e,
    w: geo(a.w, b.w),
    h: geo(a.h, b.h),
    rot: a.rot + (b.rot - a.rot) * e
  };
}

// THE SECTOR'S GROUND IS A CIRCLE THAT TRAVELS WITH ITS DRAWING (O-306,
// Howell 2026-11-16, of the crossing between two leaves: "In one direction it
// fades away, and in the other direction it is a moving, enlarging circle.
// As you know, I'm not fond of fades generally, so I like the moving,
// enlarging circle, but it needs to be reciprocal and mirror the action in
// each direction").
//
// Each half's circle belongs to that half's drawing and rides it across the
// glass. `a` and `b` are the circle at the two ends ({cx, cy, r, ink}), and
// `anchorA` and `anchorB` the centre of its drawing at the same two ends. The
// radius runs geometrically, so a sector closing has shrunk to a small disc
// well before the crossing's middle and a sector opening is still small well
// after it: the two grounds are never both large. Where the circle is not
// centred on its drawing (a sector is centred on the ring's hub), it closes
// onto the drawing as it shrinks.
//
// RECIPROCAL BY CONSTRUCTION: discAt(a, b, A, B, e) is discAt(b, a, B, A,
// 1 - e), so arriving is leaving played backwards and neither needs a rule
// of its own. Pure, so a test can walk it.
const DISC_FLOOR = 0.5;   // px: the "nothing" a circle with no disc grows from
export function discAt(a, b, anchorA, anchorB, e) {
  const ra = Math.max(a.r, DISC_FLOOR), rb = Math.max(b.r, DISC_FLOOR);
  const r = ra * Math.pow(rb / ra, e);
  const p = Math.abs(rb - ra) > 1e-9 ? (r - ra) / (rb - ra) : e;
  const ax = anchorA.x + (anchorB.x - anchorA.x) * e, ay = anchorA.y + (anchorB.y - anchorA.y) * e;
  return {
    cx: ax + (a.cx - anchorA.x) * (1 - p) + (b.cx - anchorB.x) * p,
    cy: ay + (a.cy - anchorA.y) * (1 - p) + (b.cy - anchorB.y) * p,
    r: r <= DISC_FLOOR ? 0 : r,
    ink: a.ink + (b.ink - a.ink) * p
  };
}
const centreOf = r => (r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null);

// A copy of a fixed vessel that stays at its seat while the live one travels
// inside the content group. It is laid in the frame of the original's parent
// and wears the original's outline inline, since it stands outside the groups
// the stylesheet finds it by.
function still(el, outlineOnly) {
  const copy = el.cloneNode(true);
  copy.removeAttribute('id');
  if (outlineOnly && typeof getComputedStyle === 'function') {
    const cs = getComputedStyle(el);
    copy.style.stroke = cs.stroke;
    copy.style.strokeWidth = cs.strokeWidth;
    copy.style.fill = 'none';
  }
  const m = el.parentNode?.getCTM?.();
  if (!m || (m.a === 1 && m.b === 0 && m.c === 0 && m.d === 1 && m.e === 0 && m.f === 0)) return copy;
  const wrap = document.createElementNS(SVG_NS, 'g');
  wrap.setAttribute('transform', `matrix(${m.a} ${m.b} ${m.c} ${m.d} ${m.e} ${m.f})`);
  wrap.appendChild(copy);
  return wrap;
}

const BANDS = '.focus-ring-band, .focus-ring-band-hollow';
const VESSELS = 'circle.focus-ring-magnifier-circle';   // the lens and the parent button

/**
 * Play the swap. `from` = { seal: {rect, src, opacity}, logo: {rect, src, opacity} }
 * read at the tap; `toSeal` and `toLogo` are the new half's live elements, read
 * now that it is rendered. The old seal flies to the new badge, the old badge's
 * drawing to the new seal. A drawing with no place on either side fades.
 * `content` is the new half's live content group and `overlays` its live HTML
 * overlays: they are carried in while `snapshot` and `ghosts` are carried out.
 */
export function playSealSwap({ land = null, toSealDisc = null, toDiscColour = null, svg = null, snapshot = null, ghosts = [], from, toSeal = null, toLogo = null, content = null, overlays = [], durationMs = SWAP_MS, onDone = null }) {
  const targets = [
    { from: from?.seal, to: toLogo },
    { from: from?.logo, to: toSeal }
  ];
  const flights = [];
  const made = [];      // what the swap put on the glass, taken off at the end
  const undo = [];      // what it changed on the live half, put back at the end
  const fading = [];    // the old ground and the old badge's disc: scenery with nowhere to go
  const carried = overlays.filter(Boolean);
  let outgoing = null;
  let disc = null, discInk = 1;
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    flights.forEach(f => f.el.remove());
    made.forEach(el => el.remove());
    snapshot?.remove();
    ghosts.forEach(el => el.remove());
    undo.forEach(fn => { try { fn(); } catch (_) { /* the element is gone */ } });
    content?.removeAttribute('transform');
    onDone?.();
  };

  const box = svg?.getBoundingClientRect?.();
  const glassW = box?.width || window.innerWidth;
  const axis = swapAxis(glassW, box?.height || window.innerHeight);
  let oldBadgeSmall = false, newBadgeSmall = false, oldBadge = null, oldSky = null, oldSkyInk = 1;
  const discFlights = [];
  const frame = u => {
    const e = ease(u);
    // The discs first: a drawing that left or lands in a sector is seen
    // through its disc, and needs to know where the disc is.
    for (const d of discFlights) {
      // The landing is read every frame, as the drawings' landings are.
      const end = d.target();
      if (end) d.end = end;
      d.now = discAt(d.a, d.end.disc, d.anchorA, d.end.anchor, e);
      d.el.setAttribute('cx', d.now.cx.toFixed(1));
      d.el.setAttribute('cy', d.now.cy.toFixed(1));
      d.el.setAttribute('r', Math.max(0, d.now.r).toFixed(1));
      d.el.style.opacity = d.now.ink.toFixed(3);
    }
    for (const f of flights) {
      // The landing is read every frame: the new half can still settle its
      // badge after the swap began (the emblem's own scale arrives with the
      // host's first render), and a flight aimed once would land beside it.
      const at = contentBox(boxOf(f.to), f.aspect);
      if (at) f.toBox = at;
      const k = boxAt(f.fromBox, f.toBox, e);
      const base = f.base;
      f.el.setAttribute('transform', `translate(${k.cx.toFixed(1)} ${k.cy.toFixed(1)}) rotate(${k.rot.toFixed(2)}) scale(${(k.w / base.w).toFixed(4)} ${(k.h / base.h).toFixed(4)}) translate(${-base.cx} ${-base.cy})`);
      if (f.window) {
        // SEEN THROUGH ITS DISC (O-306). At a leaf the drawing shows only
        // inside its sector; in a corner it stands out past its disc. So the
        // window is the disc itself at the leaf's end of the flight and has
        // opened to the whole drawing by the corner's end: the drawing never
        // spills over the band at a leaf, and never has to be handed over
        // from a copy standing still while its disc has already left.
        // The opening is measured on the drawing AS IT IS NOW (O-307): its
        // disc closes to nothing well before the corner, and a window that
        // opened by the corner's small measure would crop the drawing to a
        // dot on the way.
        const d = f.window.disc, t = f.window.leaving ? e : 1 - e;
        const open = Math.hypot(k.w, k.h) / 2 * 1.05;
        f.window.el.setAttribute('cx', d.now.cx.toFixed(1));
        f.window.el.setAttribute('cy', d.now.cy.toFixed(1));
        f.window.el.setAttribute('r', (d.now.r + open * t).toFixed(1));
        f.el.style.opacity = flightInk(f.fromBox.w, f.toBox.w, f.fromOp, f.toOp, e).toFixed(3);
        continue;
      }
      f.el.style.opacity = flightInk(f.fromBox.w, f.toBox.w, f.fromOp, f.toOp, e, glassW).toFixed(3);
      // A drawing wider than the glass is taken over by its own self in place.
      if (f.to && f.toBox.w > glassW) f.to.style.opacity = (f.toOp * clamp01(1 - (1 - e) / 0.25)).toFixed(3);
    }
    const out = contentShift(axis, e, 'out');
    const inn = contentShift(axis, e, 'in');
    outgoing?.setAttribute('transform', `translate(${out.x.toFixed(1)} ${out.y.toFixed(1)})`);
    ghosts.forEach(el => { el.style.transform = `translate(${out.x.toFixed(1)}px, ${out.y.toFixed(1)}px)`; });
    content?.setAttribute('transform', `translate(${inn.x.toFixed(1)} ${inn.y.toFixed(1)})`);
    carried.forEach(el => { el.style.transform = `translate(${inn.x.toFixed(1)}px, ${inn.y.toFixed(1)}px)`; });
    // The scenery changes hands a little ahead of the crossing, except a
    // corner badge's disc, which empties as its drawing leaves it and fills
    // as its drawing arrives: a seat is never seen empty and waiting.
    const o = Math.min(1, u / 0.7);
    fading.forEach(el => { el.style.opacity = String(1 - o); });
    if (oldSky) oldSky.style.opacity = (oldSkyInk * (1 - clamp01(e / 0.25))).toFixed(3);
    if (discFlights.length) {
      if (oldBadge) oldBadge.style.opacity = String(1 - o);
    } else {
      if (oldBadge) oldBadge.style.opacity = String(oldBadgeSmall ? 1 - clamp01(e / 0.12) : 1 - o);
      if (disc) disc.style.opacity = String(discInk * (newBadgeSmall ? clamp01((e - 0.88) / 0.12) : o));
    }
  };

  try {
    const top = svg ? Array.from(svg.children) : [];
    const liveLogo = top.find(el => el.getAttribute('id') === 'volume-logo-group') || null;

    // THE NEW BADGE LANDS AT ONCE. A badge that changes size between the two
    // halves (a leaf's whole sky, the other half's corner) eases there on its own
    // clock, which would leave the flight aimed at where it started. The swap
    // is that move: the journey is landed (`land`) and any transition put out
    // for the swap's length.
    try { land?.(); } catch (_) { /* nothing was moving */ }
    if (liveLogo) {
      for (const el of [liveLogo, ...liveLogo.querySelectorAll('*')]) {
        const was = el.style.transition;
        el.style.transition = 'none';
        undo.push(() => { el.style.transition = was; });
      }
      liveLogo.getBoundingClientRect();   // the jump to the end, now
    }

    const inkOf = el => {
      const v = el && typeof getComputedStyle === 'function' ? Number(getComputedStyle(el).opacity) : NaN;
      return Number.isFinite(v) ? v : 1;
    };
    for (const t of targets) {
      if (!t.from?.rect || !t.from.src) continue;
      const r = t.from.rect;
      // Both ends are the drawing as drawn there, not the box it sits in (O-308).
      const aspect = aspectOf(t.from.src);
      const fromBox = contentBox(t.from.box || { cx: r.left + r.width / 2, cy: r.top + r.height / 2, w: r.width, h: r.height, rot: 0 }, aspect);
      const toBox = contentBox(boxOf(t.to), aspect);
      const toOp = toBox ? inkOf(t.to) : 0;
      let toStyleOpacity = '';
      if (t.to) {
        // The landing is shown at the end, whatever hid it before the swap
        // (the tap puts the old seal out, and the seal is the same element).
        const op = toStyleOpacity = t.to.style.opacity;
        undo.push(() => { t.to.style.visibility = ''; t.to.style.opacity = op; });
        // The drawing in place is the flyer's landing: put out until it lands,
        // or, wider than the glass, taken over in the last quarter.
        if (toBox && toBox.w > glassW) t.to.style.opacity = '0';
        else t.to.style.visibility = 'hidden';
      }
      // Drawn once at the larger of its two sizes, so it is only ever carried down.
      const base = toBox && toBox.w > fromBox.w ? { ...toBox } : { ...fromBox };
      flights.push({ el: flyer(t.from.src, base), base, aspect, to: t.to, down: t.to === toSeal, fromBox, toBox: toBox || fromBox, fromOp: t.from.opacity ?? 1, toOp, toStyleOpacity });
    }

    // Nothing takes the finger while the halves change places.
    const shield = document.createElement('div');
    Object.assign(shield.style, { position: 'fixed', left: '0', top: '0', right: '0', bottom: '0', zIndex: '1002' });
    const swallow = e => { e.stopPropagation(); e.preventDefault(); };
    ['pointerdown', 'pointerup', 'pointermove', 'click', 'touchstart', 'touchmove', 'touchend']
      .forEach(type => shield.addEventListener(type, swallow, { passive: false }));
    document.body.appendChild(shield);
    made.push(shield);

    // THE NEW HALF. The band and the two seats' outlines are copied where
    // they stand and the live ones put out, so the group can travel without
    // taking the vessels along: the live discs, unoutlined, are the fills in
    // flight ("a travelling node wears no stroke", O-162).
    if (svg && content) {
      const under = document.createElementNS(SVG_NS, 'g');
      const over = document.createElementNS(SVG_NS, 'g');
      under.style.pointerEvents = 'none';
      over.style.pointerEvents = 'none';
      content.querySelectorAll(BANDS).forEach(el => {
        if (!rectOf(el)) return;
        under.appendChild(still(el, false));
        const was = el.style.visibility;
        el.style.visibility = 'hidden';
        undo.push(() => { el.style.visibility = was; });
      });
      content.querySelectorAll(VESSELS).forEach(el => {
        if (!rectOf(el)) return;
        over.appendChild(still(el, true));
        const was = el.style.stroke;
        el.style.stroke = 'none';
        undo.push(() => { el.style.stroke = was; });
      });
      svg.insertBefore(under, content);
      svg.insertBefore(over, content.nextSibling);
      made.push(under, over);
    }
    carried.forEach(el => { const was = el.style.transform; undo.push(() => { el.style.transform = was; }); });
    disc = liveLogo?.querySelector('circle') || null;
    if (disc) {
      discInk = inkOf(disc);
      newBadgeSmall = (rectOf(disc)?.width || Infinity) < glassW;
      const was = disc.style.opacity;
      undo.push(() => { disc.style.opacity = was; });
    }

    // THE OLD HALF. The boot left the snapshot at the bottom of the glass;
    // its ground goes under everything, its badge's disc stays where it was
    // (after the live badge, so a lookup by id finds the live one first), and
    // what is left, the contents, is raised to the top and carried out. Its
    // band is dropped (the live copy stands in the same place) and its seats
    // lose their outlines the same way.
    if (svg && snapshot) {
      const ground = document.createElementNS(SVG_NS, 'g');
      ground.style.pointerEvents = 'none';
      for (const child of Array.from(snapshot.children)) {
        if (child.tagName.toLowerCase() === 'rect') { svg.insertBefore(child, svg.firstChild); made.push(child); fading.push(child); }
        else if (child.getAttribute('id') === 'volume-logo-group') { ground.appendChild(child); oldBadge = child; }
      }
      snapshot.querySelectorAll(BANDS).forEach(el => el.remove());
      snapshot.querySelectorAll(VESSELS).forEach(el => { el.style.stroke = 'none'; });
      svg.insertBefore(ground, liveLogo ? liveLogo.nextSibling : svg.firstChild);
      made.push(ground);
      oldBadgeSmall = (rectOf(oldBadge?.querySelector('circle'))?.width || Infinity) < glassW;
      // The old sky's drawing stays in place, clipped to its sector as it
      // stood, and hands over to its flyer in the first quarter.
      if ((from?.logo?.rect?.width || 0) > glassW && !from?.discs?.logo) {
        oldSky = oldBadge?.querySelector('image#volume-logo-image') || null;
        if (oldSky) { oldSky.style.visibility = ''; oldSkyInk = from.logo.opacity ?? 1; }
      }
      svg.appendChild(snapshot);
      outgoing = snapshot;
    }
    // THE DISCS (O-295, O-306). Two can be on the glass: the leaving half's,
    // behind the drawing that goes down to the foot, and the arriving half's,
    // behind the drawing that comes up to the corner. Each lands where its
    // own drawing lands, never on the other half's disc: a disc that had
    // nowhere of its own to land used to be sent to the other half's sector,
    // which painted one half's ground in the other's colour for the length
    // of the crossing.
    const discs = from?.discs || (from?.disc ? { logo: from.disc } : {});
    const circleEl = colour => {
      const el = document.createElementNS(SVG_NS, 'circle');
      el.setAttribute('fill', colour || '#362e6a');
      el.style.pointerEvents = 'none';
      return el;
    };
    const liveDisc = disc && rectOf(disc) && inkOf(disc) > 0 && Number(disc.getAttribute('opacity') ?? 1) > 0 ? disc : null;
    if (svg && discs.logo && Number.isFinite(discs.logo.cx)) {
      // LEAVING: from where it stands (a corner disc, or a whole sector) to
      // the new seal's disc, or to nothing at the new seal where that seal
      // stands bare.
      const a = { cx: discs.logo.cx, cy: discs.logo.cy, r: discs.logo.r, ink: discs.logo.ink ?? 0.5 };
      const anchorA = centreOf(from?.logo?.rect) || { x: a.cx, y: a.cy };
      const target = () => {
        const c = centreOf(rectOf(toSeal));
        if (!c) return null;
        const r = toSealDisc ? Math.min(rectOf(toSeal).width, rectOf(toSeal).height) / 2 * Math.min(1, toSealDisc.ratio || 0.5) : 0;
        return { disc: { cx: c.x, cy: c.y, r, ink: toSealDisc ? inkOf(toSeal) : a.ink }, anchor: c };
      };
      // With nowhere to land, it closes where it stands.
      const fallback = { disc: { cx: a.cx, cy: a.cy, r: 0, ink: a.ink }, anchor: anchorA };
      discFlights.push({ el: circleEl(discs.logo.colour), a, anchorA, end: target() || fallback, target, leaving: true });
      const oldCircle = oldBadge?.querySelector('circle');
      if (oldCircle) oldCircle.style.visibility = 'hidden';
    }
    if (svg && liveDisc && (discs.seal || toDiscColour)) {
      // ARRIVING: from the old seal's disc, or from nothing at the old seal
      // where it stood bare, to the new half's own disc as it stands (a
      // corner disc, or a whole sector).
      const start = centreOf(from?.seal?.rect);
      const target = () => {
        const r = rectOf(liveDisc);
        if (!r) return null;
        const c = centreOf(r);
        return { disc: { cx: c.x, cy: c.y, r: r.width / 2, ink: discInk }, anchor: centreOf(rectOf(toLogo)) || c };
      };
      const first = target();
      if (first && (discs.seal || start)) {
        const a = discs.seal
          ? { cx: discs.seal.cx, cy: discs.seal.cy, r: discs.seal.r, ink: discs.seal.ink ?? discInk }
          : { cx: start.x, cy: start.y, r: 0, ink: discInk };
        discFlights.push({ el: circleEl(discs.seal?.colour || toDiscColour), a, anchorA: start || { x: a.cx, y: a.cy }, end: first, target, leaving: false });
        liveDisc.style.visibility = 'hidden';
        undo.push(() => { liveDisc.style.visibility = ''; });
      }
    }
    // The drawings fly over the ground and under everything else.
    if (svg) {
      const sky = document.createElementNS(SVG_NS, 'g');
      sky.style.pointerEvents = 'none';
      discFlights.forEach(d => sky.appendChild(d.el));
      for (const f of flights) {
        // A drawing wider than the glass at one end stands in a sector there.
        // Where that sector's disc is flying too, the drawing is seen through
        // it (see frame), and the copy in place stays out for the whole
        // flight; no hand-over between a still drawing and a moving one.
        const wideFrom = f.fromBox.w > glassW, wideTo = f.toBox.w > glassW;
        const d = (wideFrom || wideTo) ? discFlights.find(x => x.leaving === f.down) : null;
        if (d && (f.down ? wideFrom : wideTo)) {
          const id = `seal-swap-window-${f.down ? 'down' : 'up'}`;
          const clip = document.createElementNS(SVG_NS, 'clipPath');
          clip.setAttribute('id', id);
          clip.setAttribute('clipPathUnits', 'userSpaceOnUse');
          const hole = document.createElementNS(SVG_NS, 'circle');
          clip.appendChild(hole);
          const pane = document.createElementNS(SVG_NS, 'g');
          pane.setAttribute('clip-path', `url(#${id})`);
          pane.appendChild(f.el);
          sky.appendChild(clip);
          sky.appendChild(pane);
          f.window = { el: hole, disc: d, leaving: f.down };
          if (!f.down && f.to) { f.to.style.opacity = f.toStyleOpacity; f.to.style.visibility = 'hidden'; }
          continue;
        }
        sky.appendChild(f.el);
      }
      const after = svg.contains(oldBadge) ? oldBadge.parentNode : liveLogo;
      svg.insertBefore(sky, after ? after.nextSibling : svg.firstChild);
      made.push(sky);
    }
    // The first frame is laid now: the new half must not be seen at rest
    // before it has travelled.
    frame(0);
  } catch (err) {
    finish();
    throw err;
  }

  const t0 = performance.now();
  const step = now => {
    if (done) return;
    const u = Math.min(1, (now - t0) / durationMs);
    frame(u);
    if (u < 1) requestAnimationFrame(step); else finish();
  };
  requestAnimationFrame(step);
  return { finish };
}
