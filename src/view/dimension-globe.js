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

// A STATIC globe glyph drawn into an existing SVG container — the countries
// ring's parent seat wears this (the world: tap it and everything returns —
// Howell 2026-07-23). Same construction as the button globe, at rest pose,
// plus an invisible hit disc so thin strokes don't make a thin target.
export function appendGlobeGlyph(container, cx, cy, r) {
  if (!container || typeof document === 'undefined') return null;
  // Outer group = position only (safe for a caller to retranslate on reuse);
  // inner group carries the fixed tilt.
  const outer = el('g', { class: 'world-glyph', transform: `translate(${cx} ${cy})` });
  const g = el('g', { transform: `rotate(${TILT_DEG})` });
  outer.appendChild(g);
  const line = attrs => g.appendChild(el('ellipse', {
    cx: '0', cy: '0', fill: 'none', stroke: 'currentColor',
    'stroke-width': '1', 'vector-effect': 'non-scaling-stroke', ...attrs
  }));
  g.appendChild(el('circle', {
    cx: '0', cy: '0', r: String(r * 1.25), fill: 'transparent', stroke: 'none'
  })); // the hit disc
  line({ rx: String(r), ry: String(r) });
  for (const lat of PARALLEL_LATS) {
    const a = (lat * Math.PI) / 180;
    const prx = r * Math.cos(a);
    line({ cy: String((-r * Math.sin(a)).toFixed(2)), rx: prx.toFixed(2), ry: (prx * PARALLEL_SQUASH).toFixed(2) });
  }
  const rest = Math.PI / (2 * MERIDIAN_COUNT); // the balanced pose
  for (let i = 0; i < MERIDIAN_COUNT; i += 1) {
    const rx = Math.max(MIN_RX, r * Math.abs(Math.sin((i * Math.PI) / MERIDIAN_COUNT + rest)));
    line({ rx: rx.toFixed(2), ry: String(r) });
  }
  container.appendChild(outer);
  return outer;
}

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

// THE VOLUME'S OWN EMBLEM AS THE BUTTON (O-244, Howell 2026-10-30: "the
// dimension button should be the logo … just the artwork itself with no
// stroke and no fill circle, but it should be rotated to align with the
// other child pyramid elements, angled toward the hub"). The artwork alone
// in the globe's seat; the caller tells it the ray it lies on (orient), as
// the host tells every label in the sky. It has no spin — a logo does not
// turn — so the globe's entrance and press cues are quietly nothing here.
const EMBLEM_SCALE = 1.5;   // the art's long side, in button widths
const EMBLEM_SHIFT = 14;    // viewBox units down the ray, away from the hub
export function mountDimensionEmblem(button, url, aspect = null) {
  if (!button || typeof document === 'undefined' || !url) return null;
  const svg = el('svg', { viewBox: '-50 -50 100 100', 'aria-hidden': 'true', focusable: 'false', overflow: 'visible' });
  const g = el('g', { transform: 'rotate(0)' });
  svg.appendChild(g);
  const image = el('image', { href: url, preserveAspectRatio: 'xMidYMid meet' });
  g.appendChild(image);
  const fit = ratio => {
    // The long side is HALF AGAIN the button's box (Howell 2026-10-30,
    // "make it 50% larger"): the artwork spills past the hit disc on
    // purpose, the button's box being the thumb's target rather than the
    // art's frame. The short side follows the art's own proportions, so
    // the artwork is never squeezed into a square.
    const r = Number.isFinite(ratio) && ratio > 0 ? ratio : 2.5;
    const w = 100 * EMBLEM_SCALE, h = r >= 1 ? w / r : w;
    const ww = r >= 1 ? w : w * r;
    image.setAttribute('x', String(-ww / 2)); image.setAttribute('y', String(-h / 2));
    image.setAttribute('width', String(ww)); image.setAttribute('height', String(h));
  };
  fit(aspect);
  if (!Number.isFinite(aspect) && typeof Image === 'function') {
    try {
      const probe = new Image();
      probe.onload = () => { if (probe.naturalHeight > 0) fit(probe.naturalWidth / probe.naturalHeight); };
      probe.src = url;
    } catch (_) { /* a stub DOM */ }
  }
  while (button.firstChild) button.removeChild(button.firstChild);
  button.appendChild(svg);
  return {
    spin() { /* a logo does not turn */ },
    // The ray the artwork lies on, in degrees — the sky's own convention
    // (labelRotationDeg of the ray angle from the hub).
    // Turned onto the ray, then slid a little AWAY from the hub along it
    // (the group's +x points at the hub once turned), so the far end of a
    // larger artwork stays on the glass at the narrowest phone.
    orient(deg) { if (Number.isFinite(deg)) g.setAttribute('transform', `rotate(${deg.toFixed(2)}) translate(${-EMBLEM_SHIFT} 0)`); }
  };
}
