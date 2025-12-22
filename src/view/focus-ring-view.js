export class FocusRingView {
  constructor(svgRoot) {
    this.svgRoot = svgRoot;
    this.nodesGroup = null;
    this.labelsGroup = null;
    this.magnifierGroup = null;
    this.magnifierCircle = null;
    this.magnifierLabel = null;
    this.band = null;
    this.loggedFontSizes = false;
    this.loggedComputedFonts = false;
  }

  init() {
    if (!this.svgRoot) return;
    this.band = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    this.band.setAttribute('class', 'focus-ring-band');
    this.svgRoot.appendChild(this.band);

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
    this.svgRoot.appendChild(this.magnifierGroup);

    this.nodesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.nodesGroup.setAttribute('class', 'focus-ring-nodes');
    this.svgRoot.appendChild(this.nodesGroup);
    this.labelsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.labelsGroup.setAttribute('class', 'focus-ring-labels');
    this.svgRoot.appendChild(this.labelsGroup);
  }

  render(nodes, arcParams, viewportWindow, magnifier, options = {}) {
    if (!this.nodesGroup) return;
    const isRotating = Boolean(options.isRotating);
    const magnifierAngle = options.magnifierAngle;
    const labelMaskEpsilon = options.labelMaskEpsilon ?? 0.0001;
    // Ensure magnifier group is on top for proper z-ordering
    if (this.magnifierGroup?.parentNode === this.svgRoot) {
      this.svgRoot.appendChild(this.magnifierGroup);
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
        this.nodesGroup.appendChild(el);
      }
      el.setAttribute('cx', node.x);
      el.setAttribute('cy', node.y);
      el.setAttribute('r', node.radius || 10);
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
      const offset = (node.radius || 10) + 8;
      const lx = node.x + Math.cos(node.angle) * offset;
      const ly = node.y + Math.sin(node.angle) * offset;
      const nodeBaseFont = (node.radius || 10) * 1.4;
      const fontSize = nodeBaseFont * 0.78; // slightly smaller than magnifier
      label.setAttribute('x', lx);
      label.setAttribute('y', ly);
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('dominant-baseline', 'middle');
      label.setAttribute('font-size', `${fontSize}px`);
      const rotation = (node.angle * 180) / Math.PI + 180; // 90° more to flip vertical
      label.setAttribute('transform', `rotate(${rotation}, ${lx}, ${ly})`);
      const showNodeLabel = isRotating || !this.#isNearMagnifier(node.angle, magnifierAngle, labelMaskEpsilon);
      label.textContent = showNodeLabel ? (node.item.name || '').toUpperCase() : '';
    });

    if (!this.loggedFontSizes && nodes.length) {
      const radii = nodes.map(n => n.radius || 10);
      const nodeFontSizes = radii.map(r => (r * 1.4) * 0.78);
      const magRadius = magnifier?.radius || 0;
      const referenceRadius = radii[0] || magRadius || 10;
      const magFont = referenceRadius * 1.4; // magnifier matches pre-reduction node size
      console.log('[FocusRing] font sizing', {
        nodes: nodes.length,
        radii: { min: Math.min(...radii).toFixed(2), max: Math.max(...radii).toFixed(2) },
        nodeFontsPx: { min: Math.min(...nodeFontSizes).toFixed(2), max: Math.max(...nodeFontSizes).toFixed(2) },
        magnifier: { radius: magRadius.toFixed?.(2) ?? magRadius, fontPx: magFont.toFixed?.(2) ?? magFont }
      });
      this.loggedFontSizes = true;
    }

    if (!this.loggedComputedFonts && nodes.length && this.magnifierLabel) {
      // Defer to ensure styles applied
      requestAnimationFrame(() => {
        try {
          const firstLabel = this.labelsGroup?.querySelector('text');
          const nodeStyle = firstLabel ? getComputedStyle(firstLabel) : null;
          const magStyle = getComputedStyle(this.magnifierLabel);
          console.log('[FocusRing] computed font sizes', {
            nodeAttr: firstLabel?.getAttribute('font-size'),
            nodeComputed: nodeStyle?.fontSize,
            magAttr: this.magnifierLabel.getAttribute('font-size'),
            magComputed: magStyle?.fontSize
          });
        } catch (err) {
          console.log('[FocusRing] computed font sizes error', err);
        }
      });
      this.loggedComputedFonts = true;
    }

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

    if (this.magnifierGroup && magnifier) {
      const radius = (magnifier.radius || 14);
      this.magnifierCircle.setAttribute('cx', magnifier.x);
      this.magnifierCircle.setAttribute('cy', magnifier.y);
      this.magnifierCircle.setAttribute('r', radius);
      if (isRotating) {
        this.magnifierCircle.setAttribute('fill', 'none');
        this.magnifierCircle.setAttribute('stroke', '#000');
        this.magnifierCircle.setAttribute('stroke-width', '1');
        this.magnifierCircle.style.fill = 'none';
        this.magnifierCircle.style.stroke = '#000';
        this.magnifierCircle.style.strokeWidth = '1px';
      } else {
        this.magnifierCircle.setAttribute('fill', 'var(--color-nodes)');
        this.magnifierCircle.setAttribute('stroke', '#000');
        this.magnifierCircle.setAttribute('stroke-width', '1');
        this.magnifierCircle.style.fill = 'var(--color-nodes)';
        this.magnifierCircle.style.stroke = '#000';
        this.magnifierCircle.style.strokeWidth = '1px';
      }
      this.magnifierLabel.setAttribute('x', magnifier.x);
      this.magnifierLabel.setAttribute('y', magnifier.y);
      const nodeReferenceRadius = nodes.find(n => n.radius)?.radius || radius || 10;
      const magFontSize = nodeReferenceRadius * 1.4; // match node base font size
      this.magnifierLabel.setAttribute('font-size', `${magFontSize}px`);
      const magRotation = ((magnifier.angle || 0) * 180) / Math.PI + 180;
      this.magnifierLabel.setAttribute('transform', `rotate(${magRotation}, ${magnifier.x}, ${magnifier.y})`);
      if (isRotating) {
        this.magnifierLabel.textContent = '';
        this.magnifierGroup.setAttribute('data-rotating', 'true');
      } else {
        this.magnifierLabel.textContent = (magnifier.label || '').toUpperCase();
        this.magnifierGroup.removeAttribute('data-rotating');
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
