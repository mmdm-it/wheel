import { createApp, getViewportInfo, buildBibleBookCousinChain, validateVolumeRoot } from './index.js';
import { buildCalendarYears, buildBibleBooks, buildCatalogManufacturers, getCatalogChildren, getCalendarMonths, getBibleChapters, toRomanNumeral, bookIdOf } from './adapters/volume-helpers.js';
import { createVolumeLayoutSpec } from './adapters/volume-layout.js';
import { adapterLoader, volumeConfigs, DEFAULT_VOLUME, makeLabelFormatter } from './volume-configs.js';
import { mountFeelHud } from './view/feel-hud.js';
import { mountProbe } from './diagnostics/probe.js';
import { captureGatewaySnapshot, playGatewayWipe } from './view/gateway-wipe.js';
import { clearStack as clearMigrationStack } from './view/migration-animation.js';
import { createInteractionStore } from './core/interaction-store.js';
import { createDimensionBridge } from './core/dimension-bridge.js';
import { recall, remember } from './core/session-memory.js';
import { renderStratum, hideStratum } from './view/secondary-strata-view.js';
import { DetailPluginRegistry } from './view/detail/plugin-registry.js';
import { TextDetailPlugin } from './view/detail/plugins/text-plugin.js';
import { CardDetailPlugin } from './view/detail/plugins/card-plugin.js';
import { EphemerisDetailPlugin } from './view/detail/plugins/ephemeris-plugin.js';
import { computeDetailSectorBounds } from './geometry/detail-sector-geometry.js';
import { onVerseFontReady, invalidateVerseMeasurement } from './view/detail/plugins/line-layout.js';
import { isDetailLevel } from './view/detail/detail-level.js';
import { computeFlickRotation, FLICK_GLIDE_MS } from './interaction/gesture-tiers.js';
import { getArcParameters, getViewportWindow, getNodeSpacing, getMagnifierPosition, getMagnifierAngle, getParentSeat } from './geometry/focus-ring-geometry.js';
import { bootSplashShouldPlay, playBootSplash } from './view/boot-splash.js';
import { mountDimensionGlobe } from './view/dimension-globe.js';
import { mountSearchDividers } from './view/search-dividers.js';
import { enterSearchLook, exitSearchLook, setSearchScopeLabel } from './view/search-mode.js';

const svg = document.getElementById('app');

// Viewport responsiveness, part one: measure the GENUINELY-visible area and
// size the canvas from JS to the same numbers the geometry uses. window.inner*
// reports the full screen as if there were no address bar; visualViewport is
// the area actually visible BELOW a browser's chrome (e.g. a DuckDuckGo/Android
// top address bar). Measuring inner* — and measuring it at module load, before
// the bar drops in — computed for a full screen and the bar then cropped the
// bottom. One source of truth, measured fresh at boot.
function measureViewport() {
  const vv = window.visualViewport;
  const w = vv && vv.width ? Math.round(vv.width) : window.innerWidth;
  const h = vv && vv.height ? Math.round(vv.height) : window.innerHeight;
  return getViewportInfo(w, h);
}
const strataLayer = typeof document !== 'undefined' ? document.getElementById('strata-layer') : null;
// A transparent full-viewport hit target, kept as the FIRST (bottom) child of
// the strata layer, so the front stratum can be rotated by a drag STARTED
// anywhere — not only on the thin band or a node. Strata groups append after
// it, so it never covers them. Its pointer-events ride the layer's (toggled by
// strataFront), so it's inert at the primary.
// The strata layer is an HTML <div> (each stratum a top-level <svg> inside it)
// so WebKit honors the recede blur on each stratum's svg root — a filter on an
// SVG child <g>, or even a NESTED <svg>, is silently dropped on iOS (Howell
// 2026-07-27). The hit target is therefore an HTML div too, kept as the FIRST
// (bottom) child so the stratum svgs append on top of it.
const strataHit = strataLayer && typeof document !== 'undefined'
  ? (() => {
    const d = document.createElement('div');
    d.id = 'strata-hit';
    d.style.position = 'absolute';
    d.style.inset = '0';
    // Inert by default — turned on ONLY while a stratum is front (renderStack),
    // or it swallows every tap/swipe on the primary (Howell 2026-07-21).
    d.style.pointerEvents = 'none';
    strataLayer.appendChild(d);
    return d;
  })()
  : null;
function pinCanvas(vp) {
  if (svg) { svg.style.width = `${vp.width}px`; svg.style.height = `${vp.height}px`; }
  // The strata layer shares the primary's exact coordinate system (px, no
  // viewBox) so a stratum drawn at (x,y) lands where the geometry says.
  if (strataLayer) { strataLayer.style.width = `${vp.width}px`; strataLayer.style.height = `${vp.height}px`; }
  // strataHit is an HTML div at inset:0 — it sizes with the layer, no attrs.
}
let viewport = measureViewport();
pinCanvas(viewport);

// D.2 — the dimension state lives at the HOST level, above bootVolume, so a
// choice survives volume reboots and gateway round trips (Howell ruling
// 2026-07-20, docs/DIMENSION_SYSTEM.md). The store and bridge are created
// once; each boot refreshes the bridge's registry and its render hook.
const dimensionStore = createInteractionStore();
const dimensionBridge = createDimensionBridge({ store: dimensionStore });

// D — the strata STACK (docs/DIMENSION_SYSTEM.md). Up to three deep for a
// dimensioned volume: primary (the volume) → secondary (languages, mirrored)
// → tertiary (translations, standard). The dimension button cycles which
// stratum is at
// the FRONT: primary → secondary → tertiary → primary. Each press pushes the
// stack one layer deeper — the front is full size, one layer back recedes to
// 0.4, two layers back to 0.2 — each receding one straight-pull-back
// (Disney multiplane: a 2D scale about the viewport centre, which drops the
// off-screen hub) and softening under a static rack-focus blur. The front
// opaquely covers the layers behind; strata not yet entered are hidden
// ("behind the user's head"). Selection is still tap-for-now — rotation
// (magnifier-as-selection) is the next build.
const STRATA_DEPTHS = [1.0, 0.4, 0.2];  // scale, indexed by levels behind the front
const STRATA_BLURS = [0, 1, 2];         // px local, same index — front sharp,
// one back a soft rack-focus, two back twice that so it reads further away.
// Kept GENTLE on purpose: a receded plane's nodes must stay legible, never
// dissolve into a smear (Howell 2026-07-27). Eased again 2026-07-30 (1.5/3 →
// 1/2) now that the deepest plane is the app's FIRST screen: the boot funnel
// is a stranger's introduction, so what waits behind the glass has to be
// legible enough to be worth travelling toward.
// Tangent fill span (radians past each viewport exit), sized to reach the
// screen edge at each recede scale — the deeper the ring, the more of the
// straight chain climbs into view (Howell 2026-07-21). Level 0 = arc-only.
const STRATA_TANGENT_SPANS = [0, 1.1, 2.2];
const CHOOSERS = [
  // THE STRATA INVERTED (Howell 2026-07-30). The z-axis used to disagree with
  // itself: the SEQUENCE was right (language, then edition — an edition's
  // options depend on the language) but the DEPTH was backwards, seating the
  // narrower, dependent thing FURTHER from the reader than the set containing
  // it. Howell: "translations are subsets of languages, but they are shown as
  // supersets." Now nesting and depth agree — language deepest (the largest
  // set), edition between, the text in front (the element itself), so
  // travelling inward is narrowing and travelling outward is broadening, the
  // same logic the wheel already uses radially.
  // NOTE the planes keep their own DRESS: `mirrored` and `centerMag` describe
  // how a plane looks, not what it holds, so the edition inherits the
  // mirrored ring and the language the centred magnifier.
  { id: 'secondary', mirrored: true,
    // Reads the PREVIEW language while the language ring is being turned, so
    // the receded edition plane keeps pace with the finger (Howell 2026-07-30)
    // — the same live courtesy the child pyramid has always shown the ring.
    items: () => dimensionBridge.translationsOf(strataPreview?.language),
    previewSelected: () => strataPreview?.edition || null,
    // Magnified node: the full, spelled-out translation title; the rest keep
    // the abbreviation/key — Howell 2026-07-21.
    // The PREVIEW language is passed as the hint: the "coming soon" node is a
    // single sentinel carrying no language of its own, so while a language is
    // merely passing under the lens its placeholder must be told whose promise
    // it is — otherwise Italian's held shelf wore Finnish's words (Howell
    // spotted it on the phone, 2026-07-30).
    // THE SHELF SPEAKS IN FULL (Howell, LAN check 2026-08-01): every edition
    // node shows its NATIVE FULL NAME — Οἱ Ἑβδομήκοντα, כתב יד לנינגרד —
    // magnified or not. The old split showed Latin-letter codes (LXX, WLC) on
    // the unmagnified nodes, which read as filing labels in a volume whose
    // whole point is that each tongue speaks for itself. This retires O-6's
    // nativeAbbrev before any data was written for it. It fits because this
    // plane holds only an edition or three per language, far apart on the
    // arc — unlike the book sky, where long names collide.
    label: key => dimensionBridge.translationName(key, strataPreview?.language || null),
    selected: () => dimensionBridge.getSelection().translation,
    select: key => {
      const ok = dimensionBridge.setTranslation(key);
      window.__wheelTapTrace?.push({ ev: 'select-tr', key, ok: ok ? 1 : 0 });
      return ok;
    } },
  { id: 'tertiary', mirrored: false, centerMag: true,
    items: () => dimensionBridge.languagesAvailable(),
    label: id => dimensionBridge.languageLabel(id), // each tongue names itself
    selected: () => dimensionBridge.getSelection().language,
    select: id => {
      const ok = dimensionBridge.setLanguage(id);
      window.__wheelTapTrace?.push({ ev: 'select-lang', id, ok: ok ? 1 : 0 });
      return ok;
    } }
];
let strataFront = 0;                       // 0 = primary at front
// THE LIVE PREVIEW (Howell 2026-07-30): while a chooser ring is being turned,
// everything AHEAD of it (nearer the reader) follows the node passing under
// the lens, before anything commits — turn the language wheel and the receded
// edition plane re-stocks itself and the verse behind the glass changes
// tongue, exactly as the child pyramid has always tracked the focus ring.
// Null while nothing is being turned; the choosers fall back to committed
// state. Preview always ENDS in a commit (the springback settles the nearest
// node), so what the reader watched is what they get.
let strataPreview = null;                  // { language, edition } | null
const isStrataOpen = () => strataFront !== 0;
const isSecondaryOpen = isStrataOpen;      // the primary pointer guard reads this
// The dimension feature lives IN the detail sector: strata recede only when
// the purple sill is on screen (a leaf), never over a child pyramid — that is
// where the sprocket-wheel-and-chain analogy reads (Howell 2026-07-21).
let detailSectorVisible = false;
// During a gateway wipe the corner icons are FROZEN — part of the image
// (Howell 2026-07-27, second ruling): the departing volume's icon stays put
// under the frozen screen and the swap happens at the INSTANT the sweep line
// crosses the icon's corner (the wipe's onCross), exactly as every node and
// color swaps when the line passes it. While frozen the updaters leave the
// buttons untouched. The globe's hello spin comes only at wipe END, only on
// an arrival (never a goodbye), revealed static first.
let cornerIconHold = false;
let globeSpinMuted = false; // the crossing swap reveals the globe STATIC
const dimensionButton = typeof document !== 'undefined' ? document.getElementById('dimension-button') : null;
// The button's wireframe globe, drawn by code so it can truly turn: once on
// arrival, and once per press — settling exactly as the stratum recedes.
const dimensionGlobe = mountDimensionGlobe(dimensionButton);
// The navigator's dividers — the search instrument's icon, sharing the
// globe's corner: dividers while browsing, globe at a leaf.
const searchButton = typeof document !== 'undefined' ? document.getElementById('search-button') : null;
mountSearchDividers(searchButton);
let searchAvailable = false; // set per volume at boot (config.hasSearch)

// ── Search mode (Howell 2026-07-22): the alphanumeric ring + the strike ───
// Tap the dividers and the browse chain yields the focus ring to a bounded
// chain of characters — A..Z, a two-link seam, 0..9 — rotatable with the
// instrument's own grammar. TAP THE MAGNIFIER to strike the settled letter:
// it joins the carriage (the search string riding just left of the lens,
// rotated on the lens's own axis, growing leftward like paper past a
// platen), and the ring prunes to only the characters that could possibly
// follow. The child pyramid holds the live completions — dancing per
// character through the lens — and tapping one arrives at its place in the
// volume. Tap the dividers again to abandon and restore the browse chain.
const SEARCH_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('');
const SEARCH_COMPLETION_CAP = 14; // pyramid seats for candidates
// Normalize a label for striking (A-Z0-9, punctuation and spaces dropped)
// AND record which norm-indices begin a WORD in the raw label — the substring
// ranking (Howell 2026-07-27) seats name-start matches first, word-start
// second, anywhere third, so "IN" surfaces INTERCEPTOR above 8.2 FUEL PINCHER.
const searchAnalyze = s => {
  const label = String(s).toUpperCase();
  let norm = '';
  const wordStarts = new Set();
  let newWord = true;
  for (const ch of label) {
    if (/[A-Z0-9]/.test(ch)) {
      if (newWord) wordStarts.add(norm.length);
      norm += ch;
      newWord = false;
    } else {
      newWord = true;
    }
  }
  return { norm, wordStarts };
};
// Best match tier of the struck string in an entry: 0 = name-start,
// 1 = word-start, 2 = anywhere, -1 = no match. Checks every occurrence —
// "IN" in "INBOARD INTERCEPTOR" is tier 0 even though a later occurrence
// is mid-word.
const searchMatchTier = (e, struck) => {
  let at = e.norm.indexOf(struck);
  if (at === -1) return -1;
  let tier = 2;
  while (at !== -1) {
    if (at === 0) return 0;
    if (e.wordStarts && e.wordStarts.has(at)) tier = 1;
    at = e.norm.indexOf(struck, at + 1);
  }
  return tier;
};
let searchRestore = null;       // the browse chain to restore on exit
let searchStruck = '';          // the struck string so far (normalized; matches ANYWHERE in a name)
let searchCorpusEntries = [];   // [{ item, label, norm }] — ALL the volume's searchable leaves
let searchScopedCorpus = [];    // the active subset: leaves under the ring the search opened from
let searchOpeningAllowed = null;// characters the opening ring is pruned to when scoped (any position)
let searchGraphById = new Map();// the adapter graph, for walking a leaf up to the ring level
let searchStringEl = null;      // the carriage — SVG text left of the lens
let searchAllLabel = 'TUTTI';   // what the scope label says when nothing is filtered

// IN SEARCH, the dividers take the parent disc's seat — directly under the
// magnifier. That seat means BACK on every screen (Howell 2026-07-23): the
// parent vessel while browsing, the dividers while searching. Out of search
// they return to their corner (the stylesheet's position).
function seatSearchButton(inSearch) {
  if (!searchButton) return;
  if (inSearch) {
    const seat = getParentSeat(viewport);
    searchButton.style.left = `${seat.discX.toFixed(0)}px`;
    searchButton.style.top = `${seat.discY.toFixed(0)}px`;
    searchButton.style.right = 'auto';
    searchButton.style.bottom = 'auto';
    searchButton.style.transform = 'translate(-50%, -50%)';
  } else {
    searchButton.style.left = '';
    searchButton.style.top = '';
    searchButton.style.right = '';
    searchButton.style.bottom = '';
    searchButton.style.transform = '';
  }
}

// THE SCOPE (Howell 2026-07-23, superseding the ring rule): the corpus is
// every leaf DESCENDED FROM WHAT IS IN THE MAGNIFIER. With KOHLER in the
// lens, the dividers search KOHLER — the search is the deep version of the
// pyramid, everything under the lens filtered by letters. One object of
// attention. An item's id encodes its shelf-path prefix, and every model's
// id is that same prefix — so scope is pure id-prefix containment, no graph
// walk, no cross-dialect ambiguity.
function searchScopeSpec(item) {
  const id = String(item?.id || '');
  if (id.startsWith('model:')) return { exact: id };            // ring of models: those very siblings
  if (id.startsWith('subfam:')) return { prefix: `model:${id.slice(7)}:` };
  if (id.startsWith('fam:')) return { prefix: `model:${id.slice(4)}:` };
  if (id.startsWith('cyl:')) return { prefix: `model:${id.slice(4)}:` };
  if (id.startsWith('cylinder:')) return { prefix: `model:${id.slice(9)}:` }; // normalize dialect
  if (id.startsWith('manufacturer:')) return { prefix: `model:${id.slice(13)}:` };
  if (id.includes('__')) return { prefix: `model:${id.split('__').slice(2).join('__')}:` }; // top-level maker
  return null;
}
function scopeCorpusForLens(lensItem) {
  // A COUNTRY in the lens scopes to all its makers' models. Model ids don't
  // carry the country, so walk the adapter graph: the country's manufacturer
  // children each contribute their model-id prefix.
  if (typeof lensItem?.id === 'string' && lensItem.id.startsWith('country:')) {
    const prefixes = [];
    for (const it of searchGraphById.values()) {
      if (it?.level === 'manufacturer' && it.parentId === lensItem.id) prefixes.push(`model:${it.name}:`);
    }
    if (prefixes.length) return searchCorpusEntries.filter(e => prefixes.some(p => e.item.id.startsWith(p)));
  }
  const spec = lensItem ? searchScopeSpec(lensItem) : null;
  if (!spec) return searchCorpusEntries.slice(); // unrecognized lens: whole volume
  if (spec.exact) return searchCorpusEntries.filter(e => e.item.id === spec.exact);
  return searchCorpusEntries.filter(e => e.item.id.startsWith(spec.prefix));
}

function searchCharItems(allowed = null) {
  // Letters, a two-link breath, then digits — gap links (nulls) are the
  // chain's own idiom for a seam. Orders are array positions so the gaps
  // hold their seats. `allowed` (a Set) prunes to surviving characters.
  const keep = c => !allowed || allowed.has(c);
  const letters = SEARCH_CHARS.slice(0, 26).filter(keep);
  const digits = SEARCH_CHARS.slice(26).filter(keep);
  const seam = letters.length && digits.length ? [null, null] : [];
  return [...letters, ...seam, ...digits]
    .map((c, i) => (c === null ? null : { id: `char:${c}`, name: c, level: 'character', order: i }));
}

// Every character that could EXTEND the struck string at some occurrence in
// some name (Howell 2026-07-27, substring search): after "IN", "T" survives
// for INTERCEPTOR and "C" for 8.2 FUEL PINCHER alike. The foreclosure
// principle is unchanged — the ring never offers a dead strike — computed
// as "can extend a match" instead of "can extend a prefix".
function searchNextChars(struck) {
  const next = new Set();
  for (const e of searchScopedCorpus) {
    let at = e.norm.indexOf(struck);
    while (at !== -1) {
      const c = e.norm[at + struck.length];
      if (c) next.add(c);
      at = e.norm.indexOf(struck, at + 1);
    }
  }
  return next;
}

// The pyramid's candidates while searching: every name CONTAINING the struck
// string + the character in (or passing through) the lens, seated by tier —
// name-start matches first, word-start second, anywhere third (Howell
// 2026-07-27), alphabetical within a tier — so the old prefix behavior stays
// the front of the results and substring hits extend rather than scramble it.
// Wired into the volume's pyramid config at boot; dances live during rotation.
function searchCompletions(selected) {
  if (!selected || selected.level !== 'character') return [];
  const p = searchStruck + selected.name;
  const matched = [];
  for (const e of searchScopedCorpus) {
    const tier = searchMatchTier(e, p);
    if (tier === -1) continue;
    // The candidate wears its REAL id: the arrival migration pairs pyramid
    // clones with ring targets by id, and a namespaced id left the tapped
    // star unpaired — it jumped to the lens instead of flying (Howell).
    matched.push({ tier, cand: { id: e.item.id, name: e.label, level: e.item.level, searchEntry: e } });
  }
  // Corpus is already alphabetical, so a stable tier sort keeps each tier
  // alphabetical without re-comparing labels.
  return matched.sort((a, b) => a.tier - b.tier)
    .slice(0, SEARCH_COMPLETION_CAP)
    .map(m => m.cand);
}

// The carriage: the struck string, seated just left of the lens on the
// lens's own rotated axis, end-anchored so each new strike pushes the
// older characters leftward — the typewriter's platen. Each character is
// its own tspan and TAPPABLE: the backspace that came to us (Howell
// 2026-07-22) — tap a struck letter and it returns to the lens, the string
// truncating to just before it, the completions widening back out.
function updateSearchCarriage() {
  if (!searchStringEl && svg) {
    const p = getMagnifierPosition(viewport);
    const deg = (getMagnifierAngle(viewport) * 180) / Math.PI + 180;
    searchStringEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    // The carriage wears the magnifier label's type, plus its own class so
    // it can be lit for the dark ground (it sits on the GROUND, not on a node).
    searchStringEl.setAttribute('class', 'focus-ring-magnifier-label search-carriage');
    searchStringEl.setAttribute('x', String(-viewport.SSd * 0.115));
    searchStringEl.setAttribute('y', '0');
    searchStringEl.setAttribute('text-anchor', 'end');
    searchStringEl.setAttribute('dominant-baseline', 'middle');
    searchStringEl.setAttribute('transform', `translate(${p.x.toFixed(1)}, ${p.y.toFixed(1)}) rotate(${deg.toFixed(1)})`);
    // The label class disables pointer events; the carriage takes them back.
    searchStringEl.style.pointerEvents = 'auto';
    searchStringEl.style.cursor = 'pointer';
    searchStringEl.addEventListener('click', e => {
      const t = e.target && e.target.closest ? e.target.closest('tspan') : null;
      if (t && t.dataset.index != null) searchBackspaceTo(Number(t.dataset.index));
    });
    svg.appendChild(searchStringEl);
  }
  if (!searchStringEl) return;
  while (searchStringEl.firstChild) searchStringEl.removeChild(searchStringEl.firstChild);
  [...searchStruck].forEach((ch, i) => {
    const t = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
    t.textContent = ch;
    t.dataset.index = String(i);
    // An imaginary blank between characters — each is its own backspace
    // key, and thumbs need the room (Howell 2026-07-22).
    if (i > 0) t.setAttribute('dx', '0.45em');
    searchStringEl.appendChild(t);
  });
}

// Tap a struck character: everything from it onward un-strikes, the tapped
// letter returns to the lens as the settled character, and the ring/pyramid
// rebuild for the shortened string.
function searchBackspaceTo(i) {
  const app = currentApp;
  if (!app?.nav || !searchRestore) return;
  const letter = searchStruck[i];
  if (!letter) return;
  searchStruck = searchStruck.slice(0, i);
  updateSearchCarriage();
  // An empty string restores the opening ring as the mode opened it (full
  // when unscoped, scope-pruned when narrowed); otherwise prune for the
  // shortened prefix. The tapped letter is by construction a survivor.
  const survivors = searchStruck ? searchNextChars(searchStruck) : searchOpeningAllowed;
  const items = searchCharItems(survivors);
  const idx = Math.max(0, items.findIndex(it => it && it.name === letter));
  app.setPrimaryItems(items, idx, true);
}

// THE STRIKE: the settled character joins the carriage and the ring prunes
// to what can still follow. A dead-end strike (nothing follows) is refused —
// the completions in the pyramid are the only way onward from there.
function strikeSettledChar() {
  const app = currentApp;
  if (!app?.nav || !searchRestore) return;
  const cur = app.nav.getCurrent();
  if (!cur || cur.level !== 'character') return;
  const nextStruck = searchStruck + cur.name;
  const survivors = searchNextChars(nextStruck);
  const hasAnyMatch = searchScopedCorpus.some(e => e.norm.includes(nextStruck));
  if (!hasAnyMatch) return; // a character no name contains: no strike
  searchStruck = nextStruck;
  updateSearchCarriage();
  if (survivors.size) app.setPrimaryItems(searchCharItems(survivors), 0, true);
  // No survivors = the string is complete: the ring rests, the pyramid holds
  // the exact match(es); arrival is a pyramid tap away.
}

// ARRIVAL (Howell 2026-07-22, second draft — the cascade was overwhelming):
// a completion tap lands the found leaf DIRECTLY, exactly as picking a model
// from its cylinder group does — the tapped candidate migrates from pyramid
// to magnifier, its sibling set pours onto the ring, the detail sector
// enlarges in sync, and the character ring migrates off screen as every
// outgoing ring does. The parent button does not fight the tide: no flight,
// it simply fades on. The browse chain the search began from is planted as
// the breadcrumb, so OUT of the found leaf returns there — never to letters.
let searchVolumePyramid = null; // the volume's own pyramid config (set at boot)
function searchArrive(entry) {
  const app = currentApp;
  if (!app || !searchRestore || !entry?.item) return;
  const breadcrumb = {
    items: searchRestore.items,
    selectedIndex: searchRestore.selectedIndex,
    preserveOrder: true
  };
  const landed = typeof searchVolumePyramid?.descendTo === 'function'
    ? searchVolumePyramid.descendTo({ item: entry.item, breadcrumb })
    : false;
  // Search bookkeeping ends either way — but WITHOUT restoring the character
  // ring: it is mid-flight outward (or, if the landing failed, the dividers
  // remain the way back).
  if (landed) {
    searchRestore = null;
    searchStruck = '';
    if (searchStringEl) { searchStringEl.remove(); searchStringEl = null; }
    exitSearchLook({ svg }); // the lights come up as the found leaf arrives
    seatSearchButton(false); // back to the corner — the arriving parent owns the seat
    if (searchButton) searchButton.setAttribute('aria-pressed', 'false');
    // The empty corner is dressed in strict order (Howell 2026-07-22):
    // FIRST the golden fill arrives (the labelless disc, handing off to the
    // real circle's fill at the barrier), THEN the stroke ring and the name
    // label come on together. The stroke must not pop on ahead of the fill —
    // hold it invisible from the migration's start until the label's moment.
    const view = app.view;
    const outer = view?.parentButtonOuter;
    if (outer) outer.style.strokeOpacity = '0';
    setTimeout(() => {
      const label = view?.parentButtonOuterLabel;
      if (label) {
        label.style.transition = 'none';
        label.style.opacity = '0';
      }
      requestAnimationFrame(() => {
        if (label) { label.style.transition = 'opacity 400ms ease'; label.style.opacity = ''; }
        if (outer) { outer.style.transition = 'stroke-opacity 400ms ease'; outer.style.strokeOpacity = ''; }
      });
      setTimeout(() => {
        if (label) label.style.transition = '';
        if (outer) outer.style.transition = '';
      }, 500);
    }, 900);
  }
}

function exitSearchMode() {
  const app = currentApp;
  if (!app?.nav || !searchRestore) return;
  // Clear the flag FIRST: restoring the chain triggers a render, and the
  // pyramid wrapper must already answer in browse voice — clearing after
  // painted an empty pyramid over the restored ring (Howell caught it).
  const restore = searchRestore;
  seatSearchButton(false); // the dividers yield the seat back to the parent vessel
  searchRestore = null;
  searchStruck = '';
  app.setPrimaryItems(restore.items, restore.selectedIndex, true);
  app.setParentButtons({ showOuter: true }); // the vessel returns with the browse chain
  if (searchStringEl) { searchStringEl.remove(); searchStringEl = null; }
  exitSearchLook({ svg }); // the lights come back up
  if (searchButton) searchButton.setAttribute('aria-pressed', 'false');
}

function toggleSearchRing() {
  const app = currentApp;
  if (!app?.nav || !searchAvailable || detailSectorVisible) return;
  if (searchRestore) { exitSearchMode(); return; }
  searchRestore = {
    items: (app.nav.items || []).slice(),
    selectedIndex: app.nav.getCurrentIndex()
  };
  searchStruck = '';
  // 5a (Howell 2026-07-23): scope = WHAT IS IN THE MAGNIFIER. The lens item
  // is captured before the character chain replaces it.
  const lensItem = app.nav.getCurrent();
  searchScopedCorpus = scopeCorpusForLens(lensItem);
  // The opening ring prunes to characters appearing ANYWHERE in the scope's
  // names (Howell 2026-07-27, substring search — superseding the first-
  // character rule of the Mercedes ruling): a character no in-scope name
  // contains is simply absent, foreclosed. The virgin full ring survives
  // only in the unrecognized-lens fallback, where scope is the whole volume.
  const narrowed = searchScopedCorpus.length < searchCorpusEntries.length;
  searchOpeningAllowed = narrowed
    ? new Set(searchScopedCorpus.flatMap(e => [...e.norm]))
    : null;
  // The scope, in words: the LENS's own label — the user searches the thing
  // they were looking at, and the corner says so. Read from the magnifier's
  // DOM (the display form: KOHLER), before the letters land there.
  const lensLabel = (app.view?.magnifierLabel?.textContent || '').trim()
    || String(lensItem?.name || '') || searchAllLabel;
  const seat = getParentSeat(viewport);
  updateSearchCarriage(); // seats the (empty) carriage at the lens
  // The lights dim for close work, and the pressed tool ghosts in behind.
  enterSearchLook({ svg, viewport });
  seatSearchButton(true); // the dividers take the back seat under the lens
  setSearchScopeLabel(svg, { text: lensLabel, x: seat.labelX, y: seat.labelY });
  app.setPrimaryItems(searchCharItems(searchOpeningAllowed), 0, true);
  // The parent button has no meaning over the character ring — no vessel,
  // nothing to ascend to. It leaves entirely (Howell 2026-07-22).
  app.setParentButtons({ showOuter: false });
  if (searchButton) searchButton.setAttribute('aria-pressed', 'true');
}
if (searchButton) searchButton.addEventListener('click', toggleSearchRing);
function updateSearchButton() {
  if (!searchButton) return;
  if (cornerIconHold) return; // frozen mid-wipe: the icon is part of the image
  // Only where the volume declares a searchable namespace; hidden at a leaf
  // (the globe's turf) and while the boot reveal owns the screen; present
  // while browsing.
  const splashUp = typeof document !== 'undefined' && document.getElementById('boot-splash-blocker');
  searchButton.hidden = !searchAvailable || detailSectorVisible || Boolean(splashUp);
}

// THE DATA STAMPS (W-7): the factory stamp's data lines — each volume's
// volume_data_version under the engine version, read at RUNTIME from each
// manifest (data syncs independently of the bundle; a baked stamp would lie
// exactly when it's used to check whether a data push landed). Fetches use
// no-cache: always revalidated against the server (a 304 when unchanged
// costs nothing), so the stamp shows the server's truth. A volume whose
// manifest never answers shows '?' — never a silently absent line.
const dataStampCache = new Map(); // letter → last resolved version this session
async function refreshDataStamps(app) {
  const items = app?.nav?.items || [];
  const stamps = items.filter(it => it && typeof it.id === 'string' && it.id.startsWith('data-stamp-'));
  if (!stamps.length) return; // volumes without the footnote
  // A rebuilt chain arrives with placeholder lines — re-dress them from the
  // session cache immediately, then revalidate below.
  stamps.forEach(it => {
    const letter = it.id.slice('data-stamp-'.length);
    if (dataStampCache.has(letter)) it.name = `${letter} ${dataStampCache.get(letter)}`;
  });
  await Promise.all(stamps.map(async it => {
    const letter = it.id.slice('data-stamp-'.length);
    const cfg = Object.values(volumeConfigs).find(c => c?.stampLetter === letter);
    let version = '?';
    if (cfg?.manifestPath) {
      try {
        const res = await fetch(cfg.manifestPath, { cache: 'no-cache' });
        if (res.ok) {
          const m = await res.json();
          const root = typeof cfg.extractRoot === 'function' ? cfg.extractRoot(m) : null;
          version = root?.display_config?.volume_data_version || '?';
        }
      } catch (e) { /* '?' stands — the honest unknown */ }
    }
    if (version !== '?') dataStampCache.set(letter, version);
    it.name = `${letter} ${version}`;
  }));
  // If the reader is parked near the stamp, one static re-render shows the
  // resolved lines; otherwise they're correct whenever the chain reaches them.
  if (currentApp === app && typeof app.refreshPyramid === 'function') app.refreshPyramid();
}

function scaleAboutCentre(scale) {
  const cx = viewport.width / 2;
  const cy = viewport.height / 2;
  return `translate(${cx} ${cy}) scale(${scale}) translate(${-cx} ${-cy})`;
}
// A plane's DEPTH is a uniform scale about the viewport centre (which drops
// the off-screen hub — Disney multiplane) plus a rack-focus blur. These
// setters apply an ARBITRARY scale/blur/opacity, so the settled snap and the
// animated tween drive the same pixels through one path.
function setPrimaryVisual(scale, blurPx) {
  const scaled = scale < 0.999;
  const tf = scaled ? scaleAboutCentre(scale) : null;
  const filter = blurPx > 0.01 ? `blur(${blurPx}px)` : '';
  // The scale (recede) rides the child groups; the BLUR rides the #app <svg>
  // ROOT (Howell 2026-07-27, WebKit fix, phase 1). WebKit silently ignores
  // `filter` on SVG *child* elements (`<g>`) — the old per-group blur was
  // invisible on iPhone (ring/parent/crown stayed sharp; only the HTML verse
  // panel blurred). WebKit DOES honor `filter` on the root <svg>, just as it
  // does on the HTML panel — so blurring #app itself blurs the whole primary
  // plane on iOS too. (The SVG-native feGaussianBlur route was tried and
  // reverted 2026-07-22: sluggish + region-crop. This is the HTML/root-level
  // avenue that memory scoped instead.)
  ['.focus-content-group', '#volume-logo-group'].forEach(sel => {
    const g = document.querySelector(`#app ${sel}`);
    if (!g) return;
    if (tf) g.setAttribute('transform', tf); else g.removeAttribute('transform');
    g.style.filter = ''; // never on the child group — WebKit drops it
  });
  const app = document.getElementById('app');
  if (app) app.style.filter = filter;
  const panel = document.getElementById('detail-panel');
  if (panel) {
    const cx = viewport.width / 2, cy = viewport.height / 2;
    // Scale about the viewport CENTRE — the point the SVG ring/logo scale
    // about — so the verse text stays seated on the blue circle. The panel is
    // fixed at inset:0, so (cx,cy) is its centre; transform-origin is defined
    // pre-transform, so it's stable across successive scales. (Reading
    // getBoundingClientRect here slid the origin on a second recede, Howell
    // 2026-07-21.)
    panel.style.transformOrigin = `${cx}px ${cy}px`;
    panel.style.transform = scaled ? `scale(${scale})` : '';
    panel.style.filter = filter;
  }
}
function setStratumVisual(el, scale, blurPx, opacity = 1, offsetX = 0, offsetY = 0) {
  if (!el) return;
  // The recede TRANSFORM rides the inner <g>; the BLUR + opacity ride the
  // outer <svg> — WebKit honors a filter on an <svg>, not on a <g> (Howell
  // 2026-07-27, the strata half of the iOS blur fix).
  const inner = el.querySelector?.('.stratum-inner') || el;
  const still = Math.abs(offsetX) < 0.5 && Math.abs(offsetY) < 0.5;
  if (scale > 0.999 && blurPx < 0.01 && opacity > 0.999 && still) {
    inner.removeAttribute('transform'); el.style.filter = ''; el.style.opacity = ''; return;
  }
  const slide = still ? '' : `translate(${offsetX.toFixed(1)} ${offsetY.toFixed(1)}) `;
  inner.setAttribute('transform', `${slide}${scaleAboutCentre(scale)}`);
  el.style.filter = blurPx > 0.01 ? `blur(${blurPx}px)` : '';
  el.style.opacity = String(opacity);
}

// Settled depths (the snap, and the end of a tween): a plane at stack-level L
// sits at STRATA_DEPTHS[L], blurred STRATA_BLURS[L]. The primary also fills
// its tangent runs to match its recede.
function applyPrimaryDepth(level) {
  setPrimaryVisual(STRATA_DEPTHS[level], STRATA_BLURS[level]);
  if (currentApp && typeof currentApp.setTangentFill === 'function') {
    currentApp.setTangentFill(STRATA_TANGENT_SPANS[level] || 0);
  }
}
function applyStratumDepth(g, level) {
  setStratumVisual(g, STRATA_DEPTHS[level], STRATA_BLURS[level], 1);
}

function renderStack() {
  applyPrimaryDepth(strataFront); // primary is stack position 0; its level == front
  // Choosers are positions 1..N. Render (front to back so the SVG z-order —
  // last child on top — puts the front stratum highest) any at or ahead of
  // the front; hide the rest.
  CHOOSERS.forEach((ch, ci) => {
    const pos = ci + 1;
    if (pos > strataFront) { hideStratum(strataLayer, ch.id); return; }
    const items = ch.items();
    // A receded plane shows its PREVIEW selection when one is running, so the
    // edition under the lens tracks the language being turned behind it.
    const shown = (pos !== strataFront && ch.previewSelected?.()) || ch.selected();
    const g = renderStratum(strataLayer, {
      id: ch.id, viewport, items,
      selectedIndex: Math.max(0, items.indexOf(shown)),
      mirrored: ch.mirrored,
      labelFor: ch.label,
      centerMagnified: ch.centerMag
    });
    applyStratumDepth(g, strataFront - pos);
  });
  if (dimensionButton) dimensionButton.setAttribute('aria-pressed', String(isStrataOpen()));
  // The front stratum is drag-rotatable; the layer and its full-area hit target
  // catch pointer events ONLY while a stratum is front — at the primary they
  // stay out of the way so the ring below gets every tap and swipe.
  if (strataLayer) {
    const strataLive = strataFront > 0;
    strataLayer.style.pointerEvents = strataLive ? 'auto' : 'none';
    // Q12 (0c): hidden from assistive technology while inactive, exposed while
    // live. index.html carries aria-hidden="true" as the BOOT state, which is
    // correct — no stratum exists yet — but it was static, so the layer stayed
    // invisible to a screen reader even once the reader had dollied into it.
    //
    // Deliberately NOT a one-line removal of that attribute: unhidden always,
    // AT would announce an empty layer on every screen where strata are not
    // in play, which trades one defect for a noisier one. The layer is
    // already telling us whether it is live — this reuses that same signal
    // rather than inventing a second source of truth.
    if (strataLive) strataLayer.removeAttribute('aria-hidden');
    else strataLayer.setAttribute('aria-hidden', 'true');
  }
  if (strataHit) strataHit.style.pointerEvents = strataFront > 0 ? 'auto' : 'none';
}

// ── Magnifier-as-selection: rotate the front stratum (D.4a) ────────────────
// The front stratum is a rotatable focus ring: drag it, and whatever node
// SETTLES in the magnifier is obeyed — retiring tap-for-now, restoring the
// two-motion premise (Howell 2026-07-21). Short chains, so a gentle per-node
// sensitivity; the selection commits on release (the settle), which is when
// the receded primary re-renders its live preview.
// Match the PRIMARY's drag-to-rotation rate exactly (π/4 of arc per 100px), so
// the strata feel as graceful as the ring the reader already knows — mapping
// pixels straight to arc angle, then to node travel via the node spacing. (A
// flat px-per-node was geared down ~7×; the thumb had to crawl — Howell.)
const STRATA_DRAG_SENSITIVITY = Math.PI / 4 / 100; // rad per px
const STRATA_OVERRUN = 3;         // nodes of overshoot past each end, then the wall
const STRATA_SPRINGBACK_MS = 280; // the eased return from the overrun / into the lens
const STRATA_TAP_SLOP = 8;        // px of travel below which a press is a TAP, not a drag
let strataDrag = null;            // { items, center, spacing, lastX/Y, startX/Y, moved }
let strataSnap = null;            // rAF id of an in-flight springback / snap glide
const clampCenter = (c, n) => Math.max(0, Math.min(n - 1, c));
const clampDrag = (c, n) => Math.max(-STRATA_OVERRUN, Math.min(n - 1 + STRATA_OVERRUN, c));
const activeChooser = () => (strataFront > 0 ? CHOOSERS[strataFront - 1] : null);

// The real node nearest a tap point (for tap-to-magnifier), or null if the tap
// is nearest the lodestar (already selected — no move) or out in empty space.
function nodeIndexNearPoint(event, ch) {
  if (!ch || !strataLayer) return null;
  const group = strataLayer.querySelector(`#${ch.id}`);
  if (!group) return null;
  const rect = strataLayer.getBoundingClientRect();
  const x = event.clientX - rect.left, y = event.clientY - rect.top;
  let best = null, bd = Infinity;
  group.querySelectorAll('.secondary-strata-node[data-index]').forEach(n => {
    const d = Math.hypot(Number(n.getAttribute('cx')) - x, Number(n.getAttribute('cy')) - y);
    if (d < bd) { bd = d; best = Number(n.dataset.index); }
  });
  const lens = group.querySelector('.secondary-strata-node.is-magnified');
  if (lens && Math.hypot(Number(lens.getAttribute('cx')) - x, Number(lens.getAttribute('cy')) - y) < bd) {
    return null; // nearest the lens itself → already the selection
  }
  return best != null && bd <= viewport.SSd * 0.14 ? best : null;
}

// Re-render ONLY the front stratum at a (fractional) center index, front depth.
// rotating (default) = the empty hollow lens with every node streaming through;
// false = the settled, filled lodestar (used at the end of the springback).
function renderFrontStratumAt(centerIndex, rotating = true) {
  const ch = activeChooser();
  if (!ch) return;
  const items = ch.items();
  const g = renderStratum(strataLayer, {
    id: ch.id, viewport, items,
    selectedIndex: centerIndex,
    mirrored: ch.mirrored, labelFor: ch.label, centerMagnified: ch.centerMag,
    rotating
  });
  setStratumVisual(g, 1, 0, 1); // front plane: sharp, in place
  if (rotating) previewFromLens(ch, items, centerIndex);
}

// What is under the lens RIGHT NOW, previewed into every plane ahead of this
// one. Repainting on every pointermove would re-flow the verse dozens of times
// a second (the layout measures real glyphs), so this fires only when the
// nearest node actually CHANGES — a handful of times across a whole drag.
let lastPreviewKey = null;
function previewFromLens(ch, items, centerIndex) {
  const idx = Math.max(0, Math.min(items.length - 1, Math.round(centerIndex)));
  const item = items[idx];
  if (item === undefined || item === null) return;
  const key = `${ch.id}:${item}`;
  if (key === lastPreviewKey) return;
  lastPreviewKey = key;

  if (ch.id === 'tertiary') {
    // A language is passing: restock the edition plane and take its default,
    // exactly the edition committing this language would choose.
    const editions = dimensionBridge.translationsOf(item) || [];
    strataPreview = { language: item, edition: editions[0] || null };
  } else {
    strataPreview = { ...(strataPreview || {}), edition: item };
  }
  renderStack();          // receded planes re-stock and re-seat
  previewPrimary(strataPreview); // and the text behind the glass follows
}

// Ease the ring from wherever it settled (maybe out in the overrun) back to the
// nearest real node — the SPRINGBACK that makes the last link go taut, and the
// snap-glide into the lens. Commit on arrival (the settle → the live preview).
function springbackStrata(fromCenter, toIndex, ch, items) {
  if (strataSnap) { cancelAnimationFrame(strataSnap); strataSnap = null; }
  const commit = () => {
    renderFrontStratumAt(toIndex, false);
    if (ch) ch.select(items[toIndex]);
    // The preview has become the truth: drop it so every plane reads the
    // committed state again. The settle lands on the node the reader was
    // already watching, so nothing on screen changes at this instant.
    strataPreview = null;
    lastPreviewKey = null;
  };
  if (Math.abs(fromCenter - toIndex) < 0.001) { commit(); return; }
  let start = 0;
  const step = now => {
    if (!start) start = now;
    const t = Math.min(1, (now - start) / STRATA_SPRINGBACK_MS);
    const e = 1 - Math.pow(1 - t, 3); // easeOutCubic — matches the primary's glideTo
    renderFrontStratumAt(fromCenter + (toIndex - fromCenter) * e);
    if (t < 1) { strataSnap = requestAnimationFrame(step); }
    else { strataSnap = null; commit(); }
  };
  strataSnap = requestAnimationFrame(step);
}

if (strataLayer) {
  strataLayer.addEventListener('pointerdown', event => {
    const ch = activeChooser();
    if (!ch || strataAnim) return; // nothing to rotate at the primary or mid-glide
    if (strataSnap) { cancelAnimationFrame(strataSnap); strataSnap = null; } // catch a springback
    const items = ch.items();
    strataDrag = {
      items,
      center: clampCenter(items.indexOf(ch.selected()), items.length),
      spacing: getNodeSpacing(viewport), // rad per node — constant through the drag
      lastX: event.clientX, lastY: event.clientY,
      startX: event.clientX, startY: event.clientY,
      moved: false
    };
    try { strataLayer.setPointerCapture(event.pointerId); } catch (_) { /* unsupported */ }
  });
  strataLayer.addEventListener('pointermove', event => {
    if (!strataDrag) return;
    const dx = event.clientX - strataDrag.lastX;
    const dy = event.clientY - strataDrag.lastY;
    strataDrag.lastX = event.clientX; strataDrag.lastY = event.clientY;
    // Hold still until the press clears the tap slop — otherwise a tap jitters
    // the ring. Past it, it's a drag.
    if (!strataDrag.moved) {
      if (Math.hypot(event.clientX - strataDrag.startX, event.clientY - strataDrag.startY) <= STRATA_TAP_SLOP) return;
      strataDrag.moved = true;
    }
    // Same drag sign for BOTH rings: the mirror flips the arc's look, not the
    // index→magnifier mapping, so no per-ring inversion — the mirrored secondary
    // read backwards until this flip came out (Howell 2026-07-21). Pixels → arc
    // angle → node travel (primary's rate); clampDrag allows the sprocket's
    // 3-node overshoot past each end before the wall.
    strataDrag.center = clampDrag(
      strataDrag.center - (dx + dy) * STRATA_DRAG_SENSITIVITY / strataDrag.spacing,
      strataDrag.items.length
    );
    renderFrontStratumAt(strataDrag.center);
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(type =>
    strataLayer.addEventListener(type, event => {
      if (!strataDrag) return;
      const { items, center, moved } = strataDrag;
      strataDrag = null;
      const ch = activeChooser();
      // Tap (no drag) on a node → glide THAT node into the lens; a drag → snap
      // to the nearest. Either way springbackStrata eases it home and commits.
      let target = clampCenter(Math.round(center), items.length);
      if (!moved && type === 'pointerup') {
        const tapped = nodeIndexNearPoint(event, ch);
        if (tapped != null) target = tapped;
      }
      springbackStrata(center, target, ch, items);
    })
  );
}

// ── The strata transition tween (D.4) ─────────────────────────────────────
// The recede is a snap today; this glides it — a camera pull-back. The front
// plane recedes to 0.4/0.2 while the incoming plane arrives from "behind the
// head" (starting a touch closer than the film plane, ENTER_SCALE) and settles
// at the front; a leaving plane drifts back and fades. Blur is DROPPED during
// motion (the C.2 per-frame villain) and snapped back on settle, where the
// receded planes are static again. Tunable feel knobs below.
const STRATA_TWEEN_MS = 600;
// Incoming/leaving strata TRAVEL in from / out to the left, DIAGONALLY: mostly
// horizontal, with a vertical bias toward each ring's own home half — the
// mirrored secondary from ABOVE-left, the standard tertiary from BELOW-left —
// so the slide runs on the same diagonal the recede backs away on, not a flat
// horizontal shift (Howell 2026-07-21). A translate (the whole ring travels),
// NOT a scale about centre (which only inflates the edges and reads as a pop).
const STRATA_SLIDE_X = 0.9;  // × viewport width
const STRATA_SLIDE_Y = 0.4;  // × viewport height — the diagonal's vertical bias
const lerp = (a, b, t) => a + (b - a) * t;
const easeInOut = t => (t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2);
let strataAnim = null;

// Each plane's settled visual for a given front (level < 0 ⇒ off-stack, hidden).
function layerStates(front) {
  const states = { __primary: { scale: STRATA_DEPTHS[front], blur: STRATA_BLURS[front], opacity: 1, offsetX: 0, offsetY: 0 } };
  CHOOSERS.forEach((ch, ci) => {
    const level = front - (ci + 1);
    states[ch.id] = level >= 0
      ? { scale: STRATA_DEPTHS[level], blur: STRATA_BLURS[level], opacity: 1, offsetX: 0, offsetY: 0 }
      : { scale: 1, blur: 0, opacity: 0, offsetX: 0, offsetY: 0 };
  });
  return states;
}

function transitionStrata(fromFront, toFront) {
  if (strataAnim) { strataAnim.cancel(); strataAnim = null; }
  if (strataLayer) strataLayer.style.pointerEvents = 'none'; // no rotating mid-glide
  if (strataHit) strataHit.style.pointerEvents = 'none';
  const from = layerStates(fromFront);
  const to = layerStates(toFront);

  // Render every chooser present at EITHER end, so a leaving plane persists
  // through the glide and an entering one has something to animate; hide the rest.
  const groups = {};
  CHOOSERS.forEach((ch, ci) => {
    const pos = ci + 1;
    const inFrom = pos <= fromFront, inTo = pos <= toFront;
    if (!inFrom && !inTo) { hideStratum(strataLayer, ch.id); return; }
    const items = ch.items();
    groups[ch.id] = renderStratum(strataLayer, {
      id: ch.id, viewport, items,
      selectedIndex: Math.max(0, items.indexOf(ch.selected())),
      mirrored: ch.mirrored, labelFor: ch.label,
      centerMagnified: ch.centerMag
    });
    // Slide diagonally in from / out to the left: the vertical bias follows
    // each ring's home half (mirrored ⇒ from above, standard ⇒ from below), so
    // the whole ring travels on the recede's diagonal. Full opacity — the
    // travel carries it in, no fade.
    const dx = -viewport.width * STRATA_SLIDE_X;
    const dy = (ch.mirrored ? -1 : 1) * viewport.height * STRATA_SLIDE_Y;
    if (!inFrom && inTo) from[ch.id] = { ...to[ch.id], offsetX: dx, offsetY: dy };
    if (inFrom && !inTo) to[ch.id] = { ...from[ch.id], offsetX: dx, offsetY: dy };
  });

  // Populate the primary's tangent chain for the DESTINATION now, so the links
  // are already there as it recedes (static re-render, off the per-frame path).
  if (currentApp && typeof currentApp.setTangentFill === 'function') {
    currentApp.setTangentFill(STRATA_TANGENT_SPANS[toFront] || 0);
  }

  let raf = 0, start = 0, cancelled = false;
  const frame = now => {
    if (cancelled) return;
    if (!start) start = now;
    const e = easeInOut(Math.min(1, (now - start) / STRATA_TWEEN_MS));
    // Hold each plane's STARTING blur through the motion — a receded plane must
    // never sharpen (Howell 2026-07-21); a front plane holds 0 and recedes
    // sharp as before. Constant radius = the blurred layer renders once, only
    // the scale moves. Blur snaps to its destination on settle (renderStack).
    setPrimaryVisual(lerp(from.__primary.scale, to.__primary.scale, e), from.__primary.blur);
    CHOOSERS.forEach(ch => {
      const g = groups[ch.id]; if (!g) return;
      const f = from[ch.id], t = to[ch.id];
      setStratumVisual(g, lerp(f.scale, t.scale, e), f.blur, lerp(f.opacity, t.opacity, e),
        lerp(f.offsetX || 0, t.offsetX || 0, e), lerp(f.offsetY || 0, t.offsetY || 0, e));
    });
    if (e < 1) { raf = requestAnimationFrame(frame); }
    else { strataAnim = null; renderStack(); } // settle: final depths + blur, prune hidden
  };
  raf = requestAnimationFrame(frame);
  strataAnim = { cancel: () => { cancelled = true; cancelAnimationFrame(raf); } };
}

const dimensionAvailable = () => dimensionBridge.languagesAvailable().length > 0;

// EVERY language shows a tertiary stratum, even a single-translation one: the
// reader wants to know WHICH translation they're reading — the Vulgate is a
// specific edition, not an absence of choice — so Latin's magnifier names the
// Clementine Vulgate all the same (Howell 2026-07-21, reversing the earlier
// single-translation skip). Every language has at least one translation, so
// the tertiary always has a node to show.
const maxStrataFront = () => CHOOSERS.length; // primary(0) → secondary(1) → tertiary(2)

// THE GLOBE TRAVELS INWARD, ALWAYS (Howell ruling 1, 2026-07-30):
// language (2) → edition (1) → the text (0) → and round again to language.
// One rule, no context-dependence. The old cycle travelled outward, which
// asked the reader to move AWAY from the text in order to narrow their
// choice. A returning reader mostly presses this never — they just read — so
// the funnel's coherence is worth more than keeping any one chooser nearest.
function cycleStrata() {
  if (!dimensionAvailable()) return;
  const max = maxStrataFront();
  const from = strataFront;
  strataFront = strataFront <= 0 ? max : strataFront - 1;
  if (from === strataFront) return;
  transitionStrata(from, strataFront);
  // The globe turns with the recede — same duration, settling together.
  if (dimensionGlobe) dimensionGlobe.spin(STRATA_TWEEN_MS);
  if (dimensionButton) dimensionButton.setAttribute('aria-pressed', String(isStrataOpen()));
}
function resetStrata() {
  if (strataAnim) { strataAnim.cancel(); strataAnim = null; }
  strataFront = 0;
  CHOOSERS.forEach(ch => hideStratum(strataLayer, ch.id));
  renderStack();
}
// The globe shows only where a dimension EXISTS and the reader stands at one
// of the two language-question moments (Howell 2026-07-27): a LEAF (detail
// sector open — "what did the original say?") or the volume's FRONT DOOR
// (the adapter-declared threshold item magnified — "give me this book in my
// tongue"). Between the two — drilling down or backing out — it is clutter
// and hides; any open stack recedes back to the primary. A volume boot
// (including a gateway transit) resets the stack. The door is declared by
// the adapter (dimensionFrontDoorAt), so the host stays volume-agnostic.
let dimensionFrontDoorAt = () => false;
// Repaints the PRIMARY for a previewed language/edition while a chooser is
// being turned — assigned by bootVolume, which owns the adapter and manifest.
let previewPrimary = () => {};

// THE NOT-PROOFREAD MARKER (Howell 2026-07-31, reworded 2026-08-01).
// Insurance for the override: when `?proofread=true` is showing an edition no
// human has read against another witness, the screen says so — otherwise a
// bookmarked override could quietly become the normal view and unread text
// would look finished.
//
// NO LONGER INSURANCE FOR THE OVERRIDE ALONE (2026-08-15). The mark used to
// render only while `?proofread=true` was active, because that flag was the
// only way unread text could reach the screen. It is not any more: an edition
// now earns the shelf with its first confirmed book, so a reader with no flag
// at all reaches the 36 books nobody has confirmed. Gating the mark on the
// override would have shipped exactly the thing the mark exists to prevent —
// unread text looking finished — and it would have done it on the DEFAULT
// path rather than the debug one. The condition is now the honest one: is the
// book in hand confirmed in the edition in hand.
//
// Howell's shape, precisely: the marker names THE TRANSLATION IN HAND. "This
// translation is a work in progress" is honest; "a translation somewhere is"
// is not, because a vague global notice tells the reader nothing about what
// they are actually looking at. So it tracks the ACTIVE edition and vanishes
// the moment a proofread one is selected — even while the override stays on.
// The wording is now simply NOT PROOFREAD; Howell: "that message tells me the
// translation I'm looking at is a work in progress, and that's all I need to
// know." It says only that, never what is missing: the point is the caveat,
// not an inventory.
//
// PER BOOK SINCE H-25 (Howell, 2026-08-15). With 39 books he needs to see
// where he left off, and this is the place he already looks. So the mark now
// asks about the BOOK IN HAND rather than the edition, and its absence claims
// that this book's seat was confirmed on the running app — one seat per book,
// chosen so the 41 of them carry every character in the corpus. It does NOT
// claim every verse was read, and that distinction is Howell's own ruling,
// made knowing what he looked at.
let incompleteMarkEl = null;

// Which book is the reader in? `bookIdOf` is pure and lives with the other
// volume helpers, so the resolution can be fired at the item shapes the two
// chain builders actually produce — the shape mismatch that broke the first
// cut was invisible from here and would have stayed invisible.
function currentBookId() {
  return bookIdOf(currentApp?.nav?.getCurrent?.());
}

function updateIncompleteMark() {
  if (typeof document === 'undefined') return;
  let show = false;
  try {
    // GATED ON THE FLAG AGAIN (Howell, 2026-08-15) — and briefly un-gating it
    // was my error, made from a design he had not ruled. Under H-25 point 4
    // unconfirmed books are UNREACHABLE without the flag, not merely marked.
    // So off the flag there is nothing on screen to caveat, and the un-gated
    // version would have shown a red NOT PROOFREAD banner to a reader looking
    // at confirmed text only — including, one day, the public. The mark
    // belongs to the development view because that is the only view with
    // unconfirmed work in it.
    if (dimensionBridge.completeOverrideActive()) {
    const active = dimensionStore.getState().edition || null;
    const unit = currentBookId();
    // NO BOOK IN HAND — a testament ring, the root, the gateway. The question
    // becomes whether the EDITION is finished, and that must be DERIVED from
    // the per-unit marks rather than read off the edition's own flag.
    //
    // Howell found this at the testament ring: the Hebrew had reached 39 of 39
    // confirmed while its `proofread` flag was still false, so the data said
    // both "nothing is unconfirmed" and "not proofread", and the mark believed
    // the wrong one. Flipping the flag in the data would have fixed the symptom
    // and left the same fact living in two places, with the last book's
    // confirmation needing a second act nobody is reminded to perform — which
    // is precisely the omission that produced this.
    //
    // An edition with no per-unit marks still falls back to its flag, inside
    // isFullyConfirmed, so nothing else changes.
    const volume = currentManifest?.__wallVolume;
    const editionFinished = typeof volume?.isFullyConfirmed === 'function'
      ? volume.isFullyConfirmed(active)
      : dimensionBridge.isCertifiedEdition(active);
    show = Boolean(active) && (unit
      ? !dimensionBridge.isCertifiedUnit(active, unit)
      : !editionFinished);
    }
  } catch (_) { show = false; }
  if (!show) {
    if (incompleteMarkEl) incompleteMarkEl.style.display = 'none';
    return;
  }
  if (!incompleteMarkEl) {
    incompleteMarkEl = document.createElement('div');
    incompleteMarkEl.id = 'incomplete-mark';
    incompleteMarkEl.textContent = 'NOT PROOFREAD';
    document.body.appendChild(incompleteMarkEl);
  }
  incompleteMarkEl.style.display = '';
}

// THE SECTION LABEL (H-26, Howell's own sketch; specified in W-83).
//
// *"Sections should be a label, not a hierarchy... merely a label displayed
// next to a group of books that indicates these books are all in the same
// section. I don't want to use colors to distinguish sections. I want to show
// their name."*
//
// So it shows exactly ONE name — the section of the book in the MAGNIFIER —
// and updates as books rotate through, which makes the division an EVENT:
// the label reads תּוֹרָה five times and flips to נְבִיאִים as Joshua
// arrives. That shows where the breaks fall without adding a level to
// navigate, which is the whole of the ruling.
//
// A NAME IS A QUOTATION (H-2), and that is why this shows the tradition's own
// word rather than a colour. A colour asserts nothing, so it can be quietly
// wrong — AndBible paints Ruth as a history while seating her in the Writings
// and nothing contradicts it. A name is attested or it is absent: no shelf
// chart, or a book in no declared group, means NO LABEL rather than an empty
// frame.
//
// IT HAS ITS OWN ELEMENT, and that was a reviewed decision rather than a
// default. The old build did put a section in the parent-button slot — the
// red section name still live on the public deployment — and it could,
// because a section was the book's parent LEVEL then. Under H-26 it is
  // not: the testament is, and that
// slot currently carries הברית הישנה. Reusing it would displace the testament
// name, which is a silent loss wearing the shape of a feature.
function updateSectionLabel() {
  if (typeof document === 'undefined') return;
  let label = null;
  try {
    // ONLY WHILE BOOKS ARE IN THE RING (H-26). Deeper than that the ring is
    // inside a single book, where a section name answers a question the
    // reader has stopped asking.
    const item = currentApp?.nav?.getCurrent?.();
    if (item?.level === 'book') {
      const edition = dimensionStore.getState().edition || null;
      const volume = currentManifest?.__wallVolume;
      if (edition && typeof volume?.sectionOf === 'function') {
        label = volume.sectionOf(edition, bookIdOf(item));
      }
    }
  } catch (_) { label = null; }
  // IT IS DRAWN IN THE RING, not over it (Howell, 2026-08-16, by drawing on a
  // screenshot): outside the arc, radially in line with the magnifier, and
  // rotated parallel to the ring so it reads along the arc as the node labels
  // do. The seat therefore belongs to the view, which owns the arc's hub,
  // radius and magnifier angle — deriving those a second time in a DOM
  // overlay is how the label ends up somewhere the ring is not.
  //
  // The first cut was a fixed-position div in the corner. It was legible and
  // it was not what he asked for: a caption ABOUT the ring rather than a part
  // of it.
  try { currentApp?.view?.setSectionLabel?.(label || ''); } catch (_) { /* a label may never break a render */ }
}

function updateDimensionButton() {
  if (!dimensionButton) return;
  if (cornerIconHold) return; // frozen mid-wipe: the icon is part of the image
  const atFrontDoor = (() => {
    try { return Boolean(dimensionFrontDoorAt(currentApp?.nav?.getCurrent?.())); } catch (_) { return false; }
  })();
  // While a stratum is forward the globe is the ONLY way onward, so it must
  // show regardless of what the primary is doing behind the glass — this is
  // the boot state itself under the 2026-07-30 funnel (Howell ruling 2), and
  // the reader would otherwise be stranded in the language chooser.
  const show = dimensionAvailable() && (detailSectorVisible || atFrontDoor || isStrataOpen());
  const arriving = show && dimensionButton.hidden;
  dimensionButton.hidden = !show;
  // The entrance: the globe appears with a quick turn when the detail
  // sector brings it in (Howell 2026-07-22) — EXCEPT when a wipe reveals
  // it: then it arrives static, part of the image, and says hello only
  // once the sweep completes (the wipe block's onDone).
  if (arriving && dimensionGlobe && !globeSpinMuted) dimensionGlobe.spin();
  if (!show && isStrataOpen()) resetStrata();
}
function refreshDimensionButton() {
  if (!dimensionButton) return;
  resetStrata();
  updateDimensionButton();
}
// THE BOOT FUNNEL (Howell ruling 2, 2026-07-30): every launch opens on the
// LANGUAGE plane, with the edition and the text receding behind it. The
// reader travels inward — language, edition, text — so the instrument teaches
// its third gesture by requiring it rather than by explaining it, and the
// first question a stranger is asked is the one they can always answer.
// Every launch, not just the first: it confirms a returning reader's language
// and edition, "and I don't consider two quick taps to be an undue burden."
// Revisitable once real readers report.
function openBootFunnel() {
  if (!dimensionButton || !dimensionAvailable()) return false;
  strataFront = maxStrataFront();
  renderStack();
  updateDimensionButton();
  return true;
}
if (dimensionButton) {
  dimensionButton.addEventListener('click', cycleStrata);
}
if (typeof window !== 'undefined') {
  window.__wheelDimension = {
    get: () => dimensionBridge.getSelection(),
    set: id => dimensionBridge.setTranslation(id) || dimensionBridge.setLanguage(id),
    languages: () => dimensionBridge.languagesAvailable(),
    cycle: cycleStrata
  };
}
const tapDebugEnabled = new URLSearchParams(window.location.search).get('tapdebug') === '1';

if (tapDebugEnabled && typeof window !== 'undefined') {
  window.__tapLog = [];
  window.__tapDebugLog = (event, payload = {}) => {
    const row = {
      ts: new Date().toISOString(),
      event,
      ...payload
    };
    window.__tapLog.push(row);
    console.log('[tapdebug]', row);
  };
  window.__tapDebugDownload = () => {
    const text = JSON.stringify(window.__tapLog || [], null, 2);
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    a.href = url;
    a.download = `tapdebug-${ts}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
}

// Detect iframe zoom-out (e.g. GoDaddy "Forward with Masking" on mobile).
// Mobile browsers ignore the iframe's viewport meta tag, defaulting to a
// ~980 px layout viewport which is then scaled down to fit the screen.
// CSS clamp floors (in px) resolve pre-zoom, so fonts appear tiny.
// Multiply clamp min/max by this factor to compensate.
const _physSSd = Math.min(screen.width, screen.height);
const _cssSSd  = Math.min(window.innerWidth, window.innerHeight);
if (_physSSd > 0 && _cssSSd > _physSSd * 1.2) {
  document.documentElement.style.setProperty(
    '--iframe-scale', (_cssSSd / _physSSd).toFixed(3));
}


// C.2 instrumentation: decompose boot time into phases. Read the result in
// the feel HUD (?debug=1) or via window.__wheelBootPhases / console.table.
function recordBootPhases(volume) {
  try {
    const ms = (a, b) => {
      const ea = performance.getEntriesByName(a).pop();
      const eb = performance.getEntriesByName(b).pop();
      return ea && eb ? Math.round(eb.startTime - ea.startTime) : null;
    };
    const first = performance.getEntriesByName('wheel:html-start').pop();
    const phases = {
      volume,
      htmlToBoot: first ? Math.round(performance.getEntriesByName('wheel:boot-start').pop().startTime - first.startTime) : null,
      manifest: ms('wheel:boot-start', 'wheel:manifest-ready'),
      chainBuild: ms('wheel:manifest-ready', 'wheel:chain-built'),
      renderWire: ms('wheel:chain-built', 'wheel:render-done'),
      total: first ? Math.round(performance.getEntriesByName('wheel:render-done').pop().startTime - first.startTime) : null
    };
    window.__wheelBootPhases = phases;
    console.table([phases]);
    ['wheel:boot-start', 'wheel:manifest-ready', 'wheel:chain-built', 'wheel:render-done'].forEach(n => performance.clearMarks(n));
  } catch (err) { /* instrumentation must never break boot */ }
}

// Parsed-manifest cache: a volume visited once — or prefetched on approach —
// boots without refetching or reparsing its manifest. Gateway RETURNS ride
// this cache too (re-entering the origin volume becomes free). (Phase C.2)
const manifestCache = new Map();
function fetchManifest(volumeId) {
  if (!manifestCache.has(volumeId)) {
    const cfg = volumeConfigs[volumeId];
    if (!cfg) return Promise.reject(new Error(`unknown volume "${volumeId}"`));
    // A VOLUME MAY LOAD ITSELF (H-14). A volume behind its own migration wall
    // boots from several artifacts rather than one file — an enumeration, its
    // names — and normalises them before anything reads it. Volumes still in
    // front of their wall fetch one manifest exactly as they always have,
    // which is what makes the wall per-volume rather than a flag day.
    const p = (typeof cfg.loadManifest === 'function'
      ? cfg.loadManifest()
      : fetch(cfg.manifestPath).then(r => {
        if (!r.ok) throw new Error(`manifest missing for volume "${cfg.id}" (${cfg.manifestPath}: HTTP ${r.status})`);
        return r.json();
      })
    ).catch(err => { manifestCache.delete(volumeId); throw err; });
    manifestCache.set(volumeId, p);
  }
  return manifestCache.get(volumeId);
}

// Prefetch-on-approach: after a volume boots, scan its manifest for gateway
// declarations and warm the target manifests during idle time — by the time
// a human reads a gateway node and taps it, the network cost is paid.
// Data-driven: no volume names appear here. (Phase C.2)
function prefetchGatewayTargets(manifest) {
  const targets = new Set();
  (function scan(o) {
    if (Array.isArray(o)) { o.forEach(scan); return; }
    if (o && typeof o === 'object') {
      if (Array.isArray(o.gateway_children)) {
        o.gateway_children.forEach(g => { if (g?.volume) targets.add(g.volume); });
      }
      Object.values(o).forEach(scan);
    }
  })(manifest);
  if (!targets.size) return;
  const kick = () => targets.forEach(v => { if (volumeConfigs[v]) fetchManifest(v).catch(() => {}); });
  if (typeof requestIdleCallback === 'function') requestIdleCallback(kick, { timeout: 5000 });
  else setTimeout(kick, 2500);
}

function resolveVolumeFromPath(path) {
  const lower = (path || '').toLowerCase();
  const match = Object.values(volumeConfigs).find(cfg => cfg.paths?.some(p => lower.includes(p)));
  return match?.id || null;
}

// Which volume this boot is for, decided from override/param/path WITHOUT
// touching the network. Split out of loadConfig so the reveal decision — which
// must happen BEFORE the manifest loads, to hide the wheel without a flash —
// can consult the volume's own config rather than playing for whichever volume
// booted first (2026-07-30).
function resolveVolumeId(volumeOverride = null, searchOverride = null) {
  const params = new URLSearchParams(searchOverride ?? window.location.search);
  const path = (window.location.pathname || '').toLowerCase();
  const paramVolume = params.get('volume');
  return volumeConfigs[volumeOverride]?.id || volumeConfigs[paramVolume]?.id
    || resolveVolumeFromPath(path) || DEFAULT_VOLUME;
}

async function loadConfig(volumeOverride = null, searchOverride = null) {
  const params = new URLSearchParams(searchOverride ?? window.location.search);
  const resolvedVolume = resolveVolumeId(volumeOverride, searchOverride);
  const config = volumeConfigs[resolvedVolume];
  // Q4 (0c): the supplemental fetches used to wait for the manifest, costing
  // one full round trip on every cold boot — for no reason. A config whose
  // `loadSupplemental` DECLARES NO PARAMETERS cannot depend on the manifest or
  // the root, so its fetches can start immediately and be awaited later.
  //
  // The arity test is the point: it is a promise the function itself makes, in
  // its own signature, checked here rather than assumed. Today all four volume
  // configs declare zero parameters and fetch fixed paths. If one ever starts
  // taking `root`, this silently and correctly falls back to the serial path
  // instead of handing it an undefined manifest — the failure mode of a flag
  // or a comment, which is what we would otherwise have used.
  const supplementalEarly = config.loadSupplemental.length === 0
    ? config.loadSupplemental()
    : null;

  const manifest = await fetchManifest(resolvedVolume);
  const root = config.extractRoot(manifest);
  const validation = validateVolumeRoot(root);
  if (!validation.ok) {
    console.error('[wheel] volume validation failed', { errors: validation.errors, warnings: validation.warnings });
    throw new Error('Invalid volume manifest');
  }
  const startup = root?.display_config?.focus_ring_startup || {};
  const arrangements = root?.display_config?.focus_ring_arrangements || {};
  const supplemental = supplementalEarly
    ? await supplementalEarly
    : await config.loadSupplemental(root, manifest, params);
  const debugFlag = params.get('debug') === '1' || localStorage.getItem('wheel-debug') === '1';
  const options = {
    // `root` rides along so a volume can take its defaults from its own data
    // rather than from a literal in the engine. Under H-14 that stopped being
    // a nicety: a volume behind its wall enumerates only what has migrated, so
    // a hard-coded starting address names something unreachable, and a default
    // that cannot resolve is a blank screen.
    ...config.buildOptions({ params, startup, arrangements, root }),
    debug: debugFlag
  };
  return { volume: resolvedVolume, config, manifest, root, options, supplemental };
}

function applyTheme(volume) {
  const theme = volumeConfigs[volume]?.theme || volume;
  const root = document.documentElement;
  const active = volumeConfigs[volume]?.palette || {
    bg: '#f5f5f5',
    node: '#555555',
    text: '#111111',
    band: '#7a7979',
    accent: '#1f6feb',
    magnifierStroke: '#000000'
  };
  const bg = active.bg;
  root.setAttribute('data-theme', theme);
  root.style.backgroundColor = bg;
  // Set ALL theme CSS variables inline so the first render has correct
  // colors even before the async volume stylesheet finishes loading.
  root.style.setProperty('--theme-color-bg', bg);
  root.style.setProperty('--theme-color-node', active.node);
  root.style.setProperty('--theme-color-text', active.text);
  root.style.setProperty('--theme-color-band', active.band);
  // ORBITAL = the band's own gray, a step darker (Howell 2026-07-23,
  // retiring the demo red as too distracting): the ring's nodes are made of
  // the band's material — chain and links, one metal — while RADIAL travel
  // (parent vessel, pyramid) keeps the volume's node color. Derived from
  // whatever band the volume wears, so every volume follows automatically.
  const darkenHex = (hex, f) => {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
    if (!m) return hex;
    const n = parseInt(m[1], 16);
    const ch = v => Math.max(0, Math.round(v * f)).toString(16).padStart(2, '0');
    return `#${ch((n >> 16) & 255)}${ch((n >> 8) & 255)}${ch(n & 255)}`;
  };
  root.style.setProperty('--theme-color-orbital', darkenHex(active.band, 0.78));
  root.style.setProperty('--theme-color-accent', active.accent);
  root.style.setProperty('--theme-color-magnifier-stroke', active.magnifierStroke);
  if (document.body) {
    document.body.style.backgroundColor = bg;
  }
  if (svg) {
    svg.style.backgroundColor = bg;
  }
  const link = document.getElementById('volume-style');
  if (link) {
    link.setAttribute('href', `./styles/themes/${theme}.css`);
  }
}

const detailRegistry = new DetailPluginRegistry();
detailRegistry.register(new TextDetailPlugin());
detailRegistry.register(new CardDetailPlugin());
detailRegistry.register(new EphemerisDetailPlugin());
const detailPanel = document.getElementById('detail-panel');
const detailContent = document.getElementById('detail-content');

// Toggle detail panel visibility in sync with the Detail Sector animation.
// The panel fades in after the blue circle has finished expanding,
// and hides immediately when the circle begins collapsing.
window.addEventListener('detail-sector-change', (e) => {
  const { visible } = e.detail || {};
  if (detailPanel) {
    detailPanel.classList.toggle('detail-panel--visible', Boolean(visible));
  }
  // The dimension button follows the sill: present at a leaf, gone over a
  // child pyramid (which also recedes any open stack back to the primary).
  detailSectorVisible = Boolean(visible);
  updateDimensionButton();
  updateSearchButton();
});

let detailRenderSeq = 0; // stale-verify guard: each render invalidates pending checks
function renderDetail(selected, adapterInstance, manifest, adapterNormalized, { translation, wrapAttempt = 0 } = {}) {
  if (!detailPanel || !detailContent) return;
  // Only the leaf is described here. Note this returns WITHOUT clearing:
  // on the way up out of a leaf the panel is already fading, and it should
  // fade carrying what it was describing rather than flash the level
  // above's payload on its way out.
  if (!isDetailLevel(selected, adapterNormalized)) {
    window.__wheelTapTrace?.push({ ev: 'render-detail-skip', lvl: selected?.level || '?', tr: translation || '' });
    return;
  }
  window.__wheelTapTrace?.push({ ev: 'render-detail', lvl: selected?.level || '?', tr: translation || '' });
  while (detailContent.firstChild) detailContent.removeChild(detailContent.firstChild);
  if (!selected) return;

  const payload = adapterInstance?.detailFor
    ? adapterInstance.detailFor(selected, manifest, { normalized: adapterNormalized, translation })
    : { type: 'text', text: selected.name || selected.id || '' };
  if (!payload) return;
  window.__wheelTapTrace?.push({
    ev: 'render-payload', tr: translation || '',
    txt: String(payload.text || '').slice(0, 14)
  });

  // W-1: the text is stamped with the script it is in. With substitution
  // retired (NO ASTERISKS, 2026-07-30) the text is always the reader's own
  // edition, so there is only one script it can be.
  if (payload?.type === 'text' && payload.uniform) {
    payload.dir = dimensionBridge.editionDirection(translation);
    payload.lang = dimensionBridge.editionLang(translation);
  }

  const plugin = detailRegistry.getPlugin(payload);
  if (!plugin) return;

  // Build arc-aware bounds (DSUA — full area, no logo exclusion).
  // The logo moves to the centre as a watermark when the circle expands,
  // so its collapsed upper-right position does not restrict detail text.
  // MEASURED viewport, never window.inner* — the wheel's geometry and the
  // pinned canvas use the visual viewport, and a browser chrome bar makes
  // innerHeight lie (Phase C audit M4; the DDG bottom-crop class of bug).
  const vpm = measureViewport();
  const arcBounds = computeDetailSectorBounds(vpm.width, vpm.height);
  const panelRect = detailPanel.getBoundingClientRect();
  const renderBounds = { ...arcBounds, width: panelRect.width, height: panelRect.height };


  window.__wheelVerseBounds = renderBounds; // probe's verse-wrap autopsy reads this (?probe=1)
  const node = plugin.render(payload, renderBounds, { createElement: tag => document.createElement(tag) });
  if (node) detailContent.appendChild(node);

  // POST-PAINT WRAP VERIFY (Howell 2026-07-27, the iOS overflow endgame).
  // The wrap is computed from hidden-span measurements, and on iOS those can
  // lie: the font-load promise resolves BEFORE the face reaches layout, so
  // even a fresh span still measures the Georgia fallback while the verse
  // paints in (wider) EB Garamond — Genesis ran 27px past the fence to the
  // glass. Rather than keep racing the font pipeline, trust the only honest
  // witness: the PAINT. Two frames after rendering, if any line's content
  // overflows its box (scrollWidth > clientWidth), the measurements were
  // wrong whatever the reason — dump every measurement cache and re-wrap.
  // Capped at 3 attempts; a newer render (seq guard) cancels the check.
  const seq = ++detailRenderSeq;
  if (wrapAttempt < 3 && typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (seq !== detailRenderSeq) return; // superseded by a newer render
      let overflows = false;
      detailContent.querySelectorAll('.detail-text-line').forEach(el => {
        if ((el.scrollWidth || 0) - (el.clientWidth || 0) > 2) overflows = true;
      });
      if (!overflows) return;
      invalidateVerseMeasurement();
      renderDetail(selected, adapterInstance, manifest, adapterNormalized,
        { translation, wrapAttempt: wrapAttempt + 1 });
    }));
  }
}

function wireInteractions(getApp) {
  let isDragging = false;
  let lastX = 0;
  let lastY = 0;
  let lastTime = 0;
  let suppressNativeClickUntil = 0;
  // C.3 double-flick (see docs/FEEL.md) — additive; drag feel untouched.
  const DOUBLE_FLICK_WINDOW_MS = 400;   // max gap between two fast swipes
  const DOUBLE_FLICK_MIN_VELOCITY = 0.8; // px/ms sustained at release = "fast"
  const GLIDE_TO_LIMIT_MS = 600;         // one tempo (= detail sector)
  // "Fast" is judged by what the finger was doing AT RELEASE: distance over
  // the trailing window, not the peak of any single event sample. Touch
  // events arrive in bursts with ~1ms deltas, so per-sample velocity spikes
  // past any threshold even mid-slow-scrub — that noise once made released
  // scrubs take off on their own (2026-07-17 flick regression).
  const VELOCITY_WINDOW_MS = 100;
  let recentMoves = [];         // {t, dist, delta} samples inside the window
  let gestureTravelPx = 0;      // cumulative finger travel this drag
  let pointerCaptured = false;  // capture transferred to the svg root
  const trace = { downTarget: '', moves: 0, endedBy: '', travel: 0, captured: false, cancels: 0 };
  const publishTrace = () => { window.__wheelGestureTrace = { ...trace }; };
  const DRAG_SLOP_PX = 8;       // past this, it's a drag, not a tap
  let pendingAdvanceTap = false; // press landed in the sector's NEXT area
  let pendingTapNode = null;    // ring node under the finger at pointerdown;
                                // its click fires at lift IF travel stayed
                                // within tap slop — a press is ambiguous
                                // until the finger commits
  let lastFlickAt = 0;          // pointerup time of the last fast swipe
  let lastFlickDir = 0;         // its direction (sign of net delta)
  const sensitivity = Math.PI / 4 / 100; // 100px → 45°
  // C.3 flick tier (approved 2026-07-17): the drag is a pure 1:1 scrub at
  // every speed — the old velocity-gain amplifier (velocityThreshold 0.4,
  // gainSlope 1.1, targetSpinNodes 350) is retired. Fast-swipe distance now
  // comes from the ballistic glide on release (gesture-tiers.js), so travel
  // is chain-relative and never double-counted.
  const logTap = (event, payload = {}) => {
    if (typeof window !== 'undefined' && typeof window.__tapDebugLog === 'function') {
      window.__tapDebugLog(event, payload);
    }
  };

  const svgPointOf = event => {
    if (!svg || typeof svg.createSVGPoint !== 'function') return null;
    const ctm = svg.getScreenCTM?.();
    if (!ctm) return null;
    const pt = svg.createSVGPoint();
    pt.x = event.clientX;
    pt.y = event.clientY;
    return pt.matrixTransform(ctm.inverse());
  };

  const nearestRingNode = event => {
    const p = svgPointOf(event);
    if (!p) return null;

    // Placebo nodes (the version footnote) are not tap targets — excluding
    // them here keeps a real neighbor eligible for the redirect.
    const nodes = svg.querySelectorAll('.focus-ring-node:not(.is-placebo)');
    let nearest = null;
    let nearestDist = Infinity;
    nodes.forEach(node => {
      const cx = Number(node.getAttribute('cx'));
      const cy = Number(node.getAttribute('cy'));
      const r = Number(node.getAttribute('r')) || 0;
      if (!Number.isFinite(cx) || !Number.isFinite(cy)) return;
      const dx = p.x - cx;
      const dy = p.y - cy;
      const dist = Math.hypot(dx, dy);
      const threshold = Math.max(r * 4, 36);
      if (dist <= threshold && dist < nearestDist) {
        nearestDist = dist;
        nearest = node;
      }
    });
    return nearest;
  };

  const onPointerMove = event => {
    if (!isDragging) return;
    const app = getApp();
    if (!app) return;
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    const dt = event.timeStamp - lastTime;
    lastX = event.clientX;
    lastY = event.clientY;
    lastTime = event.timeStamp;

    const distance = Math.abs(dx) + Math.abs(dy);
    const delta = -(dx + dy) * sensitivity;
    const t = event.timeStamp;
    recentMoves.push({ t, dist: distance, delta });
    while (recentMoves.length && t - recentMoves[0].t > VELOCITY_WINDOW_MS) recentMoves.shift();
    gestureTravelPx += distance;
    trace.moves += 1; trace.travel = Math.round(gestureTravelPx); trace.captured = pointerCaptured;
    if ((trace.moves & 7) === 0) publishTrace();
    // Ring nodes are disposable elements: a drag that began ON one holds an
    // implicit pointer capture that dies if that node scrolls out of the
    // window and is removed. Once travel exceeds tap slop, re-anchor the
    // capture to the permanent svg root so the event stream survives the
    // whole gesture. Taps never reach the slop, so node clicks are
    // unaffected.
    if (!pointerCaptured && gestureTravelPx > DRAG_SLOP_PX && event.pointerId != null) {
      try { svg.setPointerCapture(event.pointerId); pointerCaptured = true; } catch (err) { /* capture unsupported */ }
    }
    logTap('pointermove', {
      pointerType: event.pointerType,
      dx,
      dy,
      dt,
      dragging: isDragging
    });
    app.choreographer.rotate(delta);
  };

  // When touch pointerdown manually dispatches a node onclick, suppress the
  // browser's delayed native click so the same node doesn't rotate twice.
  svg.addEventListener('click', event => {
    const now = Date.now();
    if (now < suppressNativeClickUntil) {
      // Control taps (magnifier, parent button) rely on their NATIVE click
      // and their pointerdown path never arms a manual fire — suppressing
      // them makes a quick node-then-parent rhythm eat the second tap
      // (Phase C audit M6). Controls are exempt from suppression.
      const isControl = event.target?.closest?.('.focus-ring-magnifier-circle, .focus-ring-magnifier-label, .world-glyph');
      if (isControl) return;
      logTap('native-click-suppressed', {
        targetClass: event.target?.getAttribute?.('class') || null,
        targetId: event.target?.getAttribute?.('id') || null
      });
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);

  svg.addEventListener('pointerdown', event => {
    const app = getApp();
    if (!app) return;
    // While the secondary strata is up, the primary is receded and INERT —
    // its ring must not take taps (D.3). The secondary nodes handle their
    // own pointerdown and stop it here anyway; this is the belt.
    if (isSecondaryOpen()) return;
    logTap('pointerdown', {
      pointerType: event.pointerType,
      targetClass: event.target?.getAttribute?.('class') || null,
      targetId: event.target?.getAttribute?.('id') || null,
      x: event.clientX,
      y: event.clientY
    });
    const isNode = event.target && event.target.closest && event.target.closest('.focus-ring-node');
    pendingTapNode = null;
    pendingAdvanceTap = false;
    if (isNode) {
      logTap('node-hit', {
        pointerType: event.pointerType,
        nodeIndex: isNode.dataset?.index ?? null,
        nodeId: isNode.getAttribute?.('id') || null
      });
      // A press on a node is ambiguous until the finger commits: firing the
      // click here at pointerdown is what made every over-ring swipe die as
      // a 2-node tap. Arm a pending tap instead and start the drag machinery
      // like anywhere else; pointerup decides — within slop it's the tap
      // (fired manually, so tiny targets still never depend on the browser's
      // synthetic click), past slop it was a swipe all along.
      pendingTapNode = isNode;
      if (event.pointerType === 'touch' || event.pointerType === 'pen') event.preventDefault();
    }

    // Parent/magnifier controls — and the countries ring's world glyph, a
    // control in a class of its own (the globe-tap hunt, 2026-07-23: every
    // non-control tap arms the native-click suppressor at the line below,
    // which ate the glyph's click while its pointer events sailed through):
    // don't start drag, don't near-miss redirect, let native click run.
    const isControlTarget = event.target && event.target.closest && event.target.closest('.focus-ring-magnifier-circle, .focus-ring-magnifier-label, .world-glyph');
    if (isControlTarget) {
      isDragging = false;
      logTap('control-hit', {
        pointerType: event.pointerType,
        targetClass: event.target?.getAttribute?.('class') || null,
        targetId: event.target?.getAttribute?.('id') || null
      });
      return;
    }
    suppressNativeClickUntil = Date.now() + 450;
    // Child pyramid node OR ITS LABEL — delegate to the app's pyramid click
    // handler. The label is a sibling <text>, not a descendant of the circle,
    // so matching only the circle made a tap on the word itself fall through
    // to ring near-miss targeting (the multi-tap gateway bug on iOS browsers
    // whose touch-target adjustment doesn't rescue the miss).
    const isPyramidNode = event.target && event.target.closest
      && event.target.closest('.child-pyramid-node, .child-pyramid-label');
    if (isPyramidNode) {
      const attrIndex = isPyramidNode.getAttribute && isPyramidNode.getAttribute('data-index');
      const rawIndex = isPyramidNode.dataset?.index ?? attrIndex;
      const idx = Number.parseInt(rawIndex, 10);
      logTap('pyramid-hit', { pointerType: event.pointerType, nodeIndex: Number.isFinite(idx) ? idx : null, rawIndex: rawIndex ?? null });
      if (Number.isFinite(idx)) {
        if (app.handlePyramidNodeClick) {
          app.handlePyramidNodeClick(idx);
        }
        return; // don't start drag
      }
      // No valid index on this pyramid-shaped target (e.g. transient clone).
      // Fall through to near-miss ring targeting instead of swallowing the tap.
      logTap('pyramid-hit-no-index-fallback', { pointerType: event.pointerType });
    }

    // THE NEXT GESTURE (Howell 2026-07-20): at a leaf, in volumes that ask
    // for it, the detail sector is one large button — read the verse, tap
    // it with your thumb, read the next. Resolved at lift like every other
    // tap here, so a scrub that merely ends over the sector never advances.
    if (!pendingTapNode && typeof app.detailAreaAdvances === 'function') {
      const p = svgPointOf(event);
      if (p && app.detailAreaAdvances(p.x, p.y)) {
        pendingAdvanceTap = true;
        logTap('detail-advance-pending', { pointerType: event.pointerType });
      }
    }

    // Touch near-miss support: if the tap lands close to a tiny ring node,
    // trigger its click handler instead of starting a drag.
    const isBackgroundLikeTarget = (
      event.target === svg
      || (event.target && event.target.closest && event.target.closest('.focus-ring-band'))
      || Boolean(isPyramidNode)
    );
    if ((event.pointerType === 'touch' || event.pointerType === 'pen') && isBackgroundLikeTarget
      && !pendingTapNode && !pendingAdvanceTap) {
      const nearby = nearestRingNode(event);
      if (nearby && typeof nearby.onclick === 'function') {
        // Same deferral as a direct node press: tap resolves at lift,
        // movement past slop means this was a swipe born near a node.
        logTap('near-miss-pending-tap', {
          pointerType: event.pointerType,
          nodeIndex: nearby.dataset?.index ?? null,
          nodeId: nearby.getAttribute?.('id') || null
        });
        pendingTapNode = nearby;
        event.preventDefault();
      }
    }

    isDragging = true;
    recentMoves = [];
    gestureTravelPx = 0;
    pointerCaptured = false;
    trace.downTarget = event.target?.getAttribute?.('class') || event.target?.tagName || '?';
    trace.moves = 0; trace.endedBy = ''; trace.travel = 0; trace.captured = false; trace.cancels = 0;
    publishTrace();
    logTap('drag-start', { pointerType: event.pointerType });
    // Catch the ring mid-glide: a finger planted during a flick's glide
    // stops the glide and takes over (flick, flick, catch).
    app.choreographer?.stopMomentum?.();
    lastX = event.clientX;
    lastY = event.clientY;
    lastTime = event.timeStamp;
  });

  svg.addEventListener('pointermove', onPointerMove);

  ['pointerup', 'pointercancel', 'pointerleave'].forEach(type => {
    svg.addEventListener(type, event => {
      // v0 parity: only snap after real drags. For taps/clicks, let the
      // target node's click handler run without a competing snap animation.
      const app = getApp();
      if (!app) return;
      if (isSecondaryOpen()) return; // primary inert while the secondary is up (D.3)
      const wasDragging = isDragging;
      isDragging = false;
      if (wasDragging) {
        trace.endedBy = type;
        if (type === 'pointercancel') trace.cancels += 1;
        trace.captured = pointerCaptured;
        publishTrace();
      }
      if (pointerCaptured && event.pointerId != null) {
        try { svg.releasePointerCapture(event.pointerId); } catch (err) { /* already released */ }
        pointerCaptured = false;
      }
      logTap(type, {
        pointerType: event?.pointerType,
        wasDragging,
        action: wasDragging ? 'snap-nearest' : 'tap-no-snap'
      });
      if (!wasDragging) return;
      // Resolve a pending node tap: the press landed on (or near) a node and
      // the finger never traveled past slop — fire that node's click now, at
      // lift. Either way the node press is finished; suppress the browser's
      // own delayed click so nothing fires twice.
      const tapNode = pendingTapNode;
      pendingTapNode = null;
      const advanceTap = pendingAdvanceTap;
      pendingAdvanceTap = false;
      if (advanceTap && !tapNode) {
        suppressNativeClickUntil = Date.now() + 450;
        if (gestureTravelPx <= DRAG_SLOP_PX && type === 'pointerup') {
          logTap('detail-advance-on-lift', { pointerType: event?.pointerType });
          app.advanceLeaf?.();
          return; // a tap: the advance manages rotation, no snap
        }
        // Travelled: this was a scrub that began in the sector. Fall
        // through and let it settle like any other scrub.
      }
      if (tapNode) {
        suppressNativeClickUntil = Date.now() + 450;
        if (gestureTravelPx <= DRAG_SLOP_PX) {
          if (type === 'pointerup' && typeof tapNode.onclick === 'function') {
            logTap('node-tap-on-lift', {
              pointerType: event?.pointerType,
              nodeId: tapNode.getAttribute?.('id') || null
            });
            tapNode.onclick();
          }
          return; // a tap: the node's click manages rotation, no snap
        }
      }
      // "Fast" = what the finger was doing at release: distance and direction
      // over the trailing VELOCITY_WINDOW_MS, so a pause before lifting (or a
      // noisy 1ms event sample mid-scrub) can never read as a flick.
      const now = event.timeStamp || Date.now();
      const recent = recentMoves.filter(m => now - m.t <= VELOCITY_WINDOW_MS);
      recentMoves = [];
      const recentDist = recent.reduce((sum, m) => sum + m.dist, 0);
      const recentDelta = recent.reduce((sum, m) => sum + m.delta, 0);
      const releaseVelocity = recentDist / VELOCITY_WINDOW_MS;
      const dir = Math.sign(recentDelta);
      const isFast = releaseVelocity >= DOUBLE_FLICK_MIN_VELOCITY && dir !== 0;
      // C.3 double-flick: two fast swipes, same direction, inside the
      // window -> glide to that end of the chain (sprocket doctrine:
      // every chain is bounded; the last link is a real place).
      if (isFast && dir === lastFlickDir && (now - lastFlickAt) <= DOUBLE_FLICK_WINDOW_MS) {
        lastFlickAt = 0;
        lastFlickDir = 0;
        const ch = app.choreographer;
        const limit = dir > 0 ? ch.maxRotation : ch.minRotation;
        if (Number.isFinite(limit)) {
          logTap('double-flick', { dir, limit });
          ch.glideTo(limit, GLIDE_TO_LIMIT_MS, () => app.selectNearest());
          return;
        }
      }
      lastFlickAt = isFast ? now : 0;
      lastFlickDir = isFast ? dir : 0;
      // C.3 single flick: a fast swipe is ballistic — the ring glides
      // FLICK_SCRUBS corner-to-corner scrubs' worth of rotation, in the house
      // tempo. Scrub-anchored, not chain-relative, so it feels the same on any
      // chain length (Howell 2026-07-17). glideTo clamps to the chain ends, so
      // a flick that would overshoot a short chain lands at the end. The "fast"
      // gate is the same 0.8 px/ms a double-flick leg uses (isFast).
      if (isFast) {
        const ch = app.choreographer;
        const flickRotation = computeFlickRotation(app.viewport, sensitivity);
        if (flickRotation > 0) {
          const target = ch.getRotation() + dir * flickRotation;
          logTap('flick', { dir, flickRotation: Number(flickRotation.toFixed(3)) });
          ch.glideTo(target, FLICK_GLIDE_MS, () => app.selectNearest());
          return;
        }
      }
      app.selectNearest();
      app.choreographer.stopMomentum();
    });
  });
}

async function showVersion() {
  const badge = document.getElementById('version-badge');
  if (!badge) return;
  try {
    const pkg = await fetch('./package.json').then(r => r.json());
    const name = pkg?.name || 'wheel';
    const version = pkg?.version ? `v${pkg.version}` : 'v?';
    badge.textContent = `${name} ${version}`;
  } catch (err) {
    console.warn('Version load failed', err);
    badge.textContent = 'version unavailable';
  }
}

let currentApp = null;
// The booted volume's manifest, kept module-wide for the same reason
// `currentApp` is: the section label (H-26) is updated from a nav callback
// that has no path back into bootVolume's scope, and it needs the wall
// volume's own answer for which section holds a book.
let currentManifest = null;
let currentVolumeId = null;
let gatewayReturnContext = null;
let interactionsWired = false;
let firstBootDone = false; // the boot splash plays only on the initial load

// Sample points along the visible focus-ring arc — the first stroke the boot
// splash inks. Ordered endAngle→startAngle so the self-draw sweeps from the
// upper-left corner down to the lower-right (Howell 2026-07-17).
function computeArcPoints(vp, n = 72) {
  const arc = getArcParameters(vp);
  const win = getViewportWindow(vp, getNodeSpacing(vp));
  const pts = [];
  for (let i = 0; i <= n; i += 1) {
    const a = win.endAngle + (win.startAngle - win.endAngle) * (i / n);
    pts.push({ x: arc.hubX + arc.radius * Math.cos(a), y: arc.hubY + arc.radius * Math.sin(a) });
  }
  return pts;
}

function gatewayLabelFromItemId(itemId) {
  if (typeof itemId !== 'string') return '';
  const segments = itemId.split('__');
  return (segments[segments.length - 1] || '').toUpperCase();
}

// Data-declared door into another volume: boot it in-app, remembering the
// way back. The browser URL gains a history entry so Back exits the door.
function showBootError(message) {
  // Minimal visible error surface: the console-only failures of the past
  // left black screens (Phase B audit, H4/M1).
  //
  // AND IT WAS ITSELF INVISIBLE until 2026-08-12. `.detail-panel` is
  // `opacity: 0` until something adds `detail-panel--visible`, and the only
  // two call sites touching that class are the ordinary render toggle and a
  // REMOVE during boot. This wrote its text into a panel nobody could see, so
  // every boot failure in every volume has shown a blank screen — the exact
  // outcome the function was added to end.
  //
  // Found from Howell's phone on a withheld volume: background, a copyright
  // line and nothing else. Worth stating plainly because the instrument lied
  // about itself — a guard that cannot prove it fires is not a guard, and this
  // one read as working in every review of the file.
  const el = document.getElementById('detail-content');
  if (el) {
    // SEATED CLEAR OF THE COPYRIGHT, which is a fixed band at top:0 while this
    // panel is full-screen — so writing straight into it put the message
    // underneath the notice and the two overlapped on Howell's phone,
    // illegibly. The message gets its own element and its own seat rather
    // than inheriting a container sized for something else.
    el.textContent = '';
    const box = document.createElement('div');
    box.className = 'boot-error';
    box.textContent = message;
    el.appendChild(box);
  }
  const panel = document.getElementById('detail-panel');
  if (panel) panel.classList.add('detail-panel--visible');
  console.error('[wheel]', message);
}

function launchGateway(gateway) {
  if (!gateway?.volume || !volumeConfigs[gateway.volume]) {
    console.warn('[wheel] gateway names unknown volume', gateway?.volume);
    return;
  }
  const returnContext = { volume: currentVolumeId, itemId: gateway.returnItemId || null };
  const search = `?volume=${encodeURIComponent(gateway.volume)}&level=root`;
  // Capture the outgoing screen AT THE TAP: the frozen copy covers its own
  // identical pixels through the fetch (warming its rasterization so the
  // wipe's first frames can't blink) and swallows input for the transit.
  const transit = { mode: 'launch', snapshot: captureGatewaySnapshot(svg) };
  // Boot first; only a successful boot earns the history entry (H4).
  bootVolume(gateway.volume, search, returnContext, transit)
    .then(() => {
      try {
        window.history.pushState({ wheelGateway: true, gatewayReturn: returnContext }, '', search);
      } catch (err) { /* history unavailable (e.g. file://) */ }
    })
    .catch(err => {
      // Failed boot leaves the OLD volume intact (M1) — uncover it.
      if (transit.snapshot) transit.snapshot.remove();
      showBootError(`gateway boot failed: ${err.message}`);
    });
}

function returnThroughGateway() {
  const ctx = gatewayReturnContext;
  if (!ctx?.volume || !volumeConfigs[ctx.volume]) return false;
  const params = new URLSearchParams();
  params.set('volume', ctx.volume);
  if (ctx.itemId) params.set('item', ctx.itemId);
  const search = `?${params.toString()}`;
  const transit = { mode: 'return', snapshot: captureGatewaySnapshot(svg) };
  bootVolume(ctx.volume, search, null, transit)
    .then(() => {
      try { window.history.pushState({ wheelGateway: true }, '', search); } catch (err) { /* ignore */ }
    })
    .catch(err => {
      if (transit.snapshot) transit.snapshot.remove();
      showBootError(`gateway return failed: ${err.message}`);
    });
  return true;
}

// Browser Back across a gateway pushState: reload resolves the URL cleanly.
window.addEventListener('popstate', () => window.location.reload());

// M4: history.state survives reloads — a refresh inside a gateway volume
// restores its way back instead of stranding the visitor.
function restoredGatewayReturn() {
  try {
    const st = window.history.state;
    if (st?.gatewayReturn?.volume && volumeConfigs[st.gatewayReturn.volume]) return st.gatewayReturn;
  } catch (err) { /* history unavailable */ }
  return null;
}

async function bootVolume(volumeOverride = null, searchOverride = null, gatewayReturn = null, transit = null) {
  performance.mark('wheel:boot-start');
  // Arm the corner-icon hold BEFORE anything in this boot can show an icon
  // (the mid-boot updateSearchButton showed the dividers at wipe START on a
  // return transit — Howell 2026-07-27). Armed only when a wipe will
  // actually play (same condition as the wipe block); its onDone clears it.
  cornerIconHold = Boolean(transit?.snapshot);
  // The splash reveal is initial-load only, never a gateway transit. Decide
  // now and hide the live wheel so it can be dissolved into, not popped on.
  // THE REVEAL IS DECLARED BY THE VOLUME (Howell 2026-07-30). It was playing
  // for whichever volume happened to boot first, so a volume that boots into
  // its strata funnel had the line-drawing overture running behind it — an
  // arrival animation for an instrument the reader was already being asked to
  // steer. A volume now opts in (`bootSplash` in volume-configs), and opts
  // back in when it has a reveal of its own.
  const playSplash = !firstBootDone
    && volumeConfigs[resolveVolumeId(volumeOverride, searchOverride)]?.bootSplash === true
    && bootSplashShouldPlay();
  firstBootDone = true;
  if (playSplash) {
    if (svg) svg.style.opacity = '0';
    // Hide the copyright as early as possible — it is an index.html div,
    // visible from first paint; the splash brings it in only at the end.
    const cr = document.getElementById('copyright-notice');
    if (cr) cr.style.opacity = '0';
  }
  // THE THEME IS DRESSED BEFORE ANY DATA ARRIVES (Howell, 2026-08-12, from
  // the phone: the dark volume "is a very light gray screen... give the dark
  // page the same yellow parchment background that the working page loads").
  //
  // The palette comes from the volume's own config and never needed a
  // manifest — `applyTheme` took one and ignored it. It used to run AFTER the
  // chain was built, so any boot that ended early never reached it and the
  // reader was left on the browser's default gray, with white copyright text
  // on top of it and nothing legible at all.
  //
  // A volume going dark is a RULED state, not a failure (H-1, H-14), so it
  // must arrive wearing the volume's own clothes. Dressing this early also
  // removes a flash of gray from every ordinary boot, which is the same
  // reasoning that already moved the wheel-hiding above the manifest load.
  applyTheme(resolveVolumeId(volumeOverride, searchOverride));

  let { volume, config, manifest, root, options, supplemental } = await loadConfig(volumeOverride, searchOverride);
  performance.mark('wheel:manifest-ready');
  const translationsMeta = supplemental?.translationsMeta || null;
  dimensionBridge.setTranslationsMeta(translationsMeta);
  dimensionBridge.setLanguagesMeta(supplemental?.languagesMeta || null);
  // Seed the dimension state, in order of authority: a choice already sticky
  // in THIS page session (a gateway round trip) wins; else the reader's
  // REMEMBERED edition from a previous launch (Howell ruling 3, 2026-07-30 —
  // the boot funnel confirms their language and edition rather than asking
  // again); else the volume's pinned default. `setTranslation` refuses an
  // edition that is no longer servable, so a remembered choice that has since
  // been withdrawn falls through to the default rather than stranding.
  if (!dimensionStore.getState().language) {
    const remembered = recall(volume).edition;
    if (!(remembered && dimensionBridge.setTranslation(remembered)) && options.translation) {
      dimensionBridge.setTranslation(options.translation);
    }
  }
  refreshDimensionButton(); // show the globe only where a dimension exists
  // The dividers only in volumes that declare search, only while browsing —
  // and never during the reveal (the blocker isn't up yet at this point, so
  // gate on the decision itself; the splash's finally() brings them in).
  searchAvailable = Boolean(config.hasSearch);
  // A volume boot always lands in browse, never mid-search.
  searchRestore = null;
  searchStruck = '';
  searchScopedCorpus = [];
  searchOpeningAllowed = null;
  seatSearchButton(false);
  if (searchStringEl) { searchStringEl.remove(); searchStringEl = null; }
  exitSearchLook({ svg }); // a boot never inherits the dimmed lights
  if (searchButton) searchButton.setAttribute('aria-pressed', 'false');
  if (!playSplash) updateSearchButton();
  // The sticky dimension choice (survives reboots/gateways) wins over the
  // volume's pinned default — but the pinned default is only honoured if the
  // data DECLARES that edition complete (NO ASTERISKS, Howell 2026-07-30).
  // Without this the volume kept reading its hardcoded Vulgate even with
  // nothing certified: the shelf went dark while the reader carried on, which
  // is precisely the asterisk the ruling forbids. With nothing complete there
  // is no active edition, so the detail sector has no text to render — the
  // volume offers nothing, which is the honest state until an edition is
  // certified.
  // THE VOLUME SHOWS ONLY WHAT ITS OFFERED EDITIONS CONTAIN (Howell
  // 2026-07-30). A volume may declare a pruner; the host stays agnostic about
  // what the structure means. With nothing offered, the pruner empties the
  // volume, so the rings and pyramid have no testaments, books, chapters or
  // verses to show — not a shell of names with no words behind them.
  // WITHHELD IS NOT FAILED, and the difference has to be carried (Howell,
  // 2026-08-12). A volume with nothing servable is in a RULED state — H-1's
  // "going dark is correct behaviour", H-14's wall before the first increment
  // — and the reader must not be shown a crash report for it. A volume that
  // SHOULD have items and has none is a defect and must still shout. Only the
  // pruner can tell the two apart, so it says so here rather than leaving the
  // empty ring to be interpreted downstream.
  let volumeWithheld = false;
  if (typeof config.pruneToOffered === 'function') {
    volumeWithheld = dimensionBridge.offeredEditions().length === 0;
    manifest = config.pruneToOffered(manifest, dimensionBridge.offeredEditions());
    root = config.extractRoot(manifest) || root;
  }
  // The stylesheet strips the fills for this state. TOGGLE, never add: a
  // gateway hop or an edition becoming servable must take the volume back out
  // of the dark, and a class that only ever goes on would leave the next
  // volume wearing the last one's emptiness.
  if (document?.documentElement?.classList) {
    document.documentElement.classList.toggle('volume-withheld', volumeWithheld);
  }
  const editionIsOffered = id => Boolean(id) && dimensionBridge.isServableEdition(id);
  const activeTranslation = () => {
    const chosen = dimensionStore.getState().edition;
    if (chosen) return chosen;                       // already vetted on selection
    return editionIsOffered(options.translation) ? options.translation : null;
  };
  const translationId = activeTranslation();
  const translationLang = translationsMeta?.translations?.[translationId]?.language || options.locale || 'english';
  const resolvedLocale = options.locale || translationLang || 'english';

  // THE LIVE NAMES TABLE (W-16, 2026-07-29). This object was once derived
  // once at boot and passed BY VALUE into buildChain, createHandlers and the
  // label formatter — so book and testament names froze in whatever language
  // the app booted in, while the verse text (fetched per render) followed the
  // reader. Same bug CLASS as the stale-Latin verse: baked at construction
  // instead of resolved at render.
  // The cure is deliberately NOT a rebuild: the object's IDENTITY is stable
  // and its CONTENTS are replaced on a language change. Every consumer that
  // reads it at call time — the parent button, the testaments builder, the
  // pyramid's chapters, getBibleChapters — therefore follows the reader for
  // free, with no chain rebuild and no lost place in the book.
  const namesMap = { books: {}, sections: {}, testaments: {}, bookAbbreviations: {}, locale: resolvedLocale };
  const refreshNamesMap = (previewLang = null) => {
    const lang = previewLang
      || translationsMeta?.translations?.[activeTranslation()]?.language
      || options.locale || 'english';
    const ln = translationsMeta?.names?.[lang] || {};
    // Replace CONTENTS, never the reference — the whole point.
    namesMap.books = ln.books || ln || {};
    namesMap.testaments = ln.testaments || {};
    namesMap.bookAbbreviations = ln.book_abbreviations || {};
    // THE VOLUME TITLE (W-27, 2026-07-31): the door's name in the reader's
    // tongue — the last engine-held human language. Registry-first; consumers
    // fall back to their own default when a language has no title yet.
    namesMap.title = ln.title || null;
    // THE PYRAMID'S SHORT FORMS, with Latin as the fallback (2026-07-29).
    // Only Latin carries abbreviations today; every other tongue has none,
    // and the child pyramid's LABEL LAW vetoes a star whose name would
    // collide with its neighbour's — so a 37-character Finnish book name
    // ("Ensimmäinen kirje tessalonikalaisille") collapsed the whole sky to
    // the single guaranteed star. The Latin short forms (GN, EX) are the
    // near-universal scholarly citation in Catholic use and the volume's own
    // tongue, so they stand in until the registry carries each language's
    // own. This is WAYFINDING, not scripture — the ring and magnifier still
    // show the reader's full localized name.
    namesMap.fallbackAbbreviations = translationsMeta?.names?.latin?.book_abbreviations || {};
    // The locale rides along so the label formatter's vocabulary
    // (Capitulum/Chapter/Глава) and NUMERAL system (Roman, Greek, Hebrew)
    // travel with the names rather than freezing at boot.
    namesMap.locale = lang;
    // The reading vocabulary (chapter/verse/era words) from the registry
    // when it carries them; null leaves the engine's own table in charge.
    namesMap.vocabulary = dimensionBridge.languageVocabulary(lang);
    return namesMap;
  };
  refreshNamesMap();

  const translationName = translationsMeta?.translations?.[translationId]?.name || translationId;

  // The splash overture (data-declared, volume-agnostic): when the reveal
  // will play and the volume names an overture item, the chain BOOTS there —
  // the wireframe is drawn at the overture — and the splash's rotation beat
  // glides the live wheel home to the configured start. Returning visitors
  // skip the splash and boot at home directly; nothing changes for them.
  const overtureHomeId = options.initialItemId || null;
  const overtureItemId = playSplash && options.splashOvertureItem && overtureHomeId
    && options.splashOvertureItem !== overtureHomeId ? options.splashOvertureItem : null;
  if (overtureItemId) options.initialItemId = overtureItemId;

  // The committed choice, carried to the chain builder alongside the volume's
  // pinned default — a builder that seats by artifact needs to know which
  // artifact the reader actually holds, not which one the config prefers.
  options.activeEdition = translationId;
  const chainResult = await config.buildChain(manifest, options, namesMap);
  performance.mark('wheel:chain-built');
  const { items, selectedIndex = 0, preserveOrder = false, meta } = chainResult;
  const handlerSet = config.createHandlers({
    manifest,
    namesMap,
    options,
    translationsMeta,
    chainMeta: chainResult,
    translationName,
    onGatewayReturn: returnThroughGateway,
    gatewayLabel: gatewayReturn ? gatewayLabelFromItemId(gatewayReturn.itemId) : '',
    // The origin volume's own display name (from its config) — for adapters
    // whose top-ring OUT button names the volume you'd return TO rather
    // than the gateway node you came through.
    gatewayReturnLabel: gatewayReturn
      ? (volumeConfigs[gatewayReturn.volume]?.gatewayReturnLabel || gatewayLabelFromItemId(gatewayReturn.itemId))
      : ''
  });
  // THE DARK STATE (Howell, 2026-08-12, specified from the phone): parchment,
  // the crown of thorns in its purple circle at the corner, the focus ring
  // band, and the black strokes around the magnifier and parent-button nodes.
  // Nothing beyond that — no fill on any node, no labels.
  //
  // So a withheld volume takes the ORDINARY render path with an empty ring
  // rather than a special screen. The instrument is present and holds
  // nothing, which is the honest picture and needs no new drawing code: nodes
  // come from items, and there are none, so no fill and no label can appear.
  //
  // An empty ring that was NOT withheld is still a defect and still throws.
  if (!items.length && !volumeWithheld) throw new Error(`no items found for volume "${volume}"`);

  // Gateway transit (C.4): the outgoing screen was frozen at the tap
  // (colors inlined, input swallowed) and has covered its own pixels since.
  const wipeSnapshot = transit?.snapshot || null;

  // ── Point of no return ── the new volume built successfully; only now
  // tear down the previous instance (Phase B audit, M1: a late failure
  // above leaves the old volume intact instead of a black screen).
  // Teardown any previous volume instance — gateway reboots reuse the SVG.
  // Clear only the detail CONTENT: #detail-panel's inner skeleton
  // (#detail-content, #version-badge) is owned by index.html and must survive.
  Array.from(svg.childNodes).forEach(node => {
    // The wipe snapshot stays: it is the old volume's face until the sweep.
    if (node !== wipeSnapshot) svg.removeChild(node);
  });
  const detailContentEl = document.getElementById('detail-content');
  if (detailContentEl) detailContentEl.innerHTML = '';
  const detailPanelEl = document.getElementById('detail-panel');
  if (detailPanelEl) detailPanelEl.classList.remove('detail-panel--visible');
  // The migration LIFO belongs to the OLD volume: clear it, or its detached
  // overlay clones leak per transit and a later ascent in the NEW volume can
  // pop the old volume's entry and replay stale clones (Phase C audit M3).
  clearMigrationStack();
  currentApp = null;
  currentVolumeId = volume;
  gatewayReturnContext = gatewayReturn;
  applyTheme(volume);

  const adapter = adapterLoader.load(volume);
  let adapterNormalized = null;
  let adapterLayoutSpec = null;
  if (adapter) {
    try {
      adapterNormalized = adapter.normalize(manifest);
      adapterLayoutSpec = adapter.layoutSpec(adapterNormalized, viewport);
      // Attach manifest to adapter for logo configuration
      adapter.manifest = manifest;
    } catch (err) {
      console.warn('[wheel] adapter layoutSpec failed, falling back to host config', err);
      adapterNormalized = null;
      adapterLayoutSpec = null;
    }
  }

  // The search corpus: the volume's leaves, by the name each shows in the
  // magnifier, from the adapter's normalized graph. The graph map lets a
  // found leaf walk up its parent chain to the ring level for the arrival.
  searchCorpusEntries = [];
  searchGraphById = new Map();
  searchAllLabel = root?.display_config?.search_all_label || 'TUTTI';
  if (config.hasSearch && Array.isArray(adapterNormalized?.items)) {
    const leafLevel = root?.display_config?.leaf_level || null;
    searchGraphById = new Map(adapterNormalized.items.map(i => [i.id, i]));
    if (leafLevel) {
      searchCorpusEntries = adapterNormalized.items
        .filter(i => i?.level === leafLevel && (i.name || i.id))
        .map(i => {
          const label = String(i.name || i.id);
          const { norm, wordStarts } = searchAnalyze(label);
          return { item: i, label, norm, wordStarts };
        })
        .filter(e => e.norm.length > 0)
        .sort((a, b) => a.label.localeCompare(b.label));
    }
  }

  const configLabel = makeLabelFormatter({ config, volume, level: options.level, locale: resolvedLocale, namesMap, options, manifest, meta });
  const adapterLabel = adapterLayoutSpec?.label;
  // THE VOLUME'S OWN FORMATTER WINS WHENEVER IT DECLARES ONE (2026-08-02).
  //
  // This used to decide by ARITY — "a zero-argument factory returns
  // (item, context), so it is context-aware" — which was a guess, and it was
  // wrong for every config whose factory takes its context as a parameter.
  // Those volumes fell silently through to the adapter's plain
  // `item => item.name`, so their labels were only ever right because they
  // had been BAKED at build time: chapters pre-rendered as Roman, book names
  // frozen in whichever language the app booted in. It looked correct for as
  // long as the volume spoke one language.
  //
  // The symptom that exposed it (Howell, from the phone): the parent button
  // counted in Greek — it builds its own label and reads the live names
  // table — while the ring and the child pyramid beside it did not, because
  // neither was ever reaching the formatter that knows the reader's tongue.
  //
  // A declared formatter is a statement that the volume knows how to name
  // its own items. The adapter's label is the fallback for volumes that make
  // no such statement, and it must not shadow one that does.
  const labelFormatter = config?.formatLabel
    ? configLabel
    : adapterLabel
      ? ({ item }) => adapterLabel(item)
      : configLabel;
  const shouldCenterLabel = handlerSet.shouldCenterLabel || (({ item } = {}) => {
    if (Boolean(config?.centerLabel)) return true;
    // Cylinder items (short numeric labels) should always be centered
    if (item?.level === 'cylinder') return true;
    // The search ring's characters sit ON their nodes, like all numerals
    if (item?.level === 'character') return true;
    return false;
  });
  let app;

  const parentHandler = params => (handlerSet.parentHandler ? handlerSet.parentHandler({ ...params, app }) : false);
  const childrenHandler = params => (handlerSet.childrenHandler ? handlerSet.childrenHandler({ ...params, app }) : false);
  const adapterGetParentLabel = typeof handlerSet.getParentLabel === 'function' ? handlerSet.getParentLabel : null;
  // The volume declares what it appended to a parent label (a chapter
  // numeral), so the label can be seated by its NAME and the suffix hang
  // clear of the vessel. Volumes that append nothing need not define it.
  const adapterGetParentLabelSuffix = typeof handlerSet.getParentLabelSuffix === 'function' ? handlerSet.getParentLabelSuffix : null;
  // The volume's dimension front door, if its adapter declares one (the
  // globe-at-the-threshold rule — see updateDimensionButton).
  dimensionFrontDoorAt = typeof handlerSet.showsDimensionAt === 'function' ? handlerSet.showsDimensionAt : () => false;

  const layoutBindings = handlerSet.layoutBindings || {};
  const layoutSpec = createVolumeLayoutSpec({
    volume,
    manifest,
    namesMap,
    getCatalogChildren: layoutBindings.getCatalogChildren || ((m, selected) => getCatalogChildren(manifest, selected)),
    getCalendarMonths: layoutBindings.getCalendarMonths || ((m, selected, mode) => getCalendarMonths(manifest, selected, mode)),
    getCalendarMonthChain: layoutBindings.getCalendarMonthChain,
    getCalendarDayChain: layoutBindings.getCalendarDayChain,
    getWeekdayLetters: layoutBindings.getWeekdayLetters,
    getBibleChapters: layoutBindings.getBibleChapters || ((m, selected, nm, mode) => getBibleChapters(manifest, selected, nm, mode)),
    getBibleVerseItems: layoutBindings.getBibleVerseItems,
    getBibleVerseCacheStatus: layoutBindings.getBibleVerseCacheStatus,
    getBibleVerseChain: layoutBindings.getBibleVerseChain,
    getBibleChapterChain: layoutBindings.getBibleChapterChain,
    prefetchBibleVerses: layoutBindings.prefetchBibleVerses,
    getBibleBooksForTestament: layoutBindings.getBibleBooksForTestament,
    getBibleTestaments: layoutBindings.getBibleTestaments,
    getApp: () => app,
    launchGateway,
    calendarModeRef: layoutBindings.calendarModeRef,
    setCalendarMode: layoutBindings.setCalendarMode,
    setCalendarMonthContext: layoutBindings.setCalendarMonthContext,
    bibleModeRef: layoutBindings.bibleModeRef,
    setBibleMode: layoutBindings.setBibleMode,
    setBibleChapterContext: layoutBindings.setBibleChapterContext,
    setBibleVerseContext: layoutBindings.setBibleVerseContext,
    catalogModeRef: layoutBindings.catalogModeRef,
    setCatalogMode: layoutBindings.setCatalogMode,
    savePreInState: layoutBindings.savePreInState,
    pyramidBuilder: layoutBindings.pyramidBuilder
  });
  const volumePyramidConfig = {
    ...(layoutSpec?.pyramid || {}),
    ...(adapterLayoutSpec?.pyramid || {})
  };
  searchVolumePyramid = volumePyramidConfig; // the cascade descends with the volume's own hands
  // In search mode the pyramid belongs to the completions: candidates for
  // the character in (or streaming through) the lens, and a candidate tap
  // is the arrival. Browse mode passes straight through to the volume's own
  // pyramid. One wrapper, no volume knowledge.
  const pyramidConfig = {
    ...volumePyramidConfig,
    getChildren: args => (searchRestore
      ? searchCompletions(args?.selected)
      : (typeof volumePyramidConfig.getChildren === 'function' ? volumePyramidConfig.getChildren(args) : [])),
    onClick: instr => {
      if (searchRestore) {
        if (instr?.item?.searchEntry) searchArrive(instr.item.searchEntry);
        return;
      }
      if (typeof volumePyramidConfig.onClick === 'function') volumePyramidConfig.onClick(instr);
    }
  };
  const pyramidLayout = adapterLayoutSpec || layoutSpec;
  const normalized = {
    items,
    links: (items || [])
      .filter(item => item?.parentId)
      .map(item => ({ from: item.parentId, to: item.id })),
    meta: { volumeId: volume }
  };

  // Re-measure just before rendering: by now the page has settled and the
  // browser's address bar (if any) is present, so the visible viewport is
  // accurate. Re-pin the canvas to it so layout and canvas agree with reality.
  viewport = measureViewport();
  pinCanvas(viewport);

  app = createApp({
    svgRoot: svg,
    items,
    viewport,
    selectedIndex,
    preserveOrder,
    labelFormatter,
    shouldCenterLabel,
    contextOptions: { ...options, locale: resolvedLocale },
    onParentClick: parentHandler,
    getParentLabel: adapterGetParentLabel,
    getParentLabelSuffix: adapterGetParentLabelSuffix,
    getParentActionable: typeof handlerSet.getParentActionable === 'function' ? handlerSet.getParentActionable : null,
    getParentIcon: typeof handlerSet.getParentIcon === 'function' ? handlerSet.getParentIcon : null,
    pyramid: pyramidConfig,
    pyramidLayoutSpec: pyramidLayout,
    pyramidNormalized: adapterNormalized || normalized,
    pyramidAdapter: adapter,
    detailTapAdvances: Boolean(adapter?.capabilities?.detailTapAdvances),
    // Leaf-advance paints the text ahead of the ring's arrival — same
    // renderer the settle hook uses, resolving the translation live.
    onDetailPreview: item => renderDetail(item, adapter, manifest, adapterNormalized, { translation: activeTranslation() })
  });
  currentApp = app;
  currentManifest = manifest;
  // THE MARK FOLLOWS THE READER (H-25). Before this it was re-evaluated on an
  // edition change and at boot only, which was sufficient while it asked about
  // the edition and is not once it asks about the BOOK: the reader would carry
  // whatever was true where they entered the corpus through every book after
  // it. Per book is a per-navigation question.
  //
  // Only a CHANGE OF BOOK can change the answer, so the id is compared before
  // touching the DOM — verse-by-verse travel through a book costs one string
  // comparison per settle and no repaint.
  if (app?.nav?.onChange) {
    let lastMarkedBook = currentBookId();
    app.nav.onChange(() => {
      const book = currentBookId();
      if (book === lastMarkedBook) return;
      lastMarkedBook = book;
      updateIncompleteMark();
      // The section label rides the same signal, and for the same reason:
      // only a change of BOOK can change either answer (H-26). It is the
      // division being seen as an EVENT that Howell asked for, so it must
      // fire on the settle that carries Joshua into the magnifier.
      updateSectionLabel();
    });
  }
  updateSectionLabel();
  // THE STRIKE: in search mode — and only there — the magnifier receives
  // its first-ever click (Howell 2026-07-22): tap the lens, commit the
  // settled character to the carriage. Inert in browse mode.
  if (app?.view?.magnifierCircle) {
    app.view.magnifierCircle.addEventListener('click', () => {
      if (searchRestore) strikeSettledChar();
    });
  }
  // Expose app to window for console API
  window.app = app;
  // Gateway transit: the new volume is fully rendered — lay the frozen old
  // screen over it and sweep the wipe line, hub-centered, top → lower right.
  // Same tick as the render above, so the swap itself never paints.
  if (transit && wipeSnapshot) {
    try {
      // Launch wipes downward; return wipes back up — the wipe always flows
      // away from where you are going. The corner icons are PART OF THE
      // IMAGE (Howell 2026-07-27): frozen while the hold is armed (boot
      // start), swapped at the INSTANT the sweep line crosses their corner
      // (onCross — static, no flourish), exactly as every node swaps when
      // the line passes it. Then, sweep complete and the ground fully the
      // new volume's, the globe — if it stands at a front door — does its
      // hello turn. An arrival greeting only: leaving a dimensioned volume
      // plays no goodbye spin (the globe is simply wiped away).
      const iconR = (() => {
        const vmin = Math.min(viewport.width, viewport.height);
        const size = Math.min(Math.max(52, vmin * 0.13), 96); // the buttons' CSS clamp
        return {
          x: viewport.width * 0.97 - size / 2,
          y: viewport.height * 0.87 - size / 2
        };
      })();
      playGatewayWipe({
        svg,
        snapshot: wipeSnapshot,
        viewport,
        direction: transit.mode === 'return' ? 'up' : 'down',
        onCross: {
          ...iconR,
          fn: () => {
            cornerIconHold = false;
            globeSpinMuted = true;
            updateDimensionButton();
            updateSearchButton();
            globeSpinMuted = false;
          }
        },
        onDone: () => {
          cornerIconHold = false; // safety — onCross normally cleared it
          if (transit.mode !== 'return' && dimensionButton && !dimensionButton.hidden && dimensionGlobe) {
            dimensionGlobe.spin(); // "I'm here, hello"
          }
        }
      });
    } catch (err) {
      console.warn('[wheel] gateway wipe failed', err);
      wipeSnapshot.remove();
      cornerIconHold = false;
      updateDimensionButton();
      updateSearchButton();
    }
  }
  // THE READER'S PLACE (Howell ruling 3, 2026-07-30): remember where they
  // were reading so the next launch resumes there rather than at the pinned
  // default. Only a LEAF is worth remembering — a verse is a place in the
  // book; a testament or a chapter ring is a place in the machinery, and
  // resuming there would be resuming mid-gesture. Written on every nav
  // change (cheap: session-memory skips no-op writes), so a battery death
  // loses nothing.
  const rememberReadingPosition = () => {
    const current = app?.nav?.getCurrent?.();
    if (!current?.id || !isDetailLevel(current, adapterNormalized)) return;
    remember(volume, { itemId: current.id });
  };

  // Detail renders resolve the translation LIVE (the sticky choice can
  // change between renders); the settle hook below regenerates the open
  // panel the moment a new choice commits.
  renderDetail(app?.nav?.getCurrent?.(), adapter, manifest, adapterNormalized, { translation: activeTranslation() });
  rememberReadingPosition(); // the boot position counts too
  // The globe follows the magnifier: at the volume's front door it appears,
  // one step of descent hides it (nav change), the leaf brings it back
  // (detail-sector-change). This call catches the boot/gateway arrival.
  updateDimensionButton();
  app?.nav?.onChange?.(() => {
    renderDetail(app?.nav?.getCurrent?.(), adapter, manifest, adapterNormalized, { translation: activeTranslation() });
    updateDimensionButton();
    rememberReadingPosition();
  });
  dimensionBridge.onSettle(translation => {
    window.__wheelTapTrace?.push({ ev: 'dim-settle', tr: translation || '' });
    // THE SHELF FOLLOWS THE READER (W-16): refresh the live names table
    // FIRST, then repaint. The chain is not rebuilt and nothing moves — the
    // reader keeps their exact place; only the words change, on the ring, in
    // the magnifier, in the parent button and across the pyramid. Apocalypsis
    // becomes Offenbarung des Johannes where it stands.
    refreshNamesMap();
    if (typeof app?.refreshPyramid === 'function') app.refreshPyramid();
    if (typeof app?.setParentButtons === 'function') app.setParentButtons({ showOuter: true });
    renderDetail(app?.nav?.getCurrent?.(), adapter, manifest, adapterNormalized, { translation });
    // Remember the choice, so the next launch's funnel confirms it (ruling 2)
    // rather than presenting the pinned default as though nothing was chosen.
    const sel = dimensionBridge.getSelection();
    remember(volume, { language: sel.language || null, edition: sel.translation || null });
    // The committed edition travels with the options, and the volume may warm
    // whatever it needs to seat the reader by it next time a ring is built.
    options.activeEdition = translation || options.activeEdition;
    // THE READER IS CARRIED ACROSS, NOT LEFT BEHIND. Once whatever the volume
    // needs has landed, give it the chance to RE-SEAT: the reader is standing
    // on a particular thing, and a volume whose editions divide their contents
    // differently must put them where that thing actually sits — which is not
    // the same index, and sometimes not the same number. A volume that returns
    // false (or declares no handler) keeps the reader exactly where they are,
    // which is the right answer whenever the editions agree.
    Promise.resolve(config.onEditionSettle?.(translation || null))
      .then(() => handlerSet.reseatOnEditionChange?.({
        selected: app?.nav?.getCurrent?.(), app
      }))
      .catch(() => {});
    updateIncompleteMark();
  });
  // Re-wrap the open detail the moment EB Garamond truly lands (Howell
  // 2026-07-27): the first wrap may have measured in the Georgia fallback,
  // which on iOS is NARROWER than the serif that then paints — the line ran
  // past the fence to the glass edge. One-shot per font arrival; fires
  // immediately (harmless re-render) if the face was already loaded.
  onVerseFontReady(() => renderDetail(
    app?.nav?.getCurrent?.(), adapter, manifest, adapterNormalized,
    { translation: activeTranslation() }));
  // Generic post-boot hook: adapters may schedule volume-specific startup
  // work (e.g. a featured-item prefetch) without the host
  // carrying volume literals (Phase B audit, H1).
  if (typeof handlerSet.onBoot === 'function') {
    handlerSet.onBoot({
      app,
      items,
      selectedIndex,
      renderDetail: item => renderDetail(item, adapter, manifest, adapterNormalized, { translation: activeTranslation() })
    });
  }
  if (!interactionsWired) {
    wireInteractions(() => currentApp);
    interactionsWired = true;
  }
  // THE PRIMARY FOLLOWS THE LENS (Howell 2026-07-30). While a chooser ring is
  // being turned, the text behind the glass changes tongue with it — book
  // names, chapter words and the verse itself — before anything commits.
  // Nothing here is committed to the store: the paint is thrown away and
  // redone by the settle, which lands on the same node the reader was
  // watching. A previewed language with no servable edition (a placeholder
  // tongue) leaves the text exactly as it was, matching what committing it
  // would do.
  previewPrimary = preview => {
    if (!preview) return;
    const edition = preview.edition;
    if (!edition || edition === dimensionBridge.comingSoonKey) return;
    refreshNamesMap(preview.language);
    if (typeof app?.refreshPyramid === 'function') app.refreshPyramid();
    if (typeof app?.setParentButtons === 'function') app.setParentButtons({ showOuter: true });
    renderDetail(app?.nav?.getCurrent?.(), adapter, manifest, adapterNormalized, { translation: edition });
  };

  // Open the funnel LAST, once the primary has its chain, its verse and its
  // detail sector — the text must already be there to recede behind the
  // glass, since the reader sees it blurred from the first frame and it is
  // the destination they are travelling toward. A volume without dimensions
  // is untouched and boots straight to its primary.
  //
  // BUT NOT ON A TRANSIT (Howell 2026-07-30). The funnel is the APP'S FRONT
  // DOOR, not a ritual for every arrival: a reader crossing laterally from
  // another volume mid-session came through a different door and is already
  // inside — they have not asked to re-declare their language. Two faults
  // fell out of treating a transit as a launch: the three planes painted
  // themselves ON TOP of the 1800ms wipe still sweeping beneath them
  // (breaking the "corner icons are part of the image" doctrine, which holds
  // for whole planes too), and the way back out — the parent button, the only
  // thing that says where a transit returns to — sat two taps deep behind the
  // choosers. Landing a transit on the primary fixes both at once, and it
  // keeps the ruling exact where it counts: every LAUNCH still opens the
  // funnel. (This is also why no parent button was built into the strata: the
  // need exists solely for the gateway, which is dev scaffolding — a
  // standalone deployment has no volume above it to return to.)
  updateIncompleteMark();
  if (!transit) openBootFunnel();
  showVersion();
  performance.mark('wheel:render-done');
  recordBootPhases(volume);
  if (options.debug) mountFeelHud();
  mountProbe(); // inert unless ?probe=1 — field diagnostics to the drop box
  // ?bounds=1 — green region outlines (solid: star field, dashed: day grid)
  // for phone-side layout tuning; phones have no console for the old call.
  try {
    const diagParams = new URLSearchParams(window.location.search);
    if (diagParams.get('bounds') === '1') {
      window.showPyramidBounds?.();
    }
    // ?wedge=1 — day-wedge construction rays; ?wedgemul=N tunes the new
    // hub's distance (multiplier on magnifier→hub, default 1.5).
    if (diagParams.get('wedge') === '1') {
      window.showDayWedge?.(Number(diagParams.get('wedgemul')) || 1.5);
    }
  } catch (err) { /* diagnostics never break boot */ }
  prefetchGatewayTargets(manifest);
  // Adapters that rebuild the top chain (the globe's homecoming) re-invoke
  // this through the hook so rebuilt stamp lines resolve again.
  app.refreshDataStamps = () => refreshDataStamps(app);
  app.refreshDataStamps();

  if (playSplash) {
    const contentGroup = app?.view?.contentGroup || null;
    playBootSplash({
      svg, contentGroup, viewport, arcPoints: computeArcPoints(viewport),
      // The overture's homeward glide — the splash calls this at its rotation
      // beat; the wheel travels steady (linear) and commits on arrival.
      overture: overtureItemId && app ? { glide: ms => app.glideToItem(overtureHomeId, ms) } : null
    })
      .catch(err => {
        console.warn('[wheel] boot splash failed', err);
        if (contentGroup) contentGroup.style.opacity = '';
        if (svg) svg.style.opacity = '';
        // Never strand the wheel at the overture: if the reveal died before
        // its rotation, snap home now (0ms — the error path has no theatre).
        if (overtureItemId && app) app.glideToItem(overtureHomeId, 0);
      })
      .finally(() => updateSearchButton()); // the dividers arrive once the reveal is over
  }
}

bootVolume(null, null, restoredGatewayReturn()).catch(err => {
  showBootError(`Failed to initialize app: ${err.message}`);
});
