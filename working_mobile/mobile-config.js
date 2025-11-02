/**
 * Mobile Catalog Configuration
 * Centralized configuration constants for the mobile catalog system
 */

const MOBILE_CONFIG = {
    // SVG namespace
    SVG_NS: "http://www.w3.org/2000/svg",
    
    // Visual constants
    HIT_PADDING: 5,
    RADIUS: {
        UNSELECTED: 10,
        SELECTED: 18,
        MAGNIFIED: 22,  // 25% larger than selected (18 * 1.25 = 22.5 ≈ 22)
        FOCUS_RING: 375,
        CHILD_RING: 280,
        MODEL_RING: 180,
        CHILD_NODE: 10,  // Same as UNSELECTED
        MODEL_NODE: 10,    // Same as UNSELECTED
        MAGNIFIER: 22  // Renamed from MAGNIFYING_RING - same as magnified node radius
    },
    
    // Animation constants
    ROTATION: {
        SENSITIVITY: 0.0044,  // Increased for 2.5-swipe full traversal (was 0.003)
        DECELERATION: 0.95,
        MIN_VELOCITY: 0.001,
        SNAP_THRESHOLD: 0.05,
        DETENT_VELOCITY: 0.005  // Higher threshold for detent snapping
    },
    
    // Timing constants
    TIMING: {
        CYLINDER_SETTLE_DELAY: 300  // ms to wait after rotation stops before showing cylinders
    },
    
    // Angle constants - mobile arc-based system
    ANGLES: {
        FOCUS_SPREAD: Math.PI / 42, // 4.3° - renamed from MANUFACTURER_SPREAD
        CHILD_SPREAD: Math.PI / 40,     // 4.5° - renamed from CYLINDER_SPREAD
        MODEL_SPREAD: Math.PI / 18         // 10°
    },
    
    // Viewport constants
    VIEWPORT: {
        MARKET_OFFSET: {
            HORIZONTAL: 0.20,  // Match bundled version
            VERTICAL: 0.35
        },
        // Sprocket chain viewport window parameters
        MAX_VISIBLE_ITEMS: 11, // Maximum manufacturers visible in focus ring at once (reduced to original range)
        VIEWPORT_ARC: Math.PI * 0.6, // 108° total arc for visible manufacturers 
        CHAIN_POSITION_START: 0, // Linear position 0 = first manufacturer
        CHAIN_BUFFER: 0 // No buffer - only show exact visible items
    }
};

export { MOBILE_CONFIG };