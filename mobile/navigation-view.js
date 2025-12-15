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
    }

    init() {
        this.parentButtonGroup = document.getElementById('parentButtonGroup');
        this.parentText = document.getElementById('parentText');
        this.parentNodeCircle = document.getElementById('parentNodeCircle');

        if (!this.parentButtonGroup || !this.parentText || !this.parentNodeCircle) {
            Logger.warn('NavigationView: parent button elements missing');
            return false;
        }
        return true;
    }

    updateParentButton(parentName, skipAnimation = false) {
        if (!this.parentButtonGroup || !this.parentText) return;

        if (!parentName) {
            this.hideParentButton(skipAnimation);
            return;
        }

        this.parentText.textContent = parentName;
        this.parentButtonGroup.classList.remove('hidden');

        if (!skipAnimation) {
            this.parentButtonGroup.style.transition = 'transform 200ms ease-out, opacity 200ms ease-out';
            this.parentButtonGroup.style.opacity = '1';
        } else {
            this.parentButtonGroup.style.transition = '';
            this.parentButtonGroup.style.opacity = '';
        }
    }

    hideParentButton(skipAnimation = false) {
        if (!this.parentButtonGroup) return;
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
    }
}

export { NavigationView };
