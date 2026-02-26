/**
 * Detail Sector Geometry
 *
 * Computes the line table used by text plugins to position text so that each
 * line's left edge follows the inner boundary of the expanded Detail Sector
 * circle (the Focus Ring arc).
 *
 * All coordinates are in viewport space (top-left origin, matching the SVG).
 */

import {
  getViewportInfo,
  getArcParameters,
  getMagnifierPosition
} from './focus-ring-geometry.js';

/** Fraction of arc radius used as the inner usable boundary */
const INNER_RADIUS_RATIO  = 0.98;

/** Viewport-edge margin as a fraction of SSd */
const MARGIN_RATIO        = 0.03;

/** Magnifier circle radius as a fraction of SSd */
const MAGNIFIER_RATIO     = 0.060;

/** Bottom clearance: this many magnifier-radii above the magnifier centre */
const MAGNIFIER_CLEARANCE = 4;

/** Horizontal/vertical padding inside the arc, as a fraction of SSd */
const TEXT_PAD_RATIO      = 0.04;

/** Skip lines whose available width is narrower than this fraction of SSd */
const MIN_WIDTH_RATIO     = 0.10;

/**
 * Line pitch based on the smallest (tier-4) font: 3% SSd × line-height 1.4.
 * This is the finest resolution; larger tiers will still fit within the table.
 */
const LINE_PITCH_RATIO    = 0.03 * 1.4;   // 0.042 × SSd

/**
 * Average character width at tier-4 font size (≈ 60% of 3% SSd).
 * Used to estimate maxChars per line at the base resolution.
 */
const CHAR_WIDTH_RATIO    = 0.03 * 0.60;  // 0.018 × SSd

/**
 * Compute the Detail Sector content bounds including a line table.
 *
 * The line table is an array of row descriptors ordered top-to-bottom.
 * Each row gives the viewport-absolute position and available width for one
 * line of text, accounting for the arc boundary on the left and the right
 * viewport margin.
 *
 * @param {number} width       - Viewport pixel width
 * @param {number} height      - Viewport pixel height
 * @param {{ left: number, right: number, top: number, bottom: number }|null} [logoBounds]
 *   Optional bounding box of the volume logo (upper-right corner).
 *   Lines whose y falls inside this zone have their leftX pushed past the
 *   logo's right edge so text does not overlap the logo.
 *
 * @returns {{
 *   topY: number,
 *   bottomY: number,
 *   leftBound: number,
 *   rightBound: number,
 *   arcCenterX: number,
 *   arcCenterY: number,
 *   arcRadius: number,
 *   viewportWidth: number,
 *   viewportHeight: number,
 *   SSd: number,
 *   lineTable: Array<{ y: number, leftX: number, rightX: number,
 *                       availableWidth: number, maxChars: number }>
 * }}
 */
export function computeDetailSectorBounds(width, height, logoBounds = null) {
  const viewport     = getViewportInfo(width, height);
  const arcParams    = getArcParameters(viewport);
  const magnifierPos = getMagnifierPosition(viewport);

  const { SSd }                = viewport;
  const { hubX, hubY, radius } = arcParams;
  const innerRadius            = radius * INNER_RADIUS_RATIO;

  const margin          = SSd * MARGIN_RATIO;
  const magnifierRadius = SSd * MAGNIFIER_RATIO;
  const textPad         = SSd * TEXT_PAD_RATIO;
  const linePitch       = SSd * LINE_PITCH_RATIO;
  const avgCharWidth    = SSd * CHAR_WIDTH_RATIO;

  const topY       = margin;
  const bottomY    = Math.min(height, magnifierPos.y - MAGNIFIER_CLEARANCE * magnifierRadius);
  const rightBound = width - margin;

  const lineTable = [];
  let y = topY + textPad;

  while (y < bottomY - textPad) {
    const dy   = y - hubY;
    const disc = innerRadius * innerRadius - dy * dy;

    if (disc >= 0) {
      let leftX    = hubX - Math.sqrt(disc) + textPad;
      const rightX = Math.min(rightBound, hubX + Math.sqrt(disc)) - textPad;

      // Push leftX past the logo exclusion zone if needed
      if (logoBounds && y >= logoBounds.top && y <= logoBounds.bottom) {
        leftX = Math.max(leftX, logoBounds.right + textPad);
      }

      const availableWidth = Math.max(0, rightX - leftX);

      if (availableWidth > SSd * MIN_WIDTH_RATIO) {
        lineTable.push({
          y,
          leftX,
          rightX,
          availableWidth,
          maxChars: Math.floor(availableWidth / avgCharWidth)
        });
      }
    }

    y += linePitch;
  }

  return {
    topY,
    bottomY,
    leftBound: 0,
    rightBound,
    arcCenterX: hubX,
    arcCenterY: hubY,
    arcRadius:  innerRadius,
    viewportWidth:  width,
    viewportHeight: height,
    SSd,
    lineTable
  };
}
