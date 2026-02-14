// Pure helper to convert pyramid placements into renderable instructions.
// Keeps view consumption data-agnostic: placements -> drawable circles/labels.

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

    this.pyramidNodesGroup = this.doc.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.pyramidNodesGroup.setAttribute('class', 'child-pyramid-nodes');

    this.pyramidLabelsGroup = this.doc.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.pyramidLabelsGroup.setAttribute('class', 'child-pyramid-labels');

    this.pyramidGroup.appendChild(this.pyramidFanLinesGroup);
    this.pyramidGroup.appendChild(this.pyramidSpiralGroup);
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
    if (!data) {
      this.pyramidGroup.setAttribute('display', 'none');
      this.#clear(this.pyramidFanLinesGroup);
      this.#clear(this.pyramidSpiralGroup);
      this.#clear(this.pyramidNodesGroup);
      this.#clear(this.pyramidLabelsGroup);
      return;
    }

    const { fanLines = [], spiral, intersections = [], nodes = [] } = data;
    this.pyramidGroup.removeAttribute('display');
    this.#clear(this.pyramidFanLinesGroup);
    this.#clear(this.pyramidSpiralGroup);
    this.#clear(this.pyramidNodesGroup);
    this.#clear(this.pyramidLabelsGroup);

    fanLines.forEach(line => {
      const el = this.doc.createElementNS('http://www.w3.org/2000/svg', 'line');
      el.setAttribute('class', 'child-pyramid-fan-line');
      el.setAttribute('x1', line.x1);
      el.setAttribute('y1', line.y1);
      el.setAttribute('x2', line.x2);
      el.setAttribute('y2', line.y2);
      el.setAttribute('stroke', 'black');
      el.setAttribute('stroke-width', '1');
      this.pyramidFanLinesGroup.appendChild(el);
    });

    if (spiral?.path) {
      const path = this.doc.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('class', 'child-pyramid-spiral');
      path.setAttribute('d', spiral.path);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', 'black');
      path.setAttribute('stroke-width', '1');
      this.pyramidSpiralGroup.appendChild(path);
    }

    // Only show red X intersection markers when no child nodes are present.
    // When nodes exist, they occupy the intersection slots directly.
    if (nodes.length === 0) {
      intersections.forEach(hit => {
        const size = 9;
        const half = size / 2;
        const line1 = this.doc.createElementNS('http://www.w3.org/2000/svg', 'line');
        line1.setAttribute('x1', hit.x - half);
        line1.setAttribute('y1', hit.y - half);
        line1.setAttribute('x2', hit.x + half);
        line1.setAttribute('y2', hit.y + half);
        line1.setAttribute('stroke', 'red');
        line1.setAttribute('stroke-width', '2');
        const line2 = this.doc.createElementNS('http://www.w3.org/2000/svg', 'line');
        line2.setAttribute('x1', hit.x - half);
        line2.setAttribute('y1', hit.y + half);
        line2.setAttribute('x2', hit.x + half);
        line2.setAttribute('y2', hit.y - half);
        line2.setAttribute('stroke', 'red');
        line2.setAttribute('stroke-width', '2');
        this.pyramidSpiralGroup.appendChild(line1);
        this.pyramidSpiralGroup.appendChild(line2);
      });
    }

    // Render child nodes at intersection/placement positions.
    this.#clear(this.pyramidNodesGroup);
    this.#clear(this.pyramidLabelsGroup);

    if (Array.isArray(nodes) && nodes.length > 0) {
      this.pyramidNodesGroup.removeAttribute('display');
      this.pyramidLabelsGroup.removeAttribute('display');
      const onNodeClick = data.onNodeClick ?? null;
      nodes.forEach(instr => {
        const circle = this.doc.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('class', 'child-pyramid-node');
        circle.setAttribute('cx', instr.x);
        circle.setAttribute('cy', instr.y);
        circle.setAttribute('r', instr.r);
        circle.setAttribute('role', 'button');
        circle.setAttribute('tabindex', '0');
        if (instr.label) circle.setAttribute('aria-label', instr.label);
        if (onNodeClick) {
          circle.style.cursor = 'pointer';
          circle.onclick = () => onNodeClick(instr);
          circle.onkeydown = evt => {
            if (evt.key === 'Enter' || evt.key === ' ') {
              evt.preventDefault();
              onNodeClick(instr);
            }
          };
        }
        this.pyramidNodesGroup.appendChild(circle);

        const label = this.doc.createElementNS('http://www.w3.org/2000/svg', 'text');
        label.setAttribute('class', 'child-pyramid-label');
        label.setAttribute('x', instr.x);
        label.setAttribute('y', instr.y - instr.r - 4);
        label.setAttribute('text-anchor', 'middle');
        label.setAttribute('dominant-baseline', 'auto');
        label.textContent = instr.label || '';
        this.pyramidLabelsGroup.appendChild(label);
      });
    } else {
      this.pyramidNodesGroup.setAttribute('display', 'none');
      this.pyramidLabelsGroup.setAttribute('display', 'none');
    }
  }
}
