# Click-to-Magnify Bug Report

## Bug Description

In the Wheel mobile app, clicking Focus Ring nodes to magnify them works correctly at the top navigation level (manufacturers) but fails at deeper navigation levels (cylinders) until swiping/rotation occurs.

### Specific Symptoms
- **Top level (manufacturers)**: Clicking unselected nodes works immediately
- **Cylinder level**: Clicking unselected cylinder nodes fails until rotation occurs
- **Cylinder count behavior**:
  - 4 Cylinders: Works after swiping
  - 6 Cylinders: Does not work at all
  - 8 Cylinders: Works partially
  - 10 Cylinders: Works after swiping

### Root Cause Analysis
The issue appears to be a timing/state synchronization problem where click handlers are not properly attached or positioned after IN migration animations. Rotation "fixes" the issue because it triggers `updateFocusRingPositions()`, which refreshes the ring elements and reattaches event handlers.

## Console Outputs

### Initial App Load and Navigation
```
🎯🎪 showFocusRing CALLED
🎯📡 Focus Ring debug listeners attached
🎨 === CREATING FOCUS RING CENTERLINE ===
🎨 arcParams: {centerX: 479.5, centerY: -333.5, radius: 667, viewport: {…}}
🎨 Hub: (479.5, -333.5)
🎨 Inner radius (98%): 653.66
🎨 Outer radius (102%): 680.34
🎨 White band created
🎨 Appended to empty group
🎨 focusRingGroup children after: 1
🎨 === WHITE BAND COMPLETE ===
✨ Magnifier created with click handler
🔍 === MAGNIFIER AT LOAD ===
🔍 Magnifier position: {x: '-68.1', y: '47.3', radius: 22}
🔍 Magnifier angle (from viewport): 145.2°
🔍 No selected item yet
🎯🔄 updateFocusRingPositions CALLED with rotationOffset=-2.169
🎯🔄 At start: currentFocusItems=107, allFocusItems=107
🎯📝 CREATE: Element for "Chrysler" key="americhe/Stati Uniti/Chrysler" isSelected=false
🎯📝 HANDLER: Adding click handler for "Chrysler" key="americhe/Stati Uniti/Chrysler"
```

### IN Migration to Cylinder Level
```
🔺🔺🔺 HANDLE CHILD PYRAMID CLICK CALLED! 8 Cylinders
🎬🎬🎬 Stage 3 + Stage 5: Magnifier → Parent Button (IN migration)
🎬 Clicked item: 8 Cylinders
🎬 Current magnified item: Ford
🎬 Stage 5: Checking for Parent Button to animate off-screen
🎬 Stage 5: Animating Parent Button off-screen
🎬 Stage 5: Current transform: translate(-120.80000000000007, 266.8000000000002)
🎬 Stage 5: Moving from (-120.8, 266.8) to (-356.6, 502.6)
🔺🔍 SEARCHING FOR: key="americhe/Stati Uniti/Ford/8" in array of 4 items
🔺🔍 FOUND AT INDEX: 2 (8 Cylinders)
🎬 Saved 4 animated nodes for level "cylinder" (stack depth: 1)
🎬⏰ IN animation setup complete at timestamp: 5081.80 ms
🎬 Stage 5: Animation complete, Parent Button hidden
🎬🏁 IN[0] 4 Cylinders final computed transform: matrix(0.996905, 0.0786184, -0.0786184, 0.996905, -166.32, 38.1629)
🎬🏁 IN[1] 6 Cylinders final computed transform: matrix(0.991194, -0.132416, 0.132416, 0.991194, -111.867, 142.882)
🎬🏁 IN[2] 8 Cylinders final computed transform: matrix(0.99763, 0.0688078, -0.0688078, 0.99763, -155.67, 66.3442)
🎬🏁 IN[3] 10 Cylinders final computed transform: matrix(0.991194, 0.132416, -0.132416, 0.991194, -172.877, 55.1622)
🎬 IN animation END: Child Pyramid → Focus Ring
🎬⏰ Timestamp: 5717.30 ms
🔺🔍 SIBLINGS ARRAY (4 items): [0]4 Cylinders(key:americhe/Stati Uniti/Ford/4), [1]6 Cylinders(key:americhe/Stati Uniti/Ford/6), [2]8 Cylinders(key:americhe/Stati Uniti/Ford/8), [3]10 Cylinders(key:americhe/Stati Uniti/Ford/10)
🔺🔍 CLICKED ITEM: name="8 Cylinders", key="americhe/Stati Uniti/Ford/8"
🎯🔄 SET currentFocusItems: 4 items set: "4 Cylinders"(key=americhe/Stati Uniti/Ford/4), "6 Cylinders"(key=americhe/Stati Uniti/Ford/6), "8 Cylinders"(key=americhe/Stati Uniti/Ford/8), "10 Cylinders"(key=americhe/Stati Uniti/Ford/10)
```

### Focus Ring Creation After IN Migration
```
🎯🎪 showFocusRing CALLED
🎨 === CREATING FOCUS RING CENTERLINE ===
🎨 arcParams: {centerX: 479.5, centerY: -333.5, radius: 667, viewport: {…}}
🎨 Hub: (479.5, -333.5)
🎨 Inner radius (98%): 653.66
🎨 Outer radius (102%): 680.34
🎨 White band created
🎨 Appended to empty group
🎨 focusRingGroup children after: 1
🎨 === WHITE BAND COMPLETE ===
✨ Magnifier created with click handler
🔍 === MAGNIFIER AT LOAD ===
🔍 Magnifier position: {x: '-68.1', y: '47.3', radius: 22}
🔍 Magnifier angle (from viewport): 145.2°
🔍 Selected item text: 8 Cylinders
🔍 Selected item rotation: 0° (text is horizontal at Magnifier)
[MobileCatalog ERROR] ❌ STARTUP ERROR: initial_magnified_item 24 not found
[MobileCatalog ERROR]    Available sort_numbers: 1, 2, 3, 4
[MobileCatalog WARN]    Falling back to first item (index 0), offset = -6.428571428571429°
🎯🔄 updateFocusRingPositions CALLED with rotationOffset=-0.112
🎯🔄 At start: currentFocusItems=4, allFocusItems=4
🎯🎯🎯 ITEM SELECTED AT CENTER: [0] 4 Cylinders, angleDiff=0.000°, rotationOffset=-6.4°
🎯📝 CREATE: Element for "4 Cylinders" key="americhe/Stati Uniti/Ford/4" isSelected=true
📏 MAGNIFIER TEXT SIZE: 20px (CSS) weight: bold (CSS) item: 4 Cylinders
🎯📝 CREATE: Element for "6 Cylinders" key="americhe/Stati Uniti/Ford/6" isSelected=false
🎯📝 HANDLER: Adding click handler for "6 Cylinders" key="americhe/Stati Uniti/Ford/6"
🎯📝 CREATE: Element for "8 Cylinders" key="americhe/Stati Uniti/Ford/8" isSelected=false
🎯📝 HANDLER: Adding click handler for "8 Cylinders" key="americhe/Stati Uniti/Ford/8"
🎯📝 CREATE: Element for "10 Cylinders" key="americhe/Stati Uniti/Ford/10" isSelected=false
🎯📝 HANDLER: Adding click handler for "10 Cylinders" key="americhe/Stati Uniti/Ford/10"
```

### Click Attempt on 4 Cylinders
```
🎯📡 FOCUS RING EVENT {type: 'touchstart', tagName: 'text', classes: 'none', pointerEvents: 'auto', timestamp: '12175.50'}
🎯👆 TOUCHSTART on "4 Cylinders" key="americhe/Stati Uniti/Ford/4"
🎯📡 FOCUS RING EVENT {type: 'touchend', tagName: 'text', classes: 'none', pointerEvents: 'auto', timestamp: '12295.80'}
🎯📡 FOCUS RING EVENT {type: 'mousedown', tagName: 'text', classes: 'none', pointerEvents: 'auto', timestamp: '12298.50'}
🎯👆 MOUSEDOWN on "4 Cylinders" key="americhe/Stati Uniti/Ford/4"
🎯📡 FOCUS RING EVENT {type: 'mouseup', tagName: 'text', classes: 'none', pointerEvents: 'auto', timestamp: '12300.00'}
🎯📡 FOCUS RING EVENT {type: 'click', tagName: 'text', classes: 'none', pointerEvents: 'auto', timestamp: '12300.60'}
🎯🔥 CLICK: Handler fired! clickedKey="americhe/Stati Uniti/Ford/4"
🎯🔥 CLICK: this.currentFocusItems has 4 items
🎯🔥 CLICK: this.allFocusItems has 4 items
🎯🔥 CLICK: currentFocusItems: "4 Cylinders"(key=americhe/Stati Uniti/Ford/4), "6 Cylinders"(key=americhe/Stati Uniti/Ford/6), "8 Cylinders"(key=americhe/Stati Uniti/Ford/8), "10 Cylinders"(key=americhe/Stati Uniti/Ford/10)
🎯🔥 CLICK: allFocusItems: "4 Cylinders"(key=americhe/Stati Uniti/Ford/4), "6 Cylinders"(key=americhe/Stati Uniti/Ford/6), "8 Cylinders"(key=americhe/Stati Uniti/Ford/8), "10 Cylinders"(key=americhe/Stati Uniti/Ford/10)
🎯✅ CLICK: Found item "4 Cylinders"
🎯🎯🎯 bringFocusNodeToCenter CALLED
🎯🔍 SEARCH: Looking for item name="4 Cylinders" key="americhe/Stati Uniti/Ford/4"
🎯🔍 SEARCH: currentFocusItems array has 4 items
🎯🔍 SEARCH: Searching for key="americhe/Stati Uniti/Ford/4" in array...
🎯🔍 Comparing with item name="4 Cylinders" key="americhe/Stati Uniti/Ford/4" match=true
🎯🔍 SEARCH: Result targetIndex=0
🎯✅ ANIMATE: Will center [0] "4 Cylinders" with offset: -0.112
🎯🚀 animateRotationTo START {targetOffset: -0.1121997376282069}
```

### Post-Animation Settlement
```
🎯✅ animateRotationTo COMPLETE - calling triggerFocusSettlement
🎯🎯🎯 triggerFocusSettlement CALLED
🎯 Set isRotating = false
🎯 Cleared pending settle timeout
🎯 Selected focus item: 4 Cylinders
🎯 Calling showChildContentForFocusItem for: 4 Cylinders
📦 Current level: cylinder
📦 Next level: family
📦 Resolved level: 'family', child items: 8
📦 Found 8 families, calling showChildPyramid
📏 PARENT BUTTON TEXT SIZE: 16px (CSS) weight: 600 (CSS) text: FORD
🟡 Circle VISIBLE - line will be drawn
🟡🟡🟡 PARENT BUTTON FINAL STATE:
  Group visible: true
  Circle visible: true
  Text visible: true
  Disabled: false
🎯🔄 Refreshing focus ring positions after settlement
🎯🔄 updateFocusRingPositions CALLED with rotationOffset=-0.112
🎯🔄 At start: currentFocusItems=4, allFocusItems=4
🎯🎯🎯 ITEM SELECTED AT CENTER: [0] 4 Cylinders, angleDiff=0.000°, rotationOffset=-6.4°
🎯📝 CREATE: Element for "4 Cylinders" key="americhe/Stati Uniti/Ford/4" isSelected=true
📏 MAGNIFIER TEXT SIZE: 20px (CSS) weight: bold (CSS) item: 4 Cylinders
🎯📝 CREATE: Element for "6 Cylinders" key="americhe/Stati Uniti/Ford/6" isSelected=false
🎯📝 HANDLER: Adding click handler for "6 Cylinders" key="americhe/Stati Uniti/Ford/6"
🎯📝 CREATE: Element for "8 Cylinders" key="americhe/Stati Uniti/Ford/8" isSelected=false
🎯📝 HANDLER: Adding click handler for "8 Cylinders" key="americhe/Stati Uniti/Ford/8"
🎯📝 CREATE: Element for "10 Cylinders" key="americhe/Stati Uniti/Ford/10" isSelected=false
🎯📝 HANDLER: Adding click handler for "10 Cylinders" key="americhe/Stati Uniti/Ford/10"
```

## Attempted Fixes

### Fix 1: Add updateFocusRingPositions to triggerFocusSettlement
**Problem**: Click handlers not refreshed after IN migration animations.

**Solution**: Added `updateFocusRingPositions(this.lastRotationOffset || 0)` to `triggerFocusSettlement()` in `mobile-renderer.js`.

**Result**: Partial fix - handlers are refreshed but with incorrect rotation offset.

### Fix 2: Update lastRotationOffset in triggerFocusSettlement
**Problem**: Using stale rotation offset from initial ring creation instead of current position after centering animation.

**Solution**: Capture current rotation offset and update `lastRotationOffset` before calling `updateFocusRingPositions()`.

**Code Changes**:
```javascript
// CRITICAL FIX: Update lastRotationOffset to current rotation before refreshing positions
// This ensures the focus ring is refreshed with the correct centering offset
const currentRotationOffset = window.mobileCatalogApp?.touchHandler?.rotationOffset || 0;
this.lastRotationOffset = currentRotationOffset;

// CRITICAL FIX: Refresh focus ring positions after IN migration to attach click handlers
// This ensures click handlers are properly attached after animation completes
console.log('🎯🔄 Refreshing focus ring positions after settlement');
this.updateFocusRingPositions(currentRotationOffset);
```

**Result**: Still not working - click handlers remain misaligned.

### Fix 3: Optimize Passive Event Listeners
**Problem**: Browser violations about non-passive touch event listeners.

**Solution**: Made `touchstart` listeners passive while keeping `touchmove`/`touchend` non-passive for drag prevention.

**Code Changes** in `mobile-touch.js`:
```javascript
// Use passive listeners for touchstart (doesn't prevent default), non-passive for move/end (may prevent default during drag)
const passive = event === 'touchStart';
document.addEventListener(eventName, handler, { passive });
```

**Result**: Reduced violations but core click issue persists.

## Current Status

- **Bug State**: UNRESOLVED - Click-to-magnify fails for 6 and 8 cylinders
- **Root Cause**: Unknown - handlers are being refreshed but positioning/alignment is incorrect
- **Workaround**: Rotate/swipe the ring to reposition elements and fix click handlers
- **Impact**: Poor user experience at cylinder navigation level

## Next Steps

1. Investigate why `updateFocusRingPositions` with correct rotation offset doesn't fix click handler alignment
2. Check if element positioning calculations are correct after refresh
3. Verify that `data-focus-key` attributes match `currentFocusItems` keys
4. Consider if SVG transform updates are interfering with click detection
5. Test with different rotation offsets to isolate the positioning issue