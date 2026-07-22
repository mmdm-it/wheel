// The dimension button's wireframe globe — drawn by code, turned honestly.
//
// Replaces the static PNG (which could neither spin on command nor sit
// cleanly on every volume's ground). An orthographic side-view globe: the
// PARALLELS are latitude circles and never move under axial rotation — only
// the MERIDIANS travel. Each meridian is a full ellipse (front and back
// drawn, the X-ray wireframe look of the old art) whose half-width follows
// R·|sin(longitude + phase)|; driving the phase slides the meridians across
// the face and around the back — a real axial turn, not a twirled disc.
// The whole globe wears a fixed tilt for the jaunty desk-globe stance.
//
// spin() is rAF-driven so it starts on the exact frame of the tap and shares
// the strata tween's duration — the globe settles precisely as the receding
// stratum does (Howell 2026-07-22). Filter-free, dependency-free, vector.

const SVGNS = 'http://www.w3.org/2000/svg';

const R = 44;               // globe radius in viewBox units (viewBox is ±50)
const TILT_DEG = -18;       // the desk-globe stance
const MERIDIAN_COUNT = 4;   // longitudes, evenly spaced over a half-turn
const PARALLEL_LATS = [-52, 0, 52];        // degrees; equator and two tropics
const PARALLEL_SQUASH = 0.22;              // stylised tip of the parallels
const STROKE = 1;                          // ONE PIXEL — vector-effect keeps it
                                           // a true screen pixel at any button
                                           // size (Howell 2026-07-22)
const MIN_RX = 0.4;                        // an edge-on meridian keeps a hairline
const SPIN_MS = 600;                       // default — the strata tween's clock
const SPIN_TURN = Math.PI / 2;             // a quarter axial turn per event: at
                                           // 4 meridians a half-turn maps every
                                           // meridian onto a neighbour and the
                                           // spin reads as nothing; a quarter
                                           // is unmistakably a rotation
const easeInOut = t => (t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2);

const el = (tag, attrs) => {
  const n = document.createElementNS(SVGNS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  return n;
};

// Draw the globe into the button (replacing whatever art is there) and hand
// back its spin. Meridian phases persist across spins, so successive presses
// keep turning the same globe the same way instead of rewinding it.
export function mountDimensionGlobe(button) {
  if (!button || typeof document === 'undefined') return null;

  const svg = el('svg', { viewBox: '-50 -50 100 100', 'aria-hidden': 'true', focusable: 'false' });
  const g = el('g', { transform: `rotate(${TILT_DEG})` });
  svg.appendChild(g);

  const line = attrs => {
    const e = el('ellipse', {
      cx: '0', cy: '0', fill: 'none', stroke: 'currentColor',
      'stroke-width': String(STROKE), 'vector-effect': 'non-scaling-stroke', ...attrs
    });
    g.appendChild(e);
    return e;
  };

  // The sphere's limb, then the still parallels, then the travelling meridians.
  line({ rx: String(R), ry: String(R) });
  for (const lat of PARALLEL_LATS) {
    const a = (lat * Math.PI) / 180;
    const rx = R * Math.cos(a);
    line({ cy: String((-R * Math.sin(a)).toFixed(2)), rx: rx.toFixed(2), ry: (rx * PARALLEL_SQUASH).toFixed(2) });
  }
  const meridians = [];
  for (let i = 0; i < MERIDIAN_COUNT; i += 1) {
    meridians.push({ phase: (i * Math.PI) / MERIDIAN_COUNT, node: line({ rx: '0', ry: String(R) }) });
  }
  const setPhase = offset => {
    for (const m of meridians) {
      const rx = Math.max(MIN_RX, R * Math.abs(Math.sin(m.phase + offset)));
      m.node.setAttribute('rx', rx.toFixed(2));
    }
  };

  while (button.firstChild) button.removeChild(button.firstChild);
  button.appendChild(svg);

  // Accumulated axial angle — spins continue, never rewind. Starts a half-slot
  // in, so no meridian rests edge-on (a bare line) or on the limb (invisible):
  // a balanced wireframe at rest, and every quarter-turn lands on it again.
  let spun = Math.PI / (2 * MERIDIAN_COUNT);
  setPhase(spun);
  let rafId = null;
  const reducedMotion = typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return {
    // One eased turn of the axis, synced to the caller's clock (the strata
    // tween). A press mid-spin restarts the turn from wherever the globe is.
    spin(durationMs = SPIN_MS, turn = SPIN_TURN) {
      if (reducedMotion) { spun += turn; setPhase(spun); return; }
      if (rafId) cancelAnimationFrame(rafId);
      const from = spun;
      spun += turn;
      let start = 0;
      const step = now => {
        if (!start) start = now;
        const t = Math.min(1, (now - start) / durationMs);
        setPhase(from + turn * easeInOut(t));
        if (t < 1) { rafId = requestAnimationFrame(step); } else { rafId = null; }
      };
      rafId = requestAnimationFrame(step);
    }
  };
}
