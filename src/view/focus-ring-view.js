import { PyramidView } from './detail/pyramid-view.js';
import { NOW_NODE_FILL, NOW_LABEL_FILL } from './node-appearance.js';

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
    this.parentButtonOuter.setAttribute('class', 'focus-ring-magnifier-circle');
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
    // Ensure correct z-ordering: pyramid group (with fan lines), then magnifier on top
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
      // Hide fan lines between Magnifier and Child Pyramid nodes while rotating
      if (this.pyramidFanLinesGroup) {
        if (isRotating) {
          this.pyramidFanLinesGroup.setAttribute('display', 'none');
        } else {
          this.pyramidFanLinesGroup.removeAttribute('display');
        }
      }
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
    }

    const existingNodes = new Map();
    [...this.nodesGroup.children].forEach(child => existingNodes.set(child.id, child));
    const existingLabels = new Map();
    [...(this.labelsGroup?.children || [])].forEach(child => existingLabels.set(child.id, child));

    nodes.forEach(node => {
      if (node.item === null) return; // gaps are spacing only
      const id = `focus-node-${node.item.id || node.index}`;
      let el = existingNodes.get(id);
      if (!el) {
        el = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        el.setAttribute('id', id);
        el.setAttribute('class', 'focus-ring-node');
        el.setAttribute('role', 'button');
        el.setAttribute('tabindex', '0');
        this.nodesGroup.appendChild(el);
      }
      if (onNodeClick) {
        el.onclick = () => onNodeClick(node);
        this.#attachKeyActivation(el, () => onNodeClick(node));
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
      if (isRotating && magnifierAngle != null) {
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
      const useCentered = Boolean(node.labelCentered);
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
      if (isRotating) {
        this.magnifierLabel.textContent = '';
      } else {
        this.magnifierLabel.textContent = (magnifier.label || '');
      }
      this.magnifierGroup.removeAttribute('display');
    } else if (this.magnifierGroup) {
      this.magnifierGroup.setAttribute('display', 'none');
    }

    if (this.parentButtonOuter && arcParams && magnifier) {
      const magRadius = magnifier.radius || 14;

      // Parent button: explicit viewport-relative placement (top-left origin)
      const ss = viewport?.SSd ?? 0;
      const ls = viewport?.LSd ?? viewport?.height ?? 0;
      const outerX = ss * 0.13;
      const outerY = ls * 0.93;

      const showOuter = parentButtons?.showOuter !== false;
      if (showOuter) {
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
          const labelX = outerX + magRadius * -1.7; // small negative multiplier to slide start just past stroke
          this.parentButtonOuterLabel.setAttribute('x', labelX);
          this.parentButtonOuterLabel.setAttribute('y', outerY);
          this.parentButtonOuterLabel.removeAttribute('transform');
          this.parentButtonOuterLabel.textContent = text;
          this.parentButtonOuterLabel.onclick = parentButtons?.onOuterClick || null;
          this.parentButtonOuterLabel.style.cursor = parentButtons?.onOuterClick ? 'pointer' : 'default';
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

  #ringPath(arcParams, viewportWindow) {
    const outerR = arcParams.radius * 1.01;
    const innerR = arcParams.radius * 0.99;
    const { startAngle, endAngle } = viewportWindow;
    const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;

    const polar = (r, angle) => ({
      x: arcParams.hubX + r * Math.cos(angle),
      y: arcParams.hubY + r * Math.sin(angle)
    });

    const oStart = polar(outerR, startAngle);
    const oEnd = polar(outerR, endAngle);
    const iEnd = polar(innerR, endAngle);
    const iStart = polar(innerR, startAngle);

    return [
      `M ${oStart.x} ${oStart.y}`,
      `A ${outerR} ${outerR} 0 ${largeArc} 1 ${oEnd.x} ${oEnd.y}`,
      `L ${iEnd.x} ${iEnd.y}`,
      `A ${innerR} ${innerR} 0 ${largeArc} 0 ${iStart.x} ${iStart.y}`,
      'Z'
    ].join(' ');
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
