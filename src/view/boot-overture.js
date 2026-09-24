// THE BOOT OVERTURE (O-177, Howell 2026-09-23: "the load time is still long
// enough that I think we should consider a brief overture, similar to
// the other volume's"). The first-visit reveal plays once per browser, AFTER the app has
// loaded, for seven seconds — a first-visit ceremony, not a cover for a wait.
// This is the cover: it starts the instant the app's code runs, on the ground
// the page painted before anything arrived (O-174), and it ends the moment
// the instrument is ready, never a beat later.
//
// WHAT IT DRAWS. The wheel's own line-work, in the wheel's own ink, at the
// wheel's own coordinates — the band's centre line inking itself from the hub
// end to the left edge, then the lens's ring, then the parent's — so that
// when the live wheel arrives the lines are exactly where its parts land and
// nothing jumps. THE HANDOFF is not a fade (O-160's grammar): the drawn line
// THICKENS into the band, the two rings are already the rings, and the wheel
// appears within them.
//
// Every load, because it covers a real wait every load; ?overture=0 skips it
// on the bench. Gated off under a gateway transit and under the first-visit
// reveal, which owns the screen then.
import { getArcParameters, getMagnifierPosition, getParentSeat, standardBandCenterline, pointsToPath } from '../geometry/focus-ring-geometry.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const MAGNIFIER_RADIUS_RATIO = 0.060;   // the lens, as index.js draws it
const T = {
  arcDrawMs: 650,     // the band's line inking itself
  ringDrawMs: 220,    // each of the two rings
  thickenMs: 320,     // the line becoming the band at the handoff
};

export function overtureShouldPlay() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  try { if (new URLSearchParams(window.location.search).get('overture') === '0') return false; } catch { /* no address */ }
  return true;
}

/**
 * Begin the overture inside the app's own SVG. Returns { finish(), abort() }:
 * finish() hands off to the live wheel (the drawing completes at once if it
 * has not, then thickens into the band and leaves); abort() removes it now.
 */
export function beginBootOverture({ svg, viewport, ink = null }) {
  if (!svg || !viewport || typeof document === 'undefined') return { finish() {}, abort() {} };
  const cs = typeof getComputedStyle === 'function' ? getComputedStyle(document.documentElement) : null;
  const inkColour = ink || (cs && cs.getPropertyValue('--color-text').trim()) || '#111';
  const bandColour = (cs && cs.getPropertyValue('--color-band').trim()) || inkColour;

  const arc = getArcParameters(viewport);
  const bandWidth = arc.radius * 0.02;
  const lens = getMagnifierPosition(viewport);
  const magR = viewport.SSd * MAGNIFIER_RADIUS_RATIO;
  const seat = getParentSeat(viewport, magR);

  const g = document.createElementNS(SVG_NS, 'g');
  g.setAttribute('id', 'boot-overture');
  g.setAttribute('aria-hidden', 'true');
  g.style.pointerEvents = 'none';

  const line = document.createElementNS(SVG_NS, 'path');
  line.setAttribute('d', pointsToPath(standardBandCenterline(viewport)));
  line.setAttribute('fill', 'none');
  line.setAttribute('stroke', inkColour);
  line.setAttribute('stroke-width', '1.2');
  line.setAttribute('stroke-linecap', 'round');
  line.setAttribute('stroke-linejoin', 'round');
  g.appendChild(line);

  const ring = (cx, cy, r) => {
    const c = document.createElementNS(SVG_NS, 'circle');
    c.setAttribute('cx', cx); c.setAttribute('cy', cy); c.setAttribute('r', r);
    c.setAttribute('fill', 'none'); c.setAttribute('stroke', inkColour); c.setAttribute('stroke-width', '1.2');
    // A ring is drawn from its top, clockwise, by the same dash trick as the line.
    c.setAttribute('transform', `rotate(-90 ${cx} ${cy})`);
    g.appendChild(c);
    return c;
  };
  const lensRing = ring(lens.x, lens.y, magR);
  const parentRing = ring(seat.discX, seat.discY, magR);

  svg.classList.add('booting');
  svg.appendChild(g);

  // The dash trick: a dash as long as the path, offset by its own length, so
  // the offset running to zero inks the path from its start.
  const draw = (el, ms, delay) => {
    let len = 0;
    try { len = el.getTotalLength(); } catch { len = 0; }
    if (!len) { el.style.opacity = '1'; return; }
    el.style.strokeDasharray = `${len} ${len}`;
    el.style.strokeDashoffset = String(len);
    el.style.transition = 'none';
    void el.getBoundingClientRect();
    el.style.transition = `stroke-dashoffset ${ms}ms cubic-bezier(.3,0,.5,1) ${delay}ms`;
    el.style.strokeDashoffset = '0';
  };
  draw(line, T.arcDrawMs, 0);
  draw(lensRing, T.ringDrawMs, T.arcDrawMs);
  draw(parentRing, T.ringDrawMs, T.arcDrawMs + T.ringDrawMs);

  let done = false;
  const remove = () => { try { g.remove(); } catch { /* gone */ } svg.classList.remove('booting'); };
  return {
    finish() {
      if (done) return; done = true;
      // Complete the drawing at once if the instrument beat it.
      for (const el of [line, lensRing, parentRing]) { el.style.transition = 'none'; el.style.strokeDashoffset = '0'; }
      void g.getBoundingClientRect();
      // The line becomes the band; the rings are already the rings.
      line.style.transition = `stroke-width ${T.thickenMs}ms cubic-bezier(.3,0,.5,1), stroke ${T.thickenMs}ms linear`;
      line.setAttribute('stroke-width', bandWidth.toFixed(1));
      line.setAttribute('stroke', bandColour);
      setTimeout(() => {
        svg.classList.remove('booting');          // the wheel arrives within the lines
        requestAnimationFrame(() => requestAnimationFrame(remove));
      }, T.thickenMs);
    },
    abort() { if (done) return; done = true; remove(); }
  };
}
