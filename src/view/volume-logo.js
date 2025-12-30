/**
 * Volume Logo Module
 * Domain-specific logo rendering in upper-right corner
 * 
 * Configured per volume in manifest.json:
 * {
 *   "detail_sector": {
 *     "logo_base_path": "assets/",
 *     "default_image": "gutenberg_logo"
 *   }
 * }
 */

const SVG_NS = 'http://www.w3.org/2000/svg';
const XLINK_NS = 'http://www.w3.org/1999/xlink';

export class VolumeLogo {
  constructor(svgRoot, viewport) {
    this.svgRoot = svgRoot;
    this.viewport = viewport;
    this.group = null;
    this.circle = null;
    this.logo = null;
  }

  /**
   * Get logo bounds for CPUA cropping
   * Returns { x, y, width, height, radius } in viewport coordinates
   */
  getBounds() {
    if (!this.circle) return null;

    const shorterSide = Math.min(this.viewport.width, this.viewport.height);
    const radius = shorterSide * 0.12;
    const margin = shorterSide * 0.03;
    
    // Logo is wider than circle
    const logoScaleFactor = 1.8;
    const logoWidth = radius * 2 * logoScaleFactor;
    const logoHalfWidth = logoWidth / 2;
    
    // Position from top-left origin (SVG default)
    const centerX = this.viewport.width - logoHalfWidth - margin;
    const centerY = radius + margin;
    
    return {
      centerX,
      centerY,
      radius,
      logoWidth,
      // Rectangular bounds for intersection
      left: centerX - logoHalfWidth,
      right: centerX + logoHalfWidth,
      top: centerY - radius,
      bottom: centerY + radius
    };
  }

  /**
   * Render logo from volume configuration
   * @param {Object} config - Volume display_config.detail_sector
   */
  render(config) {
    this.clear();

    if (!config) return;

    const shorterSide = Math.min(this.viewport.width, this.viewport.height);
    const radius = shorterSide * 0.12;
    const margin = shorterSide * 0.03;
    
    // Logo dimensions
    const logoAspectRatio = 154 / 134;
    const logoScaleFactor = 1.8;
    const logoWidth = radius * 2 * logoScaleFactor;
    const logoHeight = logoWidth / logoAspectRatio;
    const logoHalfWidth = logoWidth / 2;
    
    // Position in upper right corner (top-left origin)
    const centerX = this.viewport.width - logoHalfWidth - margin;
    const centerY = radius + margin;
    
    // Create group
    this.group = document.createElementNS(SVG_NS, 'g');
    this.group.setAttribute('id', 'volume-logo-group');
    
    // Create blue circle background
    this.circle = document.createElementNS(SVG_NS, 'circle');
    this.circle.setAttribute('id', 'volume-logo-circle');
    this.circle.setAttribute('cx', centerX);
    this.circle.setAttribute('cy', centerY);
    this.circle.setAttribute('r', radius);
    this.circle.setAttribute('fill', config.color_scheme?.detail_sector || '#362e6a');
    this.circle.setAttribute('opacity', config.color_scheme?.detail_sector_opacity || '0.5');
    this.circle.setAttribute('stroke', 'black');
    this.circle.setAttribute('stroke-width', '1');
    this.group.appendChild(this.circle);
    
    // Create logo image or placeholder
    const logoBasePath = config.logo_base_path;
    const defaultImage = config.default_image;
    
    if (logoBasePath && defaultImage) {
      const logoPath = logoBasePath + defaultImage + '.png';
      const logoX = centerX - (logoWidth / 2);
      const logoY = centerY - (logoHeight / 2);
      
      this.logo = document.createElementNS(SVG_NS, 'image');
      this.logo.setAttribute('id', 'volume-logo-image');
      this.logo.setAttributeNS(XLINK_NS, 'href', logoPath);
      this.logo.setAttribute('x', logoX);
      this.logo.setAttribute('y', logoY);
      this.logo.setAttribute('width', logoWidth);
      this.logo.setAttribute('height', logoHeight);
      this.logo.setAttribute('opacity', config.color_scheme?.detail_sector_opacity || '0.5');
      this.logo.style.pointerEvents = 'none';
      this.group.appendChild(this.logo);
    }
    
    // Insert at beginning so it renders behind everything
    if (this.svgRoot.firstChild) {
      this.svgRoot.insertBefore(this.group, this.svgRoot.firstChild);
    } else {
      this.svgRoot.appendChild(this.group);
    }
  }

  /**
   * Clear the logo
   */
  clear() {
    if (this.group) {
      this.group.remove();
      this.group = null;
      this.circle = null;
      this.logo = null;
    }
  }
}

// Console API for showing/hiding logo bounds
if (typeof window !== 'undefined') {
  window.showLogoBounds = function() {
    const event = new CustomEvent('volume-logo:show-bounds');
    window.dispatchEvent(event);
  };

  window.hideLogoBounds = function() {
    const event = new CustomEvent('volume-logo:hide-bounds');
    window.dispatchEvent(event);
  };
}
