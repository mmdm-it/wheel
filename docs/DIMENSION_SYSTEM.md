# Dimension System — the strata canon

*Rewritten 2026-07-20 to open Phase D.1, superseding the v3.7 portal
specification (dimension-button-cycles-portals, focus-ring-repurposing,
mirrored-at-same-radius — all retired). This is paper: the ruled model
before a line is built. Grounded in [PREMISE.md](PREMISE.md); rulings are
Howell's. Open questions are gathered at the end.*

---

## The third axis

The Premise forbids a keyboard and a search box: the user knows what they
seek and roughly where. So how does a user *narrow* a huge space — pick a
language to read in, a sort order, a set of layers? Not by typing, and not
by a flag-button cycling a fixed list (clumsy, one variable). By **another
wheel**.

The instrument built so far moves on **two axes, both on the plane of the
focus ring**:

- **Orbital** — rotate the ring to browse siblings.
- **Radial** — in and out through the hierarchy (child pyramid in, parent
  out).

That is the entire current app, and it never leaves the glass. Phase D adds
the **third axis — z** — and reserves it for exactly one thing: **travel
between strata.** Mainstream apps are flat planes you slide around on x and
y; no feed invites you to fly *into* the screen. This one does, and the
going-somewhere is the point. The 1960s *Twilight Zone* opened on the
literal thesis: *"You're traveling through another dimension."*

## What a dimension is

**A dimension is another focus ring, on its own hub** — a full wheel,
structurally identical to the primary strata (orbital rotation, a child pyramid),
but centered on a *mirrored* hub so the eye knows instantly it is not the
text. "Dimension" and "stratum" are used interchangeably.

Up to three strata, one instrument. **Primary strata**, **secondary
strata**, **tertiary strata** are the names (primary/secondary/tertiary for
short); these words are used nowhere else in the app, so they are
unambiguous. "Reader" is wrong — a volume may be a music library, not a text.

- The **primary strata** — the volume itself (testaments → books →
  chapters → verses; a music library's artists → albums → tracks). The
  instrument as built so far.
- The **secondary strata** — a second focus ring on its own *mirrored*
  hub, **not for reading**. Its only job is to set the parameters the
  primary strata reads *with* when you return (for the Bible: the
  language).
- The **tertiary strata** — a third ring, standard-hubbed again, for the
  choice *within* the secondary's selection (for the Bible: which
  translation of the chosen language). It appears for **every** language,
  even a single-translation one — the reader wants to know *which* edition
  they're reading, choice or not (Howell 2026-07-21, D.3 below).

**The dimension button toggles the two.** It is the wireframe globe parked
in a corner — a **neutral icon** that does not display the current value
(ruled 2026-07-20). Tap it in the primary strata → z-travel to the
secondary. Tap the *same* button again → z-travel back to the primary.
On/off. The button does not cycle values and does not itself pick anything;
it only switches strata. A volume that declares no dimension shows no
globe.

## Z-travel — the motion between strata

Click the globe and you **back through a door**: the primary stratum you
were reading **recedes ahead of you** — smaller, into the middle distance,
soft-focus — while the secondary stratum **arrives from behind your head**,
its mirrored arc running lower-left → upper-right (the primary's
upper-left → lower-right reflected across the screen's **horizontal**
centerline — the primary's magnifier low, the secondary's high). Because
the primary shrinks and recedes as the secondary arrives, the two never
share the viewport at full size; where their full-size arcs would cross is
a non-question. Click again and you **push forward through the door**: the
primary swells and sharpens as you arrive, the secondary falls away behind.

Orbital and radial happen *within* a stratum (the frozen C physics,
untouched). Z happens *between* strata. One rule covers the whole
instrument.

## The living primary — reassurance, and the live preview

The receded primary is **not a frozen backdrop, and not a gimmick.** It is
integral:

- **It stays in the field of view**, still showing the exact nodes and text
  the user last saw. The reassurance is explicit: your reading is not gone,
  it is *on hold* in the distance while you make a change.
- **It is a live preview.** As the user rotates the secondary ring to a new
  language, the change is **instantly visible in the distant primary** — the
  same verse, re-rendered in the new language, before anything is committed.
  This is the content anchor (below) made literal: you watch *In principio*
  become *Ἐν ἀρχῇ* out there in the soft focus, and *that* is what you will
  be reading when you toggle back.
- **The blur is legibility-preserving** — rack-focus, not frost. "Not too
  blurry; still alive and in sight." You must be able to read the change
  happening.

**Architectural consequence (load-bearing for D.5).** A live preview
**forbids the cheap trick**: you cannot snapshot the primary as a bitmap and
blur the still image once. The primary must remain a *rendering* view so it
can turn Greek on command. The relief that keeps it affordable: "live" means
*re-render when the selection changes* — a handful of discrete moments, not
every frame. So the D.5 rule: the receded primary is a **cheap static
blurred layer between choices, regenerated only when a new value settles in
the secondary magnifier.** Live, but bounded. It regenerates only when a new
value **settles** in the secondary magnifier (ruled 2026-07-20) — never
mid-rotation, consistent with the hold-stale detail-sector doctrine.

## The Bible's secondary strata, concretely

Language then translation is a two-step choice. D.1 drafted it as one
stratum — orbit the secondary ring for the language, dive its child pyramid
for the translation. **D.3 replaced the pyramid with a third stratum**
(Howell, 2026-07-21): the dimension button cycles **primary → secondary →
tertiary → primary**, each press pushing the stack one plane deeper. The
reason is the z-axis itself — a translation is a *parallel* to its language,
a stratum of the same rank behind it, not a child hanging off it. Three
mirrored planes receding read as the instrument's defining cinematic pull;
a pyramid would have read as ordinary drill-down.

- **Orbit the secondary ring → pick a LANGUAGE** (Latin, Greek, Hebrew,
  English…), named in its own tongue (ESPAÑOL, ΕΛΛΗΝΙΚΆ, עברית).
- **Orbit the tertiary ring → pick a TRANSLATION within that language**
  (NAB vs Douay-Rheims English; LXX vs BYZ Greek).

A translation belongs to exactly one language (no Greek KJV; the data
carries a single `language` per translation), so the ladder is clean. The
tertiary appears for **every** language — a single-translation one (Latin →
Clementine Vulgate) shows a one-node ring that *names* the edition, because
the reader wants to know which translation they're reading whether or not
there's a choice (Howell 2026-07-21, reversing an earlier skip). The
magnified tertiary node carries the edition's full title; the rest keep
their abbreviations.

**Prominence is the default.** The secondary strata's pyramid uses the C.5 star
field: the most-used translation in the magnified language is the largest
node, so orbiting to "Greek" and toggling straight back — without touching
the pyramid — lands on Greek's primary translation. The pyramid is there for
the user who wants a *specific* edition. (This asks one thing of the data:
translations need a popularity ranking, the same editorial tier the verses
and books await.) One star-field mechanism now serves three jobs — sizing
verses, sizing engine models once families flatten, and sizing the secondary
strata's options.

**It scales like any volume.** Because the secondary stratum is a full focus
ring, the secondary strata inherits everything C proved: a language dimension holds a
handful of nodes, but the mechanism does not care — a dimension could hold
**six thousand** choices and scan them with the same two thumb-flicks as the
calendar's six thousand years. That is the whole advantage over a
flag-button loop: the toggle is on/off, but *behind* it is a navigable
world, not a list.

**The D.6 first cut (ruled 2026-07-20): two languages, one translation
each.** The secondary ring opens with **Latin and English**, a single
translation apiece (Vulgate; one English) — so the pyramid-of-translations
is not exercised yet, and the first build is just the z-travel, the mirrored
ring, and the live preview. It is deliberately minimal but *not* trivial:
Latin uses VUL numbering and English uses MT numbering, so even two nodes
already cross a versification boundary and prove the content-anchor map end
to end. (⚠ D.6 prerequisite: verify the English text's completeness in the
chapter files — the corpus was pinned to VUL in Phase A, and Esther showed
even VUL has holes.)

## Three shapes of parameter (bank for the schema)

The secondary strata does not always do the same job:

| Shape | Effect | Example | Cardinality |
|---|---|---|---|
| **Swap** | the content itself changes | Bible language | pick one |
| **Sort** | same nodes, new order | Catalog: alphabetical / hp / displacement | pick one |
| **Filter** | which nodes are visible | Calendar: work / holidays / personal | **pick many** |

The Bible (D.6) is pure **swap, pick-one** — the simplest shape, so it does
not block the first build. **Filter is multi-select** (a real calendar shows
work *and* holidays), so the schema must leave room for toggling several
values. The multi-select selection gesture is **deferred to the calendar**
(ruled 2026-07-20), the first volume that needs it — not designed now.

## Behavior rules

- **Persist-on-select — sticky across the volume.** The chosen dimension is
  a mode you carry until you change it: pick Greek at a verse, navigate
  anywhere in the Bible, stay in Greek. **It survives a gateway exit and
  re-entry** (ruled 2026-07-20) — a choice made in the secondary stratum
  outlives leaving the volume and coming back.
- **Content anchor — follow the text.** Translations number verses
  differently (Vulgate Ps 118 = Hebrew Ps 119; the Vulgate merges verses
  others split). Changing language keeps you on the **same words**, landing
  wherever they are numbered in the new system — not on "the same seat."
  This requires a **verse-mapping table** across the versification systems.
  **Full cross-numbering from the start** (ruled 2026-07-20): the map spans
  the systems (MT / VUL / LXX); no share-numbering shortcut. The first
  *build* is small but still crosses a boundary (see below).
- **Absent dimension → no button.** A volume that declares no secondary strata hides
  the globe entirely. (Already the code's posture: every adapter declares
  `search: false`; a secondary strata is the same kind of declared capability.)
- **Read-time application, never a data mutation.** A dimension changes how
  an item is *presented*, not which items exist; the primary strata's hierarchy
  position is untouched by a dimension change. (The v3.7 read-time filtering
  + per-combination caching survives; the interaction model around it does
  not.)

## Geometry (principle now; specifics are D.3/D.5)

- The secondary ring is **mirrored** — its own hub on the opposite side, arc
  reversed — so mode is unmistakable at a glance. Exact hub placement is D.3
  geometry work.
- The z-recede + **blur** is the depth cue and the perf crux (D.5): the C.2
  SVG-Gaussian-blur villain (~150 ms/frame at dpr:3) returns at whole-ring
  scale, now with a *live* layer under it — the native-vs-wrapper decider
  (`docs/WRAPPER_EVIDENCE.md`). Do not assume SVG blur is affordable.
- **Color is undecided.** The sketches' gray/yellow secondary is borrowed
  from the catalog, not a choice; within a volume the primary and secondary
  may even share colors. An E-era decision.

## D.3 — the strata, built (2026-07-21)

The visual stack shipped. What landed, and the decisions the sketches left open:

- **Three-deep stack.** The dimension button cycles primary → secondary →
  tertiary → primary; each press pushes the front plane one deeper. Depths
  `[1.0, 0.4, 0.2]`, static blurs `[0, 5, 10]` px, indexed by planes behind
  the front. The recede is a **straight camera pull-back** — a 2D scale about
  the *viewport centre* (Disney multiplane), which drops the off-screen hub
  down-and-left for free, no 3D. Locked with Howell.
- **The strata render in their own layer** (`#strata-layer`, z 250) above the
  primary's detail panel (z 200), so a front stratum opaquely covers the
  receded primary where its band and nodes fall, and the blurred primary shows
  through the gaps. The wheel-and-chain reading depends on this.
- **The band is the honest sprocket chain, not a circle.** `bandCenterlinePoints`
  draws the arc where the chain rides the off-screen sprocket, then **straight
  tangent runs** past the two viewport exits — vertical up at the upper-left,
  ~SE at the lower-right (the exact lower angle set by the viewport ratio).
  Mirrored for the secondary (vertical *down*). Stroked centreline, not a
  filled annulus. At full size the tangents are off-screen; the recede scales
  them into view, so a receded ring reads as a straight chain vanishing off
  the top — never a hose-reel coil. Shared by the primary and the strata.
- **Tangent fill.** When the primary recedes, `calculateNodePositions` takes a
  `tangentSpan` and populates the straight runs with the chain's beyond-window
  links (verses climbing overhead). Sized per depth (`STRATA_TANGENT_SPANS`).
  A **static re-render**, off the rotation hot path — the front ring stays
  arc-only, so rotation perf is untouched.
- **The button lives in the detail sector.** The globe appears only where a
  dimension exists *and* the purple sill is on screen (a leaf). Over a child
  pyramid it hides and any open stack recedes — the analogy only holds where
  the round wheel (the purple) is visible for the straight chain to wrap.
- **Native tongues, magnified-label span.** The secondary names each language
  in its own script (`languageLabel`); the magnified label is start-anchored
  and pulled back over its node so the name spans it weighted inward, off the
  left edge.
- **Colour** resolved to the primary's own band/node colours per volume (the
  gray/brown is the theme's, not borrowed) — the E-era question the sketch
  flagged, closed for now.

**Still open (the animation phase).** Selection is **tap-for-now** — a stopgap
that violates the two-motion premise; magnifier-as-selection (rotating the
secondary/tertiary rings) is the next build. And the transition between strata
is a **snap**, not yet the multiplane tween. Both are D.4/D.5 work.

## Data schema (sketch — D.1 designs, D.2 builds)

```jsonc
// volume manifest — a declared dimension capability
"dimension": {
  "shape": "swap",              // swap | sort | filter
  "parameter": "language",       // what the secondary ring browses
  "child": "translation",        // what its pyramid browses (optional)
  "default": "latin",            // the pinned starting value
  "anchor": "content"            // content (mapped) | position (seat)
}
```

The *data* largely exists: each verse already carries `text` keyed by
translation (`VUL`, `NAB`, `BYZ`…), and `translations.json` declares each
translation's `language`, `versification`, and `direction`. D.1's schema
work is (a) the manifest dimension declaration above, (b) the translation
popularity tier, and (c) the versification map the content anchor requires.

## The dormant core — revive the state, rebuild the bridge

`src/core/` holds v3.7's dimension machinery, dormant (only `telemetry.js`
is wired live). The D.1 verdict from reading it:

- **REVIVE** `interaction-store.js` — its state already carries `language`,
  `edition`, and `dimensions` slots with clean reducer actions
  (`SET_LANGUAGE`, `SET_EDITION`, `SET_DIMENSIONS`) — roughly the right
  state for "reading in Greek, Byzantine edition." Keep the shape; refit
  action names to swap/sort/filter if needed.
- **REBUILD** `store-navigation-bridge.js` — it drives that state the
  *portal* way (extract from manifest, dispatch, redirect). The secondary strata
  replaces that interaction model wholesale; the bridge is the piece to
  rewrite to connect a secondary-stratum selection to the store.
- Both have tests (`interaction-store.test.js`,
  `store-navigation-bridge.test.js`) to lean on and rewrite against.

## What earns dimension-hood (the litmus test, refreshed)

The v3.7 litmus test — "can I navigate the ENTIRE hierarchy through this
lens?" — still names the *purest* dimension (language: every level
translates, the structure identical across languages). But Howell's
generalization is broader than a lens: a secondary stratum legitimately holds
**any** orthogonal parameter a user would otherwise toggle — a sort key that
reorders one level, a filter that hides layers. So:

- A **true dimension** (swap/lens) transcends the hierarchy — language.
- The **secondary strata** serves that *and* sort *and* filter.
- Still NOT a dimension: a leaf-only property dressed up as one (currency,
  price range, in-stock) — display preferences or filters within a view.
  The old doc's rejections (market, currency, price) stand.

The discipline the old doc urged remains: **hundreds of hierarchies, a
handful of dimensions.** Make the things a user would genuinely toggle
through a list, not everything.

## Candidate dimensions by volume

- **Bible** — language (swap; the D.6 build), translation as its pyramid.
- **Catalog** — sort order (alphabetical / horsepower / displacement); most
  natural *after* family flattening, when models sit in one ring to reorder.
- **Calendar** — layers (work / holidays / personal; the first multi-select
  filter; the "personal" layer is the input frontier the Premise leaves open
  — ingested from outside, never typed).
- **Music (future)** — genre, era, language; the vision that motivated
  strata being general rather than a Bible feature.

---

## Rulings (all closed 2026-07-20)

1. Dimension choices **survive** a gateway exit/re-entry.
2. Content anchor uses **full cross-numbering**; the first build is Latin +
   English, one translation each — already crossing VUL↔MT numbering.
3. The live preview regenerates **on settle**, never mid-rotation.
4. The dimension button is a **neutral icon** (no current-value label).
5. Multi-select filter gesture **deferred to the calendar**.
6. Secondary-stratum colors **carried to E**.

**Deferred out of D by design:** the multi-select gesture (→ calendar), the
color scheme (→ E), and the catalog/calendar/music dimensions (D lands on the
Bible first). **The one live prerequisite for D.6:** confirm the English
text's completeness in the chapter files.
