// config.js: Shared constants for the catalog visualization
export const CONFIG = {
  // SVG and layout
  NS: 'http://www.w3.org/2000/svg',
  RADII: {
    manufacturers: 375,
    cylinders: 280,
    models: 180
  },
  UNSELECTED_RADIUS: 10,
  SELECTED_RADIUS: 18,
  HIT_PADDING: 5,
  GAP: -30, // For path lines

  // Angles and spreads
  MANUFACTURER_ANGLE_SPREAD: Math.PI / 42, // ~4.29 degrees
  CYLINDER_ANGLE_SPREAD: Math.PI / 18, // 10 degrees for multiples
  MODEL_ANGLE_SPREAD: Math.PI / 18,
  CENTER_ANGLE: Math.PI / 2, // Starting angle for rings

  // Animations
  ANIMATION_DURATION: 500, // ms for growth/shrink
  FADE_STAGES: {
    desc: 0,
    pricesSpecs: 500,
    photo: 750,
    link: 1000,
    fadeOutDelay: 300
  },
  EASING: {
    grow: (progress) => 1 - Math.pow(1 - progress, 2), // Ease out quadratic
    shrink: (progress) => Math.pow(progress, 2) // Ease in quadratic
  },

  // Colors and styles
  COLORS: {
    default: '#f1b800',
    oemManifold: 'steelblue',
    mmdmManifold: 'limegreen'
  },
  CENTRAL: {
    start: { radius: 40, logo: { x: -35, y: -16, width: 70, height: 22 } },
    end: { radius: 130, logo: { x: -60, y: -120, width: 120, height: 38 } }
  },

  // Other
  FO_X: -150,
  FO_Y: -150,
  FO_WIDTH: 300,
  FO_HEIGHT: 300,
  TEXT_FONT: '12px',
  TEXT_FAMILY: "'Montserrat', sans-serif",
  TEXT_DY: '0.3em'
};

export function getColor(type, name) {
  // Can expand this later; for now, simple switch
  const colors = CONFIG.COLORS;
  switch (type) {
    case 'oem-manifold':
      return colors.oemManifold;
    case 'mmdm-manifold':
      return colors.mmdmManifold;
    default:
      return colors.default;
  }
}