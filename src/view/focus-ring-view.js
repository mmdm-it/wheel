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

    this.pyramidGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.pyramidGroup.setAttribute('class', 'child-pyramid');
    this.pyramidFanLinesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.pyramidFanLinesGroup.setAttribute('class', 'child-pyramid-fan-lines');
    this.pyramidNodesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.pyramidNodesGroup.setAttribute('class', 'child-pyramid-nodes');
    this.pyramidLabelsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.pyramidLabelsGroup.setAttribute('class', 'child-pyramid-labels');
    this.pyramidGroup.appendChild(this.pyramidFanLinesGroup);
    this.pyramidGroup.appendChild(this.pyramidNodesGroup);
    this.pyramidGroup.appendChild(this.pyramidLabelsGroup);
    this.blurGroup.appendChild(this.pyramidGroup);
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
    const pyramidInstructions = Array.isArray(options.pyramidInstructions) ? options.pyramidInstructions : null;
    const onPyramidClick = options.onPyramidClick;
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
    if (this.blurGroup && this.svgRoot) {
      // Keep layering: base blur content, then mirrored band, then dimension icon
      this.svgRoot.appendChild(this.blurGroup);
      if (this.mirrorLayer) this.svgRoot.appendChild(this.mirrorLayer);
      if (this.dimensionIcon) this.svgRoot.appendChild(this.dimensionIcon);
    }

    // Render child pyramid nodes/labels if provided
    if (this.pyramidGroup && this.pyramidFanLinesGroup && this.pyramidNodesGroup && this.pyramidLabelsGroup) {
      console.log('[FocusRingView] pyramidInstructions:', pyramidInstructions ? `${pyramidInstructions.length} nodes` : 'null/empty');
      if (!pyramidInstructions || pyramidInstructions.length === 0) {
        this.pyramidGroup.setAttribute('display', 'none');
        while (this.pyramidFanLinesGroup.firstChild) this.pyramidFanLinesGroup.removeChild(this.pyramidFanLinesGroup.firstChild);
        while (this.pyramidNodesGroup.firstChild) this.pyramidNodesGroup.removeChild(this.pyramidNodesGroup.firstChild);
        while (this.pyramidLabelsGroup.firstChild) this.pyramidLabelsGroup.removeChild(this.pyramidLabelsGroup.firstChild);
      } else {
        this.pyramidGroup.removeAttribute('display');
        while (this.pyramidFanLinesGroup.firstChild) this.pyramidFanLinesGroup.removeChild(this.pyramidFanLinesGroup.firstChild);
        while (this.pyramidNodesGroup.firstChild) this.pyramidNodesGroup.removeChild(this.pyramidNodesGroup.firstChild);
        while (this.pyramidLabelsGroup.firstChild) this.pyramidLabelsGroup.removeChild(this.pyramidLabelsGroup.firstChild);
        
        // Draw 72 fan lines radiating from magnifier center, 5 degrees apart
        // Only draw lines that intersect the CPUA
        console.log('[FocusRingView] magnifier for fan lines:', magnifier);
        if (magnifier && (magnifier.cx != null || magnifier.x != null) && (magnifier.cy != null || magnifier.y != null)) {
          const magnifierX = magnifier.cx ?? magnifier.x;
          const magnifierY = magnifier.cy ?? magnifier.y;
          const lineCount = 96;
          const angleDelta = 3.75; // degrees
          const angleDeltaRad = (angleDelta * Math.PI) / 180;
          // Aim first fan line at spiral origin so it intersects the spiral start
          const spiralOriginX = (options.viewport.width || 0) / 2 + ((options.viewport.width || 0) * 0.1);
          const spiralOriginY = (options.viewport.SSd || Math.min(options.viewport.width || 0, options.viewport.height || 0)) * 0.03 +
            Math.min(options.viewport.height || 0, (magnifier.cy ?? magnifier.y ?? 0) - (1.5 * (options.viewport.SSd || Math.min(options.viewport.width || 0, options.viewport.height || 0)) * 0.060)) / 2;
          const startAngleRad = Math.atan2(spiralOriginY - magnifierY, spiralOriginX - magnifierX);
          const lineLength = options.viewport?.LSd || 1000; // Use LSd (longer side dimension)
          
          // Calculate CPUA bounds (same logic as child-pyramid.js)
          const SSd = options.viewport?.SSd || Math.min(options.viewport?.width || 0, options.viewport?.height || 0);
          const topMargin = SSd * 0.03;
          const rightMargin = SSd * 0.03;
          const cpuaLeftX = 0;
          const cpuaTopY = topMargin;
          const cpuaRightXFull = (options.viewport?.width || 0) - rightMargin;
          const magnifierRadius = SSd * 0.060;
          const cpuaBottomY = Math.min(options.viewport?.height || 0, magnifierY - (4 * magnifierRadius));

          const logoBounds = options.logoBounds || null;
          // For fan-line clipping, use full right edge and subtract logo cutout separately
          const cpuaRightX = cpuaRightXFull;

          // Clip fan lines to CPUA (rectangle ∩ focus-ring clip circle) minus logo cutout
          const clipCenterX = arcParams?.hubX ?? (options.viewport?.width || 0) / 2;
          const clipCenterY = arcParams?.hubY ?? 0;
          const clipRadius = (arcParams?.radius ?? options.viewport?.SSd ?? 0) * 0.98;

          const segmentIntervalRect = (x1, y1, x2, y2, left, right, top, bottom) => {
            const dx = x2 - x1;
            const dy = y2 - y1;
            let t0 = 0;
            let t1 = 1;
            const p = [-dx, dx, -dy, dy];
            const q = [x1 - left, right - x1, y1 - top, bottom - y1];
            for (let i = 0; i < 4; i++) {
              const pi = p[i];
              const qi = q[i];
              if (pi === 0) {
                if (qi < 0) return null;
                continue;
              }
              const t = qi / pi;
              if (pi < 0) {
                if (t > t1) return null;
                if (t > t0) t0 = t;
              } else {
                if (t < t0) return null;
                if (t < t1) t1 = t;
              }
            }
            return { t0, t1 };
          };

          const segmentIntervalCircle = (x1, y1, x2, y2) => {
            if (!(clipRadius > 0)) return { t0: 0, t1: 1 };
            const dx = x2 - x1;
            const dy = y2 - y1;
            const fx = x1 - clipCenterX;
            const fy = y1 - clipCenterY;
            const a = dx * dx + dy * dy;
            if (a === 0) return null;
            const b = 2 * (fx * dx + fy * dy);
            const c = fx * fx + fy * fy - clipRadius * clipRadius;
            if (c <= 0) return { t0: 0, t1: 1 };
            const disc = b * b - 4 * a * c;
            if (disc < 0) return null;
            const sqrt = Math.sqrt(disc);
            let t0 = (-b - sqrt) / (2 * a);
            let t1 = (-b + sqrt) / (2 * a);
            if (t0 > t1) [t0, t1] = [t1, t0];
            const enter = Math.max(0, t0);
            const exit = Math.min(1, t1);
            if (exit < 0 || enter > 1) return null;
            return { t0: enter, t1: exit };
          };

          const intersectIntervals = (a, b) => {
            if (!a || !b) return null;
            const t0 = Math.max(a.t0, b.t0, 0);
            const t1 = Math.min(a.t1, b.t1, 1);
            return t1 >= t0 ? { t0, t1 } : null;
          };

          const subtractLogoInterval = (baseInterval, logoInterval) => {
            if (!baseInterval) return [];
            if (!logoInterval) return [baseInterval];
            const { t0, t1 } = baseInterval;
            const { t0: l0, t1: l1 } = logoInterval;
            const segments = [];
            if (l1 <= t0 || l0 >= t1) return [baseInterval];
            if (l0 > t0) segments.push({ t0, t1: Math.min(l0, t1) });
            if (l1 < t1) segments.push({ t0: Math.max(l1, t0), t1 });
            return segments.filter(seg => seg.t1 > seg.t0);
          };

          const getCpuAIntersection = (x1, y1, x2, y2) => {
            const rectInterval = segmentIntervalRect(x1, y1, x2, y2, cpuaLeftX, cpuaRightX, cpuaTopY, cpuaBottomY);
            const circleInterval = segmentIntervalCircle(x1, y1, x2, y2);
            const base = intersectIntervals(rectInterval, circleInterval);
            if (!base) return null;
            const logoInterval = logoBounds
              ? segmentIntervalRect(x1, y1, x2, y2, logoBounds.left, logoBounds.right, logoBounds.top, logoBounds.bottom)
              : null;
            const candidates = subtractLogoInterval(base, logoInterval);
            if (!candidates.length) return null;
            // Choose the farthest-visible intersection so rays can extend to the rightmost legal point
            const best = candidates.reduce((acc, cur) => (cur.t1 > acc.t1 ? cur : acc), candidates[0]);
            const { t1 } = best;
            return {
              x: x1 + (x2 - x1) * t1,
              y: y1 + (y2 - y1) * t1
            };
          };

          console.log('[FocusRingView] CPUA inputs:', {
            viewportWidth: options.viewport?.width,
            viewportHeight: options.viewport?.height,
            SSd,
            topMargin,
            rightMargin,
            cpuaRightXFull,
            cpuaRightX,
            clipCenterX,
            clipCenterY,
            clipRadius,
            logoBounds
          });
          console.log(`[FocusRingView] CPUA bounds: (${cpuaLeftX}, ${cpuaTopY}) to (${cpuaRightX}, ${cpuaBottomY})`);
          console.log(`[FocusRingView] Drawing up to ${lineCount} fan lines from (${magnifierX.toFixed(1)}, ${magnifierY.toFixed(1)})`);

          let drawnCount = 0;
          const fanLineSegments = [];
          const fanLineEnds = [];
          for (let i = 0; i < lineCount; i++) {
            const angleRad = startAngleRad + i * angleDeltaRad;
            const endX = magnifierX + Math.cos(angleRad) * lineLength;
            const endY = magnifierY + Math.sin(angleRad) * lineLength;

            const clipPoint = getCpuAIntersection(magnifierX, magnifierY, endX, endY);
            if (clipPoint) {
              const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
              line.setAttribute('class', 'child-pyramid-fan-line');
              line.setAttribute('x1', magnifierX);
              line.setAttribute('y1', magnifierY);
              line.setAttribute('x2', clipPoint.x);
              line.setAttribute('y2', clipPoint.y);
              line.setAttribute('stroke', 'black');
              line.setAttribute('stroke-width', '1');
              this.pyramidFanLinesGroup.appendChild(line);
              drawnCount++;
              fanLineEnds.push({ i, x: clipPoint.x, y: clipPoint.y });
              fanLineSegments.push({ id: i, x1: magnifierX, y1: magnifierY, x2: clipPoint.x, y2: clipPoint.y });
            }
          }
          console.log(`[FocusRingView] Drew ${drawnCount} of ${lineCount} fan lines (filtered by CPUA intersection)`);
          if (fanLineEnds.length) {
            const xs = fanLineEnds.map(p => p.x);
            const maxX = Math.max(...xs);
            console.log('[FocusRingView] Fan line end x-coordinates:', fanLineEnds.map(p => `${p.i}:${p.x.toFixed(1)}`).join(', '));
            console.log(`[FocusRingView] Max fan line end x = ${maxX.toFixed(1)}, CPUA right = ${cpuaRightX.toFixed(1)}, full right = ${cpuaRightXFull.toFixed(1)}`);
          }
          this._fanLineSegments = fanLineSegments;
        }
        
        // Draw a true Archimedean spiral (no node rendering), unconstrained by CPUA
        if (options.viewport) {
          const fanLineSegments = this._fanLineSegments || [];
          const SSdLocal = options.viewport.SSd || Math.min(options.viewport.width || 0, options.viewport.height || 0);
          const expansionRate = (() => {
            if (typeof window !== 'undefined' && typeof window.getSpiralConfig === 'function') {
              const cfg = window.getSpiralConfig();
              if (cfg && typeof cfg.expansionRate === 'number') return cfg.expansionRate;
            }
            if (typeof options.spiralExpansion === 'number') return options.spiralExpansion;
            return 0.005; // fallback
          })();
          const b = expansionRate * SSdLocal; // r = b * theta
          const spiralCenterAngle = (magnifierAngle + Math.PI) / 2;

          // Keep origin consistent with pyramid logic: CPUA-based center with 10% right shift
          const topMarginLocal = SSdLocal * 0.03;
          const rightMarginLocal = SSdLocal * 0.03;
          const cpuaLeftLocal = 0;
          const cpuaRightLocal = (options.viewport.width || 0) - rightMarginLocal;
          const magnifierRadiusLocal = SSdLocal * 0.060;
          const magnifierYLocal = magnifier?.cy ?? magnifier?.y ?? 0;
          const cpuaBottomLocal = Math.min(options.viewport.height || 0, magnifierYLocal - (4 * magnifierRadiusLocal));
          const cpuaTopLocal = topMarginLocal;
          const spiralCenterX = (cpuaLeftLocal + cpuaRightLocal) / 2 + ((cpuaRightLocal - cpuaLeftLocal) * 0.1);
          const spiralCenterY = (cpuaTopLocal + cpuaBottomLocal) / 2;

          const points = [];
          let theta = 0; // start at origin
          const step = 0.03; // radians; small step for smoothness
          const maxR = Math.max(options.viewport.width || 0, options.viewport.height || 0) * 1.5;
          const maxTheta = maxR / Math.max(b, 1e-6);
          while (theta <= maxTheta) {
            const r = b * theta;
            const x = spiralCenterX + r * Math.cos(spiralCenterAngle + theta);
            const y = spiralCenterY + r * Math.sin(spiralCenterAngle + theta);
            points.push({ x, y });
            theta += step;
          }

          if (points.length > 1) {
            let d = `M ${points[0].x} ${points[0].y}`;
            for (let i = 1; i < points.length; i++) {
              d += ` L ${points[i].x} ${points[i].y}`;
            }
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('class', 'child-pyramid-spiral');
            path.setAttribute('d', d);
            path.setAttribute('fill', 'none');
            path.setAttribute('stroke', 'black');
            path.setAttribute('stroke-width', '1');
            this.pyramidNodesGroup.appendChild(path);

            // Mark intersections between spiral segments and fan lines with red X
            const intersectSegments = (a, b) => {
              const { x1, y1, x2, y2 } = a;
              const { x1: x3, y1: y3, x2: x4, y2: y4 } = b;
              const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
              if (denom === 0) return null;
              const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom; // along spiral segment
              const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom; // along fan line
              if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
                return {
                  x: x1 + t * (x2 - x1),
                  y: y1 + t * (y2 - y1),
                  t,
                  u
                };
              }
              return null;
            };

            const drawX = (x, y, size = 9) => {
              const half = size / 2;
              const line1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
              line1.setAttribute('x1', x - half);
              line1.setAttribute('y1', y - half);
              line1.setAttribute('x2', x + half);
              line1.setAttribute('y2', y + half);
              line1.setAttribute('stroke', 'red');
              line1.setAttribute('stroke-width', '2');
              const line2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
              line2.setAttribute('x1', x - half);
              line2.setAttribute('y1', y + half);
              line2.setAttribute('x2', x + half);
              line2.setAttribute('y2', y - half);
              line2.setAttribute('stroke', 'red');
              line2.setAttribute('stroke-width', '2');
              this.pyramidLabelsGroup.appendChild(line1);
              this.pyramidLabelsGroup.appendChild(line2);
            };

            const pendingFans = new Set(fanLineSegments.map(f => f.id));
            const hits = [];
            const nodeRadiusLocal = 0.04 * SSdLocal;
            const minHitDistance = nodeRadiusLocal * 4; // 4× node radius

            for (let i = 1; i < points.length && pendingFans.size > 0; i++) {
              const segSpiral = { x1: points[i - 1].x, y1: points[i - 1].y, x2: points[i].x, y2: points[i].y };
              fanLineSegments.forEach(segFan => {
                if (!pendingFans.has(segFan.id)) return;
                const hit = intersectSegments(segSpiral, segFan);
                if (hit) {
                  const tooClose = hits.some(h => {
                    const dx = h.x - hit.x;
                    const dy = h.y - hit.y;
                    return Math.hypot(dx, dy) < minHitDistance;
                  });
                  if (!tooClose) {
                    // accept hit and retire this fan line
                    hits.push(hit);
                    pendingFans.delete(segFan.id);
                  }
                  // if too close, keep fan line pending for a later intersection
                }
              });
            }

            hits.forEach(hit => drawX(hit.x, hit.y, 9));
          }
        }
      }
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
