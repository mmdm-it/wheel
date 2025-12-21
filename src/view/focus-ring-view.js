export class FocusRingView {
  constructor(svgRoot) {
    this.svgRoot = svgRoot;
    this.nodesGroup = null;
    this.labelsGroup = null;
    this.magnifierGroup = null;
    this.magnifierCircle = null;
    this.magnifierLabel = null;
    this.band = null;
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

  render(nodes, arcParams, viewportWindow, magnifier) {
    if (!this.nodesGroup) return;
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
      label.setAttribute('x', lx);
      label.setAttribute('y', ly);
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('dominant-baseline', 'middle');
      const rotation = (node.angle * 180) / Math.PI + 180; // 90° more to flip vertical
      label.setAttribute('transform', `rotate(${rotation}, ${lx}, ${ly})`);
      label.textContent = (node.item.name || '').toUpperCase();
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

    if (this.magnifierGroup && magnifier) {
      const radius = (magnifier.radius || 14);
      this.magnifierCircle.setAttribute('cx', magnifier.x);
      this.magnifierCircle.setAttribute('cy', magnifier.y);
      this.magnifierCircle.setAttribute('r', radius);
      this.magnifierLabel.setAttribute('x', magnifier.x);
      this.magnifierLabel.setAttribute('y', magnifier.y);
      const magRotation = ((magnifier.angle || 0) * 180) / Math.PI + 180;
      this.magnifierLabel.setAttribute('transform', `rotate(${magRotation}, ${magnifier.x}, ${magnifier.y})`);
      this.magnifierLabel.textContent = (magnifier.label || '').toUpperCase();
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
}
