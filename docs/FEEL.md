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
| Flick | ballistic glide of max(10% of chain, 2 × visible nodes) | **shipped in C.3 (approved 2026-07-17)** |
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

### Flick (approved and shipped 2026-07-17)

| Name | Value | Home | Why |
|---|---|---|---|
| `FLICK_FRACTION` | 0.10 | interaction/gesture-tiers.js | of the chain, gaps included: every chain is ten flicks long |
| `FLICK_MIN_FACTOR` | 2 × visible nodes | gesture-tiers.js | the small-chain floor; with glideTo's clamp, a flick on a tiny ring goes to the end — intended tier collapse |
| `FLICK_GLIDE_MS` | 600 | gesture-tiers.js | the house tempo; arrival is predictable everywhere |
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
