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

// THE SOFT EDGE (O-266). The disc is solid to its radius and fades to nothing
// across a band beyond it, `disc_feather` of that radius wide. The fade's
// shape, as [fraction of the band, opacity]: an ease that leaves the solid
// part without a visible shoulder and arrives at nothing without a rim.
const FEATHER_CURVE = [[0, 1], [0.15, 0.94], [0.3, 0.8], [0.5, 0.5], [0.7, 0.2], [0.85, 0.06], [1, 0]];
// The edge hardens over the first part of an expand and softens over the last
// part of a collapse — while the disc is still small, so the repaint a
// gradient change costs is a small one (O-160 keeps the flight itself to
// transforms).
const FEATHER_WINDOW = 0.25;
const FEATHER_ID = 'volume-logo-feather';
const SECTOR_CLIP_ID = 'volume-logo-sector';
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
    // THE FENCE STANDS WHILE THE BADGE IS FLYING HOME (O-189, Howell's phone
    // 2026-10-01: a verse's star seated on top of the crown). This answered
    // nothing while the badge was animating — written when the sky was laid
    // only at rest, and true then. The drill-out's rework (O-161: the verse
    // folds into the badge over the flight; O-170: departing nodes fly
    // straight to their sky seats) lays the sky at the start of that very
    // flight, so the sky asked for a corner to avoid and was told there was
    // none. The badge's DESTINATION is what the sky must avoid: collapsed, or
    // collapsing, the corner box; expanded, or expanding, nothing — the sky
    // is suppressed for an arriving sector anyway.
    if (this._expanded && !this._collapsing) return null;
    if (this._animating && !this._collapsing) return null;

    // AND THE FENCE IS WHERE THE BADGE IS (O-189, the same morning: a seat
    // of the sky inside the circle itself). This box was still computed from the
    // badge's OLD seat and size — the one every emblem shared before O-148
    // (2026-09-16) placed the circle by the largest emblem's box and let the
    // crown ring it at 1.8 — so the sky was keeping clear of a corner the
    // badge had left. The box is now the emblem's own, centred on the
    // circle, the same geometry that draws it: for the crown, the thorns'
    // full spread; for the scroll, a little past its circle.
    const { centerX, centerY, radius, logoWidth, logoHeight } = this._collapsedGeometry();
    const boxW = Math.max(logoWidth, radius * 2), boxH = Math.max(logoHeight, radius * 2);
    return {
      centerX,
      centerY,
      radius,
      boxSize: Math.max(boxW, boxH),
      left: centerX - boxW / 2,
      right: centerX + boxW / 2,
      top: centerY - boxH / 2,
      bottom: centerY + boxH / 2
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
      this._hrefSurround(); // no emblem, so no surround either
      return true;
    }
    if (this.logo.style) this.logo.style.display = '';
    if (!imageName) return false;
    const base = this._renderConfig?.logo_base_path;
    if (!base) return false;
    if (this._renderConfig.default_image === imageName) return false;
    this._renderConfig.default_image = imageName;
    this.logo.setAttributeNS(XLINK_NS, 'href', `${base}${imageName}.png`);
    this._hrefSurround();
    // Each emblem at its own size and place (O-148): a collapsed badge is
    // re-boxed now, circle with it; an expanded or moving one takes it from
    // its next journey's first frame.
    if (!this._expanded && !this._animating && typeof this.logo.setAttribute === 'function') {
      const s = this._getStartState();
      for (const [el, k] of this._layers()) {
        el.setAttribute('x', s[`${k}X`]);
        el.setAttribute('y', s[`${k}Y`]);
        el.setAttribute('width', s[`${k}Width`]);
        el.setAttribute('height', s[`${k}Height`]);
      }
      if (this.circle && typeof this.circle.setAttribute === 'function') {
        this.circle.setAttribute('cx', s.circleCx);
        this.circle.setAttribute('cy', s.circleCy);
        this.circle.setAttribute('r', s.circleR); // each emblem's own disc (O-265)
        this._setFeather(s.circleFeather); // and its own edge (O-266)
      }
      if (this.clickTarget && typeof this.clickTarget.setAttribute === 'function') {
        this.clickTarget.setAttribute('cx', s.circleCx);
        this.clickTarget.setAttribute('cy', s.circleCy);
      }
    } else if (this._expanded && !this._animating && this._openAt && typeof this.logo.setAttribute === 'function') {
      // AN OPEN SECTOR IS RE-BOXED TOO (O-267): the watermark's size is the
      // emblem's own now, so the crossing H-31 was written for — at a leaf,
      // the edition changing under the reader — would otherwise leave the new
      // emblem at the old one's zoom until the sector next closed.
      const e = this._getEndState(this._openAt.arcParams, this._openAt.magnifierAngle);
      for (const [el, k] of this._layers()) {
        el.setAttribute('x', e[`${k}X`]);
        el.setAttribute('y', e[`${k}Y`]);
        el.setAttribute('width', e[`${k}Width`]);
        el.setAttribute('height', e[`${k}Height`]);
        el.setAttribute('transform', `rotate(${e.logoRotation}, ${e.logoCenterX}, ${e.logoCenterY})`);
      }
    } else if (this._animating && this._flight) {
      // AND A FLIGHT UNDER WAY IS RE-AIMED (O-267). A boot at a leaf opens
      // the sector on the volume's default emblem and learns the reader's
      // division a moment later; the flight's two ends were reckoned for the
      // first emblem, and with a size per emblem it would land the second at
      // the first one's zoom. The ends are rewritten in place, so the journey
      // already playing carries on toward the right ones.
      Object.assign(this._flight.shut, this._getStartState());
      if (this._openAt) Object.assign(this._flight.open, this._getEndState(this._openAt.arcParams, this._openAt.magnifierAngle));
      this._frameBase = null;
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
    this._paintDisc();
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
    
    const { centerX, centerY, logoWidth, logoHeight, discRadius } = this._collapsedGeometry();
    
    // Create group
    this.group = document.createElementNS(SVG_NS, 'g');
    this.group.setAttribute('id', 'volume-logo-group');
    
    // Create blue circle background
    this.circle = document.createElementNS(SVG_NS, 'circle');
    this.circle.setAttribute('id', 'volume-logo-circle');
    this.circle.style.willChange = 'transform, opacity'; // composited in flight (O-160)
    this.circle.setAttribute('cx', centerX);
    this.circle.setAttribute('cy', centerY);
    this.circle.setAttribute('r', discRadius * (1 + this._discFeather()));
    this._featherNow = null;
    this._setFeather(this._discFeather());
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
      this.logo.style.willChange = 'transform, opacity'; // composited in flight (O-160)
      this.logo.setAttribute('id', 'volume-logo-image');
      this.logo.setAttributeNS(XLINK_NS, 'href', logoPath);
      this.logo.setAttribute('x', logoX);
      this.logo.setAttribute('y', logoY);
      this.logo.setAttribute('width', logoWidth);
      this.logo.setAttribute('height', logoHeight);
      this.logo.setAttribute('opacity', '0.5'); // START state: 50% opacity (matches v0)
      this.logo.style.pointerEvents = 'none';
      // THE WATERMARK IS DRAWN ONLY INSIDE THE SECTOR (O-267). The emblem sits
      // in a wrapper of its own so a clip can be put on the WRAPPER: the image
      // carries a rotation, and a clip on the image itself would turn with it.
      this.logoClip = document.createElementNS(SVG_NS, 'g');
      const clipDefs = document.createElementNS(SVG_NS, 'defs');
      const clip = document.createElementNS(SVG_NS, 'clipPath');
      clip.setAttribute('id', SECTOR_CLIP_ID);
      this._sectorClipCircle = clip.appendChild(document.createElementNS(SVG_NS, 'circle'));
      clipDefs.appendChild(clip);
      this.group.appendChild(clipDefs);
      // THE SURROUND, where the emblem declares one (O-268): a second picture
      // on the emblem's own box, in the same clipped wrapper.
      this.surround = document.createElementNS(SVG_NS, 'image');
      this.surround.setAttribute('id', 'volume-logo-surround');
      this.surround.style.willChange = 'transform, opacity';
      this.surround.style.pointerEvents = 'none';
      for (const k of ['x', 'y', 'width', 'height', 'opacity']) this.surround.setAttribute(k, this.logo.getAttribute(k));
      this._hrefSurround();
      this.logoClip.appendChild(this.surround);
      this.logoClip.appendChild(this.logo);
      this.group.appendChild(this.logoClip);
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

  // THE DISC HAS ITS OWN SIZE PER EMBLEM TOO (O-265, Howell 2026-11-06: for
  // the first time the coloured disc in the upper right corner is a different
  // size for each emblem, in addition to each one having its own artwork). An
  // emblem drawn to ring the circle hides the circle's hard
  // edge only if its band lies ACROSS that edge, and two rings of different
  // widths cannot both straddle one radius. So the volume may declare, per
  // emblem, a multiple of the base disc (display_config.detail_sector
  // .disc_scale); an emblem not named keeps the base. Only the DRAWN disc
  // changes: the badge's place, the emblem's size and the tap target are
  // still reckoned from the base radius, so nothing else moves.
  _discScale() {
    const name = this._renderConfig?.default_image;
    const declared = Number(this._renderConfig?.disc_scale?.[name]);
    return Number.isFinite(declared) && declared > 0 ? declared : 1;
  }

  // AND ITS OWN SIZE AS THE LEAF'S WATERMARK (O-267, Howell 2026-11-06, with
  // two open sectors side by side: the open sector of one emblem is to differ
  // from the other's "simply in terms of the amount of zoom … enlarge faster
  // and further so that the olive branch ring … disappears under the focus
  // ring, and … we are left with just the tilted Torah scroll alone"). An
  // emblem drawn as a centrepiece inside a ring is two pictures: all of it in
  // the corner, the centrepiece alone behind the text. Which one the open
  // sector shows is only a matter of how far it grows, so the volume declares
  // that per emblem (display_config.detail_sector.watermark_scale, a fraction
  // of the focus ring's radius), else the base. Same centre, same tilt, same
  // clock: a larger end is a faster flight.
  _expandedScale() {
    const name = this._renderConfig?.default_image;
    const declared = Number(this._renderConfig?.watermark_scale?.[name]);
    return Number.isFinite(declared) && declared > 0 ? declared : LOGO_EXPANDED_SCALE;
  }

  // AN EMBLEM MAY BE TWO PICTURES THAT PART COMPANY (O-268, Howell 2026-11-06,
  // on seeing O-267: "I don't want to crop the Torah scroll with the focus
  // ring … I want the Torah scroll to stop enlarging before it's too big to
  // fit within the details sector. This may require some cheating to make
  // the olive wreath go away under the focus ring"). One zoom cannot do both:
  // far enough for the ring around a centrepiece to leave the sector is too
  // far for the centrepiece to stay inside it. So the volume may name a
  // SURROUND for an emblem (display_config.detail_sector.emblem_surround) —
  // a second image on the same box, indistinguishable from one picture in the
  // corner — and how far the surround grows when the sector opens
  // (surround_watermark_scale); the emblem itself stops at watermark_scale.
  _surroundName() {
    const name = this._renderConfig?.default_image;
    const declared = this._renderConfig?.emblem_surround?.[name];
    return typeof declared === 'string' && declared ? declared : null;
  }

  _surroundExpandedScale() {
    const name = this._renderConfig?.default_image;
    const declared = Number(this._renderConfig?.surround_watermark_scale?.[name]);
    return Number.isFinite(declared) && declared > 0 ? declared : this._expandedScale();
  }

  _hrefSurround() {
    if (!this.surround) return;
    const name = this._surroundName(), base = this._renderConfig?.logo_base_path;
    if (name && base) {
      this.surround.setAttributeNS(XLINK_NS, 'href', `${base}${name}.png`);
      this.surround.style.display = '';
    } else {
      this.surround.style.display = 'none';
    }
  }

  // The emblem and its surround, each with the prefix its box rides under in a state.
  _layers() {
    return [[this.logo, 'logo'], [this.surround, 'surround']].filter(([el]) => el && typeof el.setAttribute === 'function');
  }

  // AND ITS OWN EDGE (O-266, Howell 2026-11-06: "the hard edge of the blue
  // circle just feels lazy to me. I would try doing a blurred edge... I want
  // the blur to begin where the current hard edge is. In other words, I want
  // the circle to get larger overall"). Per emblem again, a fraction of the
  // disc's radius (display_config.detail_sector.disc_feather); an emblem not
  // named keeps its hard edge. A GRADIENT, not a filter: an SVG blur dies on
  // WebKit below the top-level svg, and a gradient also says exactly where
  // the fade begins, which a blur cannot.
  _discFeather() {
    const name = this._renderConfig?.default_image;
    const declared = Number(this._renderConfig?.disc_feather?.[name]);
    return Number.isFinite(declared) && declared > 0 ? declared : 0;
  }

  _discColour() {
    return this._renderConfig?.color_scheme?.detail_sector || '#362e6a';
  }

  // The disc's fill, in whatever state its edge is in.
  _paintDisc() {
    if (!this.circle) return;
    const colour = this._discColour();
    if (this._featherNow > 0 && this._gradientStops) {
      for (const stop of this._gradientStops) stop.setAttribute('stop-color', colour);
      this.circle.setAttribute('fill', `url(#${FEATHER_ID})`);
    } else {
      this.circle.setAttribute('fill', colour);
    }
  }

  // `f` is the fade band as a fraction of the solid radius; the circle's `r`
  // is the OUTER radius, solid * (1 + f), so the solid part ends at 1 / (1 + f)
  // of the gradient.
  _setFeather(f) {
    if (!this.circle) return;
    const want = f > 0 ? f : 0;
    if (this._featherNow === want) return;
    this._featherNow = want;
    if (want > 0 && !this._gradientStops && this.group && typeof document !== 'undefined') {
      const defs = document.createElementNS(SVG_NS, 'defs');
      const gradient = document.createElementNS(SVG_NS, 'radialGradient');
      gradient.setAttribute('id', FEATHER_ID);
      this._gradientStops = [null, ...FEATHER_CURVE].map(() => gradient.appendChild(document.createElementNS(SVG_NS, 'stop')));
      this._gradientStops[0].setAttribute('offset', 0);
      this._gradientStops[0].setAttribute('stop-opacity', 1);
      FEATHER_CURVE.forEach(([, alpha], i) => this._gradientStops[i + 1].setAttribute('stop-opacity', alpha));
      defs.appendChild(gradient);
      this.group.insertBefore(defs, this.group.firstChild);
    }
    if (want > 0 && this._gradientStops) {
      const solid = 1 / (1 + want);
      FEATHER_CURVE.forEach(([u], i) => this._gradientStops[i + 1].setAttribute('offset', solid + (1 - solid) * u));
    }
    this._paintDisc();
  }

  // THE OPEN SECTOR'S OUTLINE CLIPS THE EMBLEM, from the moment it begins to
  // open until it is shut again (O-267). An emblem that grows past the base
  // size reaches beyond the focus ring, and what lies beyond it is the bare
  // ground: the first build of the per-emblem size left its ring showing on
  // the far side of the band, behind the parent's name. Clipped for the whole
  // flight rather than at its end, so nothing appears or vanishes on landing
  // — but only where the corner badge already lies inside the open sector,
  // or the clip would bite the badge itself at the first frame.
  _setSectorClip(open) {
    if (!this.logoClip || !this._sectorClipCircle) return;
    if (!open) { this.logoClip.removeAttribute('clip-path'); return; }
    const shut = this._getStartState();
    const far = Math.max(...[[0, 0], [1, 0], [0, 1], [1, 1]].map(([i, j]) =>
      Math.hypot(shut.logoX + i * shut.logoWidth - open.circleCx, shut.logoY + j * shut.logoHeight - open.circleCy)));
    if (far > open.circleR) { this.logoClip.removeAttribute('clip-path'); return; }
    this._sectorClipCircle.setAttribute('cx', open.circleCx);
    this._sectorClipCircle.setAttribute('cy', open.circleCy);
    this._sectorClipCircle.setAttribute('r', open.circleR);
    this.logoClip.setAttribute('clip-path', `url(#${SECTOR_CLIP_ID})`);
  }

  // Where the edge is, between two states: soft only at the collapsed end.
  _featherAt(from, to, t) {
    const a = from.circleFeather || 0, b = to.circleFeather || 0;
    if (!a && !b) return 0;
    if (a > 0) return a * (1 - Math.min(1, t / FEATHER_WINDOW));
    return b * Math.max(0, (t - (1 - FEATHER_WINDOW)) / FEATHER_WINDOW);
  }

  _collapsedGeometry() {
    const vw = this.viewport.width;
    const vh = this.viewport.height;
    const SSd = Math.min(vw, vh);
    const radius = SSd * 0.12;
    const margin = SSd * 0.03;
    // ONE CIRCLE, ONE PLACE, FOR EVERY EMBLEM (O-148, amended twice the same
    // morning). Howell compared the crown with the backup build — "the whole
    // thing is too big" — and its size was the backup's to the pixel; what
    // differed was the PLACE, crushed into the corner. Placing each badge by
    // its own box fixed the crown and made the circle jump between the two
    // divisions; then Howell asked that both circles align absolutely, each
    // artwork keeping its centred position in the one circle. So it is placed by
    // the LARGEST box the volume declares — where the backup stood it — for
    // every emblem, and each emblem is centred in it at its own size.
    const declared = Object.values(this._renderConfig?.emblem_scale || {}).map(Number).filter(n => Number.isFinite(n) && n > 0);
    const placeWidth = radius * 2 * Math.max(LOGO_COLLAPSED_SCALE, ...declared);
    const placeHeight = placeWidth / LOGO_BOX_ASPECT;
    // Shift 12% right to account for padding in the image file.
    const centerX = vw - margin - placeWidth / 2 + placeWidth * 0.12;
    const centerY = margin + placeHeight / 2;
    const logoWidth = radius * 2 * this._emblemScale();
    const logoHeight = logoWidth / LOGO_BOX_ASPECT;
    return { radius, discRadius: radius * this._discScale(), margin, centerX, centerY, logoWidth, logoHeight };
  }

  /** The badge's centre when collapsed, in viewport px — where the sector's contents fold back to (O-161). */
  collapsedCentre() {
    if (!this._renderConfig) return null;
    const { centerX, centerY, radius } = this._collapsedGeometry();
    return { x: centerX, y: centerY, radius };
  }

  _getStartState() {
    const { discRadius, centerX: cx, centerY: cy, logoWidth, logoHeight } = this._collapsedGeometry();
    return {
      circleCx: cx,
      circleCy: cy,
      circleR: discRadius * (1 + this._discFeather()),
      circleFeather: this._discFeather(),
      circleOpacity: 0.5,
      logoX: cx - logoWidth / 2,
      logoY: cy - logoHeight / 2,
      logoWidth,
      logoHeight,
      // one picture in the corner: the surround lies on the emblem's box
      surroundX: cx - logoWidth / 2,
      surroundY: cy - logoHeight / 2,
      surroundWidth: logoWidth,
      surroundHeight: logoHeight,
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
    const logoWidth = frRadius * this._expandedScale();
    const logoHeight = logoWidth / LOGO_BOX_ASPECT;
    const surroundWidth = frRadius * this._surroundExpandedScale();
    const surroundHeight = surroundWidth / LOGO_BOX_ASPECT;
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
      circleFeather: 0,
      circleOpacity: circleEndOpacity,
      logoX: logoCenterX - logoWidth / 2,
      logoY: logoCenterY - logoHeight / 2,
      logoWidth,
      logoHeight,
      // same centre and tilt, grown further (O-268)
      surroundX: logoCenterX - surroundWidth / 2,
      surroundY: logoCenterY - surroundHeight / 2,
      surroundWidth,
      surroundHeight,
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
    this._openAt = { arcParams, magnifierAngle };
    const start = this._getStartState();
    const end = this._getEndState(arcParams, magnifierAngle);
    this._flight = { shut: start, open: end };
    this._setSectorClip(end);
    this._paintDisc();
    return this._journey(start, end, {
      finish: () => {
        this._applyFrame(start, end, 1);
        this._animating = false;
        this._collapsing = false;
        this._expanded = true;
      },
      revert: () => {
        this._applyFrame(start, end, 0);
        this._setSectorClip(null);
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
    if (arcParams) this._openAt = { arcParams, magnifierAngle };
    const start = this._getEndState(arcParams, magnifierAngle); // current = expanded
    const end = this._getStartState();                           // target = collapsed
    this._flight = { shut: end, open: start };
    this._setSectorClip(start);
    // The emblem shrinks from the watermark it IS (0.10) up to the badge's
    // opacity. A v0-parity line here set the start to 1.0 — the scroll went
    // solid the instant a collapse began — unseen at 600 ms, glaring once
    // the finger could hold it (Howell 2026-09-15, O-141).
    return this._journey(start, end, {
      finish: () => {
        this._applyFrame(start, end, 1);
        this._paintDisc();
        this._setSectorClip(null);
        for (const [el] of this._layers()) if (typeof el.removeAttribute === 'function') el.removeAttribute('transform');
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
      // `linear` for a journey held by a finger (O-151): the finger is the
      // easing, so the circle follows it straight; played, it eases.
      frameAt(progress, { linear = false } = {}) {
        if (done) return;
        const p = Math.max(0, Math.min(1, Number(progress) || 0));
        self._applyFrame(start, end, linear ? p : easeInOut(p));
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
    // FRAMES IN FLIGHT ARE TRANSFORMS (O-160): the phone's frame readout put a
    // drill into a verse at half the display's rate. Every frame rewrote the
    // circle's geometry and the watermark's x, y, width and height — a raster
    // image rescaled from its source on every frame. Between the ends the
    // geometry now stays at the FROM state and a transform carries it; only
    // the ends (t = 0, t = 1) write the real attributes, so everything that
    // reads them sees a settled sector.
    this._setFeather(this._featherAt(from, to, t));
    if (t > 0 && t < 1) { this._applyTransformFrame(from, to, t); return; }
    this._frameBase = null;
    if (this.circle) { this.circle.style.transform = ''; this.circle.style.opacity = ''; }
    for (const [el] of this._layers()) if (el.style) { el.style.transform = ''; el.style.opacity = ''; }
    if (this.circle) {
      this.circle.setAttribute('cx', lerp(from.circleCx, to.circleCx));
      this.circle.setAttribute('cy', lerp(from.circleCy, to.circleCy));
      this.circle.setAttribute('r', lerp(from.circleR, to.circleR));
      this.circle.setAttribute('opacity', lerp(from.circleOpacity, to.circleOpacity));
    }
    for (const [el, k] of this._layers()) {
      const x = lerp(from[`${k}X`], to[`${k}X`]);
      const y = lerp(from[`${k}Y`], to[`${k}Y`]);
      const w = lerp(from[`${k}Width`], to[`${k}Width`]);
      const h = lerp(from[`${k}Height`], to[`${k}Height`]);
      const rot = lerp(from.logoRotation, to.logoRotation);
      const opacity = lerp(from.logoOpacity, to.logoOpacity);
      el.setAttribute('x', x);
      el.setAttribute('y', y);
      el.setAttribute('width', w);
      el.setAttribute('height', h);
      el.setAttribute('opacity', opacity);
      const cx = x + w / 2;
      const cy = y + h / 2;
      el.setAttribute('transform', `rotate(${rot}, ${cx}, ${cy})`);
    }
  }

  _applyTransformFrame(from, to, t) {
    const lerp = (a, b) => a + (b - a) * t;
    if (this.circle) {
      if (this._frameBase !== from) {
        this.circle.setAttribute('cx', from.circleCx);
        this.circle.setAttribute('cy', from.circleCy);
        this.circle.setAttribute('r', from.circleR);
      }
      const k = from.circleR ? lerp(from.circleR, to.circleR) / from.circleR : 1;
      const cx = lerp(from.circleCx, to.circleCx), cy = lerp(from.circleCy, to.circleCy);
      this.circle.style.transform = `translate(${cx - k * from.circleCx}px, ${cy - k * from.circleCy}px) scale(${k})`;
      this.circle.style.opacity = String(lerp(from.circleOpacity, to.circleOpacity));
    }
    for (const [el, p] of this._layers()) {
      const fx = from[`${p}X`], fy = from[`${p}Y`], fw = from[`${p}Width`], fh = from[`${p}Height`];
      if (this._frameBase !== from) {
        el.setAttribute('x', fx);
        el.setAttribute('y', fy);
        el.setAttribute('width', fw);
        el.setAttribute('height', fh);
      }
      const x = lerp(fx, to[`${p}X`]), y = lerp(fy, to[`${p}Y`]);
      const w = lerp(fw, to[`${p}Width`]), h = lerp(fh, to[`${p}Height`]);
      const kx = fw ? w / fw : 1, ky = fh ? h / fh : 1;
      const rot = lerp(from.logoRotation, to.logoRotation);
      const cx = x + w / 2, cy = y + h / 2;
      if (el.style) {
        el.style.transform = `translate(${cx}px, ${cy}px) rotate(${rot}deg) translate(${-cx}px, ${-cy}px) translate(${x - kx * fx}px, ${y - ky * fy}px) scale(${kx}, ${ky})`;
        el.style.opacity = String(lerp(from.logoOpacity, to.logoOpacity));
      }
    }
    this._frameBase = from;
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
      this._gradientStops = null;
      this._featherNow = null;
      this.logoClip = null;
      this._sectorClipCircle = null;
      this.surround = null;
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
