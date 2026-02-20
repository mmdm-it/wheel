/**
 * Volume Logo Module
 * Domain-specific logo rendering in upper-right corner
 * Handles expand/collapse animation for Detail Sector
 * 
 * Configured per volume in manifest.json:
 * {
 *   "detail_sector": {
 *     "logo_base_path": "assets/",
 *     "default_image": "gutenberg_logo"
 *   }
 * }
 * 
 * Animation: 600ms quadratic ease-in-out
 * Expand: circle 12% SSd → 99% FR radius at hub, logo → watermark at -35% FR offset
 * Collapse: reverse of expand
 */

const SVG_NS = 'http://www.w3.org/2000/svg';
const XLINK_NS = 'http://www.w3.org/1999/xlink';
const ANIMATION_DURATION = 600; // ms

// Quadratic ease-in-out
function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

export class VolumeLogo {
  constructor(svgRoot, viewport) {
    this.svgRoot = svgRoot;
    this.viewport = viewport;
    this.group = null;
    this.circle = null;
    this.logo = null;
    this.clickTarget = null;    // transparent mailto overlay (on top of SVG)
    this._animationId = null;   // rAF handle for cancellation
    this._expanded = false;     // current state
    this._animating = false;    // animation in progress
    this._renderConfig = null;  // saved config from render() for start-state calcs
  }

  /**
   * Get logo bounds for CPUA cropping
   * Returns { x, y, width, height, radius } in viewport coordinates
   */
  getBounds() {
    if (!this.circle) return null;
    // While expanded or animating, logo is not in upper-right — no CPUA cropping
    if (this._expanded || this._animating) return null;

    const shorterSide = Math.min(this.viewport.width, this.viewport.height);
    const radius = shorterSide * 0.12;
    const margin = shorterSide * 0.03;
    
    // Square box size (80% of full logo size)
    const logoScaleFactor = 1.8;
    const fullSize = radius * 2 * logoScaleFactor;
    const boxSize = fullSize * 0.80;
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
    this._renderConfig = config || null;
    this._expanded = false;
    this._animating = false;

    if (!config) {
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
      this.logo.setAttribute('opacity', '0.5'); // START state: 50% opacity (matches v0)
      this.logo.style.pointerEvents = 'none';
      this.group.appendChild(this.logo);
    }
    
    // Insert at beginning so it renders behind everything
    if (this.svgRoot.firstChild) {
      this.svgRoot.insertBefore(this.group, this.svgRoot.firstChild);
    } else {
      this.svgRoot.appendChild(this.group);
    }

    // Create transparent click-target overlay (appended LAST so it's on top)
    const contactEmail = config.contact_email;
    if (contactEmail) {
      const link = document.createElementNS(SVG_NS, 'a');
      const mailto = 'mailto:' + contactEmail;
      link.setAttributeNS(XLINK_NS, 'href', mailto);
      link.setAttribute('href', mailto);
      this.clickTarget = document.createElementNS(SVG_NS, 'circle');
      this.clickTarget.setAttribute('cx', centerX);
      this.clickTarget.setAttribute('cy', centerY);
      this.clickTarget.setAttribute('r', radius);
      this.clickTarget.setAttribute('fill', 'transparent');
      this.clickTarget.setAttribute('cursor', 'pointer');
      this.clickTarget.style.pointerEvents = 'all';
      link.appendChild(this.clickTarget);
      this.svgRoot.appendChild(link);
    }
  }

  /**
   * Compute the collapsed (upper-right) state for circle + logo
   */
  _getStartState() {
    const vw = this.viewport.width;
    const vh = this.viewport.height;
    const SSd = Math.min(vw, vh);
    const radius = SSd * 0.12;
    const margin = SSd * 0.03;
    const logoAspectRatio = 154 / 134;
    const logoScaleFactor = 1.8;
    const logoWidth = radius * 2 * logoScaleFactor;
    const logoHeight = logoWidth / logoAspectRatio;
    const logoHalfWidth = logoWidth / 2;
    const logoHalfHeight = logoHeight / 2;
    // Same positioning as render()
    const paddingAdjustment = logoWidth * 0.12;
    const cx = vw - margin - logoHalfWidth + paddingAdjustment;
    const cy = margin + logoHalfHeight;
    return {
      circleCx: cx,
      circleCy: cy,
      circleR: radius,
      circleOpacity: 0.5,
      logoX: cx - logoHalfWidth,
      logoY: cy - logoHalfHeight,
      logoWidth,
      logoHeight,
      logoOpacity: 0.5,
      logoRotation: 0
    };
  }

  /**
   * Compute the expanded (focus-ring-center) state for circle + logo
   * @param {Object} arcParams - { hubX, hubY, radius } from focus-ring-geometry
   * @param {number} magnifierAngle - radians, from getMagnifierAngle
   */
  _getEndState(arcParams, magnifierAngle) {
    const frRadius = arcParams.radius;
    // Circle expands to hub center at 99% of focus ring radius
    const endCircleR = frRadius * 0.99;
    // Logo: 100% of FR radius for width, at -35% of FR radius from screen center
    // v0 positions logo relative to screen center (0,0 in center-origin SVG),
    // NOT relative to the hub (which is far off-screen right).
    // In v3's top-left origin, screen center is (width/2, height/2).
    const logoAspectRatio = 154 / 134;
    const logoWidth = frRadius * 1.0;
    const logoHeight = logoWidth / logoAspectRatio;
    const logoCenterRadius = frRadius * -0.35;
    const screenCenterX = this.viewport.width / 2;
    const screenCenterY = this.viewport.height / 2;
    const logoCenterX = screenCenterX + logoCenterRadius * Math.cos(magnifierAngle);
    const logoCenterY = screenCenterY + logoCenterRadius * Math.sin(magnifierAngle);
    // Rotation: align logo with magnifier angle (CCW convention)
    const rotationDeg = (magnifierAngle * 180 / Math.PI) - 180;
    const configOpacity = this._renderConfig?.color_scheme?.detail_sector_opacity;
    const circleEndOpacity = configOpacity ? parseFloat(configOpacity) : 1.0;
    return {
      circleCx: arcParams.hubX,
      circleCy: arcParams.hubY,
      circleR: endCircleR,
      circleOpacity: circleEndOpacity,
      logoX: logoCenterX - logoWidth / 2,
      logoY: logoCenterY - logoHeight / 2,
      logoWidth,
      logoHeight,
      logoOpacity: 0.10,    // watermark
      logoRotation: rotationDeg,
      logoCenterX,
      logoCenterY
    };
  }

  /**
   * @returns {boolean} true if Detail Sector is currently expanded
   */
  get expanded() { return this._expanded; }

  /**
   * @returns {boolean} true if an animation is in progress
   */
  get animating() { return this._animating; }

  /**
   * Expand the Detail Sector circle + logo from upper-right corner to focus ring center
   * @param {Object} arcParams - { hubX, hubY, radius }
   * @param {number} magnifierAngle - radians
   * @param {Function} [onComplete] - called when animation finishes
   */
  expand(arcParams, magnifierAngle, onComplete) {
    if (!this.circle || !arcParams) {
      if (onComplete) onComplete();
      return;
    }
    if (this._animationId) {
      cancelAnimationFrame(this._animationId);
      this._animationId = null;
    }
    this._animating = true;
    if (this.clickTarget) this.clickTarget.parentNode.setAttribute('display', 'none');
    const start = this._getStartState();
    const end = this._getEndState(arcParams, magnifierAngle);
    // Apply detail_sector color if configured
    const detailColor = this._renderConfig?.color_scheme?.detail_sector;
    if (detailColor && this.circle) {
      this.circle.setAttribute('fill', detailColor);
    }
    const t0 = performance.now();
    const step = now => {
      const elapsed = now - t0;
      const progress = Math.min(elapsed / ANIMATION_DURATION, 1);
      const t = easeInOut(progress);
      this._applyFrame(start, end, t);
      if (progress < 1) {
        this._animationId = requestAnimationFrame(step);
      } else {
        // Snap to exact end state
        this._applyFrame(start, end, 1);
        this._animationId = null;
        this._animating = false;
        this._expanded = true;
        if (onComplete) onComplete();
      }
    };
    this._animationId = requestAnimationFrame(step);
  }

  /**
   * Collapse the Detail Sector back to upper-right corner
   * @param {Object} arcParams - { hubX, hubY, radius }
   * @param {number} magnifierAngle - radians
   * @param {Function} [onComplete] - called when animation finishes
   */
  collapse(arcParams, magnifierAngle, onComplete) {
    if (!this.circle) {
      if (onComplete) onComplete();
      return;
    }
    if (this._animationId) {
      cancelAnimationFrame(this._animationId);
      this._animationId = null;
    }
    this._animating = true;
    const start = this._getEndState(arcParams, magnifierAngle); // current = expanded
    const end = this._getStartState();                           // target = collapsed
    // v0 parity: collapse uses 1.0 start opacity for BOTH circle and logo
    // (not 0.10 which is the expand-end logo watermark opacity)
    start.logoOpacity = 1.0;
    const t0 = performance.now();
    const step = now => {
      const elapsed = now - t0;
      const progress = Math.min(elapsed / ANIMATION_DURATION, 1);
      const t = easeInOut(progress);
      this._applyFrame(start, end, t);
      if (progress < 1) {
        this._animationId = requestAnimationFrame(step);
      } else {
        this._applyFrame(start, end, 1);
        // Reset fill to default after collapse
        const defaultFill = this._renderConfig?.color_scheme?.detail_sector || '#362e6a';
        if (this.circle) this.circle.setAttribute('fill', defaultFill);
        if (this.logo) this.logo.removeAttribute('transform');
        this._animationId = null;
        this._animating = false;
        this._expanded = false;
        if (this.clickTarget) this.clickTarget.parentNode.removeAttribute('display');
        if (onComplete) onComplete();
      }
    };
    this._animationId = requestAnimationFrame(step);
  }

  /**
   * Apply a single interpolated frame between two states
   */
  _applyFrame(from, to, t) {
    const lerp = (a, b) => a + (b - a) * t;
    if (this.circle) {
      this.circle.setAttribute('cx', lerp(from.circleCx, to.circleCx));
      this.circle.setAttribute('cy', lerp(from.circleCy, to.circleCy));
      this.circle.setAttribute('r', lerp(from.circleR, to.circleR));
      this.circle.setAttribute('opacity', lerp(from.circleOpacity, to.circleOpacity));
    }
    if (this.logo) {
      const x = lerp(from.logoX, to.logoX);
      const y = lerp(from.logoY, to.logoY);
      const w = lerp(from.logoWidth, to.logoWidth);
      const h = lerp(from.logoHeight, to.logoHeight);
      const rot = lerp(from.logoRotation, to.logoRotation);
      const opacity = lerp(from.logoOpacity, to.logoOpacity);
      this.logo.setAttribute('x', x);
      this.logo.setAttribute('y', y);
      this.logo.setAttribute('width', w);
      this.logo.setAttribute('height', h);
      this.logo.setAttribute('opacity', opacity);
      const cx = x + w / 2;
      const cy = y + h / 2;
      this.logo.setAttribute('transform', `rotate(${rot}, ${cx}, ${cy})`);
    }
  }

  setBlur(enabled, filterId = 'focus-blur-filter') {
    if (!this.group) return;
    if (enabled) {
      this.group.setAttribute('filter', `url(#${filterId})`);
      this.group.style.pointerEvents = 'none';
    } else {
      this.group.removeAttribute('filter');
      this.group.style.pointerEvents = '';
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
    if (this.clickTarget) {
      this.clickTarget.parentNode.remove();
      this.clickTarget = null;
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
