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
| Tap | that node to the magnifier | shipped (pre-C) |
| Slow scrub | fixed clicks per inch — the precision hand | current drag feel, FROZEN |
| Fast scrub | one standard scrub-length = one flick's distance | not yet built |
| Flick | max(10% of chain, 2 × visible nodes), ballistic | not yet built |
| Double-flick | to that end of the chain | **shipped in C.3, this file's first entry** |

## Constants

### Frozen drag/scrub feel (pre-C baseline — Howell: "it's pretty good, I
### don't wanna lose anything"; measured worst 67 ms / drop 2, Moto G)

| Name | Value | Home | Why |
|---|---|---|---|
| `sensitivity` | π/4 per 100 px | main.js wireInteractions | 100 px of finger = 45° of ring |
| `velocityThreshold` | 0.4 px/ms | main.js | below this, no gain: the precision hand |
| `gainSlope` | 1.1 | main.js | linear gain growth past threshold |
| `targetSpinNodes` | 350 | main.js | fixed quick-swipe span, device-independent (to be superseded by FLICK_FRACTION when the flick tier lands — with approval) |
| `DECAY` | 0.95 | rotation-choreographer | momentum decay per frame |

### The tempo

| Name | Value | Home | Why |
|---|---|---|---|
| `ANIMATION_DURATION` | 600 ms | view/volume-logo.js | detail sector enlargement — the house tempo everything else inherits |
| `GLIDE_TO_LIMIT_MS` | 600 ms | main.js | double-flick travel: same tempo, any distance — arrival is predictable everywhere |

### Double-flick (first C.3 tier, 2026-07-17)

| Name | Value | Home | Why |
|---|---|---|---|
| `DOUBLE_FLICK_WINDOW_MS` | 400 | main.js | max gap between the two fast swipes; wide enough for deliberate repetition, tight enough that two casual swipes don't trigger it |
| `DOUBLE_FLICK_MIN_VELOCITY` | 0.8 px/ms | main.js | both swipes must be genuinely fast (2× the gain threshold) — scrubbing can never accidentally travel to the end |
| easing | easeOutCubic | rotation-choreographer glideTo | fast departure, gentle arrival at the last link; overshoot not simulated (the clamp is the wall) |

Rules of engagement: additive changes only; before/after on the Moto G
(`?debug=1`); the frozen block moves only by express approval, and any
approved change updates this file in the same commit.

### Planned (specs agreed, not yet built)

| Name | Agreed value | Notes |
|---|---|---|
| `SCRUB_LENGTH_IN` | ~1 inch, device-normalized | the standard scrub |
| `SLOW_SCRUB_RATE` | clicks per scrub-length | detented precision tier |
| `FLICK_FRACTION` | 0.10 | of chain length |
| `FLICK_MIN_FACTOR` | 2 × visible nodes | the small-chain floor; collapses flick≈double-flick on tiny rings by design |
