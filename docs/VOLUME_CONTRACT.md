# Volume Contract

This document defines what is **universal** to all volumes (provided by the engine, not
configurable) versus what is **optional** (declared per-volume in its adapter). Its purpose
is to guide new volume authors and to keep the universal/optional boundary explicit as the
codebase grows.

---

## 1. Universal Engine Behaviors

The following behaviors are implemented once in the engine and apply identically to every
volume. A volume adapter cannot override or disable them.

| Behavior | Where implemented |
|---|---|
| Focus Ring rotation physics — momentum, deceleration, snap-to-node | `src/interaction/` |
| Child Pyramid node placement — `calculatePyramidCapacity`, `sampleSiblings`, `placePyramidNodes` | `src/geometry/child-pyramid.js` |
| Migration animation — `animateIn`/`animateOut`, LIFO stack, 600 ms CSS transform, `isAnimating` guard, `prefers-reduced-motion` | `src/view/migration-animation.js` |
| Parent Button visibility (inner / outer) | `src/view/` |
| Schema validation on load — `validate()` called before `normalize()` | adapter contract, enforced by engine |
| Aria/keyboard navigation (tab order, ring focus, dimension cycling) | `src/view/`, `src/interaction/` |
| CSS-variable theming and theme-swap | `styles/` |
| Module size / purity contract — `<200 lines`, no inline styles, pure functions where possible | architecture convention |

**Implication**: If a behavior belongs here, adding it to one adapter would be a mistake;
the correct fix is to generalise it in the engine and let all volumes benefit.

---

## 2. Required Adapter Surface

Every volume **must** implement the following. The engine calls each of these unconditionally.

```
loadManifest(env)              → Promise<RawManifest>
validate(raw)                  → { ok: boolean, errors: string[] }
normalize(raw)                 → { items, links, meta }
layoutSpec(normalized, vp)     → LayoutSpec
detailFor(selected, manifest)  → DetailPayload
createHandlers({ manifest, … }) → { parentHandler, childrenHandler, layoutBindings }
capabilities                   → { search: boolean, deepLink: boolean, theming: boolean }
```

`normalize` must also populate `meta.leafLevel` (the deepest navigable level name) and
`meta.levels` (ordered level array). These drive the ring-count and leaf-detection logic.

---

## 3. Optional Capabilities

These features are **only activated when a volume declares them**. The engine handles their
absence gracefully (button hidden, handler not called, etc.).

### 3.1 Dimensions / Portals

**What it is**: Alternate views of the same hierarchy (language, era, translation). Rendered
as Secondary and Tertiary strata; toggled by the dimension button (hidden when absent).

**How declared**: `display_config.languages` and `display_config.editions` in the manifest.
The adapter surfaces them via `normalize → meta.dimensions`.

**Engine behaviour when absent**: dimension button is hidden; only the Primary stratum exists.

### 3.2 Cousin-Chain Navigation

**What it is**: At a single ring level, the Focus Ring shows siblings drawn from *multiple
parents* (e.g., Bible books that span section boundaries). Requires a custom chain-builder
that aggregates siblings from across the hierarchy.

**How declared**: Adapter calls `buildBibleBookCousinChain` (or equivalent) inside
`createHandlers` and returns the resulting item list via `parentHandler` / `childrenHandler`.

**Engine behaviour when absent**: navigation is strictly parent → children; no cross-parent
sibling merging occurs.

### 3.3 Leaf-Content Prefetch

**What it is**: Async preloading of leaf-level content (e.g., verse text from split chapter
files) triggered when the user lands on a chapter node, before they drill into verses.

**How declared**: Adapter exports `prefetchBibleVerses` and wires it into `layoutBindings.prefetchBibleVerses`.
The engine calls it opportunistically if present.

**Engine behaviour when absent**: detail content is fetched on-demand at selection time only.

### 3.4 Progressive Parent Label

**What it is**: The Parent Button label changes text to reflect the user's nav depth, rather
than showing a generic "back" cue. Depth rules are volume-specific (e.g., Catalog depth 0 →
country name; depth 1 → manufacturer name; depth ≥ 2 → "MANUFACTURER N CIL").

**How declared**: Adapter returns `getParentLabel(item)` from `createHandlers`.

**Engine behaviour when absent**: Parent Button shows its default label at all depths.

### 3.5 Custom Navigation Modes

**What it is**: Some volumes have navigation logic that does not map cleanly to a single
static hierarchy (e.g., Calendar's millennium / year / month mode switch; Catalog's nav
stack that collapses market + country + manufacturer into one compound ring level). The
adapter manages an internal mode variable and returns a handler that switches it.

**How declared**: Adapter manages `mode` state internally, exposes `parentHandler` and
`childrenHandler` that read it, and passes refs via `layoutBindings`.

**Engine behaviour when absent**: The engine calls `parentHandler` and `childrenHandler`
with the currently selected item; if they return `false` the engine falls back to its
default parent/child resolution.

### 3.6 Suffix Merge

**What it is**: Compound node IDs (`market__country__manufacturer`) are constructed by the
adapter so that the ring can display a manufacturer on a single level even though it sits
three schema levels deep. The `meta.suffixMerge: true` flag signals the engine not to
attempt further level decomposition on those IDs.

**How declared**: `meta.suffixMerge = true` in `normalize` return value.

**Engine behaviour when absent**: IDs are treated as opaque strings; no merging applied.

### 3.7 Search *(planned)*

**How declared**: `capabilities.search: true` + adapter exports `search(query)`.

### 3.8 Deep Linking *(planned)*

**How declared**: `capabilities.deepLink: true` + adapter exports `resolveDeepLink(url)`.

---

## 4. Per-Volume Capability Matrix

| Capability | Bible (Gutenberg) | MMdM Catalog | Calendar | Places |
|---|:---:|:---:|:---:|:---:|
| **Hierarchy depth** | 6 levels¹ | 8 levels² | 3 levels³ | dynamic⁴ |
| **Leaf node** | verse | model | month | varies |
| **Dimensions / portals** | ✓ Language + Translation | — | — | — |
| **Cousin-chain navigation** | ✓ books across sections | — | — | — |
| **Leaf-content prefetch** | ✓ verse cache | — | — | — |
| **Progressive parent label** | — | ✓ country → mfr → "MFR N CIL" | — | — |
| **Custom nav modes** | ✓ testament/book/chapter/verse | ✓ compound ring + nav stack | ✓ millennium/year/month | ✓ level-index stack |
| **Suffix merge** | — | ✓ | — | — |
| **Detail: text content** | ✓ verse text (multi-translation) | — | — | — |
| **Detail: card with image** | — | ✓ manufacturer logo | — | — |
| **Theming** | ✓ | ✓ | ✓ | ✓ |
| **Search** | planned | planned | planned | planned |
| **Deep linking** | planned | planned | planned | planned |

**Hierarchy levels:**

1. Bible: `root → testament → section → book → chapter → verse`
2. MMdM Catalog: `root → market → country → manufacturer → cylinder → family → subfamily → model`
3. Calendar: `root → millennium → year → month`
4. Places: levels are declared in `display_config` and resolved at runtime from the manifest

---

## 5. Decision Guide — Universal vs. Optional

Use this checklist when a new feature is proposed:

**Make it universal if:**
- It applies identically to every past and future volume with no per-volume variation
- Its absence would break the core interaction loop (rotation, pyramid, navigation)
- It is a UX guarantee (accessibility, animation contract, theme swap)

**Make it optional (adapter capability) if:**
- Only one or two volumes need it right now
- Its logic is driven by volume-specific data (schema shape, level names, external files)
- A volume operates correctly without it (engine falls back gracefully)
- It requires volume-specific parameters (depth rules, chain-builders, prefetch URLs)

**Make it a Detail Sector plugin if:**
- The feature is purely about *rendering leaf content* (text, image, audio, embed)
- It does not affect navigation or ring geometry
- Different volumes need entirely different rendering for the same lifecycle slot

---

## 6. Adding a New Volume — Checklist

1. **Implement the required adapter surface** (§2) — all seven exports.
2. **Declare your hierarchy** — populate `meta.levels` and `meta.leafLevel` in `normalize`.
3. **Set capabilities flags** — default all to `false`; flip only what is implemented.
4. **Assess optional capabilities** — work through §3 and add only what your data needs.
5. **Register the adapter** — call `registry.register(id, factory)` in the app entry point.
6. **Add a row to the matrix** (§4) so the boundary stays visible for the next author.
