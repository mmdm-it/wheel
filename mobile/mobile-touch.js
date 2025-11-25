/**
 * Mobile Catalog Touch Rotation Handler
 * Manages touch interactions with momentum and bounds
 */

// Debug flag - set to false to disable verbose console logging
const DEBUG_VERBOSE = false;

import { MOBILE_CONFIG } from './mobile-config.js';
import { Logger } from './mobile-logger.js';
import { CoordinateSystem, HubNucCoordinate } from './mobile-coordinates.js';

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
        
        // Dynamic rotation state
        this.gestureDistance = 0;
        this.lastTimeStamp = 0;
        
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
        // Skip if temporarily disabled (e.g., during immediate settlement)
        if (this.tempDisabled) {
            Logger.debug('Touch handling temporarily disabled');
            return;
        }
        
        // Don't prevent default immediately - let clicks work
        // Only prevent default when we detect actual dragging
        this.isDragging = false; // Start as false, will become true on first move
        this.velocity = 0;
        this.startTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        
        // Reset dynamic rotation tracking
        this.gestureDistance = 0;
        this.lastTimeStamp = e.timeStamp || performance.now();
        
        const touch = e.touches[0];
        this.lastTouch = { x: touch.clientX, y: touch.clientY };
        
        this.stopAnimation();
        Logger.debug('Touch rotation prepared');
    }
    
    handleTouchMove(e) {
        if (e.touches.length !== 1) return;
        
        // Defensive: if touch tracking not initialized (touchStart was skipped), ignore this move
        if (!this.lastTouch || this.lastTouch.x === undefined) return;
        if (!this.startTouch || this.startTouch.x === undefined) return;
        
        const touch = e.touches[0];
        const deltaX = touch.clientX - this.lastTouch.x;
        const deltaY = touch.clientY - this.lastTouch.y;
        const currentTime = e.timeStamp || performance.now();
        const timeDelta = currentTime - this.lastTimeStamp;
        
        // Check if this is the first move and if movement is significant enough to start dragging
        if (!this.isDragging) {
            const totalDeltaX = touch.clientX - this.startTouch.x;
            const totalDeltaY = touch.clientY - this.startTouch.y;
            const totalMovement = Math.sqrt(totalDeltaX * totalDeltaX + totalDeltaY * totalDeltaY);
            
            // Only start dragging if movement exceeds threshold (prevents accidental drags during taps)
            if (totalMovement > 10) { // 10px threshold
                this.isDragging = true;
                e.preventDefault(); // Now prevent default since we're dragging
                Logger.debug('Touch rotation started (dragging detected)');
            } else {
                // Not enough movement yet, don't prevent default (allow clicks)
                this.lastTouch = { x: touch.clientX, y: touch.clientY };
                this.lastTimeStamp = currentTime;
                return;
            }
        } else {
            e.preventDefault(); // Continue preventing default during drag
        }
        
        // Accumulate gesture distance for scaling
        this.gestureDistance += Math.abs(deltaX) + Math.abs(deltaY);
        
        // Calculate instantaneous velocity (pixels per millisecond)
        const instantaneousVelocity = timeDelta > 0 ? Math.sqrt(deltaX * deltaX + deltaY * deltaY) / timeDelta : 0;
        
        // Apply hybrid scaling: combine distance and velocity
        let scaleFactor = 1.0;
        
        // Distance-based scaling (for large gestures)
        const distanceScale = this.gestureDistance > 100 
            ? Math.min(Math.pow(this.gestureDistance / 100, 1.2), 8)
            : 1.0;
        
        // Velocity-based scaling (for fast swipes)
        const velocityScale = instantaneousVelocity > 2 
            ? Math.min(instantaneousVelocity / 2, 6)
            : 1.0;
        
        // Use the higher of the two scales
        scaleFactor = Math.max(distanceScale, velocityScale);
        
        // Convert movement to rotation with dynamic scaling
        const baseRotationDelta = -(deltaX + deltaY) * MOBILE_CONFIG.ROTATION.SENSITIVITY;
        const rotationDelta = baseRotationDelta * scaleFactor;
        
        const newOffset = this.constrainRotation(this.rotationOffset + rotationDelta);
        
        if (newOffset !== this.rotationOffset) {
            this.rotationOffset = newOffset;
            this.velocity = rotationDelta; // Store scaled velocity for momentum
            this.onRotationChange(this.rotationOffset);
            
            if (scaleFactor > 1.0) {
                Logger.debug(`Dynamic rotation: distance=${this.gestureDistance.toFixed(0)}px, velocity=${instantaneousVelocity.toFixed(2)}, scale=${scaleFactor.toFixed(1)}x`);
            }
        }
        
        this.lastTouch = { x: touch.clientX, y: touch.clientY };
        this.lastTimeStamp = currentTime;
    }
    
    // Phase 3 Consolidation: Bilingual coordinate touch calculation method
    // Provides enhanced touch analysis using Hub/Nuc coordinate system
    calculateTouchRotationBilingual(touchStartX, touchStartY, touchCurrentX, touchCurrentY, viewport) {
        try {
            // Set up coordinate system with current viewport
            CoordinateSystem.setViewport({
                LSd: Math.max(viewport.width, viewport.height),
                SSd: Math.min(viewport.width, viewport.height)
            });
            
            // Convert screen coordinates to SVG coordinates (relative to viewport center)
            const svgStartX = touchStartX - viewport.center.x;
            const svgStartY = touchStartY - viewport.center.y;
            const svgCurrentX = touchCurrentX - viewport.center.x;
            const svgCurrentY = touchCurrentY - viewport.center.y;
            
            // Create Nuc coordinates (screen-based Cartesian)
            const startNucCoord = HubNucCoordinate.fromNuc(svgStartX, svgStartY);
            const currentNucCoord = HubNucCoordinate.fromNuc(svgCurrentX, svgCurrentY);
            
            // Calculate angular movement using Hub coordinate system
            const startAngle = startNucCoord.angle;
            const currentAngle = currentNucCoord.angle;
            
            // Calculate angular delta (handling wrap-around)
            let angleDelta = currentAngle - startAngle;
            if (angleDelta > Math.PI) angleDelta -= 2 * Math.PI;
            if (angleDelta < -Math.PI) angleDelta += 2 * Math.PI;
            
            // Calculate linear movement for comparison with existing method
            const linearDelta = (touchCurrentX - touchStartX) + (touchCurrentY - touchStartY);
            
            Logger.debug(`Bilingual touch analysis: angular=${angleDelta.toFixed(4)}rad (${(angleDelta * 180 / Math.PI).toFixed(1)}°), linear=${linearDelta.toFixed(1)}px`);
            
            return {
                angleDelta,
                linearDelta,
                startCoord: startNucCoord,
                currentCoord: currentNucCoord,
                // For future: could use angular delta for more sophisticated rotation
                recommendedRotationDelta: angleDelta * 0.5 // Example scaling
            };
            
        } catch (error) {
            Logger.error('Bilingual touch calculation failed:', error);
            return null;
        }
    }
    
    handleTouchEnd(e) {
        const wasDragging = this.isDragging;
        this.isDragging = false;
        
        if (!wasDragging) {
            // This was just a tap, not a drag - don't prevent default, let click events fire
            Logger.debug('Touch ended (tap detected, allowing click events)');
            return;
        }
        
        e.preventDefault();
        Logger.debug('Touch rotation ended, velocity:', this.velocity);
        
        if (Math.abs(this.velocity) > MOBILE_CONFIG.ROTATION.MIN_VELOCITY) {
            this.startMomentumAnimation();
        } else {
            this.onRotationEnd(this.rotationOffset);
        }
    }
    
    shouldHandleTouch(e) {
        if (e.touches.length !== 1) return false;
        
        // Check if touch is on an interactive element that should handle its own clicks
        const touch = e.touches[0];
        const element = document.elementFromPoint(touch.clientX, touch.clientY);
        
        // Don't handle touch if it's on:
        // - Top-level selection buttons
        // - Child Pyramid items (they need to handle their own clicks)
        // - Parent button
        // - Magnifier (has its own click handler for advancing Focus Ring)
        // - Detail Sector logo (should pass through to magnifier)
        // - Detail Sector content (text, any element in detailItems group)
        const classAttr = element.getAttribute('class') || '';
        if (element && (
            element.classList.contains('topLevelHitArea') || 
            element.closest('.levelGroup') ||
            element.classList.contains('child-pyramid-node') ||
            element.closest('.child-pyramid-item') ||
            element.closest('#parentButton') ||
            element.id === 'magnifier' ||
            element.id === 'detailSectorLogo' ||
            element.closest('#detailItems') ||
            classAttr.includes('detail-content') ||
            classAttr.includes('gutenberg-verse-text') ||
            (element.tagName === 'text' && element.closest('.child-pyramid-item')) ||
            (element.tagName === 'text' && element.closest('#detailItems'))
        )) {
            if (DEBUG_VERBOSE) console.log('🔺 Touch handler EXCLUDING element:', element.tagName, element.id || classAttr || 'no-class');
            return false;
        }
        
        if (DEBUG_VERBOSE) console.log('🔺 Touch handler ACCEPTING element:', element && element.className, element && element.tagName);
        return true;
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
        this.gestureDistance = 0;
        this.lastTimeStamp = 0;
        this.stopAnimation();
    }
}

export { TouchRotationHandler };