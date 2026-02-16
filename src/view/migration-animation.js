/**
 * Migration Animation Module
 * Handles IN/OUT migration animations for Child Pyramid ↔ Focus Ring transitions.
 *
 * IN  (Child Pyramid → Focus Ring):
 *   Clone each child-pyramid node, animate from its pyramid position to its
 *   calculated focus-ring position over 600 ms, then hide clones and let the
 *   real render paint the focus ring.
 *
 * OUT (Focus Ring → Child Pyramid):
 *   Pop saved clones from LIFO stack, show them at their focus-ring positions,
 *   reverse-animate back to original pyramid positions, remove clones, let
 *   the real render paint the parent's child pyramid.
 *
 * Modelled after wheel-v0/mobile/mobile-animation.js.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';
const ANIM_DURATION = 600; // ms — matches v0
const ANIM_DELAY   = 10;  // ms — force reflow gap

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
      // Restore real focus ring visibility
      if (nodesGroup) nodesGroup.style.opacity = '';
      if (labelsGroup) labelsGroup.style.opacity = '';
      _animating = false;
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
