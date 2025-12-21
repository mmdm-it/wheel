# V1 vs V2 Rotation Physics Comparison (v3 baseline)

> v3 delta tracking: This comparison is preserved from v2. For any v3 rotation changes (momentum constants, gesture detection, continuous feedback), add a short "v3 delta" note near the relevant section so differences stay explicit.

## Executive Summary

**V1's rotational UI feels better** due to several key differences in implementation:

1. **Momentum Physics**: V1 has smooth deceleration with detent snapping; V2 has no momentum
2. **Gesture Recognition**: V1 has intelligent tap vs swipe detection; V2 has basic threshold
3. **Rotation Sensitivity**: V1 uses diagonal movement (X+Y) with dynamic scaling; V2 uses pure angular delta
4. **Visual Feedback**: V1 continuously updates during drag; V2 snaps between discrete items
5. **Touch Handling**: V1 has sophisticated exclusion zones; V2 has basic zone checking

---

## Key Differences

### 1. Momentum Physics

**V1 (mobile-touch.js):**
```javascript
// Smooth deceleration with exponential decay
startMomentumAnimation() {
    const animate = () => {
        this.velocity *= MOBILE_CONFIG.ROTATION.DECELERATION; // 0.95
        
        // Detent snapping when slowing down
        if (Math.abs(this.velocity) < MOBILE_CONFIG.ROTATION.DETENT_VELOCITY) {
            this.stopAnimation();
            this.snapToNearest();
            return;
        }
        
        // Continue until minimum velocity
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
            this.velocity = 0;
            this.stopAnimation();
            return;
        }
        
        this.animationId = requestAnimationFrame(animate);
    };
    
    this.animationId = requestAnimationFrame(animate);
}
```

**V2 (rotation-handler.js):**
```javascript
handleTouchEnd(event) {
    // TODO: Add momentum animation if velocity is significant
    
    this.touchStartX = null;
    this.touchStartY = null;
    // ... (no momentum implementation)
}
```

**Impact**: V1 feels natural and fluid like a physical wheel with inertia. V2 feels abrupt and digital.

---

### 2. Gesture Detection (Tap vs Swipe)

**V1:**
```javascript
handleTouchStart(e) {
    this.isDragging = false; // Start as potential tap
    this.startTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
}

handleTouchMove(e) {
    if (!this.isDragging) {
        const totalDeltaX = touch.clientX - this.startTouch.x;
        const totalDeltaY = touch.clientY - this.startTouch.y;
        const totalMovement = Math.sqrt(totalDeltaX * totalDeltaX + totalDeltaY * totalDeltaY);
        
        // Only start dragging if movement exceeds threshold
        if (totalMovement > 10) { // 10px threshold
            this.isDragging = true;
            e.preventDefault();
        } else {
            // Not enough movement yet, allow clicks
            return;
        }
    }
}

handleTouchEnd(e) {
    const wasDragging = this.isDragging;
    this.isDragging = false;
    
    if (!wasDragging) {
        // This was just a tap - allow click events
        return;
    }
    
    e.preventDefault();
    // Start momentum...
}
```

**V2:**
```javascript
handleTouchStart(event) {
    // Allow clicks on focus ring nodes
    if (target.classList && target.classList.contains('focus-ring-node')) {
        return; // Let the click handler process it
    }
    
    // Immediately prevent default if in swipe zone
    if (!this.geometry.isInSwipeZone(touch.clientX, touch.clientY)) {
        return;
    }
    
    event.preventDefault(); // Always prevents default in swipe zone
    this.touchStartX = touch.clientX;
}

handleTouchMove(event) {
    // Simple threshold check
    if (Math.abs(angularDelta) < minRotationThreshold) {
        return;
    }
    // Immediately applies rotation
}
```

**Impact**: V1 intelligently distinguishes taps from swipes, allowing both interactions naturally. V2 interferes with tap gestures.

---

### 3. Rotation Calculation Method

**V1 - Diagonal Movement (X + Y):**
```javascript
handleTouchMove(e) {
    const deltaX = touch.clientX - this.lastTouch.x;
    const deltaY = touch.clientY - this.lastTouch.y;
    
    // Hybrid scaling
    const distanceScale = this.gestureDistance > 100 
        ? Math.min(Math.pow(this.gestureDistance / 100, 1.2), 8)
        : 1.0;
    
    const velocityScale = instantaneousVelocity > 2 
        ? Math.min(instantaneousVelocity / 2, 6)
        : 1.0;
    
    scaleFactor = Math.max(distanceScale, velocityScale);
    
    // Convert diagonal movement to rotation
    const baseRotationDelta = -(deltaX + deltaY) * MOBILE_CONFIG.ROTATION.SENSITIVITY;
    const rotationDelta = baseRotationDelta * scaleFactor;
}
```

**V2 - Pure Angular Delta:**
```javascript
handleTouchMove(event) {
    // Calculate angular delta using hub-based geometry
    const angularDelta = this.geometry.calculateAngularDelta(
        this.lastTouchX, this.lastTouchY,
        touch.clientX, touch.clientY
    );
    
    // Apply hybrid scaling based on angular measurements
    const totalDegrees = this.gestureDistance * 180 / Math.PI;
    const distanceScale = totalDegrees > 45
        ? Math.min(Math.pow(totalDegrees / 45, 1.2), 8)
        : 1.0;
    
    const angularVelocity = Math.abs(angularDelta) / timeDelta;
    const velocityScale = angularVelocity > 0.02
        ? Math.min(angularVelocity / 0.02, 6)
        : 1.0;
    
    const rotationDelta = angularDelta * scaleFactor;
}
```

**V2 Geometry Calculation:**
```javascript
calculateAngularDelta(x1, y1, x2, y2) {
    const { radius, hubX, hubY } = this.arcParams;
    
    // Vector from hub to first touch
    const dx1 = x1 - hubX;
    const dy1 = y1 - hubY;
    const r1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
    
    // Movement vector
    const moveX = x2 - x1;
    const moveY = y2 - y1;
    
    // Tangent vector (perpendicular to radius)
    const tangentX = -dy1 / r1;
    const tangentY = dx1 / r1;
    
    // Project movement onto tangent (dot product)
    const tangentialMovement = moveX * tangentX + moveY * tangentY;
    
    // Convert to angular delta
    return tangentialMovement / radius;
}
```

**Impact**: 
- V1's diagonal method (`deltaX + deltaY`) is simpler and more forgiving - any diagonal swipe works
- V2's angular projection is theoretically "correct" but requires precise tangential movement
- V2 rejects movements that aren't perfectly perpendicular to the radius

---

### 4. Dynamic Scaling

**V1:**
```javascript
// Distance-based scaling
const distanceScale = this.gestureDistance > 100 
    ? Math.min(Math.pow(this.gestureDistance / 100, 1.2), 8)
    : 1.0;

// Velocity-based scaling  
const velocityScale = instantaneousVelocity > 2  // px/ms
    ? Math.min(instantaneousVelocity / 2, 6)
    : 1.0;

// Use maximum of both
scaleFactor = Math.max(distanceScale, velocityScale);
```

**V2:**
```javascript
// Distance-based (angular)
const totalDegrees = this.gestureDistance * 180 / Math.PI;
const distanceScale = totalDegrees > 45
    ? Math.min(Math.pow(totalDegrees / 45, 1.2), 8)
    : 1.0;

// Velocity-based (angular)
const angularVelocity = Math.abs(angularDelta) / timeDelta; // rad/ms
const velocityScale = angularVelocity > 0.02
    ? Math.min(angularVelocity / 0.02, 6)
    : 1.0;

scaleFactor = Math.max(distanceScale, velocityScale);
```

**Impact**: 
- V1 uses pixel-based thresholds (100px, 2px/ms) - intuitive to user movement
- V2 uses angular thresholds (45°, 0.02rad/ms) - harder to achieve naturally
- V2's higher angular thresholds make scaling activate less frequently

---

### 5. Touch Exclusion Zones

**V1:**
```javascript
shouldHandleTouch(e) {
    // Extensive list of excluded elements
    const element = document.elementFromPoint(touch.clientX, touch.clientY);
    
    if (element && (
        element.classList.contains('topLevelHitArea') || 
        element.closest('.levelGroup') ||
        element.classList.contains('child-pyramid-node') ||
        element.closest('.child-pyramid-item') ||
        element.closest('#parentButtonGroup') ||
        element.id === 'magnifier' ||
        element.id === 'detailSectorLogo' ||
        element.closest('#detailItems') ||
        classAttr.includes('detail-content') ||
        // ... many more checks
    )) {
        return false;
    }
    return true;
}
```

**V2:**
```javascript
isInSwipeZone(x, y) {
    const { radius, hubX, hubY } = this.arcParams;
    
    // Simple geometric check: distance from hub
    const distanceFromHub = Math.sqrt(dx * dx + dy * dy);
    const minDistance = radius - this.magnifierRadius;
    const maxDistance = radius + this.magnifierRadius;
    
    if (distanceFromHub < minDistance || distanceFromHub > maxDistance) {
        return false;
    }
    
    // Check angle within visible arc
    return normalizedAngle >= normalizedStart && normalizedAngle <= arcEndAngle;
}
```

**Impact**: V1 carefully avoids interfering with clickable UI elements. V2 only checks geometric zones.

---

### 6. Rotation Constants

**V1 (mobile-config.js):**
```javascript
ROTATION: {
    SENSITIVITY: 0.0032,      // Tuned for feel
    DECELERATION: 0.95,       // Momentum decay
    MIN_VELOCITY: 0.001,      // Stop threshold
    DETENT_VELOCITY: 0.005    // Snap threshold
}
```

**V2:**
```javascript
// No rotation constants defined
// Hardcoded thresholds:
const minRotationThreshold = 0.01;  // ~0.57° minimum
const threshold = Math.PI / 12;     // ~15° to change selection
const sensitivity = Math.PI / 4 / 100; // 100px = 45°
```

**Impact**: V1 has tunable parameters refined through testing. V2 has scattered magic numbers.

---

### 7. Continuous vs Discrete Updates

**V1:**
```javascript
// Continuously updates rotation offset during drag
handleTouchMove(e) {
    // ... calculate rotation
    const newOffset = this.constrainRotation(this.rotationOffset + rotationDelta);
    
    if (newOffset !== this.rotationOffset) {
        this.rotationOffset = newOffset;
        this.onRotationChange(this.rotationOffset); // Visual update every frame
        this.velocity = rotationDelta;
    }
}
```

**V2:**
```javascript
// Only updates when selection changes
handleTouchMove(event) {
    this.accumulatedRotation += rotationDelta;
    
    const newIndex = this.geometry.getIndexAfterRotation(
        currentIndex,
        totalItems,
        this.accumulatedRotation
    );
    
    // Update selection if changed (DO NOT reset accumulatedRotation)
    if (newIndex !== currentIndex) {
        this.navigationState.selectIndex(newIndex); // Only updates on index change
    }
}
```

**Impact**: V1 provides smooth visual feedback during drag. V2 snaps discretely between items.

---

## Recommendations for V2

### Critical Improvements Needed:

1. **Add Momentum Physics** (HIGH PRIORITY)
   - Implement `startMomentumAnimation()` similar to V1
   - Use exponential decay (0.95 factor)
   - Add detent snapping near end of momentum
   
2. **Fix Tap Detection** (HIGH PRIORITY)
   - Track `isDragging` state like V1
   - Only prevent default after movement threshold exceeded
   - Allow click events for tap gestures

3. **Simplify Rotation Calculation** (MEDIUM PRIORITY)
   - Consider using V1's diagonal method (`deltaX + deltaY`) for better feel
   - OR reduce angular projection strictness (make tangent tolerance wider)
   - Lower thresholds for dynamic scaling activation

4. **Add Continuous Visual Feedback** (MEDIUM PRIORITY)
   - Update visual rotation continuously during drag, not just on index change
   - Decouple visual rotation from discrete item selection

5. **Centralize Constants** (LOW PRIORITY)
   - Create rotation config similar to V1's `MOBILE_CONFIG.ROTATION`
   - Remove hardcoded magic numbers
   - Make thresholds tunable

### Why V1 Feels Better:

The combination of:
- **Momentum physics** = natural, physical feel
- **Smart tap detection** = both taps and swipes work
- **Diagonal movement** = forgiving, easy to trigger
- **Continuous updates** = smooth visual feedback
- **Tuned constants** = refined through user testing

Creates an interface that feels like turning a physical wheel, not clicking through discrete states.

---

## Code Migration Path

To bring V1's rotation feel to V2:

### Phase 1: Add Momentum (1-2 hours)
```javascript
// In rotation-handler.js
class RotationHandler {
    startMomentumAnimation() {
        const animate = () => {
            this.velocity *= 0.95; // Deceleration factor
            
            if (Math.abs(this.velocity) < 0.005) { // Detent threshold
                this.stopMomentum();
                return;
            }
            
            this.accumulatedRotation += this.velocity;
            const newIndex = this.geometry.getIndexAfterRotation(/*...*/);
            
            if (newIndex !== currentIndex) {
                this.navigationState.selectIndex(newIndex);
            }
            
            this.momentumId = requestAnimationFrame(animate);
        };
        
        this.momentumId = requestAnimationFrame(animate);
    }
}
```

### Phase 2: Fix Tap Detection (30 minutes)
```javascript
handleTouchStart(event) {
    this.isDragging = false;
    this.startPos = { x: touch.clientX, y: touch.clientY };
    // Don't prevent default yet
}

handleTouchMove(event) {
    if (!this.isDragging) {
        const movement = Math.sqrt(dx*dx + dy*dy);
        if (movement > 10) {
            this.isDragging = true;
            event.preventDefault(); // Now prevent default
        } else {
            return; // Allow tap
        }
    }
    // Continue with rotation...
}

handleTouchEnd(event) {
    if (!this.isDragging) {
        return; // Was a tap, allow click
    }
    
    event.preventDefault();
    if (Math.abs(this.velocity) > 0.001) {
        this.startMomentumAnimation();
    }
}
```

### Phase 3: Simplify Rotation Calc (Optional, 1 hour)
```javascript
// Option A: Use V1's diagonal method
handleTouchMove(event) {
    const deltaX = touch.clientX - this.lastTouchX;
    const deltaY = touch.clientY - this.lastTouchY;
    
    // Diagonal movement (more forgiving)
    const combinedDelta = deltaX + deltaY;
    const rotationDelta = combinedDelta * 0.0032; // V1 sensitivity
    
    this.accumulatedRotation += rotationDelta * scaleFactor;
}

// Option B: Widen tangent tolerance
calculateAngularDelta(x1, y1, x2, y2) {
    // ... existing code ...
    
    // Add radial tolerance (allow some radial movement)
    const radialMovement = moveX * (dx1/r1) + moveY * (dy1/r1);
    const adjustedTangential = tangentialMovement * (1 + Math.abs(radialMovement) * 0.3);
    
    return adjustedTangential / radius;
}
```

---

## Testing Checklist

After implementing improvements:

- [ ] Slow swipe feels smooth and responsive
- [ ] Fast swipe has natural momentum and deceleration
- [ ] Tap on node triggers click (doesn't prevent)
- [ ] Small movements don't accidentally trigger rotation
- [ ] Large swipes can traverse many items quickly
- [ ] Rotation stops naturally without jank
- [ ] Works consistently across different device sizes
- [ ] No conflicts with other UI element clicks

---

## Conclusion

V1's rotational UI is better because it **prioritizes feel over geometric correctness**. The diagonal movement method, momentum physics, and continuous visual feedback create a natural, intuitive experience. V2's pure angular approach is mathematically elegant but less forgiving and harder to use.

**Recommendation**: Port V1's momentum physics and tap detection to V2 as high priority. Consider using V1's diagonal rotation method or making V2's angular projection more tolerant.
