import { PyramidView } from './detail/pyramid-view.js';
import { NOW_NODE_FILL, NOW_LABEL_FILL } from './node-appearance.js';
import { bandCenterlinePoints, pointsToPath, getParentSeat, getParentLabelLeftX } from '../geometry/focus-ring-geometry.js';
import { appendGlobeGlyph } from './dimension-globe.js';

// How far outside the arc the section label sits, in MAGNIFIER RADII — so it
// holds its distance across viewports rather than being pinned to one screen.
// A knob: Howell placed it by drawing on a screenshot, and this is the number
// that drawing came to.
const SECTION_LABEL_RADII = 3.2;

// Peak scale factor applied to the node circle and label closest to the magnifier during rotation.
const MAGNIFIER_NODE_SCALE_PEAK = 2.0;

export class FocusRingView {
  constructor(svgRoot) {
    this.svgRoot = svgRoot;
    this.contentGroup = null;
    this.nodesGroup = null;
    this.labelsGroup = null;
    this.pyramidGroup = null;
    this.pyramidNodesGroup = null;
    this.pyramidLabelsGroup = null;
    this.pyramidSpiralGroup = null;
    this.pyramidView = null;
    this.magnifierGroup = null;
    this.magnifierCircle = null;
    this.magnifierLabel = null;
    this.band = null;
    this.parentButtonOuter = null;
    this.parentButtonOuterLabel = null;
  }

  // Q12 (0c), ruled 2026-08-09: THE MAGNIFIER SPEAKS ON SETTLE, AND SAYS
  // NOTHING NEW. It repeats the settled node's EXISTING accessible label —
  // "an announcement is a label, and labels are quotations", which is H-2
  // reaching speech. There is no wording to invent here and there must not be.
  //
  // On settle ONLY. `isRotating` is already the settle signal: the visible
  // label is blanked while turning and painted when it stops, so speech simply
  // follows the same rule the glass does. A live region fed every scrub frame
  // would be unusable — a reader would hear a stream of half-passed nodes and
  // learn to ignore it, which is worse than silence.
  //
  // And only on CHANGE. Re-setting identical text re-announces it in several
  // screen readers, so a settle onto the node you were already on would speak
  // twice.
  #announceSettled(label) {
    if (!label || label === this._lastAnnounced) return;
    this._lastAnnounced = label;
    // Guarded on the METHOD, not on the object: the test DOM provides a
    // `document` that has no getElementById, so checking `typeof document` was
    // never enough — it existed and threw. Speech is a courtesy; it must never
    // be able to break a render.
    const doc = this.doc || (typeof document !== 'undefined' ? document : null);
    if (!doc || typeof doc.getElementById !== 'function') return;
    const region = doc.getElementById('a11y-announcer');
    if (region) region.textContent = label;
  }

  #attachKeyActivation(target, handler) {
    if (!target) return;
    target.onkeydown = evt => {
      if (!handler) return;
      const key = evt.key;
      if (key === 'Enter' || key === ' ') {
        evt.preventDefault();
        handler(evt);
      }
    };
  }

  // The section label for whatever is in the magnifier (H-26). Text only — the seat is
  // computed from the magnifier's own geometry on every render, so the caller
  // never has to know where the ring is. Falsy hides it, which is how "no
  // shelf chart, no label" reaches the glass as ABSENCE rather than an empty
  // frame.
  setSectionLabel(text) {
    this.sectionLabelText = text || '';
    if (this.sectionLabel) this.sectionLabel.textContent = this.sectionLabelText;
  }

  init() {
    if (!this.svgRoot) return;

    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');

    // Filter for blurring child pyramid nodes/labels during rotation.
    // Using an SVG filter (not CSS filter) for iOS WebKit compatibility.
    const pyramidBlurFilter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
    pyramidBlurFilter.setAttribute('id', 'pyramid-rotate-blur');
    pyramidBlurFilter.setAttribute('x', '-50%');
    pyramidBlurFilter.setAttribute('y', '-50%');
    pyramidBlurFilter.setAttribute('width', '200%');
    pyramidBlurFilter.setAttribute('height', '200%');
    const pyramidBlur = document.createElementNS('http://www.w3.org/2000/svg', 'feGaussianBlur');
    pyramidBlur.setAttribute('stdDeviation', '4');
    pyramidBlurFilter.appendChild(pyramidBlur);
    defs.appendChild(pyramidBlurFilter);

    this.svgRoot.appendChild(defs);

    this.contentGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.contentGroup.setAttribute('class', 'focus-content-group');
    this.svgRoot.appendChild(this.contentGroup);
    this.band = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    this.band.setAttribute('class', 'focus-ring-band');
    this.contentGroup.appendChild(this.band);

    // Diagnostic band removed — was debug scaffolding (lime green #00ff00 stroke)
    this.bandDiagnostic = null;

    this.parentButtonOuter = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    // The parent vessel travels RADIALLY — it keeps the radial color while
    // the magnifier (whose class it shares for size/stroke) wears orbital.
    this.parentButtonOuter.setAttribute('class', 'focus-ring-magnifier-circle focus-ring-parent-circle');
    this.contentGroup.appendChild(this.parentButtonOuter);

    this.parentButtonOuterLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    this.parentButtonOuterLabel.setAttribute('class', 'focus-ring-magnifier-label focus-ring-parent-label');
    this.parentButtonOuterLabel.setAttribute('text-anchor', 'start');
    this.parentButtonOuterLabel.setAttribute('dominant-baseline', 'middle');
    this.contentGroup.appendChild(this.parentButtonOuterLabel);

    this.magnifierGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.magnifierGroup.setAttribute('class', 'focus-ring-magnifier');
    this.magnifierCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    this.magnifierCircle.setAttribute('class', 'focus-ring-magnifier-circle');
    this.magnifierLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    this.magnifierLabel.setAttribute('class', 'focus-ring-magnifier-label');
    this.magnifierLabel.setAttribute('text-anchor', 'middle');
    this.magnifierLabel.setAttribute('dominant-baseline', 'middle');
    this.magnifierGroup.appendChild(this.magnifierCircle);
    this.magnifierGroup.appendChild(this.magnifierLabel);
    this.contentGroup.appendChild(this.magnifierGroup);

    // THE SECTION LABEL (H-26), seated where Howell drew it: OUTSIDE the ring,
    // radially in line with the magnifier, and rotated parallel to the arc so
    // it reads along the ring like the node labels do.
    //
    // It lives here rather than in the DOM overlay because this is where the
    // geometry is. Placed as an overlay it would need the arc's hub, radius
    // and magnifier angle re-derived in a second place — which is how two
    // implementations of one question drift apart, and the label would be the
    // one that ends up somewhere the ring is not.
    //
    // Outside the magnifier group on purpose: that group toggles a `rotating`
    // class and blanks its label mid-flight, and the section is a property of
    // the ITEM that SETTLES, not of the motion.
    this.sectionLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    this.sectionLabel.setAttribute('class', 'focus-ring-section-label');
    this.sectionLabel.setAttribute('text-anchor', 'middle');
    this.sectionLabel.setAttribute('dominant-baseline', 'middle');
    this.contentGroup.appendChild(this.sectionLabel);

    this.nodesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.nodesGroup.setAttribute('class', 'focus-ring-nodes');
    this.contentGroup.appendChild(this.nodesGroup);
    this.labelsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.labelsGroup.setAttribute('class', 'focus-ring-labels');
    this.contentGroup.appendChild(this.labelsGroup);

    this.pyramidView = new PyramidView(this.contentGroup);
    this.pyramidView.init();
    this.pyramidGroup = this.pyramidView.pyramidGroup;
    this.pyramidFanLinesGroup = this.pyramidView.pyramidFanLinesGroup;
    this.pyramidSpiralGroup = this.pyramidView.pyramidSpiralGroup;
    this.pyramidNodesGroup = this.pyramidView.pyramidNodesGroup;
    this.pyramidLabelsGroup = this.pyramidView.pyramidLabelsGroup;
  }

  render(nodes, arcParams, viewportWindow, magnifier, options = {}) {
    if (!this.nodesGroup) return;
    const isRotating = Boolean(options.isRotating);
    const debug = Boolean(options.debug);
    const viewport = options.viewport ?? {};
    const viewportWidth = viewport.width ?? 0;
    const viewportHeight = viewport.height ?? 0;
    const viewportSSd = viewport.SSd ?? Math.min(viewportWidth, viewportHeight);
    const viewportLSd = viewport.LSd ?? Math.max(viewportWidth, viewportHeight);
    const removeNode = el => {
      if (!el) return;
      if (typeof el.remove === 'function') {
        el.remove();
      } else if (el.parentNode) {
        el.parentNode.removeChild(el);
      }
    };
    const magnifierAngle = options.magnifierAngle;
    const labelMaskEpsilon = options.labelMaskEpsilon ?? 0.0001;
    const onNodeClick = options.onNodeClick;
    const selectedId = options.selectedId;
    const parentButtons = options.parentButtons;
    // Ensure correct z-ordering: the PARENT SEAT above the ring labels —
    // rotating node labels sweep across the seat's ground and must pass
    // UNDER the vessel and its name, never over them (Howell 2026-07-25) —
    // then pyramid group, then magnifier on top.
    if (this.parentButtonOuter?.parentNode === this.contentGroup) {
      this.contentGroup.appendChild(this.parentButtonOuter);
    }
    if (this.parentButtonOuterLabel?.parentNode === this.contentGroup) {
      this.contentGroup.appendChild(this.parentButtonOuterLabel);
    }
    if (this.parentWorldGlyph?.parentNode === this.contentGroup) {
      this.contentGroup.appendChild(this.parentWorldGlyph);
    }
    if (this.pyramidGroup?.parentNode === this.contentGroup) {
      this.contentGroup.appendChild(this.pyramidGroup);
    }
    if (this.magnifierGroup?.parentNode === this.contentGroup) {
      this.contentGroup.appendChild(this.magnifierGroup);
    }

    if (this.pyramidView) {
      this.pyramidView.render(options.pyramidData ?? null);
      // keep references in sync for any legacy consumers
      this.pyramidGroup = this.pyramidView.pyramidGroup;
      this.pyramidFanLinesGroup = this.pyramidView.pyramidFanLinesGroup;
      this.pyramidSpiralGroup = this.pyramidView.pyramidSpiralGroup;
      this.pyramidNodesGroup = this.pyramidView.pyramidNodesGroup;
      this.pyramidLabelsGroup = this.pyramidView.pyramidLabelsGroup;
      // (Fan lines retired 2026-07-25 — the group stays as an empty anchor;
      // the rotating-hide that once lived here was the erasure experiment
      // that convicted them.)
      // De-emphasize the pyramid during rotation. The dim (opacity 0.5 via
      // the .is-rotating class) is GPU-cheap and stays. The SVG Gaussian
      // blur that used to layer on top was the whole scroll bottleneck —
      // a fixed ~150ms/frame paint at dpr:3 on the iPhone X, re-composited
      // every frame (probe 2026-07-17). Removed; the #pyramid-rotate-blur
      // filter def is left unused in <defs> for a possible device-gated
      // revival. Feel decision (Howell): dim-only vs dim+blur.
      this.pyramidGroup?.classList.toggle('is-rotating', isRotating);
      [this.pyramidNodesGroup, this.pyramidLabelsGroup].forEach(g => {
        if (g) g.removeAttribute('filter');
      });
    }

    if (this.band && arcParams && viewportWindow) {
      this.band.setAttribute('d', this.#ringPath(arcParams, viewportWindow));
      // Stroked centreline: the band width is the old 0.99r–1.01r annulus.
      this.band.setAttribute('stroke-width', (arcParams.radius * 0.02).toFixed(1));
    }

    const existingNodes = new Map();
    [...this.nodesGroup.children].forEach(child => existingNodes.set(child.id, child));
    const existingLabels = new Map();
    [...(this.labelsGroup?.children || [])].forEach(child => existingLabels.set(child.id, child));

    nodes.forEach(node => {
      if (node.item === null) return; // gaps are spacing only
      // THE VERSION FOOTNOTE (Howell 2026-07-20): a placebo link wears the
      // factory stamp costume (ink only, no fill) and is inert — no role,
      // no tab stop, no click, no magnifier-approach swell. Always toggled,
      // never merely set: these elements are recycled.
      const isPlacebo = Boolean(node.item.placebo);
      const id = `focus-node-${node.item.id || node.index}`;
      let el = existingNodes.get(id);
      if (!el) {
        el = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        el.setAttribute('id', id);
        el.setAttribute('class', 'focus-ring-node');
        this.nodesGroup.appendChild(el);
      }
      el.classList.toggle('is-placebo', isPlacebo);
      if (isPlacebo) {
        el.removeAttribute('role');
        el.removeAttribute('tabindex');
        el.setAttribute('aria-hidden', 'true');
        el.onclick = null;
        el.onkeydown = null;
      } else {
        el.setAttribute('role', 'button');
        el.setAttribute('tabindex', '0');
        el.removeAttribute('aria-hidden');
        if (onNodeClick) {
          el.onclick = () => onNodeClick(node);
          this.#attachKeyActivation(el, () => onNodeClick(node));
        }
      }
      el.setAttribute('cx', node.x);
      el.setAttribute('cy', node.y);
      const nodeRadius = node.radius;
      if (!Number.isFinite(nodeRadius)) {
        throw new Error('FocusRingView.render: node radius is required');
      }

      // Scale circle and label when the node is near the magnifier during rotation.
      // Gaussian bell centred on magnifierAngle; drops to ~1 within one node-spacing.
      let magScale = 1;
      if (isRotating && magnifierAngle != null && !isPlacebo) {
        const dist = Math.abs(node.angle - magnifierAngle);
        const sigma = labelMaskEpsilon * 0.5; // ≈ 0.3 × nodeSpacing
        magScale = 1 + (MAGNIFIER_NODE_SCALE_PEAK - 1) * Math.exp(-(dist * dist) / (2 * sigma * sigma));
      }
      const effectiveRadius = nodeRadius * magScale;

      el.setAttribute('r', effectiveRadius);
      // THE PRESENT MOMENT (Howell 2026-07-20): the year, month or day we
      // are living through wears its colors as a RING NODE only — never in
      // the magnifier, which stays its ordinary self whatever is settled
      // in it. Nothing to suppress at rest: the vessel is opaque when
      // settled and covers the node beneath, and goes hollow during a
      // scrub precisely so the ring can be read streaming through it.
      // Always assigned, never merely set: these elements are recycled.
      el.style.fill = node.item?.now ? NOW_NODE_FILL : '';
      el.dataset.index = node.index;
      const ariaLabel = node.label ?? node.item?.name ?? node.item?.id ?? '';
      if (ariaLabel) el.setAttribute('aria-label', ariaLabel);

      // Label
      const labelId = `focus-label-${node.item.id || node.index}`;
      let label = existingLabels.get(labelId);
      if (!label) {
        label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        label.setAttribute('id', labelId);
        label.setAttribute('class', 'focus-ring-label');
        this.labelsGroup.appendChild(label);
      }
      label.classList.toggle('is-placebo', isPlacebo);
      // The stamp's numerals sit ON the node, like every numeral label.
      const useCentered = Boolean(node.labelCentered) || isPlacebo;
      // On-node labels sit on the ORBITAL surface and wear its ink
      // (dark text dies on a dark orbital color — Howell 2026-07-23).
      label.classList.toggle('label-on-node', useCentered && !isPlacebo);
      const rotDeg = (node.angle * 180) / Math.PI + 180;
      if (useCentered || magScale > 1.01) {
        // Center label on the node circle and apply scale via SVG transform.
        // Setting x=0,y=0 with text-anchor:middle keeps glyphs centered at the
        // translate destination, so scale() acts from the node center.
        // This sidesteps the CSS font-size override entirely.
        label.setAttribute('x', '0');
        label.setAttribute('y', '0');
        label.setAttribute('text-anchor', 'middle');
        label.setAttribute('dominant-baseline', 'middle');
        label.setAttribute('transform',
          `translate(${node.x}, ${node.y}) rotate(${rotDeg}) scale(${magScale.toFixed(3)})`);
      } else {
        const offset = nodeRadius * -1.3;
        const lx = node.x + Math.cos(node.angle) * offset;
        const ly = node.y + Math.sin(node.angle) * offset;
        label.setAttribute('x', lx);
        label.setAttribute('y', ly);
        label.setAttribute('text-anchor', 'end');
        label.setAttribute('dominant-baseline', 'middle');
        label.setAttribute('transform', `rotate(${rotDeg}, ${lx}, ${ly})`);
      }
      label.style.fill = node.item?.now ? NOW_LABEL_FILL : '';
      const masked = this.#isNearMagnifier(node.angle, magnifierAngle, labelMaskEpsilon);
      const isSelected = selectedId && (node.item.id === selectedId);
      const showNodeLabel = isRotating || (!masked && !isSelected);
      label.textContent = showNodeLabel ? (node.label ?? node.item.name ?? '') : '';
    });

    existingNodes.forEach((el, id) => {
      if (!nodes.find(n => `focus-node-${n.item?.id || n.index}` === id)) {
        removeNode(el);
      }
    });

    existingLabels.forEach((el, id) => {
      if (!nodes.find(n => `focus-label-${n.item?.id || n.index}` === id)) {
        removeNode(el);
      }
    });

    if (this.magnifierGroup && magnifier) {
      const radius = (magnifier.radius || 14);
      this.magnifierCircle.setAttribute('cx', magnifier.x);
      this.magnifierCircle.setAttribute('cy', magnifier.y);
      this.magnifierCircle.setAttribute('r', radius);
      this.magnifierCircle.setAttribute('role', 'img');
      if (magnifier.label) {
        this.magnifierCircle.setAttribute('aria-label', magnifier.label);
      }
      this.magnifierGroup.classList.toggle('rotating', isRotating);
      this.magnifierLabel.setAttribute('x', magnifier.x);
      this.magnifierLabel.setAttribute('y', magnifier.y);
      const magRotation = ((magnifier.angle || 0) * 180) / Math.PI + 180;
      this.magnifierLabel.setAttribute('transform', `rotate(${magRotation}, ${magnifier.x}, ${magnifier.y})`);

      // Seat the section label OUTSIDE the arc on the magnifier's own radius.
      // Stepping along (cos, sin) from the magnifier moves AWAY from the hub,
      // which is up and to the right of everything — so this lands below-left
      // of the magnified node, clear of the ring, which is where Howell put
      // it. The distance is in magnifier radii so it holds across viewports;
      // the rotation is the node labels' own, so it runs parallel to the arc.
      if (this.sectionLabel) {
        const out = radius * SECTION_LABEL_RADII;
        const sx = magnifier.x + Math.cos(magnifier.angle || 0) * out;
        const sy = magnifier.y + Math.sin(magnifier.angle || 0) * out;
        this.sectionLabel.setAttribute('x', sx);
        this.sectionLabel.setAttribute('y', sy);
        this.sectionLabel.setAttribute('transform', `rotate(${magRotation}, ${sx}, ${sy})`);
        this.sectionLabel.textContent = this.sectionLabelText || '';
      }
      if (isRotating) {
        this.magnifierLabel.textContent = '';
      } else {
        this.magnifierLabel.textContent = (magnifier.label || '');
        this.#announceSettled(magnifier.label || '');
      }
      this.magnifierGroup.removeAttribute('display');
    } else if (this.magnifierGroup) {
      this.magnifierGroup.setAttribute('display', 'none');
    }

    if (this.parentButtonOuter && arcParams && magnifier) {
      const magRadius = magnifier.radius || 14;

      // Parent button: the SPLIT seat (Howell 2026-07-23) — the vessel sits
      // directly under the magnifier where the thumb lives; the label keeps
      // the lower-left corner. Geometry owns the numbers (getParentSeat).
      const seat = getParentSeat(viewport, magRadius);
      const outerX = seat.discX;
      const outerY = seat.discY;

      const showOuter = parentButtons?.showOuter !== false;
      // The disc is an AFFORDANCE (Howell 2026-07-23): it draws only when
      // tapping it migrates data. A context-only label — the top ring's
      // passing country — gets its words with no vessel.
      const actionable = parentButtons?.actionable !== false;
      // The seat can wear an ICON instead of vessel+words: the countries
      // ring's world globe — tap it and everything returns. The glyph is a
      // PERSISTENT element, reused across renders like the vessel disc — a
      // recreated-per-render glyph died between finger-down and finger-up
      // (a tap's own render destroyed it), so its click never fired.
      const worldIcon = parentButtons?.icon === 'world';
      if (showOuter && worldIcon) {
        if (!this.parentWorldGlyph) {
          this.parentWorldGlyph = appendGlobeGlyph(this.contentGroup, outerX, outerY, magRadius * 0.92);
          if (this.parentWorldGlyph) {
            this.parentWorldGlyph.style.cursor = 'pointer';
            this.parentWorldGlyph.setAttribute('role', 'button');
            this.parentWorldGlyph.setAttribute('aria-label', 'All');
          }
        }
        if (this.parentWorldGlyph) {
          this.parentWorldGlyph.setAttribute('transform', `translate(${outerX} ${outerY})`);
          this.parentWorldGlyph.removeAttribute('display');
          this.parentWorldGlyph.onclick = parentButtons?.onOuterClick || null;
        }
      } else if (this.parentWorldGlyph) {
        this.parentWorldGlyph.setAttribute('display', 'none');
        this.parentWorldGlyph.onclick = null;
      }
      if (showOuter && actionable && !worldIcon) {
        this.parentButtonOuter.setAttribute('cx', outerX);
        this.parentButtonOuter.setAttribute('cy', outerY);
        this.parentButtonOuter.setAttribute('r', magRadius);
        this.parentButtonOuter.setAttribute('role', 'button');
        this.parentButtonOuter.setAttribute('tabindex', '0');
        this.parentButtonOuter.removeAttribute('display');
        this.parentButtonOuter.onclick = parentButtons?.onOuterClick || null;
        this.#attachKeyActivation(this.parentButtonOuter, parentButtons?.onOuterClick || null);
        this.parentButtonOuter.style.cursor = parentButtons?.onOuterClick ? 'pointer' : 'default';
        this.parentButtonOuter.classList.toggle('shifted-out', Boolean(parentButtons?.isLayerOut));
        const ariaLabel = parentButtons?.outerLabel || 'Parent';
        this.parentButtonOuter.setAttribute('aria-label', ariaLabel);
      } else {
        this.parentButtonOuter.setAttribute('display', 'none');
        this.parentButtonOuter.onclick = null;
        this.#attachKeyActivation(this.parentButtonOuter, null);
        this.parentButtonOuter.style.cursor = 'default';
      }

      if (this.parentButtonOuterLabel) {
        const text = parentButtons?.outerLabel || '';
        if (showOuter && text) {
          // The label rejoined its vessel (Howell 2026-07-25): seat by
          // measured width — short centers on the disc, longer right-aligns
          // over it ring-style, the longest fall back to the corner.
          // Content first, then measure, then place.
          this.parentButtonOuterLabel.textContent = text;
          this.parentButtonOuterLabel.removeAttribute('display');
          const w = typeof this.parentButtonOuterLabel.getComputedTextLength === 'function'
            ? this.parentButtonOuterLabel.getComputedTextLength()
            : 0;
          // A DECLARED SUFFIX IS SEATED BY ITS NAME (Howell 2026-08-02): the
          // vessel's stroke was cutting through the numeral, so
          // measure the name alone and let the geometry land its last letter
          // just past the stroke. getSubStringLength measures the same glyphs
          // already laid out, so no second element and no re-flow.
          const suffix = parentButtons?.outerLabelSuffix || '';
          let nameW = null;
          if (suffix && text.endsWith(suffix) && typeof this.parentButtonOuterLabel.getSubStringLength === 'function') {
            const nameChars = text.length - suffix.length;
            if (nameChars > 0) {
              try { nameW = this.parentButtonOuterLabel.getSubStringLength(0, nameChars); } catch { nameW = null; }
            }
          }
          const labelX = getParentLabelLeftX(viewport, magRadius, w, nameW);
          this.parentButtonOuterLabel.setAttribute('x', labelX);
          this.parentButtonOuterLabel.setAttribute('y', seat.labelY);
          this.parentButtonOuterLabel.removeAttribute('transform');
          const labelClick = actionable ? (parentButtons?.onOuterClick || null) : null;
          this.parentButtonOuterLabel.onclick = labelClick;
          this.parentButtonOuterLabel.style.cursor = labelClick ? 'pointer' : 'default';
          // Inline, belt-and-suspenders: the label's class family carries
          // pointer-events:none; the stylesheet override alone proved
          // fragile in the field (Howell 2026-07-23). Tappable iff live.
          this.parentButtonOuterLabel.style.pointerEvents = labelClick ? 'auto' : 'none';
          this.parentButtonOuterLabel.removeAttribute('display');
        } else {
          this.parentButtonOuterLabel.setAttribute('display', 'none');
          this.parentButtonOuterLabel.onclick = null;
          this.parentButtonOuterLabel.style.cursor = 'default';
        }
      }
    } else {
      if (this.parentButtonOuter) this.parentButtonOuter.setAttribute('display', 'none');
      if (this.parentButtonOuterLabel) this.parentButtonOuterLabel.setAttribute('display', 'none');
    }
  }

  // The band is the sprocket-chain centreline (focus-ring-geometry): the arc
  // where the chain rides the off-screen sprocket, then STRAIGHT tangent runs
  // beyond the two viewport exits — vertical up at the upper-left, ~SE at the
  // lower-right. Stroked (not a filled annulus) at the band width, so the
  // straight runs are honest lines, not a coil, when the ring recedes (Howell
  // 2026-07-21). Off-screen and clipped at full size.
  #ringPath(arcParams, viewportWindow) {
    return pointsToPath(bandCenterlinePoints(arcParams, viewportWindow.startAngle, viewportWindow.endAngle));
  }

  #isNearMagnifier(angle, magnifierAngle, epsilon) {
    if (magnifierAngle === undefined) return false;
    const diff = Math.abs(this.#normalizeAngle(angle) - this.#normalizeAngle(magnifierAngle));
    const wrapped = diff > Math.PI ? (2 * Math.PI) - diff : diff;
    return wrapped <= epsilon;
  }

  #normalizeAngle(angle) {
    const twoPi = 2 * Math.PI;
    return ((angle % twoPi) + twoPi) % twoPi;
  }
}
