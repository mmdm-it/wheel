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

// A flying copy of a drawing, laid exactly over where it stood. It flies IN
// the glass, beneath the contents, so the pushed and pulled nodes and the
// leaf's text are always drawn over it; the svg draws in px with no viewBox,
// so a page rectangle is an svg rectangle.
function flyer(src, r) {
  const img = document.createElementNS(SVG_NS, 'image');
  img.setAttribute('href', src);
  img.setAttribute('x', String(r.left));
  img.setAttribute('y', String(r.top));
  img.setAttribute('width', String(r.width));
  img.setAttribute('height', String(r.height));
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
    const small = Math.min(fromW, toW), large = Math.max(fromW, toW);
    const w = fromW + (toW - fromW) * e;
    const sz = clamp01(Math.log(w / small) / Math.log(large / small));
    const inkSmall = fromW < toW ? fromOp : toOp, inkLarge = fromW < toW ? toOp : fromOp;
    op = inkSmall + (inkLarge - inkSmall) * (1 - (1 - sz) * (1 - sz));
  } else {
    op = fromOp + (toOp - fromOp) * e;
  }
  if (fromW > glassW) op *= clamp01(e / 0.25);
  if (toW > glassW) op *= clamp01((1 - e) / 0.25);
  return op;
}

// The frame of a flight at eased progress e: where the copy stands, how large,
// how inked. Pure, so a test can walk it.
export function flightFrame(from, to, e) {
  const x = from.left + (to.left - from.left) * e;
  const y = from.top + (to.top - from.top) * e;
  const sx = (from.width + (to.width - from.width) * e) / from.width;
  const sy = (from.height + (to.height - from.height) * e) / from.height;
  return { dx: x - from.left, dy: y - from.top, sx, sy };
}

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
export function playSealSwap({ land = null, toSealDisc = null, svg = null, snapshot = null, ghosts = [], from, toSeal = null, toLogo = null, content = null, overlays = [], durationMs = SWAP_MS, onDone = null }) {
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
  let discFlight = null;
  const frame = u => {
    const e = ease(u);
    for (const f of flights) {
      // The landing is read every frame: the new half can still settle its
      // badge after the swap began (the emblem's own scale arrives with the
      // host's first render), and a flight aimed once would land beside it.
      const at = rectOf(f.to);
      if (at) f.toRect = at;
      const { dx, dy, sx, sy } = flightFrame(f.fromRect, f.toRect, e);
      const ox = f.fromRect.left, oy = f.fromRect.top;
      f.el.setAttribute('transform', `translate(${(ox + dx).toFixed(1)} ${(oy + dy).toFixed(1)}) scale(${sx.toFixed(4)} ${sy.toFixed(4)}) translate(${-ox} ${-oy})`);
      f.el.style.opacity = flightInk(f.fromRect.width, f.toRect.width, f.fromOp, f.toOp, e, glassW).toFixed(3);
      // A drawing wider than the glass is taken over by its own self in place.
      if (f.to && f.toRect.width > glassW) f.to.style.opacity = (f.toOp * clamp01(1 - (1 - e) / 0.25)).toFixed(3);
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
    if (discFlight) {
      // THE DISC FLIES WITH ITS EMBLEM (O-295), centre and radius along the
      // same eased line, its ink from one seat's to the other's.
      const to = discFlight.target();
      if (to) discFlight.to = to;
      const a = discFlight.from, b = discFlight.to;
      discFlight.el.setAttribute('cx', (a.cx + (b.cx - a.cx) * e).toFixed(1));
      discFlight.el.setAttribute('cy', (a.cy + (b.cy - a.cy) * e).toFixed(1));
      discFlight.el.setAttribute('r', Math.max(0, a.r + (b.r - a.r) * e).toFixed(1));
      discFlight.el.style.opacity = (a.ink + (b.ink - a.ink) * e).toFixed(3);
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
      const toRect = rectOf(t.to);
      const toOp = toRect ? inkOf(t.to) : 0;
      if (t.to) {
        // The landing is shown at the end, whatever hid it before the swap
        // (the tap puts the old seal out, and the seal is the same element).
        const op = t.to.style.opacity;
        undo.push(() => { t.to.style.visibility = ''; t.to.style.opacity = op; });
        // The drawing in place is the flyer's landing: put out until it lands,
        // or, wider than the glass, taken over in the last quarter.
        if (toRect && toRect.width > glassW) t.to.style.opacity = '0';
        else t.to.style.visibility = 'hidden';
      }
      flights.push({ el: flyer(t.from.src, t.from.rect), to: t.to, fromRect: t.from.rect, toRect: toRect || t.from.rect, fromOp: t.from.opacity ?? 1, toOp });
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
      if ((from?.logo?.rect?.width || 0) > glassW) {
        oldSky = oldBadge?.querySelector('image#volume-logo-image') || null;
        if (oldSky) { oldSky.style.visibility = ''; oldSkyInk = from.logo.opacity ?? 1; }
      }
      svg.appendChild(snapshot);
      outgoing = snapshot;
    }
    // THE DISC (O-295). Where it lands: the new corner badge's own disc when
    // it has one (shown), else the new seal's, centred on the drawing at its
    // corner size. Read every frame, as the drawings' landings are.
    const fromDisc = from?.disc || null;
    if (svg && fromDisc && Number.isFinite(fromDisc.cx)) {
      const liveDisc = disc && inkOf(disc) > 0 && Number(disc.getAttribute('opacity') ?? 1) > 0 ? disc : null;
      const target = () => {
        if (liveDisc) {
          const r = rectOf(liveDisc);
          return r ? { cx: r.left + r.width / 2, cy: r.top + r.height / 2, r: r.width / 2, ink: discInk } : null;
        }
        if (toSeal && toSealDisc) {
          const r = rectOf(toSeal);
          return r ? { cx: r.left + r.width / 2, cy: r.top + r.height / 2, r: Math.min(r.width, r.height) / 2 * Math.min(1, toSealDisc.ratio || 0.5), ink: inkOf(toSeal) } : null;
        }
        return null;
      };
      const el = document.createElementNS(SVG_NS, 'circle');
      el.setAttribute('fill', fromDisc.colour || '#362e6a');
      el.style.pointerEvents = 'none';
      const first = target();
      // With nowhere to land, it goes down to the seal's corner and out.
      const fallback = { cx: fromDisc.cx, cy: fromDisc.cy, r: 0, ink: 0 };
      discFlight = { el, from: { cx: fromDisc.cx, cy: fromDisc.cy, r: fromDisc.r, ink: fromDisc.ink ?? 0.5 }, to: first || fallback, target };
      // The disc in place is the flyer's: put out where it was, and where it lands, until it lands.
      const oldCircle = oldBadge?.querySelector('circle');
      if (oldCircle) oldCircle.style.visibility = 'hidden';
      if (liveDisc) {
        liveDisc.style.visibility = 'hidden';
        undo.push(() => { liveDisc.style.visibility = ''; });
      }
    }
    // The drawings fly over the ground and under everything else.
    if (svg) {
      const sky = document.createElementNS(SVG_NS, 'g');
      sky.style.pointerEvents = 'none';
      if (discFlight) sky.appendChild(discFlight.el);
      flights.forEach(f => sky.appendChild(f.el));
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
