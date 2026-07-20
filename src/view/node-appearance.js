// ONE place that knows what a node LOOKS like — in the pyramid, in the
// focus ring, and on every clone that stands in for one mid-flight.
//
// Every node is drawn twice in its life: once by the live pyramid, and
// again as the migration clone that stands in for it while it travels.
// Anything only the live renderer knows about POPS ON at the end of the
// transit, the moment the real pyramid unhides — the label font size
// learned this the hard way, and today's colors learned it again. So the
// appearance lives here and both callers ask, which is also what keeps
// the next appearance property from having to learn it a third time.
//
// Pure view helper: elements in, styling applied; no layout, no DOM
// creation, no knowledge of which volume is on screen.

// THE PRESENT MOMENT'S SEAT (Howell 2026-07-19, widened 2026-07-20): a
// dark red node under a yellow label. A node is marked `now` when the
// present moment falls INSIDE it — the day cell for today, the month
// node for the month we are living through — so the reader can always
// find where they are standing, at whatever depth they are reading.
//
// Held in JS rather than a stylesheet precisely because both render
// paths must agree: a class would still have to be stamped in both
// paths anyway, and inline styling cannot lose a race with an async
// theme stylesheet.
export const NOW_NODE_FILL = '#7a1010';
export const NOW_LABEL_FILL = '#ffd700';

/**
 * The rotation a node's label wears, in degrees, from the node's angle.
 * Labels lie along their own ray — the same tilt the ring labels have —
 * and they wear it for the WHOLE of a migration, not just at the end:
 * a label that travels flat and snaps upright at settle is a pop, and
 * the instrument does not pop (Howell 2026-07-20).
 */
export function labelRotationDeg(angle = 0) {
  return (angle * 180) / Math.PI + 180;
}

// Ribbon neighbors: present, but plainly not the month you are reading.
const DIM_OPACITY = '0.35';

/**
 * Dress a node's circle and label to match its layout instruction.
 * Either element may be absent (the clone builders hand over both; a
 * caller drawing only one passes only one).
 *
 * @param {Object}      opts
 * @param {SVGElement}  [opts.circle] — the node circle
 * @param {SVGElement}  [opts.label]  — the node's text element
 * @param {Object}      [opts.instr]  — the layout instruction for this node
 */
export function applyPyramidNodeAppearance({ circle = null, label = null, instr = null } = {}) {
  if (!instr) return;

  // Absolute px: SVG font-size in em rebases on the inherited size, which
  // shrank whole pyramids and popped every migration clone.
  if (label && instr.labelFontPx) label.style.fontSize = `${instr.labelFontPx}px`;

  if (instr.dim) {
    if (circle) circle.setAttribute('opacity', DIM_OPACITY);
    if (label) label.setAttribute('opacity', DIM_OPACITY);
  }

  if (instr.now) {
    if (circle) circle.style.fill = NOW_NODE_FILL;
    if (label) label.style.fill = NOW_LABEL_FILL;
  }
}
