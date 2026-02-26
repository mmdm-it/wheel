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
    this._onNodeClick = null;     // current click callback
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

    // Draw fan lines provided by geometry.
    fanLines.forEach(fl => {
      const line = this.doc.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('class', 'child-pyramid-fan-line');
      line.setAttribute('x1', fl.x1);
      line.setAttribute('y1', fl.y1);
      line.setAttribute('x2', fl.x2);
      line.setAttribute('y2', fl.y2);
      this.pyramidFanLinesGroup.appendChild(line);
    });

    // Draw spiral path and intersection markers.
    if (spiral?.path) {
      const path = this.doc.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('class', 'child-pyramid-spiral');
      path.setAttribute('d', spiral.path);
      this.pyramidSpiralGroup.appendChild(path);
    }

    intersections.forEach((pt, idx) => {
      const marker = this.doc.createElementNS('http://www.w3.org/2000/svg', 'circle');
      marker.setAttribute('class', 'child-pyramid-intersection');
      marker.setAttribute('cx', pt.x);
      marker.setAttribute('cy', pt.y);
      marker.setAttribute('r', 2);
      this.pyramidSpiralGroup.appendChild(marker);

      const text = this.doc.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('class', 'child-pyramid-intersection-label');
      text.setAttribute('x', pt.x + 3);
      text.setAttribute('y', pt.y - 3);
      text.textContent = String(idx + 1);
      this.pyramidSpiralGroup.appendChild(text);
    });

    // Nodes are intentionally hidden in this rendering mode.
    this.#clear(this.pyramidNodesGroup);
    this.#clear(this.pyramidLabelsGroup);
    this.pyramidNodesGroup.setAttribute('display', 'none');
    this.pyramidLabelsGroup.setAttribute('display', 'none');
  }
}
