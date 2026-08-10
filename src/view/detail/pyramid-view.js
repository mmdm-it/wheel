// Pure helper to convert pyramid placements into renderable instructions.
// Keeps view consumption data-agnostic: placements -> drawable circles/labels.

import { applyPyramidNodeAppearance, labelRotationDeg } from '../node-appearance.js';

export function buildPyramidInstructions(placements = [], options = {}) {
  if (!Array.isArray(placements)) {
    throw new Error('buildPyramidInstructions: placements must be an array');
  }
  const nodeRadius = options.nodeRadius ?? 12;

  return placements.map((placement, idx) => {
    const item = placement?.item ?? {};
    const id = item.id ?? `p-${idx}`;
    const label = item.name ?? item.label ?? id;
    return {
      id,
      label,
      item,
      arc: placement?.arc ?? 'pyramid',
      angle: placement?.angle ?? 0,
      x: placement?.x ?? 0,
      y: placement?.y ?? 0,
      r: nodeRadius
    };
  });
}

// Responsible for rendering pyramid visuals (fan lines, spiral, intersections, optional nodes).
export class PyramidView {
  constructor(parentGroup, doc = typeof document !== 'undefined' ? document : null) {
    this.doc = doc;
    this.parentGroup = parentGroup;
    this.pyramidGroup = null;
    this.pyramidFanLinesGroup = null;
    this.pyramidSpiralGroup = null;
    this.pyramidNodesGroup = null;
    this.pyramidLabelsGroup = null;
    this._onNodeClick = null;     // current click callback
  }

  init(parentGroup) {
    if (parentGroup) this.parentGroup = parentGroup;
    if (!this.parentGroup || !this.doc) return;

    this.pyramidGroup = this.doc.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.pyramidGroup.setAttribute('class', 'child-pyramid');

    this.pyramidFanLinesGroup = this.doc.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.pyramidFanLinesGroup.setAttribute('class', 'child-pyramid-fan-lines');

    this.pyramidSpiralGroup = this.doc.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.pyramidSpiralGroup.setAttribute('class', 'child-pyramid-spiral-group');

    this.pyramidHaloGroup = this.doc.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.pyramidHaloGroup.setAttribute('class', 'child-pyramid-halos');

    this.pyramidNodesGroup = this.doc.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.pyramidNodesGroup.setAttribute('class', 'child-pyramid-nodes');

    this.pyramidLabelsGroup = this.doc.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.pyramidLabelsGroup.setAttribute('class', 'child-pyramid-labels');

    this.pyramidGroup.appendChild(this.pyramidFanLinesGroup);
    this.pyramidGroup.appendChild(this.pyramidSpiralGroup);
    this.pyramidGroup.appendChild(this.pyramidHaloGroup); // halo under the circles
    this.pyramidGroup.appendChild(this.pyramidNodesGroup);
    this.pyramidGroup.appendChild(this.pyramidLabelsGroup);

    this.parentGroup.appendChild(this.pyramidGroup);
  }

  #clear(group) {
    if (!group) return;
    while (group.firstChild) group.removeChild(group.firstChild);
  }

  render(data) {
    if (!this.pyramidGroup || !this.doc) return;

    // Q10 (0c): THE CALLBACK REFRESHES EVEN WHEN THE DOM DOES NOT.
    // This assignment sits above the signature short-circuit on purpose. The
    // handler is a closure over the caller's current state, so a render that
    // changes nothing visible can still carry a NEW callback — and skipping it
    // would leave taps acting on the state of some earlier frame. Cheap
    // assignment, and the one thing the skip must never swallow.
    this._onNodeClick = data?.onNodeClick ?? null;

    if (!data) {
      this.pyramidGroup.setAttribute('display', 'none');
      this.#clear(this.pyramidFanLinesGroup);
      this.#clear(this.pyramidSpiralGroup);
      this.#clear(this.pyramidHaloGroup);
      this.#clear(this.pyramidNodesGroup);
      this.#clear(this.pyramidLabelsGroup);
      this._signature = null;   // next real render must rebuild
      return;
    }

    const { fanLines = [], spiral, intersections = [], nodes = [] } = data;

    // Q10: nothing visible changed → leave the subtree entirely alone.
    // Every render used to clear five groups and recreate every node and
    // label, which during a scrub is roughly 110 SVG create/destroy operations
    // per frame — the dominant per-frame cost, paid most often while the ring
    // is turning and the pyramid is showing the same children it showed a
    // frame ago. The geometry was already memoized; the DOM was not.
    //
    // Same shape as renderStratum's skip in secondary-strata-view.js, and for
    // a second reason beyond speed: iOS Safari does not reliably apply a CSS
    // filter to freshly-inserted SVG content, and the pyramid IS blurred
    // during rotation. A subtree that persists keeps its filter.
    const signature = JSON.stringify([nodes, spiral, intersections, fanLines]);
    if (this._signature === signature) return;
    this._signature = signature;

    this.pyramidGroup.removeAttribute('display');
    this.#clear(this.pyramidFanLinesGroup);
    this.#clear(this.pyramidSpiralGroup);
    this.#clear(this.pyramidHaloGroup);
    this.#clear(this.pyramidNodesGroup);
    this.#clear(this.pyramidLabelsGroup);

    // THE FAN LINES ARE GONE (Howell 2026-07-25, permanent — the Tufte
    // erasure): convicted by their own absence. The program already hid
    // them during every rotation as too busy, and months of daily use never
    // missed them — "if it's too busy for the dance, how is it not too busy
    // when the dancers take a seat?" Parentage is carried by proximity, the
    // sky's embrace of the lens, and the migration choreography itself.
    // The fan GEOMETRY survives in child-pyramid.js as the seating lattice
    // (stars sit at fan×spiral intersections): construction lines, never
    // inked.

    // Render child nodes at intersection/placement positions.
    this.#clear(this.pyramidNodesGroup);
    this.#clear(this.pyramidLabelsGroup);

    // (the callback was already refreshed above the signature skip, so that a
    // visually identical frame still gets the caller's current closure)

    if (Array.isArray(nodes) && nodes.length > 0) {
      this.pyramidNodesGroup.removeAttribute('display');
      this.pyramidLabelsGroup.removeAttribute('display');
      nodes.forEach((instr, idx) => {
        const circle = this.doc.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('class', 'child-pyramid-node');
        circle.setAttribute('cx', instr.x);
        circle.setAttribute('cy', instr.y);
        circle.setAttribute('r', instr.r);
        circle.setAttribute('role', 'button');
        circle.setAttribute('tabindex', '0');
        circle.setAttribute('data-index', idx);
        if (instr.label) circle.setAttribute('aria-label', instr.label);
        if (this._onNodeClick) {
          circle.style.cursor = 'pointer';
        }
        this.pyramidNodesGroup.appendChild(circle);

        const label = this.doc.createElementNS('http://www.w3.org/2000/svg', 'text');
        label.setAttribute('class', 'child-pyramid-label');
        // The label is tappable exactly like its circle (the host's pointer
        // delegation reads data-index from whichever the finger lands on).
        label.setAttribute('data-index', idx);
        label.setAttribute('x', instr.x);
        label.setAttribute('y', instr.y);
        label.setAttribute('text-anchor', 'middle');
        label.setAttribute('dominant-baseline', 'middle');
        // Rotate label along the fan-line angle, matching focus ring node label style
        const rotation = labelRotationDeg(instr.angle);
        label.setAttribute('transform', `rotate(${rotation}, ${instr.x}, ${instr.y})`);
        // Every pyramid label wears its computed ABSOLUTE px (resolution-
        // aware base × damped star scale) — CSS clamp is only the fallback
        // for callers that don't compute one. At the taper floor the label
        // is an honest smudge.
        // Dim, today's colors, and the absolute label px all come from the
        // shared dresser, so the migration clones wear exactly the same face.
        applyPyramidNodeAppearance({ circle, label, instr });
        label.textContent = instr.label || '';
        // The cartographer's halo retired WITH the fan lines (Howell
        // 2026-07-25): its only job was carving a readable channel through
        // fan-line bundles for the Favorites' long names. No fans, no
        // channel needed.
        this.pyramidLabelsGroup.appendChild(label);
      });
    } else {
      this.pyramidNodesGroup.setAttribute('display', 'none');
      this.pyramidLabelsGroup.setAttribute('display', 'none');
    }
  }
}
