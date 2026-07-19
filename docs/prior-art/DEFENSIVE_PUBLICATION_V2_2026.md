# DEFENSIVE PUBLICATION v2: THE WHEEL INSTRUMENT

**Publication Date**: July 18, 2026
**Author/Inventor**: Howell Gibbens ([ORCID 0009-0000-9904-9864](https://orcid.org/0009-0000-9904-9864)) — MMdM (Meccanismi Marittimi delle Marche)
**Repository**: https://github.com/mmdm-it/wheel
**Live deployments**: https://mmdm.it (catalog); bible, and calendar volumes linked therein
**Version at publication**: 3.10.2
**Purpose**: Establish prior art for the navigation mechanisms developed since the first defensive publication (November 2025), and supersede that document's description of since-retired mechanisms.

---

## 0. RELATIONSHIP TO THE FIRST PUBLICATION

The first defensive publication (November 20–21, 2025; preserved in this
repository at `docs/prior-art/DEFENSIVE_PUBLICATION_V1_2025.md` and in git
history at commit `ca19d84`) disclosed the v0-era design. Its disclosures
remain valid prior art. However, the system has since been substantially
redesigned, and several v1 mechanisms were retired:

- **Pseudo parents** (`rpp_`/`rpgp_` metadata regrouping) — retired. Their
  role is subsumed by the **dimension/strata system** (§6).
- **The `h.n.r.e` constitutional formula** — superseded by the sprocket-chain
  state model (§2) and per-volume return contexts (§5).
- **The infinite-wheel/carousel framing** — explicitly repudiated. The
  current doctrine is the **bounded sprocket chain** (§2): chains never loop.

Everything disclosed below is publicly visible in the repository and in the
live deployments as of the publication date. This document exists to make
those disclosures explicit, dated, and searchable.

**Correction of record.** The v1 document expanded the acronym "MMdM" as
"Motori Marini di Montagna." That expansion was erroneous and is not the
name of the organization. The correct name is **Meccanismi Marittimi delle
Marche** (Fano, Provincia di Pesaro e Urbino, Marche, Italy), as used on the
company's printed and distributed materials since November 2025. The acronym
"MMdM" is unchanged; only the erroneous long-form gloss in v1 is corrected
here.

---

## ABSTRACT

Wheel is a mobile-first instrument for navigating large hierarchical and
sequential datasets by rotating a **bounded chain of nodes around an
eccentric, off-screen hub**. The visible portion of the chain sweeps an arc
across the viewport; a fixed **magnifier** position on the arc acts as the
selection lodestar. The system combines:

1. **Eccentric off-screen hub geometry** — the rotation center lies outside
   the viewport, computed from viewport aspect ratio, producing a large-radius
   arc tuned for thumb reach on handheld devices.
2. **The sprocket-chain doctrine** — nodes are links in a bounded chain
   wrapped over an off-screen sprocket; chains have real ends, never loop, and
   signal their ends physically (overshoot and springback).
3. **Cousin chains** — the chain continues across parent boundaries within a
   grandparent's scope, separated by typed gaps, so ordered corpora (verses,
   days, model years) read as one continuous ribbon.
4. **A chain-relative gesture tier ladder** — tap, scrub, flick, double-flick
   — with the flick anchored to the scrub (not the chain length), giving
   identical feel on 12-node and 84,000-node chains.
5. **Migration flow choreography** — on hierarchy transitions, fixed vessels
   (magnifier, parent button) empty and refill in place while nodes migrate
   between ring and pyramid in one synchronized motion, conveying data flow
   direction subliminally.
6. **A dimension/strata system** — parallel navigation lenses (e.g. language,
   edition/translation) rendered as mirrored secondary rings on a z-axis,
   switchable from any node while preserving hierarchy position.
7. **Gateway nodes** — data-driven transit points that carry the user between
   heterogeneous volumes (e.g. a parts catalog into a Bible or a calendar)
   with a hub-centered cinematic wipe and a preserved return context.

The instrument has been demonstrated on: a marine-engine catalog (~2,000
nodes, 5 levels), the Latin Vulgate Bible (31,000+ verses), a historical
calendar spanning 3000 BC to 3000 AD (chains up to ~84,000 nodes), and a
music library — all running the same engine at 60fps on 2017-era phone
hardware (compatibility floor: iPhone X, iOS 16; reference device:
Moto G 2025).

---

## 1. ECCENTRIC OFF-SCREEN HUB GEOMETRY

The rotation center ("hub") is deliberately placed **outside the viewport**,
to the right, on the horizontal centerline:

```
LSd = max(viewportWidth, viewportHeight)
SSd = min(viewportWidth, viewportHeight)
hubX = (2·LSd)² / (8·SSd) + SSd/2
hubY = 0
```

Consequences:

- The visible portion of the ring is a **shallow arc sweeping the left edge**
  of a portrait phone screen — the natural thumb path — rather than a small
  full circle.
- The **magnifier** (selection lodestar) sits at a fixed angle on the arc
  (≈2.63 rad in the reference implementation); rotation carries nodes through
  it. Selection is positional, not tapped-in-place: the focused node is
  whichever link currently occupies the magnifier.
- The visible window is aspect-ratio dependent: typically **11–21 nodes**
  rendered at a constant angular pitch (π/42 ≈ 4.3°), regardless of chain
  length. Off-arc links are not rendered; rotation creates and destroys DOM
  nodes at the window edges. This is why an 84,000-node chain costs the same
  per frame as a 12-node chain (measured chain-construction time: 5–16 ms on
  reference hardware).

## 2. THE SPROCKET-CHAIN DOCTRINE

The governing metaphor is **not** a wheel or carousel. Nodes are links in a
**sprocketed chain** wrapping an off-screen sprocket gear; the viewport is a
window a portion of the chain passes through.

- **Chains are always bounded and never loop.** There is never another
  manufacturer after the last, nor before the first. The alphabet does not
  wrap.
- **Chain ends are physical.** Attempting to rotate past an end produces
  overshoot and springback — the feel of the last link going taut. No
  boundary markers or disabled states are needed; the end is felt, not
  labeled.
- **Chains exit tangentially.** At the arc's upper-left departure the chain
  continues vertically off-screen; at the lower-right it continues
  approximately horizontally — the chain visually plausibly continues into
  the machine.
- **State model.** The chain is an ordered array (with typed gap entries, §3)
  plus a single rotation offset; the focused node derives from rotation, and
  the visible subset derives from the viewport window. This replaces v1's
  `h.n.r.e` formula.

## 3. COUSIN CHAINS: CONTINUITY ACROSS PARENT BOUNDARIES

In conventional hierarchical browsers, a level's list ends at its parent's
boundary: the last verse of Genesis 32 is a dead end, and reaching Genesis
33:1 requires navigating out and back in. In Wheel, the chain at a given
level **continues across sibling parents within the same grandparent**:

- **Cousins** — nodes at the same level whose parents share a grandparent —
  are threaded onto one chain, in order, separated by a **typed two-node
  gap** that marks the parent boundary without breaking the ribbon.
- Rotation therefore traverses Genesis 32:32 → (gap) → Genesis 33:1
  seamlessly; the parent vessel updates in place as the boundary passes.
- Scope is bounded by the grandparent (Genesis's chapters chain together;
  Genesis does not chain into Exodus at the verse level), and chains never
  wrap around.

This mechanism is what makes ordered corpora — scripture, calendars, model
ranges — readable as continuous material rather than as a filing cabinet.

## 4. THE GESTURE TIER LADDER (CHAIN-RELATIVE ADDRESSING)

Four gesture tiers, classified at finger-lift:

| Tier | Motion |
|---|---|
| **Tap** | the tapped node travels to the magnifier (fires at lift, small slop tolerance) |
| **Scrub** | pure 1:1 drag at every speed — the precision hand (reference: 100 px of finger = 45° of ring) |
| **Flick** | a ballistic glide of a fixed number of corner-to-corner scrub-equivalents (reference: 4), easing out to arrival |
| **Double-flick** | two fast swipes within a short window (reference: 400 ms) glide to that end of the chain, any distance, in one fixed tempo |

Disclosed design principles:

- **Scrub-anchored flick.** The flick distance is defined as k× the rotation
  of a corner-to-corner scrub (k·(width+height)·sensitivity), **not** as a
  fraction of chain length. A chain-proportional flick was built, measured
  (one flick lurched ~700 years on an 84,000-node timeline while a scrub
  crawled ~20), and rejected. Principle: *a swipe must never travel a
  magnitude more than a scrub*; the flick therefore feels identical on every
  chain.
- **Windowed velocity classification.** "Fast" is measured over the final
  ~100 ms before finger-lift, never from instantaneous event samples (touch
  events arrive in bursts whose spot velocities spike past any threshold).
  A pause before lifting reads as zero; release direction comes from the
  same window.
- **The catch.** A pointer-down during a glide stops it dead — flick, flick,
  catch. The finger always wins.
- **One tempo.** All travel and costume-change animations share a single
  house tempo (reference: 600 ms); a double-flick crosses 80,000 nodes in
  the same time a detail sector opens. Arrival is predictable everywhere.
- **Graceful tier collapse.** On short chains a flick reaches the end and
  clamps; the ladder degrades without special cases.

## 5. MIGRATION FLOW CHOREOGRAPHY AND GATEWAYS

**Migration doctrine.** On IN/OUT hierarchy transitions, the fixed vessels
(magnifier, parent button) do not move: they **empty and refill in place**,
while node sets migrate between the focus ring and the child pyramid in a
single synchronized motion. Every element's departure and arrival are part
of one flow whose direction (inward vs outward) is legible subliminally; no
element pops or is orphaned mid-transition.

**Gateway nodes.** A volume's data may declare a node as a gateway to
another volume entirely (e.g. catalog → GUTENBERG → the Bible volume;
catalog → GREGORIO XIII → the calendar volume). Disclosed mechanics:

- The gateway is **data-driven**: catalog data names the target volume; the
  engine contains no volume-specific literals (enforced by test).
- Transit is rendered as a **hub-centered cinematic wipe** with a soft seam
  — the new volume's theme sweeps around the same hub geometry the chain
  rotates on.
- A **return context** is preserved: navigating OUT across the boundary
  restores the originating volume at the exact node and rotation of
  departure, surviving page reload via serialized history state.
- Target-volume manifests are **prefetched on approach** (when the gateway
  node nears the magnifier), making transit effectively instant even on the
  compatibility-floor device.

## 6. THE DIMENSION / STRATA SYSTEM

Dimensions are **parallel navigation lenses over the same structure** —
distinct from hierarchy (the structure itself) and from filters (which
reduce data at one level). The litmus test: *can the entire hierarchy be
navigated through this lens?* Language qualifies for scripture (every level
translates); currency does not for a catalog (leaf-only property).

Disclosed UI mechanics ("strata"):

- **Z-axis motion semantics.** Rotation = browsing within a level; lateral
  constant-radius arrival = changing volume; **z-travel (radius change) =
  changing dimension**. Each axis of the instrument's motion vocabulary has
  exactly one meaning.
- **Mirrored secondary ring.** Toggling dimension mode blurs and freezes the
  primary stratum and renders a secondary focus ring on a vertically
  mirrored layer at the same radius, carrying the dimension's values (e.g.
  languages). Selecting a value exits dimension mode and re-renders the
  primary stratum through the new lens — **with hierarchy position
  unchanged**.
- **Up to three strata.** A volume may declare zero, one, or two dimensions
  (e.g. Bible: language, then edition/translation); the dimension button
  cycles the strata that exist and is absent otherwise.
- **The scripture application.** From any verse, the reader pivots language,
  then edition (Vulgate, King James, Douay-Rheims, …), and the same verse
  re-renders in the new lens at the same position in the instrument.
  Comparison is navigation, not a menu.

## 7. APPLICATIONS DISCLOSED

- **Deep catalogs**: the MMdM marine-engine catalog (live at mmdm.it).
- **Multi-edition scripture**: the pivotable Bible described in §6.
- **Timelines at scale**: a 6,000-year calendar traversed in a couple of
  thumb gestures; chains to ~84,000 nodes demonstrated.
- **Bounded social feeds**: the Years → Months → Days → Posts architecture
  disclosed in v1 §11.4 remains disclosed, now on the v3 mechanics.
- **Launcher / desktop environment**: the focus ring and child pyramid as a
  device home screen replacing icon grids (Android HOME-intent launcher);
  same mechanics on rotary hardware (watch bezels, automotive controllers).

## 8. NOVELTY CLAIMS

To the author's knowledge after search, no prior system combines:

1. An **eccentric off-screen hub** with aspect-ratio-derived geometry
   producing a thumb-arc ring on handheld viewports (distinct from centered
   radial menus, iPod wheels, and watch bezels, which rotate about visible
   or on-device centers).
2. **Bounded chains with physical end signaling** threaded **across parent
   boundaries** (cousin chains with typed gaps) — prior radial and carousel
   UIs are flat, looping, or stop at parent boundaries.
3. A **scrub-anchored ballistic tier ladder** whose flick distance is
   defined in scrub-equivalents rather than nodes or chain fractions,
   with windowed lift-velocity classification.
4. **Vessel-constancy migration choreography** (fixed UI vessels empty and
   refill while node sets migrate as one flow).
5. **Z-axis strata** for dimension switching that preserves hierarchical
   position across lens changes, layered on the same hub geometry.
6. **Data-driven gateways** between heterogeneous volumes with preserved
   return context and hub-centered wipe transit.

Prior art the author distinguishes: iPod click wheel and Apple Watch crown
(rotation as linear traversal of flat lists); pie/marking menus (radial
command selection, not hierarchy traversal); sunburst and hyperbolic
browsers (radial *display* of hierarchy, not rotational *navigation*);
carousel pickers (looping flat lists); v1's own references (Furnas 1986;
Bederson & Hollan 1994; Lamping et al. 1995).

## 9. LICENSING AND INVENTOR STATEMENT

The Wheel engine is published as free software under the GNU GPL v3 (see
repository LICENSE and NOTICE; the catalog and content data are reserved).
This document is published to establish the disclosed mechanisms as prior
art: the author intends that these techniques remain free for all to use,
and that no party — including the author — may patent them in any
jurisdiction where this publication constitutes prior art as of its date.

This publication is made in good faith. It does not constitute legal
advice, and no warranty is made regarding novelty relative to unpublished
prior art.

**Howell Gibbens — MMdM (Meccanismi Marittimi delle Marche)**
**July 18, 2026**

---

**Document version**: 2.0
**DOI**: [10.5281/zenodo.21434298](https://doi.org/10.5281/zenodo.21434298)
(Zenodo, deposited July 18, 2026; licensed CC BY 4.0)
**Archival**: Wayback Machine snapshots of the repository and live deployments
taken at publication.
