// THE SWAP (O-292, Howell 2026-11-11). The seal at the foot of the glass is the
// door between the two halves of the app. Tapping it, the two drawings trade
// corners across the diagonal: the seal travels up to the corner badge,
// growing, while the badge's drawing travels down to the foot, shrinking, and
// they cross in the middle of the glass. The ring never leaves: the new half
// is booted fully rendered beneath a frozen copy of the old screen, and that
// copy fades away while the drawings cross, so the ring's contents drain and
// refill and nothing else moves. Howell had first pictured the old corner's
// drawing continuing up and away; he chose the trade ("your idea is much
// better").
//
// Everything visible of the old half is a GHOST from the moment of the tap:
// the frozen SVG snapshot (gateway-wipe.js) plus copies of the HTML overlays
// that the boot clears, so the verse does not vanish a frame before the fade.

export const SWAP_MS = 750;

const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

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

/**
 * Play the swap. `from` = { seal: {rect, src, opacity}, logo: {rect, src, opacity} }
 * read at the tap; `toSeal` and `toLogo` are the new half's live elements, read
 * now that it is rendered. The old seal flies to the new badge, the old badge's
 * drawing to the new seal. A drawing with no place on either side fades.
 */
export function playSealSwap({ snapshot = null, ghosts = [], from, toSeal = null, toLogo = null, durationMs = SWAP_MS, onDone = null }) {
  const targets = [
    { from: from?.seal, to: toLogo },
    { from: from?.logo, to: toSeal }
  ];
  const live = [toSeal, toLogo].filter(Boolean);
  live.forEach(el => { el.style.visibility = 'hidden'; });
  const flights = [];
  for (const t of targets) {
    if (!t.from?.rect || !t.from.src) continue;
    const toRect = rectOf(t.to);
    const toOpacity = t.to && typeof getComputedStyle === 'function' ? Number(getComputedStyle(t.to).opacity) || 1 : 0;
    flights.push({ el: flyer(t.from.src, t.from.rect, t.from.opacity ?? 1), fromRect: t.from.rect, toRect: toRect || t.from.rect, fromOp: t.from.opacity ?? 1, toOp: toRect ? toOpacity : 0 });
  }
  const fading = [snapshot, ...ghosts].filter(Boolean);
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    flights.forEach(f => f.el.remove());
    fading.forEach(el => el.remove());
    live.forEach(el => { el.style.visibility = ''; });
    onDone?.();
  };
  const t0 = performance.now();
  const step = now => {
    if (done) return;
    const u = Math.min(1, (now - t0) / durationMs);
    const e = ease(u);
    for (const f of flights) {
      const { dx, dy, sx, sy } = flightFrame(f.fromRect, f.toRect, e);
      f.el.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) scale(${sx.toFixed(4)}, ${sy.toFixed(4)})`;
      f.el.style.opacity = String(f.fromOp + (f.toOp - f.fromOp) * e);
    }
    // The old screen drains a little ahead of the crossing, so the ring's new
    // contents are mostly in by the time the drawings meet in the middle.
    const o = String(Math.max(0, 1 - Math.min(1, u / 0.7)));
    fading.forEach(el => { el.style.opacity = o; });
    if (u < 1) requestAnimationFrame(step); else finish();
  };
  requestAnimationFrame(step);
  return { finish };
}
