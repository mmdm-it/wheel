/**
 * NavigationView
 * Handles parent button visibility/label and parent line wiring for renderer.
 */
import { MOBILE_CONFIG } from './mobile-config.js';
import { Logger } from './mobile-logger.js';

class NavigationView {
    constructor(viewport) {
        this.viewport = viewport;
        this.parentButtonGroup = null;
        this.parentText = null;
        this.parentNodeCircle = null;
        this.pathLinesGroup = null;
        this._lastParentLinePosition = null;
        this._lastParentLineTime = null;
        this._lastParentButtonNuc = null;
        this._lastParentButtonAngle = null;
    }

    init() {
        this.parentButtonGroup = document.getElementById('parentButtonGroup');
        this.parentText = document.getElementById('parentText');
        this.parentNodeCircle = document.getElementById('parentNodeCircle');
        this.pathLinesGroup = document.getElementById('pathLinesGroup');

        if (!this.parentButtonGroup || !this.parentText || !this.parentNodeCircle) {
            Logger.warn('NavigationView: parent button elements missing');
            return false;
        }
        return true;
    }

    updateParentButton({ parentName, currentLevel, topNavLevel, skipAnimation = false, isRotating = false, isAnimating = false } = {}) {
        if (!this.parentButtonGroup || !this.parentText) return;

        if (!parentName) {
            this.hideParentButton(skipAnimation);
            return;
        }

        const isAtTopLevel = topNavLevel && currentLevel === topNavLevel;
        const shouldHideCircle = isAtTopLevel || currentLevel === null;

        const parentButtonNuc = this.positionParentButton();
        this.parentText.textContent = parentName;
        this.parentText.setAttribute('x', '0');
        this.parentText.setAttribute('y', '0');
        this.parentText.setAttribute('text-anchor', 'middle');

        this.parentButtonGroup.classList.remove('hidden');
        this.parentButtonGroup.style.display = '';
        this.parentButtonGroup.style.pointerEvents = isAtTopLevel ? 'none' : 'visiblePainted';
        this.parentText.style.pointerEvents = 'none';

        if (!skipAnimation) {
            this.parentButtonGroup.style.transition = 'transform 200ms ease-out, opacity 200ms ease-out';
            this.parentButtonGroup.style.opacity = '1';
        } else {
            this.parentButtonGroup.style.transition = '';
            this.parentButtonGroup.style.opacity = '';
        }

        if (this.parentNodeCircle) {
            this.parentNodeCircle.setAttribute('cx', '0');
            this.parentNodeCircle.setAttribute('cy', '0');
            this.parentNodeCircle.setAttribute('r', MOBILE_CONFIG.RADIUS.PARENT_BUTTON);

            if (shouldHideCircle) {
                this.parentNodeCircle.classList.add('hidden');
                this.parentNodeCircle.style.display = 'none';
                this.clearParentLine();
            } else {
                this.parentNodeCircle.classList.remove('hidden');
                this.parentNodeCircle.style.display = '';
            }
        }

        if (isAtTopLevel) {
            this.parentButtonGroup.classList.add('disabled');
            this.parentButtonGroup.setAttribute('data-disabled', 'true');
            this.parentText.style.display = 'none';
            this.parentButtonGroup.style.pointerEvents = 'none';
        } else {
            this.parentButtonGroup.classList.remove('disabled');
            this.parentButtonGroup.removeAttribute('data-disabled');
            this.parentText.style.display = '';
        }

        // Rotate text to align with button angle, mirroring when on left side
        const angleDeg = this._lastParentButtonAngle !== null ? (this._lastParentButtonAngle * 180) / Math.PI : 0;
        const correctedAngle = Math.cos(this._lastParentButtonAngle || 0) < 0 ? angleDeg + 180 : angleDeg;
        this.parentText.setAttribute('transform', `rotate(${correctedAngle.toFixed(2)}, 0, 0)`);

        this._lastParentButtonNuc = parentButtonNuc;

        if (!shouldHideCircle) {
            setTimeout(() => {
                this.drawParentLine({ isRotating, isAnimating });
            }, 20);
        }
    }

    hideParentButton(skipAnimation = false) {
        if (!this.parentButtonGroup) return;
        this.clearParentLine();
        this._lastParentButtonNuc = null;
        if (skipAnimation) {
            this.parentButtonGroup.classList.add('hidden');
            this.parentButtonGroup.style.opacity = '';
            this.parentButtonGroup.style.transition = '';
        } else {
            this.parentButtonGroup.style.transition = 'opacity 150ms ease-out';
            this.parentButtonGroup.style.opacity = '0';
            setTimeout(() => {
                if (this.parentButtonGroup) {
                    this.parentButtonGroup.classList.add('hidden');
                    this.parentButtonGroup.style.transition = '';
                }
            }, 160);
        }
    }

    positionParentButton() {
        if (!this.parentButtonGroup) return;
        const viewport = this.viewport.getViewportInfo();
        const arcParams = this.viewport.getArcParameters();
        const LSd = Math.max(viewport.width, viewport.height);
        const R = arcParams.radius;
        // Angle: 180° - arctan(LSd/R), Distance: 0.9 × sqrt(LSd² + R²)
        const parentButtonAngle = Math.PI - Math.atan(LSd / R);
        const parentButtonRadius = 0.9 * Math.sqrt(LSd * LSd + R * R);
        const x = arcParams.centerX + parentButtonRadius * Math.cos(parentButtonAngle);
        const y = arcParams.centerY + parentButtonRadius * Math.sin(parentButtonAngle);
        this.parentButtonGroup.setAttribute('transform', `translate(${x}, ${y})`);
        this._lastParentButtonNuc = { x, y };
        this._lastParentButtonAngle = parentButtonAngle;
        return this._lastParentButtonNuc;
    }

    drawParentLine({ isRotating = false, isAnimating = false } = {}) {
        if (isRotating || isAnimating) return;
        if (!this.pathLinesGroup || !this._lastParentButtonNuc) return;

        const parentButtonNuc = this._lastParentButtonNuc;
        const positionKey = `${parentButtonNuc.x.toFixed(1)}_${parentButtonNuc.y.toFixed(1)}`;
        const existingLine = this.pathLinesGroup.querySelector('.parent-line');
        const now = performance.now();
        if (existingLine && this._lastParentLinePosition === positionKey && this._lastParentLineTime && now - this._lastParentLineTime < 100) {
            return;
        }
        this._lastParentLinePosition = positionKey;
        this._lastParentLineTime = now;

        if (!this.parentNodeCircle || this.parentNodeCircle.classList.contains('hidden') || this.parentNodeCircle.style.display === 'none') {
            return;
        }

        this.clearParentLine(false);

        const magnifierPos = this.viewport.getMagnifyingRingPosition();
        if (!magnifierPos) {
            Logger.warn('NavigationView: No magnifier position available for parent line');
            return;
        }

        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('class', 'parent-line');
        line.setAttribute('x1', parentButtonNuc.x);
        line.setAttribute('y1', parentButtonNuc.y);
        line.setAttribute('x2', magnifierPos.x);
        line.setAttribute('y2', magnifierPos.y);
        line.setAttribute('stroke', 'black');
        line.setAttribute('stroke-width', '1');
        this.pathLinesGroup.appendChild(line);
    }

    clearParentLine(resetDebounce = true) {
        if (!this.pathLinesGroup) return;
        const existingLine = this.pathLinesGroup.querySelector('.parent-line');
        if (existingLine) {
            existingLine.remove();
        }
        if (resetDebounce) {
            this._lastParentLinePosition = null;
            this._lastParentLineTime = null;
        }
    }
}

export { NavigationView };
