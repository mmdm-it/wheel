// THE COMPASS ROSE (Howell 2026-10-15, having second thoughts about the dead
// zones: "what if I had a series of red arrows that indicate drill, and a
// series of blue arrows that indicate rotation?"). With ?compass=1 a rose
// appears under the finger the moment it lands, painted from the local
// compass at that point (O-200): four quarters — red where a stroke drills
// out or in along the radial line, blue where it turns the ring along the
// tangent — turned to the axes at the point of impact, so the rose leans
// with the ring. As the stroke grows a needle shows its travel from the
// press and the quarter it sits in lights, with the word that means. When
// the engine decides — at its own deciding distance, from its own
// measurement — the verdict is written beneath and the rose shows its
// SECOND FACE: the losing axis's two quarters go grey and the needle snaps
// to the winning axis, its length the travel that counts, so what is being
// thrown away is visible.
//
// It paints from the same axes the engine decides with, listens to the
// pointer on its own (capture phase, primary pointer only), and is told the
// verdict by the engine's swipe note. Nothing about how a swipe is decided
// passes through here.

import { bearingOfUnit, axisOf } from '../core/stroke.js';

const NS = 'http://www.w3.org/2000/svg';
const RAD = Math.PI / 180;
const norm = d => ((d % 360) + 360) % 360;

export function compassRoseWanted() {
  try { return new URLSearchParams(window.location.search).get('compass') === '1'; } catch { return false; }
}

/** The four quarters of the rose for a set of axes, each centred on its
 *  direction and 90° wide, in bearing order from the clockwise tangent. */
export function roseQuarters(axes) {
  return ['cw', 'out', 'ccw', 'in'].map(kind => {
    const mid = bearingOfUnit(axisOf(kind, axes));
    return { kind, mid, from: norm(mid - 45), to: norm(mid + 45) };
  });
}

const COLOUR = { out: '#e2493c', in: '#e2493c', cw: '#3c7ee2', ccw: '#3c7ee2' };
const WORD = { out: 'DRILL OUT', in: 'DRILL IN', cw: 'TURN CW', ccw: 'TURN CCW' };
const isTurn = k => k === 'cw' || k === 'ccw';

function sectorPath(from, to, r0, r1) {
  const p = (r, b) => `${(r * Math.sin(b * RAD)).toFixed(2)},${(-r * Math.cos(b * RAD)).toFixed(2)}`;
  return `M${p(r0, from)} L${p(r1, from)} A${r1},${r1} 0 0 1 ${p(r1, to)} L${p(r0, to)} A${r0},${r0} 0 0 0 ${p(r0, from)} Z`;
}

export function mountCompassRose({ axesAt, kindOf, decidePx = 8 }) {
  if (typeof document === 'undefined') return null;
  const R0 = 14, R1 = 96;
  const svg = document.createElementNS(NS, 'svg');
  svg.id = 'compass-rose';
  svg.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:2147483645;opacity:0;transition:opacity 180ms';
  const g = document.createElementNS(NS, 'g');
  svg.appendChild(g);
  const quarters = ['cw', 'out', 'ccw', 'in'].map(kind => {
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('fill', COLOUR[kind]);
    path.setAttribute('stroke', '#fff');
    path.setAttribute('stroke-opacity', '0.6');
    g.appendChild(path);
    const t = document.createElementNS(NS, 'text');
    t.setAttribute('text-anchor', 'middle');
    t.setAttribute('dominant-baseline', 'middle');
    t.setAttribute('style', 'font:bold 11px sans-serif;fill:#fff;paint-order:stroke;stroke:#000;stroke-width:2px;stroke-opacity:.5');
    t.textContent = kind.toUpperCase();
    g.appendChild(t);
    return { kind, path, text: t };
  });
  // The deciding distance: the engine reads the travel when the finger has
  // gone this far from the press, and never again.
  const decide = document.createElementNS(NS, 'circle');
  decide.setAttribute('r', decidePx);
  decide.setAttribute('fill', 'none');
  decide.setAttribute('stroke', '#fff');
  decide.setAttribute('stroke-dasharray', '2 2');
  g.appendChild(decide);
  const needle = document.createElementNS(NS, 'line');
  needle.setAttribute('stroke', '#fff');
  needle.setAttribute('stroke-width', '3');
  needle.setAttribute('stroke-linecap', 'round');
  needle.setAttribute('style', 'filter:drop-shadow(0 0 2px #000)');
  g.appendChild(needle);
  const readout = document.createElementNS(NS, 'text');
  readout.setAttribute('text-anchor', 'middle');
  readout.setAttribute('style', 'font:bold 15px sans-serif;fill:#fff;paint-order:stroke;stroke:#000;stroke-width:3px;stroke-opacity:.7');
  g.appendChild(readout);
  const verdict = document.createElementNS(NS, 'text');
  verdict.setAttribute('text-anchor', 'middle');
  verdict.setAttribute('style', 'font:bold 15px sans-serif;fill:#ffd84a;paint-order:stroke;stroke:#000;stroke-width:3px;stroke-opacity:.7');
  g.appendChild(verdict);
  const mount = () => document.body.appendChild(svg);
  if (document.body) mount(); else window.addEventListener('DOMContentLoaded', mount, { once: true });

  let press = null;     // { x, y, axes, decided: kind | null }
  let hideTimer = 0;
  const paintQuarters = () => {
    for (const q of roseQuarters(press.axes)) {
      const el = quarters.find(x => x.kind === q.kind);
      el.path.setAttribute('d', sectorPath(q.from, q.to, R0, R1));
      const r = (R0 + R1) / 2 + 12;
      el.text.setAttribute('x', (r * Math.sin(q.mid * RAD)).toFixed(1));
      el.text.setAttribute('y', (-r * Math.cos(q.mid * RAD)).toFixed(1));
    }
  };
  // Which quarters are lit: before the decision the one under the needle;
  // after it the winning axis's pair, the losing pair grey.
  const light = live => {
    const d = press?.decided;
    for (const q of quarters) {
      const dead = d && isTurn(q.kind) !== isTurn(d);
      q.path.setAttribute('fill', dead ? '#000' : COLOUR[q.kind]);
      q.path.setAttribute('fill-opacity', dead ? '0.22' : q.kind === live ? '0.75' : '0.3');
    }
  };
  const show = (x, y) => {
    clearTimeout(hideTimer);
    press = { x, y, axes: axesAt(x, y), decided: null };
    // Keep the readouts on the glass when the press is near the top.
    const flip = y < R1 + 50;
    g.setAttribute('transform', `translate(${x},${y})`);
    readout.setAttribute('y', String(flip ? R1 + 24 : -R1 - 14));
    verdict.setAttribute('y', String(flip ? R1 + 44 : -R1 - 34));
    readout.textContent = '';
    verdict.textContent = '';
    needle.setAttribute('x2', '0'); needle.setAttribute('y2', '0');
    paintQuarters();
    light(null);
    svg.style.opacity = '1';
  };
  const move = (x, y) => {
    if (!press) return;
    const dx = x - press.x, dy = y - press.y;
    const len = Math.hypot(dx, dy);
    if (len < 1) return;
    if (press.decided) {
      // The second face: only the travel along the decided axis counts.
      const axis = axisOf(press.decided, press.axes);
      const along = dx * axis.ux + dy * axis.uy;
      const l = Math.max(-R1 - 6, Math.min(R1 + 6, along));
      needle.setAttribute('x2', (l * axis.ux).toFixed(1));
      needle.setAttribute('y2', (l * axis.uy).toFixed(1));
      const thrown = Math.round(Math.sqrt(Math.max(0, len * len - along * along)));
      readout.textContent = `${Math.round(along)} px along, ${thrown} px thrown away`;
      light(press.decided);
      return;
    }
    const kind = kindOf(dx, dy, press.axes);
    const l = Math.min(len, R1 + 6);
    needle.setAttribute('x2', (l * dx / len).toFixed(1));
    needle.setAttribute('y2', (l * dy / len).toFixed(1));
    light(kind);
    const b = norm(Math.atan2(dx, -dy) / RAD);
    readout.textContent = `${Math.round(b)}°  ${WORD[kind]}${len < decidePx ? '  (not yet)' : ''}`;
  };
  const up = () => {
    if (!press) return;
    press = null;
    hideTimer = setTimeout(() => { svg.style.opacity = '0'; }, 900);
  };
  const decided = (bearing, kind, note = '') => {
    if (press && WORD[kind]) { press.decided = kind; light(kind); }
    verdict.textContent = `ENGINE: ${WORD[kind] || kind} at ${Math.round(bearing)}°${note ? ' ·' + note : ''}`;
  };
  const strokeless = () => { verdict.textContent = 'ENGINE: turn, no compass'; };

  const primary = e => e.isPrimary !== false;
  window.addEventListener('pointerdown', e => { if (primary(e)) show(e.clientX, e.clientY); }, true);
  window.addEventListener('pointermove', e => { if (primary(e)) move(e.clientX, e.clientY); }, true);
  ['pointerup', 'pointercancel'].forEach(t => window.addEventListener(t, e => { if (primary(e)) up(); }, true));

  const api = { show, move, up, decided, strokeless };
  window.__compassRose = api;
  return api;
}
