# FEEL.md — the wheel's motion constants, and why

Phase C's ledger. Every constant that shapes how the instrument feels gets a
name, a value, a home, and a rationale — so feel never becomes archaeology
again. Constants marked **FROZEN** are under Howell's standing order
(2026-07-17): no change without his express approval.

## The doctrines

- **The sprocket, not the carousel.** Nodes are links in a bounded chain
  wrapping an off-screen sprocket. Chains never loop; both ends are real
  places; overshoot + springback is the feel of the last link going taut.
- **One tempo.** All costume changes and travel animations share 600 ms.
- **Motion semantics.** Rotation = browsing. Constant-radius arrival =
  changing volume (lateral). Z-travel (radius change) = changing dimension —
  reserved exclusively for Phase D strata.
- **Chain-relative gestures.** The tier ladder (below) addresses chains in
  fractions, not nodes: every chain is the same size in gesture-space.

## The gesture ladder (C.3 spec; tiers land incrementally)

| Tier | Motion | Status |
|---|---|---|
| Tap | that node to the magnifier (fires at finger-lift, ≤8px slop) | shipped (pre-C; lift-decision added in C.3) |
| Scrub | pure 1:1 drag at every speed — the precision hand | **FROZEN** (Howell 2026-07-17: "scrubbing seems fine — eliminate any changes") |
| Flick | ballistic glide of FLICK_SCRUBS (=4) corner-to-corner scrubs | **shipped in C.3 (scrub-anchored 2026-07-17)** |
| Double-flick | to that end of the chain | shipped in C.3 |

The fast-scrub tier (one scrub-length = one flick's distance) is DROPPED for
now per the same ruling — the ladder is tap / scrub / flick / double-flick.

## Constants

### Frozen scrub feel

| Name | Value | Home | Why |
|---|---|---|---|
| `sensitivity` | π/4 per 100 px | main.js wireInteractions | 100 px of finger = 45° of ring, at every speed — the whole scrub |

RETIRED with the flick tier (approved 2026-07-17): the velocity-gain
amplifier — `velocityThreshold` 0.4, `gainSlope` 1.1, `targetSpinNodes` 350
(≈5.8× max gain). It made fast swipes travel a fixed ~350-node span
regardless of chain size (measured ~715 years/swipe on the 6000-year
calendar when saturated, and inconsistent 460–580 when not). Its distance
role moved to the ballistic flick; the drag itself is now pure 1:1.
`DECAY` 0.95 momentum machinery remains in rotation-choreographer, still
unused (no caller starts it).

### The tempo

| Name | Value | Home | Why |
|---|---|---|---|
| `ANIMATION_DURATION` | 600 ms | view/volume-logo.js | detail sector enlargement — the house tempo everything else inherits |
| `GLIDE_TO_LIMIT_MS` | 600 ms | main.js | double-flick travel: same tempo, any distance — arrival is predictable everywhere |

### Flick (scrub-anchored 2026-07-17)

REVISION: the flick was first shipped as 10%-of-chain ("every chain is ten
flicks long"). That ballooned on long chains — on the 84k-node months
timeline one flick lurched ~700 years while a corner-to-corner scrub crawled
~20 (a ~30× mismatch). Howell's principle: a swipe must not travel a
magnitude more than a corner-to-corner scrub. So the flick is now anchored to
the SCRUB, not the chain: it feels identical on 12 nodes or 84,000.
`FLICK_FRACTION` / `FLICK_MIN_FACTOR` are retired.

| Name | Value | Home | Why |
|---|---|---|---|
| `FLICK_SCRUBS` | 4 | interaction/gesture-tiers.js | a flick = this many corner-to-corner scrubs; chain-INDEPENDENT. Live-tunable via `window.__flickScrubs` (no rebuild). Howell verified 4 on the Moto G: "It feels good" |
| flick rotation | `k · (width+height) · sensitivity` | gesture-tiers.js computeFlickRotation | one scrub's rotation is the Manhattan finger span × the drag sensitivity — the flick reuses the drag's own px→rotation map, so it IS k scrubs by construction |
| `FLICK_GLIDE_MS` | 600 | gesture-tiers.js | the house tempo; arrival is predictable everywhere |
| (no floor) | — | glideTo clamp | a flick that overshoots a short chain lands at the end — the clamp replaces the old 2×visible floor |
| gate | 0.8 px/ms sustained at release | main.js (`isFast`) | shared with the double-flick legs — one definition of "fast" |
| `VELOCITY_WINDOW_MS` | 100 | main.js | "fast" is measured over the last 100ms before lift, NEVER per event sample — touch events arrive in ~1ms bursts whose instantaneous velocity spikes past any threshold mid-slow-scrub (the 2026-07-17 released-scrub-takes-off regression). A pause before lifting reads as 0. Direction comes from the same window, so a scrub ending in a quick opposite toss flicks the way the toss went |
| catch | pointerdown stops a glide | main.js drag-start | flick, flick, catch: the finger always wins |

### Double-flick (first C.3 tier, 2026-07-17)

| Name | Value | Home | Why |
|---|---|---|---|
| `DOUBLE_FLICK_WINDOW_MS` | 400 | main.js | max gap between the two fast swipes; wide enough for deliberate repetition, tight enough that two casual swipes don't trigger it |
| `DOUBLE_FLICK_MIN_VELOCITY` | 0.8 px/ms | main.js | both swipes must be genuinely fast — scrubbing can never accidentally travel to the end |
| easing | easeOutCubic | rotation-choreographer glideTo | fast departure, gentle arrival at the last link; overshoot not simulated (the clamp is the wall) |

Rules of engagement: additive changes only; before/after on the Moto G
(`?debug=1`); the frozen block moves only by express approval, and any
approved change updates this file in the same commit.

### Dropped / deferred (Howell ruling 2026-07-17: "the scrubbing seems fine
### — eliminate any changes to scrubbing for now")

| Name | Was planned as | Status |
|---|---|---|
| `SCRUB_LENGTH_IN` | ~1 inch, device-normalized standard scrub | dropped with the fast-scrub tier |
| `SLOW_SCRUB_RATE` | detented clicks per scrub-length | dropped — the scrub stays a smooth 1:1 drag |

---

# C.4/C.5 ledger (recorded 2026-07-20, from the sprint's shipped code)

Three canonical named-tunable blocks arrived with C.4/C.5, each documented
in-source as "tune here and only here": the splash's `T` budget, the
usable-area `CPUA_SPEC`, and the wedge's `WEDGE`. Everything below has a
home in one of those blocks or an adjacent module.

## C.4 — boot splash "the instrument arrives" (src/view/boot-splash.js)

Budgeted to ~7s total; plays once per browser (`SEEN_KEY`
`'wheel-splash-seen'` in localStorage; `?splash=1` forces, `?splash=0`
skips). Phone-tuned by Howell on the Moto G. All timings live in the `T`
object:

| Name | Value | Why |
|---|---|---|
| `T.preInkMs` | 400 | grey beat before the first line |
| `T.arcDrawMs` | 1600 | the ring arc inking itself, upper-left → lower-right |
| `T.nodeDrawMs` | 200 | each ring node's compass draw |
| `T.nodeGapMs` | 130 | tiny pause between nodes, so the sequence reads |
| `T.circleDrawMs` | 750 | the magnifier / parent button |
| `T.charMs` | 85 | per typed character — unhurried, handcrafted |
| `T.gapMs` | 360 | breath between the focal labels |
| `T.fanLineMs` | 250 | each fan line sweeping magnifier → child node |
| `T.logoFadeMs` | 800 | maker's mark + copyright fade-in |
| `T.holdMs` | 1000 | the finished drawing sits complete before it dissolves |
| `T.dissolveMs` | 1000 | hand off to the live wheel |
| `T.inputUnlockMs` | 500 | touch stays blocked this long PAST the final fade-in |
| `ARC_COLOR` | #000000 | structural line, drawn in the wheel's ink colour |

## C.4 — gateway transit wipe (src/view/gateway-wipe.js)

The new volume boots fully rendered beneath a frozen snapshot; a straight
radius pivoting on the hub sweeps the snapshot away. Input swallowed
mid-wipe; degrades to the old hard cut.

| Name | Value | Why |
|---|---|---|
| `durationMs` | 1800 | the wipe's travel — deliberately slower than the house tempo; it is a scene change, not a costume change |
| `direction` | 'down' launch / 'up' return | the sweep says which way you are passing through the door |
| `softness` | 5 px | gradient seam width (Howell: "smoothness beats softness") — hard clipPath + thin seam, zero filter cost |
| easing | easeInOutCubic | the radius accelerates through the middle of the sweep |
| (unnamed) | 0.02 angular margin, 1.05 radius, '#868686' ×3 | flagged in PUNCHLIST for naming |

## C.5 — canonical usable areas (src/geometry/usable-areas.js, `CPUA_SPEC`)

One fence for both areas; CPUA ⊆ DSUA by construction; both engines (star
field, day grid) consume `cpua.contains()` — one membership verdict.
`?bounds=1` draws solid fence + dashed conditional logo box. Ratios are ×
SSd, eye-tuned canon as of C.5:

| Name | Value | Why |
|---|---|---|
| `TOP_RATIO` | 0.15 | top margin — clears the copyright block |
| `RIGHT_MARGIN_RATIO` | 0.02 | nearly the viewport edge |
| `LEFT` | 0 | the left edge is the canvas edge |
| `DECK_CLEARANCE_RATIO` | 0.08 | THE CONTROL DECK: floor = magY − (0.06 magnifier + 0.02 pad) × SSd; magnifier, parent button, and Phase D's dimension button live in this reserved band — retires the vessel exclusion circle |
| `ARC_MARGIN_TOP_RATIO` | 0.06 | tapered arc: tight at the top (display territory) |
| `ARC_MARGIN_BOTTOM_RATIO` | 0.28 | swelling toward the deck (thumb territory, where scrubbing happens); linear between |
| `LOGO_PAD_LEFT_RATIO` | 0.035 | logo notch padding (drawn artwork spills past getBounds()) |
| `LOGO_PAD_BOTTOM_RATIO` | 0.01 | logo notch bottom pad |

## C.5 — the star field (src/geometry/child-pyramid-geometry.js)

Golden-angle (sunflower) scatter; deterministic and unique per parent
(phase = sortNumber × golden angle); densify/re-scatter at 0.65× radial
step when a pass can't seat every child; relax ladder ends by yielding the
fan floor entirely — seating outranks fanning.

| Name | Value | Why |
|---|---|---|
| `GOLDEN_ANGLE_RAD` | π(3−√5) ≈ 137.508° | uniform density, no starvation (12/12 months place where the ray×spiral hunt yielded 3) |
| `NODE_RADIUS_RATIO` | 0.04 | matches the render's pyramid node size |
| `FILL_FRACTION` | 0.55 | how much of the usable area the field aims to cover |
| `MIN_SPACING_RADII` | 2.3 | min center-to-center distance, in node radii |
| `FAN_SEP_DEG` | 8 | min angle between fan lines at the magnifier — the fan must FAN |
| `LABEL_BAND_CLEARANCE_RATIO` | 0.1 | labels may sit closer to the band than nodes |
| label glyph advance | 0.85 em | UPPERCASE Montserrat measured advance — label placement law (rotated baseline endpoints stay on-glass, short of the band) |
| `dampLabelScale` | 1 + (s−1)·0.5 | a 1.45× star wears a ~1.22× label — prominence reads, spills less |
| labelBaseFontPx | clamp(14, 0.016·LSd, 26) | resolution-aware base; ABSOLUTE px (SVG em rebases on inherited font-size — the shrunken-labels/migration-pop bug) |

## C.5 — prominence and the seat cap (src/index.js render)

Editorial tiers from sparse data (1 featured / 2 notable / absent =
default); ring order never permuted; uniform skies stay uniform.

| Name | Value | Why |
|---|---|---|
| `scaleForTier` | 1.45 / 1.15 / 0.8 | featured near-center, notable, receding default |
| Favorites | tier 1 | wear FULL names in the sky (everyone else may abbreviate) + the cartographer's halo — a background-colored label twin UNDER the circles (fan < halo < circle < text), carving legibility through line bundles |
| `TAPER_AFTER` | 10 | past the first seats, stars shrink toward the smudge floor |
| `taperRate` | 0.86 / 0.9 / 0.95 (by family size >60 / >30 / else) | bigger families descend to the floor faster; families ≤16 untouched |
| smudge floor | 0.3× | etcetera means etcetera |
| `SEAT_CAP` | 28 | 60 → 35 → 28, Howell's eye converging (2026-07-19) |

## C.5 — the wedge (src/geometry/day-grid.js, `WEDGE`)

The day grid on the instrument's own lattice: a second hub on the
magnifier-hub axis, seven rays, seven concentric weekday arcs (Sunday
outermost), day numerals on the intersections aligned with their rays. The
lattice is invisible; `?wedge=1` draws it FROM the engine's own math.
During a scrub the ribbon rotates about the second hub, geared to the ring.

| Name | Value | Why |
|---|---|---|
| `HUB_DIST_MUL` | 1.5 | second hub at this × the magnifier→hub distance (makes the wedge more square); live: `?wedgemul=N` |
| `FAN_ROTATION_DEG` | 14 | whole fan clockwise off the axis (13 + Howell's +1) |
| `RAY_STEP_DEG` | 2 | between week rows |
| `RAY_OFFSETS_DEG` | [4,2,0,−2,−4,−6,−8] | index 0 = weekday header ray; 1..6 = week rows |
| arc step | (rBand−rCorner)/8 × 0.765 | gaps of 1/8 the corner→band span, tightened; binding edge cell solved exactly — 31/31 days seat on every tested viewport |
| `nodeR` | min(step, angularGap) × 0.38 | day-node radius (two sittings of +15%/+10%) |
| `labelFontPx` | clamp(11, nodeR×1.05, 20) | day-numeral font |

## The present moment's mark (src/view/node-appearance.js)

ONE lonely red-and-yellow node on the page at a time — the year, month, or
day being lived through, at every depth, NEVER in the magnifier (the vessel
is opaque when settled and hollow while scrubbing, so the mark streams
through the lens during a fast scroll). Data declares it (`now` flag via
`presentMoment()`); one dresser module paints it — both render paths (live
+ migration clones) share the dresser and the rotation law.

| Name | Value | Why |
|---|---|---|
| `NOW_NODE_FILL` | #7a1010 | dark red — the seat of the present |
| `NOW_LABEL_FILL` | #ffd700 | gold — its label |
| `DIM_OPACITY` | 0.35 | ribbon neighbors: present, but plainly not the month you are reading (also the pyramid's rotation dim — "a little more dimming", 0.5 → 0.35) |

## The NEXT gesture (src/index.js advanceLeaf, src/main.js)

At a leaf, in volumes that declare `capabilities.detailTapAdvances` (bible,
calendar — never the catalog), the detail sector is one large button. The
hit region is the canonical DSUA fence, so NEXT structurally cannot swallow
a ring tap, the magnifier, or the parent button.

| Name | Value | Why |
|---|---|---|
| hit region | the DSUA fence | one membership verdict; reaching up past it remains how you go BACK |
| resolve | at finger-lift, ≤ `DRAG_SLOP_PX` (8) | a scrub ending over the sector settles normally — same slop law as every tap |
| empty links | stepped OVER | cousin gaps are texture for a scrubbing thumb, never stops in a reading path |
| taps mid-travel | accumulate from where the ring is HEADED | selection commits on ARRIVAL; three quick taps advance three leaves |
| advance tempo | rotateToIndex → animateSnapTo (100 ms) | the reading step is a snap, not a journey |

## Live tuning knobs (console, no rebuild)

| Knob | Home | Tunes |
|---|---|---|
| `window.__flickScrubs` | gesture-tiers.js | flick distance in scrubs (default 4) |
| `globalThis.__starScaleMul` | child-pyramid-geometry.js | star field scale multiplier |
| `?wedgemul=N` | main.js | wedge hub distance multiplier (default 1.5) |
| `?splash=1` / `?splash=0` | boot-splash.js | force / skip the boot splash |
| `?wedge=1`, `?bounds=1` | diagnostics | draw the wedge lattice / the usable-area fence from the engine's own math |

(`src/geometry/pyramid-tuning-knobs.js` still carries knobs for the RETIRED
ray×spiral engine — flagged in PUNCHLIST for the L3 dead-code sweep.)
