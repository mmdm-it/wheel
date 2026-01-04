import { PyramidView } from './detail/pyramid-view.js';

export class FocusRingView {
  constructor(svgRoot) {
    this.svgRoot = svgRoot;
    this.blurFilter = null;
    this.blurGroup = null;
    this.mirrorLayer = null;
    this.nodesGroup = null;
    this.labelsGroup = null;
    this.pyramidGroup = null;
    this.pyramidNodesGroup = null;
    this.pyramidLabelsGroup = null;
    this.pyramidSpiralGroup = null;
    this.pyramidView = null;
    this.mirroredNodesGroup = null;
    this.mirroredLabelsGroup = null;
    this.tertiaryLayer = null;
    this.tertiaryBand = null;
    this.tertiaryNodesGroup = null;
    this.tertiaryLabelsGroup = null;
    this.tertiaryMagnifier = null;
    this.tertiaryMagnifierLabel = null;
    this.magnifierGroup = null;
    this.magnifierCircle = null;
    this.magnifierLabel = null;
    this.band = null;
    this.mirroredBand = null;
    this.mirroredMagnifier = null;
    this.mirroredMagnifierLabel = null;
    this.dimensionIcon = null;
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
    this.blurFilter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
    this.blurFilter.setAttribute('id', 'focus-blur-filter');
    this.blurFilter.setAttribute('x', '-20%');
    this.blurFilter.setAttribute('y', '-20%');
    this.blurFilter.setAttribute('width', '140%');
    this.blurFilter.setAttribute('height', '140%');
    const blur = document.createElementNS('http://www.w3.org/2000/svg', 'feGaussianBlur');
    blur.setAttribute('stdDeviation', '8');
    this.blurFilter.appendChild(blur);
    defs.appendChild(this.blurFilter);
    this.svgRoot.appendChild(defs);

    this.mirrorLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.mirrorLayer.setAttribute('class', 'focus-mirror-layer');
    this.mirrorLayer.style.pointerEvents = 'auto';
    this.svgRoot.appendChild(this.mirrorLayer);

    this.blurGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.blurGroup.setAttribute('class', 'focus-blur-group');
    this.svgRoot.appendChild(this.blurGroup);
    this.band = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    this.band.setAttribute('class', 'focus-ring-band');
    this.blurGroup.appendChild(this.band);
    
    this.bandDiagnostic = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    this.bandDiagnostic.setAttribute('class', 'focus-ring-band-diagnostic');
    this.svgRoot.appendChild(this.bandDiagnostic);
    
    this.bandDiagnostic = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    this.bandDiagnostic.setAttribute('class', 'focus-ring-band-diagnostic');
    this.blurGroup.appendChild(this.bandDiagnostic);
    
    this.bandDiagnostic = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    this.bandDiagnostic.setAttribute('class', 'focus-ring-band-diagnostic');
    this.blurGroup.appendChild(this.bandDiagnostic);

    this.tertiaryLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.tertiaryLayer.setAttribute('class', 'focus-tertiary-layer');
    this.svgRoot.appendChild(this.tertiaryLayer);
    this.tertiaryBand = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    this.tertiaryBand.setAttribute('class', 'focus-ring-band focus-ring-band-tertiary');
    this.tertiaryBand.style.pointerEvents = 'none';
    this.tertiaryLayer.appendChild(this.tertiaryBand);
    this.tertiaryNodesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.tertiaryNodesGroup.setAttribute('class', 'focus-tertiary-nodes');
    this.tertiaryLabelsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.tertiaryLabelsGroup.setAttribute('class', 'focus-tertiary-labels');
    this.tertiaryMagnifier = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    this.tertiaryMagnifier.setAttribute('class', 'focus-ring-magnifier-circle focus-tertiary-magnifier');
    this.tertiaryMagnifierLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    this.tertiaryMagnifierLabel.setAttribute('class', 'focus-ring-magnifier-label focus-tertiary-magnifier-label');
    this.tertiaryMagnifierLabel.setAttribute('text-anchor', 'middle');
    this.tertiaryMagnifierLabel.setAttribute('dominant-baseline', 'middle');
    this.tertiaryLayer.appendChild(this.tertiaryNodesGroup);
    this.tertiaryLayer.appendChild(this.tertiaryLabelsGroup);
    this.tertiaryLayer.appendChild(this.tertiaryMagnifier);
    this.tertiaryLayer.appendChild(this.tertiaryMagnifierLabel);

    this.parentButtonOuter = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    this.parentButtonOuter.setAttribute('class', 'focus-ring-magnifier-circle');
    this.blurGroup.appendChild(this.parentButtonOuter);

    this.parentButtonOuterLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    this.parentButtonOuterLabel.setAttribute('class', 'focus-ring-magnifier-label');
    this.parentButtonOuterLabel.setAttribute('text-anchor', 'start');
    this.parentButtonOuterLabel.setAttribute('dominant-baseline', 'middle');
    this.blurGroup.appendChild(this.parentButtonOuterLabel);

    this.mirroredBand = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    this.mirroredBand.setAttribute('class', 'focus-ring-band focus-ring-band-mirrored');
    this.mirroredBand.setAttribute('display', 'none');
    this.mirroredBand.style.pointerEvents = 'none';
    this.mirrorLayer.appendChild(this.mirroredBand);

    this.mirroredMagnifier = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    this.mirroredMagnifier.setAttribute('class', 'focus-ring-magnifier-circle focus-ring-magnifier-circle-mirrored');
    this.mirroredMagnifier.setAttribute('display', 'none');
    this.mirroredMagnifier.style.pointerEvents = 'none';
    this.mirrorLayer.appendChild(this.mirroredMagnifier);

    this.mirroredMagnifierLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    this.mirroredMagnifierLabel.setAttribute('class', 'focus-ring-magnifier-label focus-ring-magnifier-label-mirrored');
    this.mirroredMagnifierLabel.setAttribute('text-anchor', 'middle');
    this.mirroredMagnifierLabel.setAttribute('dominant-baseline', 'middle');
    this.mirroredMagnifierLabel.setAttribute('display', 'none');
    this.mirrorLayer.appendChild(this.mirroredMagnifierLabel);

    this.mirroredNodesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.mirroredNodesGroup.setAttribute('class', 'focus-ring-nodes focus-ring-nodes-mirrored');
    this.mirrorLayer.appendChild(this.mirroredNodesGroup);

    this.mirroredLabelsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.mirroredLabelsGroup.setAttribute('class', 'focus-ring-labels focus-ring-labels-mirrored');
    this.mirrorLayer.appendChild(this.mirroredLabelsGroup);

    this.dimensionIcon = document.createElementNS('http://www.w3.org/2000/svg', 'image');
    this.dimensionIcon.setAttribute('class', 'dimension-button');
    this.dimensionIcon.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    this.svgRoot.appendChild(this.dimensionIcon);

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
    this.blurGroup.appendChild(this.magnifierGroup);

    this.nodesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.nodesGroup.setAttribute('class', 'focus-ring-nodes');
    this.blurGroup.appendChild(this.nodesGroup);
    this.labelsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.labelsGroup.setAttribute('class', 'focus-ring-labels');
    this.blurGroup.appendChild(this.labelsGroup);

    this.pyramidView = new PyramidView(this.blurGroup);
    this.pyramidView.init();
    this.pyramidGroup = this.pyramidView.pyramidGroup;
    this.pyramidFanLinesGroup = this.pyramidView.pyramidFanLinesGroup;
    this.pyramidSpiralGroup = this.pyramidView.pyramidSpiralGroup;
    this.pyramidNodesGroup = this.pyramidView.pyramidNodesGroup;
    this.pyramidLabelsGroup = this.pyramidView.pyramidLabelsGroup;
  }

  setBlur(enabled) {
    if (!this.blurGroup) return;
    if (enabled) {
      this.blurGroup.setAttribute('filter', 'url(#focus-blur-filter)');
      this.blurGroup.style.pointerEvents = 'none';
    } else {
      this.blurGroup.removeAttribute('filter');
      this.blurGroup.style.pointerEvents = '';
    }
  }

  render(nodes, arcParams, viewportWindow, magnifier, options = {}) {
    if (!this.nodesGroup) return;
    const isRotating = Boolean(options.isRotating);
    const isBlurred = Boolean(options.isBlurred);
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
    const showSecondary = options.showSecondary ?? Boolean(options.secondary);
    const secondary = showSecondary ? options.secondary : null;
    const tertiary = options.showTertiary ? options.tertiary : null;
    const terIsRotating = Boolean(tertiary?.isRotating);
    const magnifierAngle = options.magnifierAngle;
    const labelMaskEpsilon = options.labelMaskEpsilon ?? 0.0001;
    const onNodeClick = options.onNodeClick;
    const selectedId = options.selectedId;
    const dimensionIcon = options.dimensionIcon;
    const parentButtons = options.parentButtons;
    // Ensure correct z-ordering: pyramid group (with fan lines), then magnifier on top
    if (this.pyramidGroup?.parentNode === this.blurGroup) {
      this.blurGroup.appendChild(this.pyramidGroup);
    }
    if (this.magnifierGroup?.parentNode === this.blurGroup) {
      this.blurGroup.appendChild(this.magnifierGroup);
    }
    if (this.mirrorLayer && this.mirroredMagnifier?.parentNode === this.mirrorLayer) {
      this.mirrorLayer.appendChild(this.mirroredMagnifier);
    }
    if (this.mirrorLayer && this.mirroredMagnifierLabel?.parentNode === this.mirrorLayer) {
      this.mirrorLayer.appendChild(this.mirroredMagnifierLabel);
    }
    if (this.mirrorLayer) {
      const secondaryVisible = Boolean(showSecondary && secondary);
      const pointerState = options.showTertiary ? 'none' : (secondaryVisible ? 'auto' : 'none');
      this.mirrorLayer.removeAttribute('display');
      if (options.showTertiary) {
        this.mirrorLayer.setAttribute('filter', 'url(#focus-blur-filter)');
      } else {
        this.mirrorLayer.removeAttribute('filter');
      }
      this.mirrorLayer.style.pointerEvents = pointerState;
      this.mirrorLayer.style.opacity = '';
      
      // Animate secondary band splitting from primary position to mirrored position
      if (magnifier && viewport) {
        const primaryY = magnifier.y;
        const mirroredY = (viewport.height ?? viewport.LSd ?? primaryY) - primaryY;
        const offset = mirroredY - primaryY; // Distance between primary and secondary
        const translateY = secondaryVisible ? 0 : -offset; // Start at primary, end at mirrored
        this.mirrorLayer.setAttribute('transform', `translate(0, ${translateY})`);
      } else {
        this.mirrorLayer.removeAttribute('transform');
      }
      
      this.mirrorLayer.classList.toggle('is-visible', secondaryVisible);
    }
    if (this.blurGroup && this.svgRoot) {
      // Layering order (back to front): primary, secondary (mirrored), tertiary, controls
      this.svgRoot.appendChild(this.blurGroup);
      if (this.bandDiagnostic) this.svgRoot.appendChild(this.bandDiagnostic);
      if (this.mirrorLayer) this.svgRoot.appendChild(this.mirrorLayer);
      if (this.tertiaryLayer) this.svgRoot.appendChild(this.tertiaryLayer);
      if (this.dimensionIcon) this.svgRoot.appendChild(this.dimensionIcon);
    }

    if (this.band) {
      // Animate diagnostic stroke from primary to secondary (mirrored) arc geometry
      const secondaryAnimating = Boolean(options.secondaryAnimating && secondary);
      if (this.bandDiagnostic && arcParams && viewportWindow && viewport) {
        if (secondary) {
          // Use mirrored arc geometry for correct end-state when secondary exists
          const mirroredArc = this.#mirroredArc(arcParams, viewport);
          const mirroredWindow = this.#mirroredWindow(viewport, mirroredArc);
          if (mirroredWindow) {
            this.bandDiagnostic.setAttribute('d', this.#ringPath(mirroredArc, mirroredWindow));
            
            // Calculate transform to move mirrored arc back to primary position when not animating
            if (!secondaryAnimating && magnifier) {
              const primaryY = magnifier.y;
              const mirroredY = (viewport.height ?? viewport.LSd ?? primaryY) - primaryY;
              const offset = mirroredY - primaryY;
              this.bandDiagnostic.setAttribute('transform', `translate(0, ${-offset})`);
            } else {
              this.bandDiagnostic.removeAttribute('transform');
            }
          }
        } else {
          // Use primary arc geometry when secondary doesn't exist yet
          this.bandDiagnostic.setAttribute('d', this.#ringPath(arcParams, viewportWindow));
          this.bandDiagnostic.removeAttribute('transform');
        }
      } else if (this.bandDiagnostic) {
        this.bandDiagnostic.removeAttribute('transform');
      }
    }

    if (this.pyramidView) {
      this.pyramidView.render(options.pyramidData ?? null);
      // keep references in sync for any legacy consumers
      this.pyramidGroup = this.pyramidView.pyramidGroup;
      this.pyramidFanLinesGroup = this.pyramidView.pyramidFanLinesGroup;
      this.pyramidSpiralGroup = this.pyramidView.pyramidSpiralGroup;
      this.pyramidNodesGroup = this.pyramidView.pyramidNodesGroup;
      this.pyramidLabelsGroup = this.pyramidView.pyramidLabelsGroup;
    }

    if (this.band && arcParams && viewportWindow) {
      this.band.setAttribute('d', this.#ringPath(arcParams, viewportWindow));
    }

    if (this.mirroredBand) {
      if (secondary && arcParams && viewport) {
        const mirroredArc = this.#mirroredArc(arcParams, viewport);
        const mirroredWindow = this.#mirroredWindow(viewport, mirroredArc);
        if (mirroredWindow) {
          this.mirroredBand.setAttribute('d', this.#ringPath(mirroredArc, mirroredWindow));
          this.mirroredBand.removeAttribute('display');
        } else {
          this.mirroredBand.setAttribute('display', 'none');
        }
      } else {
        this.mirroredBand.setAttribute('display', 'none');
      }
    }

    if (this.tertiaryBand) {
      if (options.showTertiary && arcParams && viewport && magnifier) {
        const tertiaryArc = this.#tertiaryArc(arcParams, viewport, magnifier);
        const tertiaryWindow = tertiaryArc ? this.#tertiaryWindow(viewport, tertiaryArc, viewportWindow) : null;
        if (tertiaryArc && tertiaryWindow) {
          this.tertiaryBand.setAttribute('d', this.#ringPath(tertiaryArc, tertiaryWindow));
          this.tertiaryBand.removeAttribute('display');
        } else {
          this.tertiaryBand.setAttribute('display', 'none');
        }
      } else {
        this.tertiaryBand.setAttribute('display', 'none');
      }
    }

    if (this.mirroredMagnifier) {
      if (isBlurred && arcParams && viewport && magnifier) {
        const radius = magnifier.radius || 14;
        const mirroredX = magnifier.x;
        const mirroredY = (viewport.height ?? viewport.LSd ?? magnifier.y) - magnifier.y;
        this.mirroredMagnifier.setAttribute('cx', mirroredX);
        this.mirroredMagnifier.setAttribute('cy', mirroredY);
        this.mirroredMagnifier.setAttribute('r', radius);
        this.mirroredMagnifier.removeAttribute('display');
        const secIsRotating = Boolean(options?.secondary?.isRotating);
        this.mirroredMagnifier.classList.toggle('rotating', secIsRotating);
        if (this.mirroredMagnifierLabel) {
          this.mirroredMagnifierLabel.setAttribute('x', mirroredX);
          this.mirroredMagnifierLabel.setAttribute('y', mirroredY);
          const labelAngle = options?.secondary?.magnifierAngle ?? magnifier.angle ?? 0;
          const magRotation = (labelAngle * 180) / Math.PI + 180;
          this.mirroredMagnifierLabel.setAttribute('transform', `rotate(${magRotation}, ${mirroredX}, ${mirroredY})`);
          const mirroredLabel = secIsRotating ? '' : (options?.secondary?.magnifierLabel || '');
          this.mirroredMagnifierLabel.textContent = mirroredLabel;
          this.mirroredMagnifierLabel.classList.toggle('rotating', secIsRotating);
          if (this.mirroredMagnifierLabel.textContent) {
            this.mirroredMagnifierLabel.removeAttribute('display');
          } else {
            this.mirroredMagnifierLabel.setAttribute('display', 'none');
          }
        }
      } else {
        this.mirroredMagnifier.setAttribute('display', 'none');
        if (this.mirroredMagnifierLabel) this.mirroredMagnifierLabel.setAttribute('display', 'none');
      }
    }

    if (this.dimensionIcon && dimensionIcon) {
      const { href, x, y, size, onClick, ariaLabel } = dimensionIcon;
      this.dimensionIcon.setAttributeNS('http://www.w3.org/1999/xlink', 'href', href);
      const w = size || 0;
      const h = size || 0;
      this.dimensionIcon.setAttribute('width', w);
      this.dimensionIcon.setAttribute('height', h);
      this.dimensionIcon.setAttribute('x', x - w / 2);
      this.dimensionIcon.setAttribute('y', y - h / 2);
      this.dimensionIcon.setAttribute('role', 'button');
      this.dimensionIcon.setAttribute('tabindex', '0');
      this.dimensionIcon.setAttribute('aria-label', ariaLabel || 'Toggle dimension mode');
      if (onClick) {
        this.dimensionIcon.onclick = onClick;
        this.#attachKeyActivation(this.dimensionIcon, onClick);
        this.dimensionIcon.style.cursor = 'pointer';
      } else {
        this.dimensionIcon.onclick = null;
        this.#attachKeyActivation(this.dimensionIcon, null);
        this.dimensionIcon.style.cursor = 'default';
      }
      this.dimensionIcon.removeAttribute('display');
    } else if (this.dimensionIcon) {
      this.dimensionIcon.setAttribute('display', 'none');
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
      el.setAttribute('r', nodeRadius);
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
      if (useCentered) {
        label.setAttribute('x', node.x);
        label.setAttribute('y', node.y);
        label.setAttribute('text-anchor', 'middle');
        label.setAttribute('dominant-baseline', 'middle');
        const rotation = (node.angle * 180) / Math.PI + 180;
        label.setAttribute('transform', `rotate(${rotation}, ${node.x}, ${node.y})`);
      } else {
        const radius = nodeRadius;
        const offset = radius * -1.3; // pull anchor notably toward the hub without hardcoded px gap
        const lx = node.x + Math.cos(node.angle) * offset;
        const ly = node.y + Math.sin(node.angle) * offset;
        label.setAttribute('x', lx);
        label.setAttribute('y', ly);
        label.setAttribute('text-anchor', 'end');
        label.setAttribute('dominant-baseline', 'middle');
        const rotation = (node.angle * 180) / Math.PI + 180; // 90° more to flip vertical
        label.setAttribute('transform', `rotate(${rotation}, ${lx}, ${ly})`);
      }
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

    if (secondary?.nodes && this.mirroredNodesGroup && this.mirroredLabelsGroup) {
      this.mirroredNodesGroup.removeAttribute('display');
      this.mirroredLabelsGroup.removeAttribute('display');
      const secNodes = secondary.nodes;
      const secIsRotating = Boolean(secondary.isRotating);
      const secMagnifierAngle = secondary.magnifierAngle;
      const secLabelMaskEpsilon = secondary.labelMaskEpsilon ?? labelMaskEpsilon;
      const secOnNodeClick = secondary.onNodeClick;
      const secSelectedId = secondary.selectedId;

      const existingSecNodes = new Map();
      [...this.mirroredNodesGroup.children].forEach(child => existingSecNodes.set(child.id, child));
      const existingSecLabels = new Map();
      [...(this.mirroredLabelsGroup?.children || [])].forEach(child => existingSecLabels.set(child.id, child));

      secNodes.forEach(node => {
        if (node.item === null) return;
        const id = `secondary-node-${node.item.id || node.index}`;
        let el = existingSecNodes.get(id);
        if (!el) {
          el = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          el.setAttribute('id', id);
          el.setAttribute('class', 'focus-ring-node focus-ring-node-secondary');
          el.setAttribute('role', 'button');
          el.setAttribute('tabindex', '0');
          this.mirroredNodesGroup.appendChild(el);
        }
        if (secOnNodeClick) {
          el.onclick = () => secOnNodeClick(node);
          this.#attachKeyActivation(el, () => secOnNodeClick(node));
          el.style.cursor = 'pointer';
        } else {
          el.onclick = null;
          this.#attachKeyActivation(el, null);
          el.style.cursor = 'default';
        }
        el.setAttribute('cx', node.x);
        el.setAttribute('cy', node.y);
        const nodeRadius = node.radius;
        el.setAttribute('r', nodeRadius);
        el.dataset.index = node.index;
        const ariaLabel = node.label ?? node.item?.name ?? node.item?.id ?? '';
        if (ariaLabel) el.setAttribute('aria-label', ariaLabel);

        const labelId = `secondary-label-${node.item.id || node.index}`;
        let label = existingSecLabels.get(labelId);
        if (!label) {
          label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          label.setAttribute('id', labelId);
          label.setAttribute('class', 'focus-ring-label focus-ring-label-secondary');
          this.mirroredLabelsGroup.appendChild(label);
        }
        const useCentered = Boolean(node.labelCentered);
        if (useCentered) {
          label.setAttribute('x', node.x);
          label.setAttribute('y', node.y);
          label.setAttribute('text-anchor', 'middle');
          label.setAttribute('dominant-baseline', 'middle');
          const rotation = (node.angle * 180) / Math.PI + 180;
          label.setAttribute('transform', `rotate(${rotation}, ${node.x}, ${node.y})`);
        } else {
          const radius = nodeRadius;
          const offset = radius * -1.3;
          const lx = node.x + Math.cos(node.angle) * offset;
          const ly = node.y + Math.sin(node.angle) * offset;
          label.setAttribute('x', lx);
          label.setAttribute('y', ly);
          label.setAttribute('text-anchor', 'end');
          label.setAttribute('dominant-baseline', 'middle');
          const rotation = (node.angle * 180) / Math.PI + 180;
          label.setAttribute('transform', `rotate(${rotation}, ${lx}, ${ly})`);
        }
        const masked = this.#isNearMagnifier(node.angle, secMagnifierAngle, secLabelMaskEpsilon);
        const isSelected = secSelectedId && (node.item.id === secSelectedId);
        const showNodeLabel = secIsRotating || (!masked && !isSelected);
        label.textContent = showNodeLabel ? (node.label ?? node.item.name ?? '') : '';
      });

      existingSecNodes.forEach((el, id) => {
        if (!secNodes.find(n => `secondary-node-${n.item?.id || n.index}` === id)) {
          removeNode(el);
        }
      });

      existingSecLabels.forEach((el, id) => {
        if (!secNodes.find(n => `secondary-label-${n.item?.id || n.index}` === id)) {
          removeNode(el);
        }
      });
    } else {
      if (this.mirroredNodesGroup) {
        this.mirroredNodesGroup.removeAttribute('display');
        this.mirroredNodesGroup.style.pointerEvents = 'none';
      }
      if (this.mirroredLabelsGroup) {
        this.mirroredLabelsGroup.removeAttribute('display');
        this.mirroredLabelsGroup.style.pointerEvents = 'none';
      }
    }

    if (options.showTertiary && tertiary?.nodes && this.tertiaryNodesGroup && this.tertiaryLabelsGroup) {
      this.tertiaryNodesGroup.removeAttribute('display');
      this.tertiaryLabelsGroup.removeAttribute('display');
      const terNodes = tertiary.nodes;
      const terMagnifierAngle = tertiary.magnifierAngle;
      const terLabelMaskEpsilon = tertiary.labelMaskEpsilon ?? labelMaskEpsilon;
      const terOnNodeClick = tertiary.onNodeClick;
      const terSelectedId = tertiary.selectedId;

      const existingTerNodes = new Map();
      [...this.tertiaryNodesGroup.children].forEach(child => existingTerNodes.set(child.id, child));
      const existingTerLabels = new Map();
      [...(this.tertiaryLabelsGroup?.children || [])].forEach(child => existingTerLabels.set(child.id, child));

      terNodes.forEach(node => {
        if (node.item === null) return;
        const id = `tertiary-node-${node.item.id || node.index}`;
        let el = existingTerNodes.get(id);
        if (!el) {
          el = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          el.setAttribute('id', id);
          el.setAttribute('class', 'focus-ring-node focus-ring-node-tertiary');
          el.setAttribute('role', 'button');
          el.setAttribute('tabindex', '0');
          this.tertiaryNodesGroup.appendChild(el);
        }
        if (terOnNodeClick) {
          el.onclick = () => terOnNodeClick(node);
          this.#attachKeyActivation(el, () => terOnNodeClick(node));
          el.style.cursor = 'pointer';
        } else {
          el.onclick = null;
          this.#attachKeyActivation(el, null);
          el.style.cursor = 'default';
        }
        el.setAttribute('cx', node.x);
        el.setAttribute('cy', node.y);
        const nodeRadius = node.radius;
        el.setAttribute('r', nodeRadius);
        el.dataset.index = node.index;
        const ariaLabel = node.label ?? node.item?.name ?? node.item?.id ?? '';
        if (ariaLabel) el.setAttribute('aria-label', ariaLabel);

        const labelId = `tertiary-label-${node.item.id || node.index}`;
        let label = existingTerLabels.get(labelId);
        if (!label) {
          label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          label.setAttribute('id', labelId);
          label.setAttribute('class', 'focus-ring-label focus-ring-label-tertiary');
          this.tertiaryLabelsGroup.appendChild(label);
        }
        const useCentered = Boolean(node.labelCentered);
        if (useCentered) {
          label.setAttribute('x', node.x);
          label.setAttribute('y', node.y);
          label.setAttribute('text-anchor', 'middle');
          label.setAttribute('dominant-baseline', 'middle');
          const rotation = (node.angle * 180) / Math.PI + 180;
          label.setAttribute('transform', `rotate(${rotation}, ${node.x}, ${node.y})`);
        } else {
          const radius = nodeRadius;
          const offset = radius * -1.3;
          const lx = node.x + Math.cos(node.angle) * offset;
          const ly = node.y + Math.sin(node.angle) * offset;
          label.setAttribute('x', lx);
          label.setAttribute('y', ly);
          label.setAttribute('text-anchor', 'end');
          label.setAttribute('dominant-baseline', 'middle');
          const rotation = (node.angle * 180) / Math.PI + 180;
          label.setAttribute('transform', `rotate(${rotation}, ${lx}, ${ly})`);
        }
        const masked = this.#isNearMagnifier(node.angle, terMagnifierAngle, terLabelMaskEpsilon);
        const isSelected = terSelectedId && (node.item.id === terSelectedId);
        const showNodeLabel = terIsRotating || (!masked && !isSelected);
        label.textContent = showNodeLabel ? (node.label ?? node.item.name ?? '') : '';
      });

      existingTerNodes.forEach((el, id) => {
        if (!terNodes.find(n => `tertiary-node-${n.item?.id || n.index}` === id)) {
          removeNode(el);
        }
      });

      existingTerLabels.forEach((el, id) => {
        if (!terNodes.find(n => `tertiary-label-${n.item?.id || n.index}` === id)) {
          removeNode(el);
        }
      });
    } else {
      if (this.tertiaryNodesGroup) {
        this.tertiaryNodesGroup.setAttribute('display', 'none');
      }
      if (this.tertiaryLabelsGroup) {
        this.tertiaryLabelsGroup.setAttribute('display', 'none');
      }
    }

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

    if (options.showTertiary && this.tertiaryMagnifier && this.tertiaryMagnifierLabel && options.tertiaryMagnifier) {
      const tMag = options.tertiaryMagnifier;
      const radius = tMag.radius || 14;
      this.tertiaryMagnifier.setAttribute('cx', tMag.x);
      this.tertiaryMagnifier.setAttribute('cy', tMag.y);
      this.tertiaryMagnifier.setAttribute('r', radius);
      this.tertiaryMagnifier.setAttribute('role', 'img');
      if (tMag.label) {
        this.tertiaryMagnifier.setAttribute('aria-label', tMag.label);
      }
      this.tertiaryMagnifier.classList.toggle('rotating', terIsRotating);
      this.tertiaryMagnifierLabel.setAttribute('x', tMag.x);
      this.tertiaryMagnifierLabel.setAttribute('y', tMag.y);
      const tRotation = ((tMag.angle || 0) * 180) / Math.PI + 180;
      this.tertiaryMagnifierLabel.setAttribute('transform', `rotate(${tRotation}, ${tMag.x}, ${tMag.y})`);
      this.tertiaryMagnifierLabel.classList.toggle('rotating', terIsRotating);
      this.tertiaryMagnifierLabel.textContent = terIsRotating ? '' : (tMag.label || '');
      this.tertiaryMagnifier.removeAttribute('display');
      this.tertiaryMagnifierLabel.removeAttribute('display');
    } else {
      if (this.tertiaryMagnifier) this.tertiaryMagnifier.setAttribute('display', 'none');
      if (this.tertiaryMagnifierLabel) this.tertiaryMagnifierLabel.setAttribute('display', 'none');
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

  #mirroredWindow(viewport, arcParams) {
    if (!viewport || !arcParams) return null;
    const { width, height } = viewport;
    const startAngle = Math.atan2(height - arcParams.hubY, 0 - arcParams.hubX); // lower-left corner
    let endAngle = Math.atan2(0 - arcParams.hubY, width - arcParams.hubX); // upper-right corner
    if (endAngle <= startAngle) {
      endAngle += Math.PI * 2;
    }
    return { startAngle, endAngle };
  }

  #mirroredArc(arcParams, viewport) {
    if (!arcParams || !viewport) return arcParams;
    const mirroredHubY = viewport.LSd ?? arcParams.hubY;
    return { ...arcParams, hubY: mirroredHubY };
  }

  #tertiaryArc(arcParams, viewport, magnifier) {
    if (!arcParams || !viewport || !magnifier) return null;
    const radius = arcParams.radius;
    const primary = { x: magnifier.x, y: magnifier.y };
    const secondaryY = (viewport.height ?? viewport.LSd ?? primary.y) - primary.y;
    const secondary = { x: primary.x, y: secondaryY };
    const dy = secondary.y - primary.y;
    const d = Math.abs(dy);
    if (d > radius * 2) return null; // points too far apart for given radius
    const midY = (primary.y + secondary.y) / 2;
    const offset = Math.sqrt(Math.max(0, radius * radius - (d * d) / 4));
    const hubX = primary.x + offset; // place hub to the right to stay consistent with primary ring
    const hubY = midY;
    return { hubX, hubY, radius };
  }

  #tertiaryWindow(viewport, arcParams, baseWindow = null) {
    if (!viewport || !arcParams) return null;
    const { width, height } = viewport;
    const startAngle = Math.atan2(height - arcParams.hubY, width - arcParams.hubX);
    const desiredArc = baseWindow?.arcLength || (baseWindow?.endAngle && baseWindow?.startAngle !== undefined
      ? baseWindow.endAngle - baseWindow.startAngle
      : Math.PI);
    const endAngle = startAngle + desiredArc;
    return { startAngle, endAngle };
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
