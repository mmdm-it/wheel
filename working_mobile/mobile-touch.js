/**
 * Mobile Catalog Touch Rotation Handler
 * Manages touch interactions with momentum and bounds
 */

import { MOBILE_CONFIG } from './mobile-config.js';
import { Logger } from './mobile-logger.js';

/**
 * Handles touch rotation with momentum and snapping
 */
class TouchRotationHandler {
    constructor(onRotationChange, onRotationEnd) {
        this.onRotationChange = onRotationChange;
        this.onRotationEnd = onRotationEnd;
        
        // Rotation state
        this.rotationOffset = 0;
        this.isDragging = false;
        this.velocity = 0;
        this.lastTouch = { x: 0, y: 0 };
        this.animationId = null;
        
        // Bound handlers for cleanup
        this.boundHandlers = {
            touchStart: this.handleTouchStart.bind(this),
            touchMove: this.handleTouchMove.bind(this),
            touchEnd: this.handleTouchEnd.bind(this)
        };
        
        this.isActive = false;
        this.rotationLimits = { min: -Infinity, max: Infinity };
    }
    
    activate() {
        if (this.isActive) return;
        
        Logger.debug('Activating touch rotation controls');
        Object.entries(this.boundHandlers).forEach(([event, handler]) => {
            const eventName = event.replace(/([A-Z])/g, c => c.toLowerCase());
            document.addEventListener(eventName, handler, { passive: false });
        });
        
        this.isActive = true;
    }
    
    deactivate() {
        if (!this.isActive) return;
        
        Logger.debug('Deactivating touch rotation controls');
        Object.entries(this.boundHandlers).forEach(([event, handler]) => {
            const eventName = event.replace(/([A-Z])/g, c => c.toLowerCase());
            document.removeEventListener(eventName, handler);
        });
        
        this.stopAnimation();
        this.isActive = false;
    }
    
    setRotationLimits(min, max) {
        this.rotationLimits = { min, max };
        Logger.debug('Rotation limits set:', this.rotationLimits);
    }
    
    handleTouchStart(e) {
        if (!this.shouldHandleTouch(e)) return;
        
        e.preventDefault();
        this.isDragging = true;
        this.velocity = 0;
        
        const touch = e.touches[0];
        this.lastTouch = { x: touch.clientX, y: touch.clientY };
        
        this.stopAnimation();
        Logger.debug('Touch rotation started');
    }
    
    handleTouchMove(e) {
        if (!this.isDragging || e.touches.length !== 1) return;
        
        e.preventDefault();
        const touch = e.touches[0];
        const deltaX = touch.clientX - this.lastTouch.x;
        const deltaY = touch.clientY - this.lastTouch.y;
        
        // Convert movement to rotation
        const rotationDelta = -(deltaX + deltaY) * MOBILE_CONFIG.ROTATION.SENSITIVITY;
        const newOffset = this.constrainRotation(this.rotationOffset + rotationDelta);
        
        if (newOffset !== this.rotationOffset) {
            this.rotationOffset = newOffset;
            this.velocity = rotationDelta; // Store for momentum
            this.onRotationChange(this.rotationOffset);
        }
        
        this.lastTouch = { x: touch.clientX, y: touch.clientY };
    }
    
    handleTouchEnd(e) {
        if (!this.isDragging) return;
        
        e.preventDefault();
        this.isDragging = false;
        
        Logger.debug('Touch rotation ended, velocity:', this.velocity);
        
        if (Math.abs(this.velocity) > MOBILE_CONFIG.ROTATION.MIN_VELOCITY) {
            this.startMomentumAnimation();
        } else {
            this.snapToNearest();
        }
    }
    
    shouldHandleTouch(e) {
        if (e.touches.length !== 1) return false;
        
        // Check if touch is on a market button
        const touch = e.touches[0];
        const element = document.elementFromPoint(touch.clientX, touch.clientY);
        return !(element && (element.classList.contains('marketHitArea') || element.closest('.marketGroup')));
    }
    
    constrainRotation(offset) {
        // Validate inputs
        if (isNaN(offset)) {
            Logger.error(`Invalid offset to constrain: ${offset}`);
            return 0; // Safe fallback
        }
        if (isNaN(this.rotationLimits.min) || isNaN(this.rotationLimits.max)) {
            Logger.error(`Invalid rotation limits: min=${this.rotationLimits.min}, max=${this.rotationLimits.max}`);
            return offset; // Return unconstrained if limits are invalid
        }
        
        const constrained = Math.max(this.rotationLimits.min, Math.min(this.rotationLimits.max, offset));
        
        // Validate result
        if (isNaN(constrained)) {
            Logger.error(`Constraint calculation produced NaN: offset=${offset}, min=${this.rotationLimits.min}, max=${this.rotationLimits.max}`);
            return 0; // Safe fallback
        }
        
        return constrained;
    }
    
    startMomentumAnimation() {
        const animate = () => {
            this.velocity *= MOBILE_CONFIG.ROTATION.DECELERATION;
            
            // Check for detent snapping when velocity is low but not yet stopped
            if (Math.abs(this.velocity) < MOBILE_CONFIG.ROTATION.DETENT_VELOCITY) {
                this.stopAnimation();
                this.snapToNearest();
                return;
            }
            
            if (Math.abs(this.velocity) < MOBILE_CONFIG.ROTATION.MIN_VELOCITY) {
                this.stopAnimation();
                this.snapToNearest();
                return;
            }
            
            const newOffset = this.constrainRotation(this.rotationOffset + this.velocity);
            if (newOffset !== this.rotationOffset) {
                this.rotationOffset = newOffset;
                this.onRotationChange(this.rotationOffset);
            } else {
                // Hit a limit, stop momentum
                this.velocity = 0;
                this.stopAnimation();
                return;
            }
            
            this.animationId = requestAnimationFrame(animate);
        };
        
        this.animationId = requestAnimationFrame(animate);
    }
    
    snapToNearest() {
        if (this.onRotationEnd) {
            this.onRotationEnd(this.rotationOffset);
        }
    }
    
    stopAnimation() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
            
            // Notify that rotation has completely stopped
            if (this.onRotationEnd) {
                this.onRotationEnd(this.rotationOffset);
            }
        }
    }
    
    reset() {
        this.rotationOffset = 0;
        this.isDragging = false;
        this.velocity = 0;
        this.stopAnimation();
    }
}

export { TouchRotationHandler };