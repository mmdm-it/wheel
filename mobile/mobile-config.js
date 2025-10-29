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
        MANUFACTURER_RING: 375,
        CYLINDER_RING: 280,
        MODEL_RING: 180
    },
    
    // Animation constants
    ROTATION: {
        SENSITIVITY: 0.003,
        DECELERATION: 0.95,
        MIN_VELOCITY: 0.001,
        SNAP_THRESHOLD: 0.05
    },
    
    // Angle constants - mobile arc-based system
    ANGLES: {
        MANUFACTURER_SPREAD: Math.PI / 42, // 4.3°
        CYLINDER_SPREAD: Math.PI / 18,     // 10°
        MODEL_SPREAD: Math.PI / 18,        // 10°
        CENTER_ANGLE: Math.PI * 0.75       // 135° (Southwest) - for arc system
    },
    
    // Viewport constants
    VIEWPORT: {
        MARKET_OFFSET: {
            HORIZONTAL: 0.30,
            VERTICAL: 0.35
        }
    }
};

export { MOBILE_CONFIG };