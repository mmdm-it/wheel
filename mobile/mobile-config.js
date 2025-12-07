/**
 * Mobile Catalog Configuration
 * Centralized configuration constants for the mobile catalog system
 */

const VERSION = {
    semantic: '0.8.114',      // major.minor.patch
    display() {
        return `v${this.semantic}`;
    }
};

const MOBILE_CONFIG = {
    // SVG namespace
    SVG_NS: "http://www.w3.org/2000/svg",
    
    // Visual constants
    RADIUS: {
        UNSELECTED: 10,
        SELECTED: 18,
        MAGNIFIED: 22,  // 25% larger than selected (18 * 1.25 = 22.5 ≈ 22)
        CHILD_RING: 280,
        DETAIL_RING: 180,
        CHILD_NODE: 10,  // Same as UNSELECTED
        DETAIL_NODE: 10,    // Same as UNSELECTED
        MAGNIFIER: 22,  // Renamed from MAGNIFYING_RING - same as magnified node radius
        PARENT_BUTTON: 22  // Same as MAGNIFIER - fixed position circle
    },
    
    // Animation constants
    ROTATION: {
        SENSITIVITY: 0.0032,  // Reduced for 104 manufacturer nodes (was 0.0044 for 2000 nodes)
        DECELERATION: 0.95,
        MIN_VELOCITY: 0.001,
        DETENT_VELOCITY: 0.005  // Higher threshold for detent snapping
    },
    
    // Timing constants
    TIMING: {
        FOCUS_ITEM_SETTLE_DELAY: 300  // ms to wait after rotation stops before showing child items
    },
    
    // Angle constants - mobile arc-based system
    ANGLES: {
        FOCUS_SPREAD: Math.PI / 42, // 4.3° - spacing between focus ring items
        CHILD_SPREAD: Math.PI / 40,     // 4.5°
        DETAIL_SPREAD: Math.PI / 18         // 10°
    },
    
    // Viewport constants
    VIEWPORT: {
        TOP_LEVEL_OFFSET: {
            HORIZONTAL: 0.20,  // Match bundled version
            VERTICAL: 0.35
        },
        // Sprocket chain viewport window parameters
        MAX_VISIBLE_ITEMS: 11, // Maximum focus items visible in focus ring at once (reduced to original range)
        VIEWPORT_ARC: Math.PI * 0.6 // 108° total arc for visible focus items
    }
};

export { MOBILE_CONFIG, VERSION };