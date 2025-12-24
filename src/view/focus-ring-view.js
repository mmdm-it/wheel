export class FocusRingView {
  constructor(svgRoot) {
    this.svgRoot = svgRoot;
    this.blurFilter = null;
    this.blurGroup = null;
    this.mirrorLayer = null;
    this.nodesGroup = null;
    this.labelsGroup = null;
    this.mirroredNodesGroup = null;
    this.mirroredLabelsGroup = null;
    this.magnifierGroup = null;
    this.magnifierCircle = null;
    this.magnifierLabel = null;
    this.band = null;
    this.mirroredBand = null;
    this.mirroredMagnifier = null;
    this.mirroredMagnifierLabel = null;
    this.dimensionIcon = null;
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
    const viewport = options.viewport;
    const secondary = options.secondary;
    const magnifierAngle = options.magnifierAngle;
    const labelMaskEpsilon = options.labelMaskEpsilon ?? 0.0001;
    const onNodeClick = options.onNodeClick;
    const selectedId = options.selectedId;
    const dimensionIcon = options.dimensionIcon;
    // Ensure magnifier group is on top for proper z-ordering
    if (this.magnifierGroup?.parentNode === this.blurGroup) {
      this.blurGroup.appendChild(this.magnifierGroup);
    }
    if (this.blurGroup && this.svgRoot) {
      // Keep layering: base blur content, then mirrored band, then dimension icon
      this.svgRoot.appendChild(this.blurGroup);
      if (this.mirrorLayer) this.svgRoot.appendChild(this.mirrorLayer);
      if (this.dimensionIcon) this.svgRoot.appendChild(this.dimensionIcon);
    }

    if (this.band && arcParams && viewportWindow) {
      this.band.setAttribute('d', this.#ringPath(arcParams, viewportWindow));
    }

    if (this.mirroredBand) {
      if (isBlurred && arcParams && viewport) {
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

    if (this.mirroredMagnifier) {
      if (isBlurred && arcParams && viewport && magnifier) {
        const radius = magnifier.radius || 14;
        const mirroredX = magnifier.x;
        const mirroredY = (viewport.height ?? viewport.LSd ?? magnifier.y) - magnifier.y;
        this.mirroredMagnifier.setAttribute('cx', mirroredX);
        this.mirroredMagnifier.setAttribute('cy', mirroredY);
        this.mirroredMagnifier.setAttribute('r', radius);
        this.mirroredMagnifier.removeAttribute('display');
        this.mirroredMagnifier.classList.toggle('rotating', Boolean(options?.secondary?.isRotating));
        if (options.debug) {
          console.info('[FocusRingView] mirrored magnifier', {
            mirroredX,
            mirroredY,
            radius,
            sourceX: magnifier.x,
            sourceY: magnifier.y,
            viewportHeight: viewport.height,
            isBlurred
          });
        }
        if (this.mirroredMagnifierLabel) {
          this.mirroredMagnifierLabel.setAttribute('x', mirroredX);
          this.mirroredMagnifierLabel.setAttribute('y', mirroredY);
          const labelAngle = options?.secondary?.magnifierAngle ?? magnifier.angle ?? 0;
          const magRotation = (labelAngle * 180) / Math.PI + 180;
          this.mirroredMagnifierLabel.setAttribute('transform', `rotate(${magRotation}, ${mirroredX}, ${mirroredY})`);
          this.mirroredMagnifierLabel.textContent = options?.secondary?.magnifierLabel || '';
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
      const { href, x, y, size, onClick } = dimensionIcon;
      this.dimensionIcon.setAttributeNS('http://www.w3.org/1999/xlink', 'href', href);
      const w = size || 0;
      const h = size || 0;
      this.dimensionIcon.setAttribute('width', w);
      this.dimensionIcon.setAttribute('height', h);
      this.dimensionIcon.setAttribute('x', x - w / 2);
      this.dimensionIcon.setAttribute('y', y - h / 2);
      if (onClick) {
        this.dimensionIcon.onclick = onClick;
        this.dimensionIcon.style.cursor = 'pointer';
      } else {
        this.dimensionIcon.onclick = null;
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
        this.nodesGroup.appendChild(el);
      }
      if (onNodeClick) {
        el.onclick = () => onNodeClick(node);
      }
      el.setAttribute('cx', node.x);
      el.setAttribute('cy', node.y);
      const nodeRadius = node.radius;
      if (!Number.isFinite(nodeRadius)) {
        throw new Error('FocusRingView.render: node radius is required');
      }
      el.setAttribute('r', nodeRadius);
      el.dataset.index = node.index;

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
        el.remove();
      }
    });

    existingLabels.forEach((el, id) => {
      if (!nodes.find(n => `focus-label-${n.item?.id || n.index}` === id)) {
        el.remove();
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
          this.mirroredNodesGroup.appendChild(el);
        }
        if (secOnNodeClick) {
          el.onclick = () => secOnNodeClick(node);
          el.style.cursor = 'pointer';
        } else {
          el.onclick = null;
          el.style.cursor = 'default';
        }
        el.setAttribute('cx', node.x);
        el.setAttribute('cy', node.y);
        const nodeRadius = node.radius;
        el.setAttribute('r', nodeRadius);
        el.dataset.index = node.index;

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
          el.remove();
        }
      });

      existingSecLabels.forEach((el, id) => {
        if (!secNodes.find(n => `secondary-label-${n.item?.id || n.index}` === id)) {
          el.remove();
        }
      });
    } else {
      if (this.mirroredNodesGroup) {
        this.mirroredNodesGroup.setAttribute('display', 'none');
      }
      if (this.mirroredLabelsGroup) {
        this.mirroredLabelsGroup.setAttribute('display', 'none');
      }
    }

    if (this.magnifierGroup && magnifier) {
      const radius = (magnifier.radius || 14);
      this.magnifierCircle.setAttribute('cx', magnifier.x);
      this.magnifierCircle.setAttribute('cy', magnifier.y);
      this.magnifierCircle.setAttribute('r', radius);
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
