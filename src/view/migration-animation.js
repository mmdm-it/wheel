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
const ANIM_DURATION = 1200; // ms — temporarily slowed from 600 for design/test
const RING_RADIAL_DURATION = 1200; // ms — temporarily slowed from 900 for design/test

/**
 * Schedule a callback after the browser has fully painted the current frame.
 *
 * On most browsers, rAF fires once per frame (~16 ms at 60 fps).  A
 * setTimeout(0) after that runs in the next macrotask — after the paint —
 * so the initial CSS transform has been composited and transitions work.
 *
 * On iOS WebKit the rAF callback can fire within the SAME compositing pass
 * (< 12 ms), meaning no paint has occurred yet.  Chaining additional rAFs
 * doesn't help — iOS can coalesce those too.  Instead, we measure elapsed
 * time and pad the setTimeout so the total wait is ≥ 34 ms (two 60 fps
 * frames), guaranteeing at least one full paint cycle with the initial
 * state.  On well-behaved browsers this adds zero extra delay.
 */
function afterPaint(fn) {
  const t0 = performance.now();
  requestAnimationFrame(() => {
    const elapsed = performance.now() - t0;
    const pad = elapsed < 12 ? Math.ceil(34 - elapsed) : 0;
    setTimeout(fn, pad);
  });
}

function setTransform(el, value) {
  if (!el) return;
  el.style.transform = value;
  el.style.webkitTransform = value;
}

function setTransition(el, value) {
  if (!el) return;
  el.style.transition = value;
  el.style.webkitTransition = value;
}

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
 * @param {number}      [opts.magnifierRadius] — magnifier circle radius (clicked node grows to this)
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
    magnifierRadius,
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

    // Target radius — the clicked node (becoming the magnifier) grows to
    // magnifierRadius; all other sibling nodes use the default nodeRadius.
    const isClickedNode = clickedId && id === clickedId;
    const endRadius = (isClickedNode && magnifierRadius) ? magnifierRadius : nodeRadius;

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

  // Kick off the animation after the browser has painted the initial state
  afterPaint(() => {
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

      // Don't hide clones yet if an outward ring animation is still running —
      // it won't restore nodesGroup/labelsGroup until RING_RADIAL_DURATION
      // (900 ms), so hiding our clones at 600 ms would leave a ~300 ms gap
      // with nothing visible.  Instead, defer hiding until the overlay from
      // animateRingOutward is removed (which restores real node opacity).
      const outwardOverlay = svgRoot.querySelector('.migration-animation-overlay.ring-outward');
      if (outwardOverlay) {
        // An outward animation is still in flight.  Use a MutationObserver
        // to hide our clones the instant the outward overlay is removed
        // (i.e. real nodes are restored).
        const observer = new MutationObserver(() => {
          if (!svgRoot.contains(outwardOverlay)) {
            observer.disconnect();
            animEntries.forEach(a => { a.g.style.opacity = '0'; });
          }
        });
        observer.observe(svgRoot, { childList: true });
      } else {
        // No outward animation running — safe to hide immediately
        animEntries.forEach(a => { a.g.style.opacity = '0'; });
      }
      _animating = false;
      if (onComplete) onComplete();
    }, ANIM_DURATION);
  });
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

  afterPaint(() => {
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
  });
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

  afterPaint(() => {
    entries.forEach(e => {
      e.g.style.transition = `transform ${ANIM_DURATION}ms ease-in-out`;
      e.g.style.transform = `translate(${e.translateX}px, ${e.translateY}px)`;
    });

    setTimeout(() => {
      overlay.remove();
      if (pyramidGroup) pyramidGroup.style.opacity = '';
      if (onComplete) onComplete();
    }, ANIM_DURATION);
  });
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

  afterPaint(() => {
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
  });
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

  afterPaint(() => {
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
  });
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
 * @param {string|null} [opts.skipId]       — optional item id to exclude (magnified node)
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
    skipId = null,
    viewportWidth = 0,
    viewportHeight = 0,
    nodesGroup,
    labelsGroup,
    onComplete
  } = opts;

  const nodesToAnimate = skipId
    ? ringNodes.filter(n => (n.item?.id ?? n.id) !== skipId)
    : ringNodes;

  if (!svgRoot || nodesToAnimate.length === 0) {
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

  // ── First pass: build clones and compute per-node radial info ──────
  // We need the per-node edge distances so we can pick the MAXIMUM as
  // a single uniform translate distance.  All nodes must stay equidistant
  // from the HUB at every moment — the rectangular viewport naturally
  // causes staggered entry/exit.
  const nodeInfos = [];

  nodesToAnimate.forEach(node => {
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

    // Unit vector from hub toward node (radial outward direction)
    const dx = node.x - hubX;
    const dy = node.y - hubY;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const ux = dx / len;
    const uy = dy / len;

    // Smallest positive t to push this node just past its nearest
    // viewport edge along its radial ray (with margin for full circle).
    const margin = node.radius * 1.5;
    let tMin = Infinity;

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

    if (!isFinite(tMin)) tMin = arcRadius;

    nodeInfos.push({ g, ux, uy, tMin, node });
  });

  // ── Uniform translate distance ─────────────────────────────────────
  // Use the maximum per-node edge distance so ALL nodes start off-screen,
  // while every node remains equidistant from the HUB at every frame.
  // Nodes closer to their nearest edge will enter the viewport sooner —
  // the rectangular viewport creates natural staggered entry.
  const uniformT = nodeInfos.reduce((max, info) => Math.max(max, info.tMin), 0);

  nodeInfos.forEach(info => {
    const offsetX = info.ux * uniformT;
    const offsetY = info.uy * uniformT;

    info.g.style.transformOrigin = `${info.node.x}px ${info.node.y}px`;
    info.g.style.transform = `translate(${offsetX}px, ${offsetY}px)`;

    entries.push({ g: info.g });
  });

  // Force reflow so browser registers the initial off-screen transform
  overlay.getBoundingClientRect();

  afterPaint(() => {
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
  });
}

/**
 * Animate the current magnifier circle + label in a straight line from
 * the magnifier position to the parent-button position.  Used during IN
 * migration.  The label transitions from centered (text-anchor: middle)
 * at magnifier to offset left (text-anchor: start) at parent button,
 * and its rotation adjusts from the arc-derived angle to horizontal (0°).
 *
 * The actual magnifier and parent-button SVG elements should be hidden
 * (empty stroke rings) by the caller; this function animates a clone.
 *
 * @param {Object}   opts
 * @param {SVGElement} opts.svgRoot       — container for clone overlay
 * @param {number}     opts.fromX         — magnifier center X
 * @param {number}     opts.fromY         — magnifier center Y
 * @param {number}     opts.toX           — parent-button center X
 * @param {number}     opts.toY           — parent-button center Y
 * @param {number}     opts.radius        — circle radius (same for both)
 * @param {string}     opts.label         — text label for the circle
 * @param {number}     opts.fromAngle     — magnifier angle (radians)
 * @param {Function}  [opts.onComplete]   — called when animation finishes
 */
export function animateMagnifierToParent(opts) {
  const {
    svgRoot,
    fromX, fromY,
    toX, toY,
    radius,
    label = '',
    fromAngle = 0,
    onComplete
  } = opts;

  if (!svgRoot) { if (onComplete) onComplete(); return; }

  const overlay = document.createElementNS(SVG_NS, 'g');
  overlay.setAttribute('class', 'migration-animation-overlay magnifier-to-parent');
  svgRoot.appendChild(overlay);

  const g = document.createElementNS(SVG_NS, 'g');
  g.setAttribute('class', 'migration-node');

  // Circle at magnifier position
  const circle = document.createElementNS(SVG_NS, 'circle');
  circle.setAttribute('cx', fromX);
  circle.setAttribute('cy', fromY);
  circle.setAttribute('r', radius);
  circle.setAttribute('class', 'focus-ring-magnifier-circle');
  g.appendChild(circle);

  // Label centered at magnifier (text-anchor: middle)
  const labelWrap = document.createElementNS(SVG_NS, 'g');
  labelWrap.setAttribute('class', 'migration-label-wrap');
  const text = document.createElementNS(SVG_NS, 'text');
  text.setAttribute('x', fromX);
  text.setAttribute('y', fromY);
  text.setAttribute('text-anchor', 'middle');
  text.setAttribute('dominant-baseline', 'middle');
  text.setAttribute('class', 'focus-ring-magnifier-label');
  const fromRotDeg = (fromAngle * 180) / Math.PI + 180;
  text.textContent = label;
  labelWrap.appendChild(text);
  g.appendChild(labelWrap);

  overlay.appendChild(g);

  // Translation vector
  const translateX = toX - fromX;
  const translateY = toY - fromY;

  // At the parent-button end, the label is offset left by radius × -1.7.
  // Keep text-anchor fixed (middle) and animate via CSS transform only;
  // this avoids iOS/WebKit snapping when x/text-anchor/transform-attr
  // are changed together on SVG <text>.
  const labelWidth = typeof text.getComputedTextLength === 'function'
    ? text.getComputedTextLength()
    : 0;
  const parentOffsetX = radius * -1.7;
  const endLocalDx = parentOffsetX + (labelWidth * 0.5);

  g.style.transformOrigin = `${fromX}px ${fromY}px`;
  g.style.webkitTransformOrigin = `${fromX}px ${fromY}px`;
  setTransform(g, 'translate3d(0px, 0px, 0px)');

  labelWrap.style.transformOrigin = `${fromX}px ${fromY}px`;
  labelWrap.style.webkitTransformOrigin = `${fromX}px ${fromY}px`;
  setTransform(labelWrap, `translate3d(0px, 0px, 0px) rotate(${fromRotDeg}deg)`);

  // Force reflow
  overlay.getBoundingClientRect();

  afterPaint(() => {
    setTransition(g, `transform ${ANIM_DURATION}ms ease-in-out`);
    setTransform(g, `translate3d(${translateX}px, ${translateY}px, 0px)`);

    // Rotate to horizontal while translating to parent-label left offset.
    // 360° (instead of 0°) preserves the short interpolation path from
    // typical magnifier angles (~322°) on engines that decompose rotation.
    setTransition(labelWrap, `transform ${ANIM_DURATION}ms ease-in-out`);
    setTransform(labelWrap, `translate3d(${endLocalDx}px, 0px, 0px) rotate(360deg)`);

    setTimeout(() => {
      overlay.remove();
      if (onComplete) onComplete();
    }, ANIM_DURATION);
  });
}

/**
 * Reverse of animateMagnifierToParent: animate from parent-button position
 * back to magnifier position.  Used during OUT migration.
 *
 * @param {Object}   opts — same shape as animateMagnifierToParent
 */
export function animateParentToMagnifier(opts) {
  const {
    svgRoot,
    fromX, fromY,   // magnifier position (destination)
    toX, toY,       // parent-button position (start)
    radius,
    label = '',
    fromAngle = 0,  // magnifier angle (destination angle)
    onComplete
  } = opts;

  if (!svgRoot) { if (onComplete) onComplete(); return; }

  const overlay = document.createElementNS(SVG_NS, 'g');
  overlay.setAttribute('class', 'migration-animation-overlay parent-to-magnifier');
  svgRoot.appendChild(overlay);

  const g = document.createElementNS(SVG_NS, 'g');
  g.setAttribute('class', 'migration-node');

  // Circle starting at parent-button position
  const circle = document.createElementNS(SVG_NS, 'circle');
  circle.setAttribute('cx', toX);
  circle.setAttribute('cy', toY);
  circle.setAttribute('r', radius);
  circle.setAttribute('class', 'focus-ring-magnifier-circle');
  g.appendChild(circle);

  // Label starting offset-left of the parent button (text-anchor: start).
  // Use 360° (≡0°) so CSS interpolates 360→dstRotDeg (≈322°) = −38° CW short path
  // instead of 0→322 = +322° the long way.
  const labelWrap = document.createElementNS(SVG_NS, 'g');
  labelWrap.setAttribute('class', 'migration-label-wrap');
  const text = document.createElementNS(SVG_NS, 'text');
  text.setAttribute('x', toX);
  text.setAttribute('y', toY);
  text.setAttribute('text-anchor', 'middle');
  text.setAttribute('dominant-baseline', 'middle');
  text.setAttribute('class', 'focus-ring-magnifier-label');
  text.textContent = label;
  labelWrap.appendChild(text);
  g.appendChild(labelWrap);

  overlay.appendChild(g);

  // Translation: parent button → magnifier
  const translateX = fromX - toX;
  const translateY = fromY - toY;

  const labelWidth = typeof text.getComputedTextLength === 'function'
    ? text.getComputedTextLength()
    : 0;
  const parentOffsetX = radius * -1.7;
  const startLocalDx = parentOffsetX + (labelWidth * 0.5);

  g.style.transformOrigin = `${toX}px ${toY}px`;
  g.style.webkitTransformOrigin = `${toX}px ${toY}px`;
  setTransform(g, 'translate3d(0px, 0px, 0px)');

  labelWrap.style.transformOrigin = `${toX}px ${toY}px`;
  labelWrap.style.webkitTransformOrigin = `${toX}px ${toY}px`;
  setTransform(labelWrap, `translate3d(${startLocalDx}px, 0px, 0px) rotate(360deg)`);

  overlay.getBoundingClientRect();

  afterPaint(() => {
    setTransition(g, `transform ${ANIM_DURATION}ms ease-in-out`);
    setTransform(g, `translate3d(${translateX}px, ${translateY}px, 0px)`);

    // Reverse label transform back to magnifier-centered + arc rotation.
    const dstRotDeg = (fromAngle * 180) / Math.PI + 180;
    setTransition(labelWrap, `transform ${ANIM_DURATION}ms ease-in-out`);
    setTransform(labelWrap, `translate3d(0px, 0px, 0px) rotate(${dstRotDeg}deg)`);

    setTimeout(() => {
      overlay.remove();
      if (onComplete) onComplete();
    }, ANIM_DURATION);
  });
}

/**
 * Volume-specific IN merge animation:
 * keep parent base label visually anchored while the magnifier suffix
 * (e.g. "4 CIL") travels into the parent label as a suffix.
 */
export function animateCatalogParentMerge(opts) {
  const {
    svgRoot,
    fromX, fromY,
    toX, toY,
    radius,
    baseLabel = '',
    suffixLabel = '',
    fromAngle = 0,
    onComplete
  } = opts;

  if (!svgRoot) { if (onComplete) onComplete(); return; }

  const overlay = document.createElementNS(SVG_NS, 'g');
  overlay.setAttribute('class', 'migration-animation-overlay volume-parent-merge');
  svgRoot.appendChild(overlay);

  const parentLabelX = toX + radius * -1.7;

  const staticBase = document.createElementNS(SVG_NS, 'text');
  staticBase.setAttribute('x', parentLabelX);
  staticBase.setAttribute('y', toY);
  staticBase.setAttribute('text-anchor', 'start');
  staticBase.setAttribute('dominant-baseline', 'middle');
  staticBase.setAttribute('class', 'focus-ring-magnifier-label');
  staticBase.setAttribute('transform', `rotate(360, ${parentLabelX}, ${toY})`);
  staticBase.textContent = baseLabel;
  overlay.appendChild(staticBase);

  const baseAdvance = typeof staticBase.getComputedTextLength === 'function'
    ? staticBase.getComputedTextLength()
    : 0;
  const suffixTargetX = parentLabelX + baseAdvance + (baseLabel ? radius * 0.25 : 0);

  const moving = document.createElementNS(SVG_NS, 'g');
  moving.setAttribute('class', 'migration-node');

  const circle = document.createElementNS(SVG_NS, 'circle');
  circle.setAttribute('cx', fromX);
  circle.setAttribute('cy', fromY);
  circle.setAttribute('r', radius);
  circle.setAttribute('class', 'focus-ring-magnifier-circle');
  moving.appendChild(circle);

  const labelWrap = document.createElementNS(SVG_NS, 'g');
  labelWrap.setAttribute('class', 'migration-label-wrap');
  const text = document.createElementNS(SVG_NS, 'text');
  text.setAttribute('x', fromX);
  text.setAttribute('y', fromY);
  text.setAttribute('text-anchor', 'middle');
  text.setAttribute('dominant-baseline', 'middle');
  text.setAttribute('class', 'focus-ring-magnifier-label');
  const fromRotDeg = (fromAngle * 180) / Math.PI + 180;
  text.textContent = suffixLabel;
  labelWrap.appendChild(text);
  moving.appendChild(labelWrap);

  overlay.appendChild(moving);

  const tx = toX - fromX;
  const ty = toY - fromY;

  const suffixWidth = typeof text.getComputedTextLength === 'function'
    ? text.getComputedTextLength()
    : 0;
  const endLocalDx = (suffixTargetX + (suffixWidth * 0.5)) - toX;

  moving.style.transformOrigin = `${fromX}px ${fromY}px`;
  moving.style.webkitTransformOrigin = `${fromX}px ${fromY}px`;
  setTransform(moving, 'translate3d(0px, 0px, 0px)');

  labelWrap.style.transformOrigin = `${fromX}px ${fromY}px`;
  labelWrap.style.webkitTransformOrigin = `${fromX}px ${fromY}px`;
  setTransform(labelWrap, `translate3d(0px, 0px, 0px) rotate(${fromRotDeg}deg)`);

  overlay.getBoundingClientRect();

  afterPaint(() => {
    setTransition(moving, `transform ${ANIM_DURATION}ms ease-in-out`);
    setTransform(moving, `translate3d(${tx}px, ${ty}px, 0px)`);

    setTransition(labelWrap, `transform ${ANIM_DURATION}ms ease-in-out`);
    setTransform(labelWrap, `translate3d(${endLocalDx}px, 0px, 0px) rotate(360deg)`);

    setTimeout(() => {
      overlay.remove();
      if (onComplete) onComplete();
    }, ANIM_DURATION);
  });
}

/**
 * Volume-specific OUT unmerge animation:
 * keep parent base label visually anchored while suffix detaches and
 * travels back to magnifier center.
 */
export function animateCatalogParentUnmerge(opts) {
  const {
    svgRoot,
    fromX, fromY,
    toX, toY,
    radius,
    baseLabel = '',
    suffixLabel = '',
    fromAngle = 0,
    onComplete
  } = opts;

  if (!svgRoot) { if (onComplete) onComplete(); return; }

  const overlay = document.createElementNS(SVG_NS, 'g');
  overlay.setAttribute('class', 'migration-animation-overlay volume-parent-unmerge');
  svgRoot.appendChild(overlay);

  const parentLabelX = toX + radius * -1.7;

  const staticBase = document.createElementNS(SVG_NS, 'text');
  staticBase.setAttribute('x', parentLabelX);
  staticBase.setAttribute('y', toY);
  staticBase.setAttribute('text-anchor', 'start');
  staticBase.setAttribute('dominant-baseline', 'middle');
  staticBase.setAttribute('class', 'focus-ring-magnifier-label');
  staticBase.setAttribute('transform', `rotate(360, ${parentLabelX}, ${toY})`);
  staticBase.textContent = baseLabel;
  overlay.appendChild(staticBase);

  const baseAdvance = typeof staticBase.getComputedTextLength === 'function'
    ? staticBase.getComputedTextLength()
    : 0;
  const suffixStartX = parentLabelX + baseAdvance + (baseLabel ? radius * 0.25 : 0);

  const moving = document.createElementNS(SVG_NS, 'g');
  moving.setAttribute('class', 'migration-node');

  const circle = document.createElementNS(SVG_NS, 'circle');
  circle.setAttribute('cx', toX);
  circle.setAttribute('cy', toY);
  circle.setAttribute('r', radius);
  circle.setAttribute('class', 'focus-ring-magnifier-circle');
  moving.appendChild(circle);

  const labelWrap = document.createElementNS(SVG_NS, 'g');
  labelWrap.setAttribute('class', 'migration-label-wrap');
  const text = document.createElementNS(SVG_NS, 'text');
  text.setAttribute('x', toX);
  text.setAttribute('y', toY);
  text.setAttribute('text-anchor', 'middle');
  text.setAttribute('dominant-baseline', 'middle');
  text.setAttribute('class', 'focus-ring-magnifier-label');
  text.textContent = suffixLabel;
  labelWrap.appendChild(text);
  moving.appendChild(labelWrap);

  overlay.appendChild(moving);

  const tx = fromX - toX;
  const ty = fromY - toY;

  const suffixWidth = typeof text.getComputedTextLength === 'function'
    ? text.getComputedTextLength()
    : 0;
  const startLocalDx = (suffixStartX + (suffixWidth * 0.5)) - toX;

  moving.style.transformOrigin = `${toX}px ${toY}px`;
  moving.style.webkitTransformOrigin = `${toX}px ${toY}px`;
  setTransform(moving, 'translate3d(0px, 0px, 0px)');

  labelWrap.style.transformOrigin = `${toX}px ${toY}px`;
  labelWrap.style.webkitTransformOrigin = `${toX}px ${toY}px`;
  setTransform(labelWrap, `translate3d(${startLocalDx}px, 0px, 0px) rotate(360deg)`);

  overlay.getBoundingClientRect();

  afterPaint(() => {
    setTransition(moving, `transform ${ANIM_DURATION}ms ease-in-out`);
    setTransform(moving, `translate3d(${tx}px, ${ty}px, 0px)`);

    const dstRotDeg = (fromAngle * 180) / Math.PI + 180;
    setTransition(labelWrap, `transform ${ANIM_DURATION}ms ease-in-out`);
    setTransform(labelWrap, `translate3d(0px, 0px, 0px) rotate(${dstRotDeg}deg)`);

    setTimeout(() => {
      overlay.remove();
      if (onComplete) onComplete();
    }, ANIM_DURATION);
  });
}

/**
 * Animate the old parent-button circle + label radially outward from the HUB
 * (same direction as Focus Ring nodes) until it exits the viewport.
 * Used during IN migration.  The parent button should "lead the way" —
 * be the first node to leave the frame.
 *
 * @param {Object}   opts
 * @param {SVGElement} opts.svgRoot        — container for clone overlay
 * @param {number}     opts.buttonX        — parent-button center X
 * @param {number}     opts.buttonY        — parent-button center Y
 * @param {number}     opts.radius         — parent-button circle radius
 * @param {string}     opts.label          — parent-button text label
 * @param {number}     opts.hubX           — arc hub X
 * @param {number}     opts.hubY           — arc hub Y
 * @param {number}     opts.arcRadius      — arc radius (used as translate distance)
 * @param {SVGElement} [opts.buttonElement]      — real parent button circle to hide
 * @param {SVGElement} [opts.buttonLabelElement] — real parent button label to hide
 * @param {Function}  [opts.onComplete]    — called when animation finishes
 */
export function animateParentButtonOutward(opts) {
  const {
    svgRoot,
    buttonX, buttonY,
    radius,
    label = '',
    hubX, hubY,
    arcRadius,
    buttonElement,
    buttonLabelElement,
    onComplete
  } = opts;

  if (!svgRoot) { if (onComplete) onComplete(); return; }

  // Real parent button fill + label are already hidden by the caller;
  // the stroke ring stays visible (empty) during the animation.

  const overlay = document.createElementNS(SVG_NS, 'g');
  overlay.setAttribute('class', 'migration-animation-overlay parent-button-outward');
  svgRoot.appendChild(overlay);

  const g = document.createElementNS(SVG_NS, 'g');
  g.setAttribute('class', 'migration-node');

  const circle = document.createElementNS(SVG_NS, 'circle');
  circle.setAttribute('cx', buttonX);
  circle.setAttribute('cy', buttonY);
  circle.setAttribute('r', radius);
  circle.setAttribute('class', 'focus-ring-magnifier-circle');
  g.appendChild(circle);

  const text = document.createElementNS(SVG_NS, 'text');
  const labelX = buttonX + radius * -1.7;
  text.setAttribute('x', labelX);
  text.setAttribute('y', buttonY);
  text.setAttribute('text-anchor', 'start');
  text.setAttribute('dominant-baseline', 'middle');
  text.setAttribute('class', 'focus-ring-magnifier-label');
  text.textContent = label;
  g.appendChild(text);

  overlay.appendChild(g);

  // Radial direction from hub through the parent button
  const dx = buttonX - hubX;
  const dy = buttonY - hubY;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const ux = dx / len;
  const uy = dy / len;

  // Translate by arcRadius (same uniform distance as ring outward)
  const translateX = ux * arcRadius;
  const translateY = uy * arcRadius;

  g.style.transformOrigin = `${buttonX}px ${buttonY}px`;
  g.style.transform = 'translate(0px, 0px)';

  overlay.getBoundingClientRect();

  afterPaint(() => {
    g.style.transition = `transform ${ANIM_DURATION}ms ease-in-out`;
    g.style.transform = `translate(${translateX}px, ${translateY}px)`;

    setTimeout(() => {
      overlay.remove();
      // Real parent button will be restored by the render after setPrimaryItems
      if (onComplete) onComplete();
    }, ANIM_DURATION);
  });
}

/**
 * Reverse of animateParentButtonOutward: animate the parent-button clone
 * inward from off-screen along a radial ray from the HUB to the parent
 * button position.  Used during OUT migration.
 *
 * @param {Object}   opts — same params as animateParentButtonOutward
 */
export function animateParentButtonInward(opts) {
  const {
    svgRoot,
    buttonX, buttonY,
    radius,
    label = '',
    hubX, hubY,
    arcRadius,
    buttonElement,
    buttonLabelElement,
    onComplete
  } = opts;

  if (!svgRoot) { if (onComplete) onComplete(); return; }

  // Real parent button fill + label are already hidden by the caller;
  // the stroke ring stays visible (empty) during the animation.

  const overlay = document.createElementNS(SVG_NS, 'g');
  overlay.setAttribute('class', 'migration-animation-overlay parent-button-inward');
  svgRoot.appendChild(overlay);

  const g = document.createElementNS(SVG_NS, 'g');
  g.setAttribute('class', 'migration-node');

  const circle = document.createElementNS(SVG_NS, 'circle');
  circle.setAttribute('cx', buttonX);
  circle.setAttribute('cy', buttonY);
  circle.setAttribute('r', radius);
  circle.setAttribute('class', 'focus-ring-magnifier-circle');
  g.appendChild(circle);

  const text = document.createElementNS(SVG_NS, 'text');
  const labelX = buttonX + radius * -1.7;
  text.setAttribute('x', labelX);
  text.setAttribute('y', buttonY);
  text.setAttribute('text-anchor', 'start');
  text.setAttribute('dominant-baseline', 'middle');
  text.setAttribute('class', 'focus-ring-magnifier-label');
  text.textContent = label;
  g.appendChild(text);

  overlay.appendChild(g);

  // Radial direction from hub through the parent button
  const dx = buttonX - hubX;
  const dy = buttonY - hubY;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const ux = dx / len;
  const uy = dy / len;

  // Start at arcRadius away along radial ray (off-screen)
  const startOffsetX = ux * arcRadius;
  const startOffsetY = uy * arcRadius;

  g.style.transformOrigin = `${buttonX}px ${buttonY}px`;
  g.style.transform = `translate(${startOffsetX}px, ${startOffsetY}px)`;

  overlay.getBoundingClientRect();

  afterPaint(() => {
    g.style.transition = `transform ${ANIM_DURATION}ms ease-in-out`;
    g.style.transform = 'translate(0px, 0px)';

    setTimeout(() => {
      overlay.remove();
      // Real parent button fill + label will be restored by the caller.
      if (onComplete) onComplete();
    }, ANIM_DURATION);
  });
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
