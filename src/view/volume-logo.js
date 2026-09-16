/**
 * Volume Logo Module
 * Domain-specific logo rendering in upper-right corner
 * Handles expand/collapse animation for Detail Sector
 * 
 * Configured per volume in its own data:
 * {
 *   "detail_sector": {
 *     "logo_base_path": "assets/",
 *     "default_image": "torah_scroll"
 *   }
 * }
 *
 * THE PATH IS RELATIVE TO THE VOLUME'S DATA ROOT, not to the app (W-114).
 * This renderer ships no volume's emblem, because a picture can assert
 * something about a corpus and this module must serve every volume alike.
 * `logo_base_path` is joined to whatever root the volume's own config
 * declares, so a volume that pins a data version gets an image pinned with
 * it — immutable and cacheable forever, like every artifact beside it.
 *
 * The example above named a VOLUME rather than a picture, and the file it
 * named had already been replaced in the data. Images live with their volume
 * now, and that one is called after what is in it.
 * 
 * Animation: 600ms quadratic ease-in-out
 * Expand: circle 12% SSd → 99% FR radius at hub, logo → watermark at -35% FR offset
 * Collapse: reverse of expand
 */

// THE LOGO'S SIZE, in the two states, as named knobs (FN-4, 2026-08-17).
//
// Both numbers were literals repeated inside the render and the animation's
// start state. That is a jump waiting to happen: tune one and the badge
// changes size the instant the expand begins, because the frame the animation
// starts from is no longer the frame that was drawn.
//
// COLLAPSED is a multiple of the badge circle's DIAMETER — above 1 the art
// deliberately overhangs the circle; below 1.149 (the box aspect) the art
// sits INSIDE it. 1.8 put a wide emblem's ends far outside the badge, and
// 1.35 was still too far — Howell, twice, from the LAN. At 1.1 a square
// emblem draws just within the blue rather than spilling over it.
//
// EXPANDED is a fraction of the FOCUS RING radius, drawn at 10% opacity as a
// watermark behind the leaf text. It was 1.0, which brought the emblem's edge
// too near the ring band; 0.8 cleared it and read a little small. 0.9 is the
// midpoint Howell asked for, and it is a true midpoint in drawn pixels too —
// the scale is linear, so on a 720x1600 phone the watermark goes 1860 -> 1488
// -> 1674, which is exactly halfway back.
//
// THE BOX ASPECT IS INHERITED AND WRONG, and is left alone deliberately —
// see the note where it is used.
const LOGO_COLLAPSED_SCALE = 1.1;
const LOGO_EXPANDED_SCALE = 0.9;

// Inherited from the v0 artwork, and no image we ship has this aspect —
// measured, they run from 1.000 (square) through 1.029 to 2.500. It does not
// DISTORT anything — the <image>
// keeps its own aspect and fits inside this box — but it does decide which
// edge binds, so the rendered size is smaller than the box in one dimension
// and by a different amount for each volume.
//
// NOT changed here. Making the box square would be the honest fix and would
// alter every other volume's emblem too, none of which anyone is looking at
// today. It wants its own change and its own look on the LAN.
const LOGO_BOX_ASPECT = 154 / 134;

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
    this._collapsing = false;   // ...and which WAY it is going
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
    const fullSize = radius * 2 * LOGO_COLLAPSED_SCALE;
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
  // SWAP THE EMBLEM WITHOUT REBUILDING (H-31).
  //
  // The image belongs to the DIVISION, so it must change while the reader is
  // standing still — crossing from Malachi into Matthew in an edition that
  // holds both — and that crossing can happen with the detail sector open and
  // the badge expanded.
  //
  // `render()` cannot do it: it clears the group and resets `_expanded` and
  // `_animating` to false, so calling it at a leaf would drop an expanded
  // badge to collapsed geometry with no animation while the host went on
  // believing it was open. This changes the one attribute that actually
  // differs and touches nothing else.
  //
  // Returns whether anything changed, so a caller on a per-frame signal can
  // tell a real swap from the ninety-nine calls that are not.
  setImage(imageName) {
    if (!this.logo) return false;
    // CLEARING IS A REAL REQUEST, NOT A NO-OP (2026-08-24). An empty name
    // means the volume was asked and this edition declares no emblem, so the
    // badge must go blank rather than keep the LAST edition's mark. It
    // returned false here and changed nothing, which is why a reader who
    // committed an edition declaring no emblem went on seeing the PREVIOUS
    // edition's. The element is hidden rather than pointed at an empty href,
    // which would ask the browser for a file named nothing.
    if (imageName === '') {
      // Idempotent, like every other name: a host on a per-frame signal must
      // be able to ask repeatedly and hear "nothing changed".
      if (this._renderConfig?.default_image === '') return false;
      if (this.logo.style) this.logo.style.display = 'none';
      if (this._renderConfig) this._renderConfig.default_image = '';
      return true;
    }
    if (this.logo.style) this.logo.style.display = '';
    if (!imageName) return false;
    const base = this._renderConfig?.logo_base_path;
    if (!base) return false;
    if (this._renderConfig.default_image === imageName) return false;
    this._renderConfig.default_image = imageName;
    this.logo.setAttributeNS(XLINK_NS, 'href', `${base}${imageName}.png`);
    // Each emblem at its own size (O-148): a collapsed badge is re-boxed now;
    // an expanded or moving one takes it from its next journey's first frame.
    if (!this._expanded && !this._animating && typeof this.logo.setAttribute === 'function') {
      const s = this._getStartState();
      this.logo.setAttribute('x', s.logoX);
      this.logo.setAttribute('y', s.logoY);
      this.logo.setAttribute('width', s.logoWidth);
      this.logo.setAttribute('height', s.logoHeight);
    }
    return true;
  }

  // THE COLOUR UNDER THE EMBLEM, SWAPPED THE SAME WAY (O-79, Howell
  // 2026-08-20). He asked for the circle under the art — the one that becomes
  // the detail sector's background — to change as the reader crosses between
  // the divisions of a volume. WHICH divisions those are, and what they are
  // called, is the adapter's business and never this file's (O-43): here it
  // is one colour arriving, from a caller that knows why.
  //
  // It rides `_renderConfig.color_scheme.detail_sector` rather than a field
  // of its own, because THREE places already read that one value — the first
  // paint, the expand, and the collapse's reset — and a second source would
  // be a fourth answer that only some of them heard. Writing it here means
  // the badge, the expanding circle and the leaf's background are the same
  // colour by construction rather than by three edits kept in step.
  //
  // Returns whether anything changed, like `setImage`, so a caller on a
  // per-position signal can tell a real crossing from the calls that are not.
  setColor(color) {
    if (!color || !this._renderConfig) return false;
    const scheme = this._renderConfig.color_scheme || (this._renderConfig.color_scheme = {});
    if (scheme.detail_sector === color) return false;
    scheme.detail_sector = color;
    // REPAINTED WHATEVER STATE THE BADGE IS IN, which is the point rather
    // than a risk. The crossing this answers happens with the detail sector
    // OPEN — the reader is at a leaf when the edition changes under them — so
    // a version that waited for the next collapse would leave the NEW
    // division's emblem sitting on the OLD one's colour, which is the
    // mismatch H-31 was written to end. `setImage` does not wait either, for
    // the same reason. `_applyFrame` animates geometry and opacity and never
    // touches fill, so a swap mid-animation is safe.
    if (this.circle) this.circle.setAttribute('fill', color);
    return true;
  }

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
    
    const { centerX, centerY, logoWidth, logoHeight } = this._collapsedGeometry();
    
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
    // NO OUTLINE (Howell, 2026-08-17: "I'd like to try removing the dark
    // stroke"). The badge was a 1px black ring over a 50%-opacity fill, which
    // drew a hard edge around a deliberately soft shape. Removed rather than
    // set to 'none' so nothing has to be undone if it stays.
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
  // THE BADGE'S PLACE AND THE EMBLEM'S SIZE ARE TWO THINGS (O-148, Howell
  // 2026-09-16, with the old gateway build beside the LAN: "the Crown of
  // Thorns is larger than the blue circle... I want to leave the Torah scroll
  // as it is, but put the crown of thorns back to the larger size"). One
  // constant sized both: when the scroll was judged to spill (1.8 -> 1.35 ->
  // 1.1, 2026-08-17) the crown shrank with it, and the crown is DRAWN to ring
  // the circle. So the circle is placed from the base scale, as the scroll
  // is today, and the image is sized by its OWN scale around that same
  // centre — declared per emblem by the volume (display_config.detail_sector
  // .emblem_scale, a multiple of the circle's diameter), else the base.
  _emblemScale() {
    const name = this._renderConfig?.default_image;
    const declared = Number(this._renderConfig?.emblem_scale?.[name]);
    return Number.isFinite(declared) && declared > 0 ? declared : LOGO_COLLAPSED_SCALE;
  }

  _collapsedGeometry() {
    const vw = this.viewport.width;
    const vh = this.viewport.height;
    const SSd = Math.min(vw, vh);
    const radius = SSd * 0.12;
    const margin = SSd * 0.03;
    // The circle's place, from the base box — unchanged for every emblem.
    const baseWidth = radius * 2 * LOGO_COLLAPSED_SCALE;
    const baseHeight = baseWidth / LOGO_BOX_ASPECT;
    // Shift 12% right to account for padding in the image file.
    const centerX = vw - margin - baseWidth / 2 + baseWidth * 0.12;
    const centerY = margin + baseHeight / 2;
    // The emblem's own box, centred on it.
    const logoWidth = radius * 2 * this._emblemScale();
    const logoHeight = logoWidth / LOGO_BOX_ASPECT;
    return { radius, margin, centerX, centerY, logoWidth, logoHeight };
  }

  _getStartState() {
    const { radius, centerX: cx, centerY: cy, logoWidth, logoHeight } = this._collapsedGeometry();
    return {
      circleCx: cx,
      circleCy: cy,
      circleR: radius,
      circleOpacity: 0.5,
      logoX: cx - logoWidth / 2,
      logoY: cy - logoHeight / 2,
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
    const logoWidth = frRadius * LOGO_EXPANDED_SCALE;
    const logoHeight = logoWidth / LOGO_BOX_ASPECT;
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

  // WHICH WAY THE SECTOR IS MOVING (Howell 2026-08-12, the empty sky).
  //
  // Callers suppressed the child pyramid whenever this was animating, in
  // either direction. But the two directions mean opposite things: an
  // EXPANDING sector is taking the screen, so the pyramid must go; a
  // COLLAPSING one is giving it back, and the pyramid should already be
  // arriving as it leaves. Suppressing during a collapse is what left the sky
  // empty on the first ascent out of a leaf.
  get collapsing() { return this._animating && this._collapsing; }

  /**
   * Expand the Detail Sector circle + logo from upper-right corner to focus ring center
   * @param {Object} arcParams - { hubX, hubY, radius }
   * @param {number} magnifierAngle - radians
   * @param {Function} [onComplete] - called when animation finishes
   */
  // THE SECTOR RIDES THE FINGER (O-140, Howell 2026-09-15: "the contraction
  // and enlargement of that circle needs to follow the slide from parent
  // button to magnifier and back"). Expand and collapse are one geometry
  // driven by a clock; whose clock is the caller's choice. beginExpand and
  // beginCollapse prepare the journey and hand back frameAt(progress) — 0 to
  // 1, eased here so a linear clock draws the same curve the tap always
  // drew — with finish() to land it, revert() to put it back where it
  // started, and play(onComplete) to run it on the sector's own clock. The
  // tap's expand() and collapse() are play() and nothing more.
  get duration() { return ANIMATION_DURATION; }

  beginExpand(arcParams, magnifierAngle) {
    if (!this.circle || !arcParams) return this._nullJourney();
    if (this._animationId) { cancelAnimationFrame(this._animationId); this._animationId = null; }
    this._animating = true;
    this._collapsing = false;
    if (this.clickTarget) this.clickTarget.parentNode.setAttribute('display', 'none');
    const start = this._getStartState();
    const end = this._getEndState(arcParams, magnifierAngle);
    // Apply detail_sector color if configured
    const detailColor = this._renderConfig?.color_scheme?.detail_sector;
    if (detailColor && this.circle) this.circle.setAttribute('fill', detailColor);
    return this._journey(start, end, {
      finish: () => {
        this._applyFrame(start, end, 1);
        this._animating = false;
        this._collapsing = false;
        this._expanded = true;
      },
      revert: () => {
        this._applyFrame(start, end, 0);
        this._animating = false;
        this._collapsing = false;
        this._expanded = false;
        if (this.clickTarget) this.clickTarget.parentNode.removeAttribute('display');
      }
    });
  }

  beginCollapse(arcParams, magnifierAngle) {
    if (!this.circle) return this._nullJourney();
    if (this._animationId) { cancelAnimationFrame(this._animationId); this._animationId = null; }
    this._animating = true;
    this._collapsing = true;
    const start = this._getEndState(arcParams, magnifierAngle); // current = expanded
    const end = this._getStartState();                           // target = collapsed
    // The emblem shrinks from the watermark it IS (0.10) up to the badge's
    // opacity. A v0-parity line here set the start to 1.0 — the scroll went
    // solid the instant a collapse began — unseen at 600 ms, glaring once
    // the finger could hold it (Howell 2026-09-15, O-141).
    return this._journey(start, end, {
      finish: () => {
        this._applyFrame(start, end, 1);
        // Reset fill to default after collapse
        const defaultFill = this._renderConfig?.color_scheme?.detail_sector || '#362e6a';
        if (this.circle) this.circle.setAttribute('fill', defaultFill);
        if (this.logo) this.logo.removeAttribute('transform');
        this._animating = false;
        this._collapsing = false;
        this._expanded = false;
        if (this.clickTarget) this.clickTarget.parentNode.removeAttribute('display');
      },
      revert: () => {
        this._applyFrame(start, end, 0);
        this._animating = false;
        this._collapsing = false;
        this._expanded = true;
      }
    });
  }

  _journey(start, end, { finish, revert }) {
    const self = this;
    let done = false;
    return {
      frameAt(progress) {
        if (done) return;
        const p = Math.max(0, Math.min(1, Number(progress) || 0));
        self._applyFrame(start, end, easeInOut(p));
      },
      finish() { if (done) return; done = true; self._animationId = null; finish(); },
      revert() { if (done) return; done = true; self._animationId = null; revert(); },
      play(onComplete) {
        const t0 = performance.now();
        const step = now => {
          if (done) return;
          const progress = Math.min((now - t0) / ANIMATION_DURATION, 1);
          this.frameAt(progress);
          if (progress < 1) self._animationId = requestAnimationFrame(step);
          else { this.finish(); if (onComplete) onComplete(); }
        };
        self._animationId = requestAnimationFrame(step);
      }
    };
  }

  _nullJourney() {
    return { frameAt() {}, finish() {}, revert() {}, play(onComplete) { if (onComplete) onComplete(); } };
  }

  /**
   * Expand the Detail Sector from the corner badge, on its own clock.
   * @param {Object} arcParams - { hubX, hubY, radius }
   * @param {number} magnifierAngle - radians
   * @param {Function} [onComplete] - called when animation finishes
   */
  expand(arcParams, magnifierAngle, onComplete) {
    this.beginExpand(arcParams, magnifierAngle).play(onComplete);
  }

  /**
   * Collapse the Detail Sector back to the upper-right corner, on its own clock.
   * @param {Object} arcParams - { hubX, hubY, radius }
   * @param {number} magnifierAngle - radians
   * @param {Function} [onComplete] - called when animation finishes
   */
  collapse(arcParams, magnifierAngle, onComplete) {
    this.beginCollapse(arcParams, magnifierAngle).play(onComplete);
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
