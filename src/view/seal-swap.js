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

const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

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

// A flying copy of a drawing, laid exactly over where it stood.
function flyer(src, r, opacity) {
  const img = document.createElement('img');
  img.src = src;
  img.alt = '';
  img.setAttribute('aria-hidden', 'true');
  Object.assign(img.style, {
    position: 'fixed', left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`,
    margin: '0', zIndex: '1001', pointerEvents: 'none', transformOrigin: '0 0', willChange: 'transform, opacity',
    opacity: String(opacity)
  });
  document.body.appendChild(img);
  return img;
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
export function playSealSwap({ svg = null, snapshot = null, ghosts = [], from, toSeal = null, toLogo = null, content = null, overlays = [], durationMs = SWAP_MS, onDone = null }) {
  const targets = [
    { from: from?.seal, to: toLogo },
    { from: from?.logo, to: toSeal }
  ];
  const live = [toSeal, toLogo].filter(Boolean);
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
    live.forEach(el => { el.style.visibility = ''; });
    onDone?.();
  };

  const box = svg?.getBoundingClientRect?.();
  const axis = swapAxis(box?.width || window.innerWidth, box?.height || window.innerHeight);
  const frame = u => {
    const e = ease(u);
    for (const f of flights) {
      const { dx, dy, sx, sy } = flightFrame(f.fromRect, f.toRect, e);
      f.el.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) scale(${sx.toFixed(4)}, ${sy.toFixed(4)})`;
      f.el.style.opacity = String(f.fromOp + (f.toOp - f.fromOp) * e);
    }
    const out = contentShift(axis, e, 'out');
    const inn = contentShift(axis, e, 'in');
    outgoing?.setAttribute('transform', `translate(${out.x.toFixed(1)} ${out.y.toFixed(1)})`);
    ghosts.forEach(el => { el.style.transform = `translate(${out.x.toFixed(1)}px, ${out.y.toFixed(1)}px)`; });
    content?.setAttribute('transform', `translate(${inn.x.toFixed(1)} ${inn.y.toFixed(1)})`);
    carried.forEach(el => { el.style.transform = `translate(${inn.x.toFixed(1)}px, ${inn.y.toFixed(1)}px)`; });
    // The scenery changes hands a little ahead of the crossing.
    const o = Math.min(1, u / 0.7);
    fading.forEach(el => { el.style.opacity = String(1 - o); });
    if (disc) disc.style.opacity = String(discInk * o);
  };

  try {
    live.forEach(el => { el.style.visibility = 'hidden'; });
    for (const t of targets) {
      if (!t.from?.rect || !t.from.src) continue;
      const toRect = rectOf(t.to);
      const toOpacity = t.to && typeof getComputedStyle === 'function' ? Number(getComputedStyle(t.to).opacity) || 1 : 0;
      flights.push({ el: flyer(t.from.src, t.from.rect, t.from.opacity ?? 1), fromRect: t.from.rect, toRect: toRect || t.from.rect, fromOp: t.from.opacity ?? 1, toOp: toRect ? toOpacity : 0 });
    }

    // Nothing takes the finger while the halves change places.
    const shield = document.createElement('div');
    Object.assign(shield.style, { position: 'fixed', left: '0', top: '0', right: '0', bottom: '0', zIndex: '1002' });
    const swallow = e => { e.stopPropagation(); e.preventDefault(); };
    ['pointerdown', 'pointerup', 'pointermove', 'click', 'touchstart', 'touchmove', 'touchend']
      .forEach(type => shield.addEventListener(type, swallow, { passive: false }));
    document.body.appendChild(shield);
    made.push(shield);

    const top = svg ? Array.from(svg.children) : [];
    const liveLogo = top.find(el => el.getAttribute('id') === 'volume-logo-group') || null;

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
      discInk = typeof getComputedStyle === 'function' ? Number(getComputedStyle(disc).opacity) || 1 : 1;
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
        else if (child.getAttribute('id') === 'volume-logo-group') ground.appendChild(child);
      }
      snapshot.querySelectorAll(BANDS).forEach(el => el.remove());
      snapshot.querySelectorAll(VESSELS).forEach(el => { el.style.stroke = 'none'; });
      svg.insertBefore(ground, liveLogo ? liveLogo.nextSibling : svg.firstChild);
      made.push(ground);
      fading.push(ground);
      svg.appendChild(snapshot);
      outgoing = snapshot;
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
