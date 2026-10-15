// THE COMPASS ROSE (Howell 2026-10-15, having second thoughts about the dead
// zones: "what if I had a series of red arrows that indicate drill, and a
// series of blue arrows that indicate rotation?"). With ?compass=1 a rose
// appears under the finger the moment it lands: red wedges where a stroke
// drills in or out, blue where it turns the ring, grey where it is dead. As
// the stroke grows a needle shows its bearing from the press and the wedge
// it sits in lights, with the word that bearing means; when the engine
// decides — at its own deciding distance, from its own measurement — the
// verdict it reached is written beneath, so the picture is of the decision
// as made and not of a drawing of it.
//
// It paints from the same wedge table the engine decides with, listens to
// the pointer on its own (capture phase, primary pointer only), and is told
// the verdict by the engine's swipe note. Nothing about how a swipe is
// decided passes through here.

const NS = 'http://www.w3.org/2000/svg';
const RAD = Math.PI / 180;
const norm = d => ((d % 360) + 360) % 360;

export function compassRoseWanted() {
  try { return new URLSearchParams(window.location.search).get('compass') === '1'; } catch { return false; }
}

/** Every sector of the rose in bearing order: the wedges given, and a dead
 *  sector (kind null) filling each gap between them, so the sectors tile
 *  the full circle. */
export function roseSectors(wedges) {
  const live = [...wedges].map(([kind, from, to]) => [kind, norm(from), norm(to)]).sort((a, b) => a[1] - b[1]);
  const out = [];
  live.forEach(([kind, from, to], i) => {
    out.push({ kind, from, to });
    const next = live[(i + 1) % live.length];
    const gapTo = i + 1 < live.length ? next[1] : next[1] + 360;
    if (gapTo > to) out.push({ kind: null, from: to, to: gapTo });
  });
  return out;
}

const COLOUR = { out: '#e2493c', in: '#e2493c', cw: '#3c7ee2', ccw: '#3c7ee2', null: '#000' };
const WORD = { out: 'DRILL OUT', in: 'DRILL IN', cw: 'TURN CW', ccw: 'TURN CCW', null: 'DEAD' };

function sectorPath(from, to, r0, r1) {
  const p = (r, b) => `${(r * Math.sin(b * RAD)).toFixed(2)},${(-r * Math.cos(b * RAD)).toFixed(2)}`;
  const big = to - from > 180 ? 1 : 0;
  return `M${p(r0, from)} L${p(r1, from)} A${r1},${r1} 0 ${big} 1 ${p(r1, to)} L${p(r0, to)} A${r0},${r0} 0 ${big} 0 ${p(r0, from)} Z`;
}

export function mountCompassRose({ wedges, kindOf, bearingOf, decidePx = 8 }) {
  if (typeof document === 'undefined') return null;
  const R0 = 14, R1 = 96;
  const svg = document.createElementNS(NS, 'svg');
  svg.id = 'compass-rose';
  svg.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:2147483645;opacity:0;transition:opacity 180ms';
  const g = document.createElementNS(NS, 'g');
  svg.appendChild(g);
  const sectors = roseSectors(wedges).map(s => {
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', sectorPath(s.from, s.to, R0, R1));
    path.setAttribute('fill', COLOUR[s.kind]);
    path.setAttribute('fill-opacity', s.kind === null ? '0.22' : '0.3');
    path.setAttribute('stroke', '#fff');
    path.setAttribute('stroke-opacity', '0.6');
    g.appendChild(path);
    if (s.kind !== null) {
      const mid = (s.from + s.to) / 2, r = (R0 + R1) / 2 + 12;
      const t = document.createElementNS(NS, 'text');
      t.setAttribute('x', (r * Math.sin(mid * RAD)).toFixed(1));
      t.setAttribute('y', (-r * Math.cos(mid * RAD)).toFixed(1));
      t.setAttribute('text-anchor', 'middle');
      t.setAttribute('dominant-baseline', 'middle');
      t.setAttribute('style', 'font:bold 11px sans-serif;fill:#fff;paint-order:stroke;stroke:#000;stroke-width:2px;stroke-opacity:.5');
      t.textContent = s.kind.toUpperCase();
      g.appendChild(t);
    }
    return { ...s, path };
  });
  // The deciding distance: the engine reads the bearing when the finger has
  // travelled this far from the press, and never again.
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
  readout.setAttribute('y', String(-R1 - 14));
  readout.setAttribute('style', 'font:bold 15px sans-serif;fill:#fff;paint-order:stroke;stroke:#000;stroke-width:3px;stroke-opacity:.7');
  g.appendChild(readout);
  const verdict = document.createElementNS(NS, 'text');
  verdict.setAttribute('text-anchor', 'middle');
  verdict.setAttribute('y', String(-R1 - 34));
  verdict.setAttribute('style', 'font:bold 15px sans-serif;fill:#ffd84a;paint-order:stroke;stroke:#000;stroke-width:3px;stroke-opacity:.7');
  g.appendChild(verdict);
  const mount = () => document.body.appendChild(svg);
  if (document.body) mount(); else window.addEventListener('DOMContentLoaded', mount, { once: true });

  let press = null;
  let hideTimer = 0;
  const light = kind => sectors.forEach(s => s.path.setAttribute('fill-opacity', s.kind === kind ? (kind === null ? '0.55' : '0.75') : (s.kind === null ? '0.22' : '0.3')));
  const show = (x, y) => {
    clearTimeout(hideTimer);
    press = { x, y };
    // Keep the readouts on the glass when the press is near the top.
    const flip = y < R1 + 50;
    g.setAttribute('transform', `translate(${x},${y})`);
    readout.setAttribute('y', String(flip ? R1 + 24 : -R1 - 14));
    verdict.setAttribute('y', String(flip ? R1 + 44 : -R1 - 34));
    readout.textContent = '';
    verdict.textContent = '';
    needle.setAttribute('x2', '0'); needle.setAttribute('y2', '0');
    light(undefined);
    svg.style.opacity = '1';
  };
  const move = (x, y) => {
    if (!press) return;
    const dx = x - press.x, dy = y - press.y;
    const len = Math.hypot(dx, dy);
    if (len < 1) return;
    const b = bearingOf(dx, dy);
    const kind = kindOf(b);
    const l = Math.min(len, R1 + 6);
    needle.setAttribute('x2', (l * Math.sin(b * RAD)).toFixed(1));
    needle.setAttribute('y2', (-l * Math.cos(b * RAD)).toFixed(1));
    light(kind);
    readout.textContent = `${Math.round(b)}°  ${WORD[kind === null ? 'null' : kind]}${len < decidePx ? '  (not yet)' : ''}`;
  };
  const up = () => {
    if (!press) return;
    press = null;
    hideTimer = setTimeout(() => { svg.style.opacity = '0'; }, 900);
  };
  const decided = (bearing, kind, note = '') => {
    verdict.textContent = `ENGINE: ${WORD[kind === null ? 'null' : kind]} at ${Math.round(bearing)}°${note ? ' ·' + note : ''}`;
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
