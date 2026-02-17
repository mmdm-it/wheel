/**
 * Migration Animation Module
 * Handles IN/OUT migration animations for Child Pyramid ↔ Focus Ring transitions.
 *
 * IN  (Child Pyramid → Focus Ring):
 *   1. animateIn — clone child-pyramid nodes, animate to focus-ring positions (600 ms)
 *   2. animateRingOutward — clone existing focus-ring nodes, animate radially outward
 *      from hub until off-screen (900 ms ease-in-out, simultaneous with animateIn)
 *   3. animatePyramidFromHub — clone new child-pyramid nodes from hub to pyramid (600 ms)
 *   All three run simultaneously.
 *
 * OUT (Focus Ring → Child Pyramid):
 *   1. animateOut — pop saved clones from LIFO stack, reverse-animate to pyramid (600 ms)
 *   2. animateRingInward — parent focus-ring nodes fly in from off-screen along
 *      radial rays to ring positions (600 ms ease-out, simultaneous with animateOut)
 *   3. animatePyramidToHub — animate child-pyramid nodes to hub (600 ms)
 *   All three run simultaneously.
 *
 * Modelled after wheel-v0/mobile/mobile-animation.js.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';
const ANIM_DURATION = 600; // ms — matches v0
const ANIM_DELAY   = 10;  // ms — force reflow gap
const RING_RADIAL_DURATION = 900; // ms — ring outward/inward (intentionally leisurely)

/**
 * LIFO stack of animation layers.
 * Each entry: { nodes: [ { clone, translateX, translateY, rotDelta } ], level }
 */
const animatedNodesStack = [];

/** True while any migration animation is in flight. */
let _animating = false;

/* ------------------------------------------------------------------ */
/*  Public API                                                        */
/* ------------------------------------------------------------------ */

/**
 * @returns {boolean} Whether a migration animation is currently running.
 */
export function isAnimating() {
  return _animating;
}

/**
 * IN animation — animate child pyramid nodes to their focus-ring destinations.
 *
 * @param {Object}   opts
 * @param {SVGElement} opts.svgRoot       — root <svg> or the blurGroup to append clones into
 * @param {Object[]}   opts.pyramidNodes  — current pyramidData.nodes (with x, y, r, angle, label, item)
 * @param {Object[]}   opts.ringTargets   — calculated focus-ring node positions for the new items
 *                                          (same shape as calculateNodePositions output:
 *                                           { item, index, angle, x, y, radius })
 * @param {number}      opts.magnifierAngle — magnifier angle (radians) so we can size the clicked node
 * @param {string|null} opts.clickedId     — id of the clicked pyramid node (will get magnifier radius)
 * @param {number}      opts.nodeRadius    — default focus-ring node radius
 * @param {Function}    opts.onComplete    — called after animation finishes
 */
export function animateIn(opts) {
  const {
    svgRoot,
    pyramidNodes = [],
    ringTargets  = [],
    magnifierAngle,
    clickedId,
    nodeRadius = 10,
    onComplete
  } = opts;

  if (!svgRoot || pyramidNodes.length === 0 || ringTargets.length === 0) {
    if (onComplete) onComplete();
    return;
  }

  _animating = true;

  // Build a lookup from item id → ring target position
  const targetById = new Map();
  ringTargets.forEach(t => {
    if (t.item?.id) targetById.set(t.item.id, t);
  });

  // Create an overlay <g> that sits on top of everything
  const overlay = document.createElementNS(SVG_NS, 'g');
  overlay.setAttribute('class', 'migration-animation-overlay');
  svgRoot.appendChild(overlay);

  const animEntries = [];

  pyramidNodes.forEach(pn => {
    const id = pn.item?.id ?? pn.id;
    const target = targetById.get(id);
    if (!target) return; // this sibling scrolled off-screen — skip

    // -- Clone: circle + label group --
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('class', 'migration-node');

    const circle = document.createElementNS(SVG_NS, 'circle');
    circle.setAttribute('cx', pn.x);
    circle.setAttribute('cy', pn.y);
    circle.setAttribute('r', pn.r);
    circle.setAttribute('class', 'child-pyramid-node');
    g.appendChild(circle);

    const label = document.createElementNS(SVG_NS, 'text');
    label.setAttribute('x', pn.x);
    label.setAttribute('y', pn.y);
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('dominant-baseline', 'middle');
    label.setAttribute('class', 'child-pyramid-label');
    const srcRot = (pn.angle * 180) / Math.PI + 180;
    label.setAttribute('transform', `rotate(${srcRot}, ${pn.x}, ${pn.y})`);
    label.textContent = pn.label ?? pn.item?.name ?? '';
    g.appendChild(label);

    overlay.appendChild(g);

    // -- Compute translation & rotation delta --
    const translateX = target.x - pn.x;
    const translateY = target.y - pn.y;
    const dstRot = (target.angle * 180) / Math.PI + 180;
    let rotDelta = dstRot - srcRot;
    while (rotDelta > 180) rotDelta -= 360;
    while (rotDelta < -180) rotDelta += 360;

    // Target radius — magnifier node is larger in v0 but in v3 all focus nodes
    // share the same radius, so we just use nodeRadius.
    const endRadius = nodeRadius;

    // Set initial transform (identity)
    g.style.transformOrigin = `${pn.x}px ${pn.y}px`;
    g.style.transform = 'translate(0px, 0px) rotate(0deg)';

    animEntries.push({
      g,
      circle,
      label,
      translateX,
      translateY,
      rotDelta,
      startRadius: pn.r,
      endRadius,
      // Original pyramid position (needed for OUT reversal)
      srcX: pn.x,
      srcY: pn.y,
      srcAngle: pn.angle,
      srcRot,
      dstRot,
      itemId: id,
      itemLabel: pn.label ?? pn.item?.name ?? ''
    });
  });

  if (animEntries.length === 0) {
    overlay.remove();
    _animating = false;
    if (onComplete) onComplete();
    return;
  }

  // Force reflow so the browser registers the initial transform
  overlay.getBoundingClientRect();

  // Push to LIFO stack for OUT reversal
  animatedNodesStack.push({ nodes: animEntries, overlay });

  // Kick off the animation after a micro-delay
  setTimeout(() => {
    animEntries.forEach(a => {
      a.g.style.transition = `transform ${ANIM_DURATION}ms ease-in-out`;
      a.g.style.transform = `translate(${a.translateX}px, ${a.translateY}px) rotate(${a.rotDelta}deg)`;

      // Animate circle radius if it changed
      if (a.startRadius !== a.endRadius) {
        a.circle.style.transition = `r ${ANIM_DURATION}ms ease-in-out`;
        a.circle.setAttribute('r', a.endRadius);
      }
    });

    // After animation ends: hide clones, signal complete
    setTimeout(() => {
      // Hide but keep in DOM for OUT reuse
      animEntries.forEach(a => { a.g.style.opacity = '0'; });
      _animating = false;
      if (onComplete) onComplete();
    }, ANIM_DURATION);
  }, ANIM_DELAY);
}

/**
 * OUT animation — reverse the most recent IN, animating focus-ring positions
 *                 back to child pyramid positions.
 *
 * @param {Object}   opts
 * @param {SVGElement} opts.nodesGroup  — the focus-ring nodesGroup (hidden during animation)
 * @param {SVGElement} opts.labelsGroup — the focus-ring labelsGroup (hidden during animation)
 * @param {Function}   opts.onComplete  — called after animation finishes
 */
export function animateOut(opts) {
  const { nodesGroup, labelsGroup, onComplete } = opts;

  if (animatedNodesStack.length === 0) {
    if (onComplete) onComplete();
    return;
  }

  _animating = true;

  const entry = animatedNodesStack.pop();
  const { nodes: animEntries, overlay } = entry;

  // Hide real focus ring nodes + labels during animation
  if (nodesGroup) nodesGroup.style.opacity = '0';
  if (labelsGroup) labelsGroup.style.opacity = '0';

  // Show clones at their animated (focus-ring) positions, then reverse
  animEntries.forEach(a => {
    a.g.style.opacity = '1';
    a.g.style.transition = 'none';
    // They are still at the translated position from IN; keep that.
  });

  // Force reflow
  if (animEntries.length) animEntries[0].g.getBoundingClientRect();

  setTimeout(() => {
    animEntries.forEach(a => {
      a.g.style.transition = `transform ${ANIM_DURATION}ms ease-in-out`;
      a.g.style.transform = 'translate(0px, 0px) rotate(0deg)';

      // Reverse radius
      if (a.startRadius !== a.endRadius) {
        a.circle.style.transition = `r ${ANIM_DURATION}ms ease-in-out`;
        a.circle.setAttribute('r', a.startRadius);
      }
    });

    setTimeout(() => {
      // Remove overlay entirely
      overlay.remove();
      // animateRingInward (same 600 ms duration) restores nodesGroup/labelsGroup
      // on its own completion, so we don't duplicate that here.
      _animating = false;
      if (onComplete) onComplete();
    }, ANIM_DURATION);
  }, ANIM_DELAY);
}

/**
 * Animate child-pyramid nodes FROM the hub (off-screen focus-ring center)
 * to their pyramid positions.  Used after an IN migration completes and
 * setPrimaryItems paints a new child pyramid.
 *
 * @param {Object}    opts
 * @param {SVGElement}  opts.svgRoot       — container for clone overlay
 * @param {Object[]}    opts.pyramidNodes  — newly rendered pyramidData.nodes
 * @param {number}      opts.hubX          — focus-ring hub X (off-screen right)
 * @param {number}      opts.hubY          — focus-ring hub Y
 * @param {SVGElement}  [opts.pyramidGroup]  — real pyramid <g> to hide during anim
 * @param {Function}    [opts.onComplete]  — called when animation finishes
 */
export function animatePyramidFromHub(opts) {
  const {
    svgRoot,
    pyramidNodes = [],
    hubX,
    hubY,
    pyramidGroup,
    onComplete
  } = opts;

  if (!svgRoot || pyramidNodes.length === 0) {
    if (onComplete) onComplete();
    return;
  }

  // Hide the real pyramid during the animation
  if (pyramidGroup) pyramidGroup.style.opacity = '0';

  const overlay = document.createElementNS(SVG_NS, 'g');
  overlay.setAttribute('class', 'migration-animation-overlay');
  svgRoot.appendChild(overlay);

  const entries = [];

  pyramidNodes.forEach(pn => {
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('class', 'migration-node');

    const circle = document.createElementNS(SVG_NS, 'circle');
    circle.setAttribute('cx', hubX);
    circle.setAttribute('cy', hubY);
    circle.setAttribute('r', pn.r);
    circle.setAttribute('class', 'child-pyramid-node');
    g.appendChild(circle);

    const label = document.createElementNS(SVG_NS, 'text');
    label.setAttribute('x', hubX);
    label.setAttribute('y', hubY);
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('dominant-baseline', 'middle');
    label.setAttribute('class', 'child-pyramid-label');
    // Start label at 0° rotation (hub) — will rotate to pyramid angle
    label.setAttribute('transform', `rotate(0, ${hubX}, ${hubY})`);
    label.textContent = pn.label ?? pn.item?.name ?? '';
    g.appendChild(label);

    overlay.appendChild(g);

    // Translation from hub to pyramid position
    const translateX = pn.x - hubX;
    const translateY = pn.y - hubY;

    // Set initial transform (at hub, identity)
    g.style.transformOrigin = `${hubX}px ${hubY}px`;
    g.style.transform = 'translate(0px, 0px)';

    entries.push({ g, circle, label, translateX, translateY, dstX: pn.x, dstY: pn.y, angle: pn.angle });
  });

  // Force reflow
  overlay.getBoundingClientRect();

  setTimeout(() => {
    entries.forEach(e => {
      e.g.style.transition = `transform ${ANIM_DURATION}ms ease-in-out`;
      e.g.style.transform = `translate(${e.translateX}px, ${e.translateY}px)`;
    });

    setTimeout(() => {
      overlay.remove();
      if (pyramidGroup) pyramidGroup.style.opacity = '';
      if (onComplete) onComplete();
    }, ANIM_DURATION);
  }, ANIM_DELAY);
}

/**
 * Animate child-pyramid nodes TO the hub (off-screen focus-ring center).
 * Used at the start of OUT migration so the child pyramid doesn't just vanish.
 *
 * @param {Object}    opts
 * @param {SVGElement}  opts.svgRoot       — container for clone overlay
 * @param {Object[]}    opts.pyramidNodes  — current pyramidData.nodes (snapshot)
 * @param {number}      opts.hubX          — focus-ring hub X (off-screen right)
 * @param {number}      opts.hubY          — focus-ring hub Y
 * @param {SVGElement}  [opts.pyramidGroup]  — real pyramid <g> to hide during anim
 * @param {Function}    [opts.onComplete]  — called when animation finishes
 */
export function animatePyramidToHub(opts) {
  const {
    svgRoot,
    pyramidNodes = [],
    hubX,
    hubY,
    pyramidGroup,
    onComplete
  } = opts;

  if (!svgRoot || pyramidNodes.length === 0) {
    if (onComplete) onComplete();
    return;
  }

  // Hide the real pyramid immediately
  if (pyramidGroup) pyramidGroup.style.opacity = '0';

  const overlay = document.createElementNS(SVG_NS, 'g');
  overlay.setAttribute('class', 'migration-animation-overlay');
  svgRoot.appendChild(overlay);

  const entries = [];

  pyramidNodes.forEach(pn => {
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('class', 'migration-node');

    const circle = document.createElementNS(SVG_NS, 'circle');
    circle.setAttribute('cx', pn.x);
    circle.setAttribute('cy', pn.y);
    circle.setAttribute('r', pn.r);
    circle.setAttribute('class', 'child-pyramid-node');
    g.appendChild(circle);

    const label = document.createElementNS(SVG_NS, 'text');
    label.setAttribute('x', pn.x);
    label.setAttribute('y', pn.y);
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('dominant-baseline', 'middle');
    label.setAttribute('class', 'child-pyramid-label');
    const srcRot = (pn.angle * 180) / Math.PI + 180;
    label.setAttribute('transform', `rotate(${srcRot}, ${pn.x}, ${pn.y})`);
    label.textContent = pn.label ?? pn.item?.name ?? '';
    g.appendChild(label);

    overlay.appendChild(g);

    // Translation from pyramid position to hub
    const translateX = hubX - pn.x;
    const translateY = hubY - pn.y;

    g.style.transformOrigin = `${pn.x}px ${pn.y}px`;
    g.style.transform = 'translate(0px, 0px)';

    entries.push({ g, translateX, translateY });
  });

  // Force reflow
  overlay.getBoundingClientRect();

  setTimeout(() => {
    entries.forEach(e => {
      e.g.style.transition = `transform ${ANIM_DURATION}ms ease-in-out`;
      e.g.style.transform = `translate(${e.translateX}px, ${e.translateY}px)`;
    });

    setTimeout(() => {
      overlay.remove();
      // Do NOT restore pyramidGroup opacity — the OUT migration's
      // onComplete → setPrimaryItems will repaint the parent's pyramid.
      if (onComplete) onComplete();
    }, ANIM_DURATION);
  }, ANIM_DELAY);
}

/**
 * Animate existing Focus Ring nodes radially outward from the hub until
 * they leave the viewport.  Each node travels along its own hub→node ray
 * like an expanding galaxy.  The magnifier node is excluded (it will get
 * its own unique animation later).
 *
 * Runs simultaneously with animateIn and animatePyramidFromHub during IN
 * migration so all three animations complete together in 600 ms.
 *
 * @param {Object}    opts
 * @param {SVGElement}  opts.svgRoot      — container for clone overlay
 * @param {Object[]}    opts.ringNodes    — current focus-ring node positions
 *                                          ({ item, index, angle, x, y, radius, label, labelCentered })
 * @param {number}      opts.hubX         — arc hub X (off-screen right)
 * @param {number}      opts.hubY         — arc hub Y
 * @param {number}      opts.arcRadius    — arc radius (distance from hub to each node)
 * @param {string|null} [opts.skipId]     — item id to exclude (magnifier node)
 * @param {SVGElement}  [opts.nodesGroup] — real nodesGroup to hide during animation
 * @param {SVGElement}  [opts.labelsGroup]— real labelsGroup to hide during animation
 * @param {Function}    [opts.onComplete] — called when animation finishes
 */
export function animateRingOutward(opts) {
  const {
    svgRoot,
    ringNodes = [],
    hubX,
    hubY,
    arcRadius,
    skipId = null,
    nodesGroup,
    labelsGroup,
    onComplete
  } = opts;

  // Filter out the magnifier node if skipId is provided
  const nodesToAnimate = skipId
    ? ringNodes.filter(n => (n.item?.id ?? n.id) !== skipId)
    : ringNodes;

  if (!svgRoot || nodesToAnimate.length === 0) {
    if (onComplete) onComplete();
    return;
  }

  // Hide real focus-ring nodes immediately — clones take over
  if (nodesGroup)  nodesGroup.style.opacity = '0';
  if (labelsGroup) labelsGroup.style.opacity = '0';

  const overlay = document.createElementNS(SVG_NS, 'g');
  overlay.setAttribute('class', 'migration-animation-overlay ring-outward');
  svgRoot.appendChild(overlay);

  // Compute a uniform translation distance.  Every node sits at distance
  // arcRadius from the hub, and the outward ray points away from hub
  // toward (and past) the viewport edge.  Translating by arcRadius pushes
  // each node to roughly 2× its current distance from hub — well past any
  // viewport boundary since the hub itself is already far off-screen right.
  const translateDistance = arcRadius;

  const entries = [];

  nodesToAnimate.forEach(node => {
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('class', 'migration-node');

    const circle = document.createElementNS(SVG_NS, 'circle');
    circle.setAttribute('cx', node.x);
    circle.setAttribute('cy', node.y);
    circle.setAttribute('r', node.radius);
    circle.setAttribute('class', 'focus-ring-node');
    g.appendChild(circle);

    const label = document.createElementNS(SVG_NS, 'text');
    const useCentered = Boolean(node.labelCentered);
    const rot = (node.angle * 180) / Math.PI + 180;
    if (useCentered) {
      label.setAttribute('x', node.x);
      label.setAttribute('y', node.y);
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('dominant-baseline', 'middle');
      label.setAttribute('transform', `rotate(${rot}, ${node.x}, ${node.y})`);
    } else {
      const offset = node.radius * -1.3;
      const lx = node.x + Math.cos(node.angle) * offset;
      const ly = node.y + Math.sin(node.angle) * offset;
      label.setAttribute('x', lx);
      label.setAttribute('y', ly);
      label.setAttribute('text-anchor', 'end');
      label.setAttribute('dominant-baseline', 'middle');
      label.setAttribute('transform', `rotate(${rot}, ${lx}, ${ly})`);
    }
    label.setAttribute('class', 'focus-ring-label');
    label.textContent = node.label ?? node.item?.name ?? '';
    g.appendChild(label);

    overlay.appendChild(g);

    // Unit vector from hub to node (radial direction)
    const dx = node.x - hubX;
    const dy = node.y - hubY;
    // dx, dy has length ≈ arcRadius; normalize then scale by translateDistance
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const translateX = (dx / len) * translateDistance;
    const translateY = (dy / len) * translateDistance;

    g.style.transformOrigin = `${node.x}px ${node.y}px`;
    g.style.transform = 'translate(0px, 0px)';

    entries.push({ g, translateX, translateY });
  });

  // Force reflow
  overlay.getBoundingClientRect();

  setTimeout(() => {
    entries.forEach(e => {
      e.g.style.transition = `transform ${RING_RADIAL_DURATION}ms ease-in-out`;
      e.g.style.transform = `translate(${e.translateX}px, ${e.translateY}px)`;
    });

    setTimeout(() => {
      overlay.remove();
      // Restore real focus-ring nodes now that outward clones are gone.
      // This is the sole authority for restoring ring visibility during IN.
      if (nodesGroup)  nodesGroup.style.opacity = '';
      if (labelsGroup) labelsGroup.style.opacity = '';
      if (onComplete) onComplete();
    }, RING_RADIAL_DURATION);
  }, ANIM_DELAY);
}

/**
 * Animate Focus Ring nodes inward from just outside the viewport to their
 * ring positions.  Used during OUT migration so the parent's focus-ring
 * nodes enter the frame simultaneously with the other animations.
 *
 * Each node starts just beyond the nearest viewport edge along its own
 * hub→node radial ray, so the first pixel enters the frame at t ≈ 0.
 * This keeps the "contracting universe" feel — all layers move hub-ward
 * in sync.
 *
 * @param {Object}    opts
 * @param {SVGElement}  opts.svgRoot        — container for clone overlay
 * @param {Object[]}    opts.ringNodes      — target focus-ring node positions
 *                                            ({ item, index, angle, x, y, radius, label, labelCentered })
 * @param {number}      opts.hubX           — arc hub X (off-screen right)
 * @param {number}      opts.hubY           — arc hub Y
 * @param {number}      opts.arcRadius      — arc radius (distance from hub to each node)
 * @param {number}      opts.viewportWidth  — SVG viewport width
 * @param {number}      opts.viewportHeight — SVG viewport height
 * @param {SVGElement}  [opts.nodesGroup]   — real nodesGroup to hide during animation
 * @param {SVGElement}  [opts.labelsGroup]  — real labelsGroup to hide during animation
 * @param {Function}    [opts.onComplete]   — called when animation finishes
 */
export function animateRingInward(opts) {
  const {
    svgRoot,
    ringNodes = [],
    hubX,
    hubY,
    arcRadius,
    viewportWidth = 0,
    viewportHeight = 0,
    nodesGroup,
    labelsGroup,
    onComplete
  } = opts;

  if (!svgRoot || ringNodes.length === 0) {
    if (onComplete) onComplete();
    return;
  }

  // Hide real focus-ring nodes — clones animate in their place
  if (nodesGroup)  nodesGroup.style.opacity = '0';
  if (labelsGroup) labelsGroup.style.opacity = '0';

  const overlay = document.createElementNS(SVG_NS, 'g');
  overlay.setAttribute('class', 'migration-animation-overlay ring-inward');
  svgRoot.appendChild(overlay);

  const entries = [];

  // Viewport bounds (SVG coordinate space: 0,0 at top-left)
  const vpW = viewportWidth  || arcRadius * 2; // fallback if not provided
  const vpH = viewportHeight || arcRadius * 2;

  ringNodes.forEach(node => {
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('class', 'migration-node');

    // Place circle and label at the TARGET (ring) position
    const circle = document.createElementNS(SVG_NS, 'circle');
    circle.setAttribute('cx', node.x);
    circle.setAttribute('cy', node.y);
    circle.setAttribute('r', node.radius);
    circle.setAttribute('class', 'focus-ring-node');
    g.appendChild(circle);

    const label = document.createElementNS(SVG_NS, 'text');
    const useCentered = Boolean(node.labelCentered);
    const rot = (node.angle * 180) / Math.PI + 180;
    if (useCentered) {
      label.setAttribute('x', node.x);
      label.setAttribute('y', node.y);
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('dominant-baseline', 'middle');
      label.setAttribute('transform', `rotate(${rot}, ${node.x}, ${node.y})`);
    } else {
      const offset = node.radius * -1.3;
      const lx = node.x + Math.cos(node.angle) * offset;
      const ly = node.y + Math.sin(node.angle) * offset;
      label.setAttribute('x', lx);
      label.setAttribute('y', ly);
      label.setAttribute('text-anchor', 'end');
      label.setAttribute('dominant-baseline', 'middle');
      label.setAttribute('transform', `rotate(${rot}, ${lx}, ${ly})`);
    }
    label.setAttribute('class', 'focus-ring-label');
    label.textContent = node.label ?? node.item?.name ?? '';
    g.appendChild(label);

    overlay.appendChild(g);

    // ── Compute per-node start offset ────────────────────────────────
    // Unit vector from hub toward node (radial outward direction)
    const dx = node.x - hubX;
    const dy = node.y - hubY;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const ux = dx / len;            // unit radial X
    const uy = dy / len;            // unit radial Y

    // Walk outward along the ray from the node position until the node
    // center is just past the viewport edge.  We need the smallest
    // positive t such that (node.x + ux*t, node.y + uy*t) is outside
    // the rectangle [0, vpW] × [0, vpH], plus a margin for the node
    // radius so the entire circle (not just its center) starts off-screen.
    const margin = node.radius * 1.5; // comfortable clearance
    let tMin = Infinity;

    // Check each viewport edge (solve for t where coordinate == edge ± margin)
    if (ux > 0) {                                      // exits right
      const t = (vpW + margin - node.x) / ux;
      if (t > 0 && t < tMin) tMin = t;
    } else if (ux < 0) {                               // exits left
      const t = (-margin - node.x) / ux;
      if (t > 0 && t < tMin) tMin = t;
    }
    if (uy > 0) {                                      // exits bottom
      const t = (vpH + margin - node.y) / uy;
      if (t > 0 && t < tMin) tMin = t;
    } else if (uy < 0) {                               // exits top
      const t = (-margin - node.y) / uy;
      if (t > 0 && t < tMin) tMin = t;
    }

    // Fallback: if no edge was reached (shouldn't happen), use arcRadius
    if (!isFinite(tMin)) tMin = arcRadius;

    const offsetX = ux * tMin;
    const offsetY = uy * tMin;

    // Start just outside viewport, animate to identity (ring position)
    g.style.transformOrigin = `${node.x}px ${node.y}px`;
    g.style.transform = `translate(${offsetX}px, ${offsetY}px)`;

    entries.push({ g, offsetX, offsetY });
  });

  // Force reflow so browser registers the initial off-screen transform
  overlay.getBoundingClientRect();

  setTimeout(() => {
    entries.forEach(e => {
      // 600 ms ease-in-out — in sync with animateOut and animatePyramidToHub.
      // The slow-start is now visible (nodes begin at the viewport edge) and
      // reads as gentle acceleration, matching the contracting-universe feel.
      e.g.style.transition = `transform ${ANIM_DURATION}ms ease-in-out`;
      e.g.style.transform = 'translate(0px, 0px)';
    });

    setTimeout(() => {
      overlay.remove();
      // Restore real nodes now that clones have settled into position
      if (nodesGroup)  nodesGroup.style.opacity = '';
      if (labelsGroup) labelsGroup.style.opacity = '';
      if (onComplete) onComplete();
    }, ANIM_DURATION);
  }, ANIM_DELAY);
}

/**
 * Clear the animation stack (e.g. on full navigation reset).
 */
export function clearStack() {
  animatedNodesStack.forEach(entry => {
    if (entry.overlay?.parentNode) entry.overlay.remove();
  });
  animatedNodesStack.length = 0;
  _animating = false;
}

/**
 * @returns {number} Current LIFO stack depth.
 */
export function getStackDepth() {
  return animatedNodesStack.length;
}
