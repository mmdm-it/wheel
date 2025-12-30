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
    
    // Square box size (use logo width for both dimensions)
    const logoScaleFactor = 1.8;
    const boxSize = radius * 2 * logoScaleFactor;
    const boxHalfSize = boxSize / 2;
    
    // Position from top-left origin (SVG default)
    const centerX = this.viewport.width - boxHalfSize - margin;
    const centerY = boxHalfSize + margin;
    
    return {
      centerX,
      centerY,
      radius,
      boxSize,
      // Square bounds for intersection
      left: centerX - boxHalfSize,
      right: centerX + boxHalfSize,
      top: centerY - boxHalfSize,
      bottom: centerY + boxHalfSize
    };
  }

  /**
   * Render logo from volume configuration
   * @param {Object} config - Volume display_config.detail_sector
   */
  render(config) {
    this.clear();

    if (!config) {
      console.log('[VolumeLogo] No config provided');
      return;
    }

    const shorterSide = Math.min(this.viewport.width, this.viewport.height);
    const radius = shorterSide * 0.12;
    const margin = shorterSide * 0.03;
    
    // Logo dimensions
    const logoAspectRatio = 154 / 134;
    const logoScaleFactor = 1.8;
    const logoWidth = radius * 2 * logoScaleFactor;
    const logoHeight = logoWidth / logoAspectRatio;
    const logoHalfWidth = logoWidth / 2;
    const logoHalfHeight = logoHeight / 2;
    
    // Position so right edge of image touches the right margin boundary
    // Right edge of CPUA: width - margin
    // Image right edge should be at: centerX + logoHalfWidth = width - margin
    // Shift 12% right to account for padding in image file
    const paddingAdjustment = logoWidth * 0.12;
    const centerX = this.viewport.width - margin - logoHalfWidth + paddingAdjustment;
    const centerY = margin + logoHalfHeight;
    
    console.log('[VolumeLogo] Rendering logo:', {
      viewport: { width: this.viewport.width, height: this.viewport.height },
      circle: { centerX, centerY, radius },
      margin,
      config
    });
    
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
    
    console.log('[VolumeLogo] Circle created:', {
      cx: centerX,
      cy: centerY,
      r: radius,
      fill: config.color_scheme?.detail_sector || '#362e6a'
    });
    
    // Create logo image or placeholder
    const logoBasePath = config.logo_base_path;
    const defaultImage = config.default_image;
    
    if (logoBasePath && defaultImage) {
      const logoPath = logoBasePath + defaultImage + '.png';
      const logoX = centerX - (logoWidth / 2);
      const logoY = centerY - (logoHeight / 2);
      
      console.log('[VolumeLogo] Creating image:', {
        path: logoPath,
        x: logoX,
        y: logoY,
        width: logoWidth,
        height: logoHeight
      });
      
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
      
      console.log('[VolumeLogo] Image element added to group');
    } else {
      console.log('[VolumeLogo] No logo image configured');
    }
    
    // Insert at beginning so it renders behind everything
    if (this.svgRoot.firstChild) {
      this.svgRoot.insertBefore(this.group, this.svgRoot.firstChild);
      console.log('[VolumeLogo] Group inserted at beginning of SVG');
    } else {
      this.svgRoot.appendChild(this.group);
      console.log('[VolumeLogo] Group appended to SVG');
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
