import { createApp, getViewportInfo, buildBibleBookCousinChain, validateVolumeRoot } from './index.js';
import { buildCalendarYears, buildBibleBooks, buildCatalogManufacturers, getCatalogChildren, getCalendarMonths, getBibleChapters, toRomanNumeral, bookIdOf, chapterIdOf } from './adapters/volume-helpers.js';
import { createVolumeLayoutSpec } from './adapters/volume-layout.js';
import { adapterLoader, volumeConfigs, DEFAULT_VOLUME, makeLabelFormatter, VENUES } from './volume-configs.js';
import { mountFeelHud } from './view/feel-hud.js';
import { mountProbe } from './diagnostics/probe.js';
import { proofreadOverrideActive, declareVenues, isOnLan } from './core/lan-gate.js';

// THE GESTURE LOG (O-153, Howell 2026-09-16: "I suggest we do some logging and
// you see what's going on"). On the bench only — a private address and
// ?gesturelog=1 — every logTap event is timestamped and sent in batches to
// scripts/gesture-log-sink.py on port 8089 of the same host. Inert anywhere
// else, and nothing is sent without the flag.
// THE FRAME READOUT (O-160): with the same flag, on any host, a line in the
// corner reports each drill's frames — so smoothness is read off the phone
// wherever it is, not assumed. Frames, display rate, median and worst gap,
// frames dropped (a gap over 1.6 periods), the longest and median seek.
if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('gesturelog') === '1') {
  const box = document.createElement('div');
  box.id = 'frame-readout';
  box.style.cssText = 'position:fixed;left:6px;bottom:6px;z-index:2147483647;font:11px/1.25 monospace;color:#fff;background:rgba(0,0,0,.72);padding:4px 6px;border-radius:4px;pointer-events:none;white-space:pre;';
  box.textContent = 'frames: waiting for a drill';
  // A/B FLAGS FOR THE BENCH (O-160): &nowatermark=1 hides the watermark
  // image, &nosector=1 the whole sector — to read what each costs in frames.
  const q = new URLSearchParams(window.location.search);
  const hideSel = q.get('nosector') === '1' ? '#volume-logo-group' : (q.get('nowatermark') === '1' ? '#volume-logo-image' : null);
  if (hideSel) {
    const hide = () => { const el = document.querySelector(hideSel); if (el) el.style.display = 'none'; else setTimeout(hide, 250); };
    hide();
    box.textContent += `  [${hideSel === '#volume-logo-group' ? 'no sector' : 'no watermark'}]`;
  }
  // THE RING PROBE (bench only): a third of the way into a drill, list what
  // is drawn at two ring seats — every element under the point, its fill
  // and its effective opacity — so a node that looks lighter in flight can
  // say which element paints it and at what opacity.
  const effOp = el => { let o = 1; for (let e = el; e && e.nodeType === 1; e = e.parentNode) { const v = parseFloat(getComputedStyle(e).opacity); if (!Number.isNaN(v)) o *= v; } return o.toFixed(2); };
  let probeText = '';
  const paint = () => { box.textContent = [probeText, framesText].filter(Boolean).join('\n'); };
  const describe = (tag, n) => {
    if (!n) return [`${tag}: none`];
    const cs = getComputedStyle(n);
    const r = n.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const out = [`${tag} @${Math.round(x)},${Math.round(y)} fill ${cs.fill} fo ${cs.fillOpacity} op ${effOp(n)} cls ${n.getAttribute('class')}`];
    document.elementsFromPoint(x, y).slice(0, 4).forEach(el => out.push(`  ${el.tagName}.${(el.getAttribute('class') || '').split(' ')[0]} ${getComputedStyle(el).fill} fo ${getComputedStyle(el).fillOpacity} op ${effOp(el)}`));
    return out;
  };
  window.__probeRing = label => {
    const ring = document.querySelectorAll('#app .focus-ring-node')[1] || null;
    const sky = document.querySelector('#app .child-pyramid-node');
    const app = document.getElementById('app');
    probeText = [`${label || 'probe'}: app cls "${app?.getAttribute('class') || ''}" paint ${app ? getComputedStyle(app).getPropertyValue('--boot-paint') : ''}`,
      ...describe('ring', ring), ...describe('sky', sky)].join('\n');
    paint();
  };
  setTimeout(() => window.__probeRing('rest'), 3500);
  const mount = () => document.body?.appendChild(box);
  if (document.body) mount(); else window.addEventListener('DOMContentLoaded', mount, { once: true });
  const history = [];
  let framesText = '';
  window.__wheelFrameReport = r => {
    r.kind = window.__wheelFrameKind || '?';
    history.unshift(r); if (history.length > 3) history.pop();
    framesText = history.map(h => `${h.kind.toUpperCase().padEnd(4)}${h.frames}f @${h.hz}Hz drop ${h.dropped} worst ${h.worst}\n    render ${h.renderMedian}/${h.renderMax} seek ${h.seekMedian}/${h.seekMax}`).join('\n');
    paint();
    setTimeout(() => window.__probeRing?.('rest after ' + r.kind), 1500);   // the landed level, sky and all
    if (typeof window.__tapDebugLog === 'function') window.__tapDebugLog('frames', r);
  };
}
if (typeof window !== 'undefined' && isOnLan() && new URLSearchParams(window.location.search).get('gesturelog') === '1') {
  const sink = `http://${window.location.hostname}:8089/log`;
  let buf = [];
  const t0 = performance.now();
  window.__tapDebugLog = (ev, payload = {}) => {
    buf.push({ t: Math.round(performance.now() - t0), ev, ...payload });
    if (buf.length > 400) flush();
  };
  const flush = () => {
    if (!buf.length) return;
    const body = JSON.stringify(buf); buf = [];
    try { if (!navigator.sendBeacon?.(sink, new Blob([body], { type: 'text/plain' }))) fetch(sink, { method: 'POST', body, mode: 'no-cors', keepalive: true }); } catch (_) { /* the bench has no sink running */ }
  };
  setInterval(flush, 1000);
  window.addEventListener('pagehide', flush);
  window.__tapDebugLog('gesturelog-on', { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio, ua: navigator.userAgent.slice(0, 60) });
}
import { beginScrubbedMigration, scrubDriver } from './view/migration-animation.js';
import { bearingOf, diagonalLean, classifyBearing, axisFor } from './core/stroke.js';
import { captureGatewaySnapshot, playGatewayWipe } from './view/gateway-wipe.js';
import { clearStack as clearMigrationStack } from './view/migration-animation.js';
import { createInteractionStore } from './core/interaction-store.js';
import { createDimensionBridge } from './core/dimension-bridge.js';
import { recall, remember } from './core/session-memory.js';
import { bookmarksOf, keep as keepBookmark, drop as dropBookmark, isBookmarked, inOrder } from './core/bookmarks.js';
import { renderStratum, hideStratum } from './view/secondary-strata-view.js';
import { DetailPluginRegistry } from './view/detail/plugin-registry.js';
import { TextDetailPlugin } from './view/detail/plugins/text-plugin.js';
import { CardDetailPlugin } from './view/detail/plugins/card-plugin.js';
import { EphemerisDetailPlugin } from './view/detail/plugins/ephemeris-plugin.js';
import { computeDetailSectorBounds } from './geometry/detail-sector-geometry.js';
import { renderMarginNote, marginPartCount } from './view/margin-panel.js';
import { apparatusRuns } from './core/margin-source.js';
import { computeMarginArea, setMarginKeepOut } from './geometry/margin-area.js';
import { onVerseFontReady, invalidateVerseMeasurement, versePartCount , poemPartCount, verseFaceReady, faceMarkDrifted } from './view/detail/plugins/line-layout.js';
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
// THE COPYRIGHT NOTICE'S REAL BOTTOM EDGE (O-115). The detail sector raises
// its text a row toward the top of the glass and must stop at this piece of
// furniture — MEASURED, never assumed: the notice's own stylesheet records it
// sitting some ninety pixels lower in DuckDuckGo than in Chrome on the same
// device, overlapping the leaf text. It stays in layout while the NOT
// PROOFREAD mark covers it (visibility, not display), so the rect is honest
// in both states. Null when there is no DOM or no notice; the geometry then
// falls back to a phone's two-line box.
function copyrightBottomPx() {
  try {
    const el = typeof document !== 'undefined' && document.getElementById('copyright-notice');
    if (!el || typeof el.getBoundingClientRect !== 'function') return null;
    const r = el.getBoundingClientRect();
    if (!Number.isFinite(r?.bottom)) return null;
    // THE NOTICE'S INK, NOT ITS BOX (Howell, 2026-08-29, reading his Moto G
    // through the now-translucent mark: "there appears to be plenty of
    // headroom before we hit the copyright warning"). There was, and the
    // clamp could not see it: the element's bottom edge carries six pixels
    // of padding below its last line, so clamping to the BOX stopped the
    // text a padding's width above where anything is actually drawn. The eye
    // measures ink to ink; so does this now.
    const pad = typeof window !== 'undefined' && window.getComputedStyle
      ? parseFloat(window.getComputedStyle(el).paddingBottom) || 0
      : 0;
    return r.bottom - pad;
  } catch (_) { return null; }
}

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

// O-84: memoised answers to "how many Detail Sector screens does this verse
// need" — keyed by item, edition and viewport, cleared whenever the verse
// measurement itself is invalidated (font arrival, re-wrap), since the count
// derives from the measured size.
const versePartsCache = new Map();
let lensSwipeFiredAt = 0;   // O-132: a down-swipe on the lens just drilled; its click is not a tap
const volumeForParts = () => currentManifest?.__wallVolume;
let currentDetailRerender = null;   // set at boot; repaints the seated verse (O-112)

// D.2 — the dimension state lives at the HOST level, above bootVolume, so a
// choice survives volume reboots and gateway round trips (Howell ruling
// 2026-07-20, docs/DIMENSION_SYSTEM.md). The store and bridge are created
// once; each boot refreshes the bridge's registry and its render hook.
const dimensionStore = createInteractionStore();
// THE SCREENING ROOM IS THE LAN (O-137): the gate learns which address is the
// room from the config — the one file that may name a site — before anything
// asks it whether the bench's flag applies.
declareVenues(VENUES);
const dimensionBridge = createDimensionBridge({ store: dimensionStore });

// D — the strata STACK (docs/DIMENSION_SYSTEM.md). Up to three deep for a
// dimensioned volume: primary (the text) → secondary (translations, mirrored)
// → tertiary (languages, standard).
//
// CORRECTED 2026-08-20 (O-82). These five lines were wrong in two separate
// ways for eleven days, while the code beneath them was right. They said
// secondary held LANGUAGES and tertiary TRANSLATIONS, which is the assignment
// O-37 retired on 2026-08-09 — read CHOOSERS below, where `secondary` asks
// for `translationsOf` and `tertiary` for `languagesAvailable`. And they said
// the button runs primary → secondary → tertiary, which is backwards.
//
// The button cycles INWARD, narrowing at every press: tertiary (the largest
// set, deepest) → secondary → primary (the element itself, in front) → and
// the wrap carries the reader from the text back out to the languages. That
// IS O-37 — "nesting and depth agree, narrowing inward" — so a comment
// describing the outward order contradicted the ruling it was implementing.
// `cycleStrata` decrements for exactly this reason, and
// test/boot-smoke.test.js walks the real button 2 → 1 → 0 → 2.
//
// Each press pushes the stack one layer deeper — the front is full size,
// one layer back recedes to 0.4, two layers back to 0.2 — each receding one
// straight-pull-back
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
    // THE SHELF SPEAKS SHORT, IN ITS OWN SCRIPT (O-97, Howell 2026-08-23).
    //
    // STRUCK, and quoted so the correction is readable — this said: "THE SHELF
    // SPEAKS IN FULL (Howell, LAN check 2026-08-01): every edition node shows
    // its NATIVE FULL NAME … magnified or not … It fits because this plane
    // holds only an edition or three per language, FAR APART ON THE ARC —
    // unlike the book sky, where long names collide."
    //
    // The last sentence was true when written and Wilbur's seating of the
    // Greek Old Testament falsified it from the other side of the wall: the
    // Greek arc now carries TWO editions, and 50grc's native name is
    // fifty-eight characters — Ἡ Καινὴ Διαθήκη ἐγκρίσει τῆς Μεγάλης τοῦ
    // Χριστοῦ Ἐκκλησίας. They collide and run off the ring, which is what
    // Howell photographed.
    //
    // What survives of 2026-08-01 is its REASON, and he ruled on it again
    // today: a Latin-letter code reads as a filing label in a volume whose
    // whole point is that each tongue speaks for itself. So the node wears a
    // SHORT NATIVE form — not Map (MT / LXX / NT Graece), which is Latin, and
    // not the key, which is worse.
    //
    // EVERY NODE, MAGNIFIED OR NOT. The view offers a split — it passes
    // `magnified` as the second argument — and the ruling did not take it: the
    // shape Howell chose shows the short native form in the lens as well,
    // תנ״ך where the full name would read כתב יד לנינגרד. The alternative (the
    // lens keeps the full name, its neighbours go short) was put beside it and
    // was not the one chosen; it remains one line away if he wants it.
    label: key => dimensionBridge.translationAbbrev(key, strataPreview?.language || null),
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
let strataFront = 0;                       // 0 = primary at front; -1 = the basement (O-126)
// ── THE BASEMENT — the Zero Stratum (O-126, Howell 2026-09-14) ─────────────
// "If you think of the app as a building, the Zero Stratum is the basement,
// the Primary Stratum is the Main Floor, the Secondary and Tertiary Strata
// are the upper floors. The user can look down from the upper floors and see
// below as far as the Main Floor, but cannot see the basement from any floor
// above." Reached by sliding the globe DOWN. Its ring looks like the
// Secondary's (the mirrored arc, lower-left to upper-right) and holds the
// reader's BOOKMARKS (src/core/bookmarks.js); nothing stands behind it —
// the primary is not receded and blurred, it LEAVES.
//
// THE DESCENT CARRIES THE VERSE: sliding down from a leaf brings the verse
// the reader was on down with them as a PROVISIONAL seat — hollow — beside
// the kept ones. A tap on the lens keeps the seat under it (or drops a kept
// one, which stays on the ring hollow until the reader leaves). Sliding up
// with a kept bookmark under the lens returns the main floor and the ring
// travels to that verse; with the provisional (the verse they came from)
// under the lens, or with an empty ring, the main floor returns as it was.
let basementArrival = null;   // { key, id, edition, label } — the verse the reader came down with, or null
let basementLens = null;      // the seat KEY last settled under the lens this visit, or null
let basementLoose = [];       // seat keys shown hollow this visit: the arrival, and any dropped
const basementLabels = {};    // labels remembered for loose seats, so re-keeping keeps the name
const basementPlaces = {};    // and their places (seatOrder), so re-keeping keeps the order
// A SEAT ON THE BASEMENT'S RING IS A LEAF IN AN EDITION (Howell, 2026-09-14:
// three bookmarks for Genesis 1:1, one per tongue, and never two in one).
// Its key joins the two; the ring's items are keys.
const seatKey = (id, edition) => `${id}@${edition ?? ''}`;
const seatParts = key => { const at = key.lastIndexOf('@'); return at < 0 ? { id: key, edition: null } : { id: key.slice(0, at), edition: key.slice(at + 1) || null }; };
const keptSeat = key => { const { id, edition } = seatParts(key); return bookmarksOf(currentVolumeId).find(b => b.id === id && (b.edition ?? null) === edition) || null; };
const currentEdition = () => dimensionBridge.getSelection()?.translation ?? null;
const isHit = key => { const { id, edition } = seatParts(key); return hitSeats().some(h => h.id === id && (h.edition ?? null) === edition); };
const BASEMENT = {
  id: 'basement', mirrored: true, allowEmpty: true, labelsBeside: true,   // the primary's label manners (O-128)
  lensShift: -4,   // the lens four nodes up the arc, clear of the left edge, so a whole name fits in it (Howell, 2026-09-14)
  items: () => {
    // Kept seats and THE GREATEST HITS (O-135, Howell 2026-09-15: "add
    // Greatest Hits permanently to the bookmarks ring") together in the
    // volume's order — book, chapter, verse, edition — and the loose ones
    // (the arrival, anything dropped this visit) after them. A hit is seated
    // in the edition up, with the label the primary would show; a hit the
    // reader has also kept is one seat, drawn kept.
    const kept = bookmarksOf(currentVolumeId);
    const hits = hitSeats().filter(h => !kept.some(b => b.id === h.id && (b.edition ?? null) === (h.edition ?? null)));
    for (const h of hits) { const k = seatKey(h.id, h.edition); basementLabels[k] = h.label; basementPlaces[k] = h.at; }
    const keys = inOrder([...kept, ...hits]).map(b => seatKey(b.id, b.edition));
    for (const k of basementLoose) if (!keys.includes(k)) keys.push(k);
    return keys;
  },
  label: key => keptSeat(key)?.label || basementLabels[key] || seatParts(key).id,
  // Kept: filled. A hit: its own fill, never mistaken for something kept.
  // Loose (arrived with, or dropped this visit): hollow, provisional.
  classFor: key => (keptSeat(key) ? '' : isHit(key) ? 'is-hit' : 'is-provisional'),
  selected: () => basementLens ?? basementArrival?.key ?? BASEMENT.items()[0] ?? null,
  select: key => { basementLens = key; return true; }
};
// The seat's label is the verse's full address as the instrument was showing
// it at that moment — the Parent Button's words (book and chapter, in the
// edition's own tongue and numerals) and the Magnifier's (the verse) — joined
// as chapter and verse are everywhere: GENESIS I:12, ΓΕΝΕΣΙΣ α':12 (Howell,
// 2026-09-14: "bookmarked nodes should display book, chapter and verse").
// Read off the primary's own labels rather than rebuilt, so the seat says
// exactly what the reader saw, in whatever form that edition writes it.
function arrivalLabel(cur) {
  const text = sel => (document.querySelector(`#app ${sel}`)?.textContent || '').trim();
  const parent = text('.focus-ring-parent-label');
  const verse = text('.focus-ring-magnifier-label:not(.focus-ring-parent-label)') || cur?.name || cur?.label || '';
  return parent && verse ? `${parent}:${verse}` : (verse || parent || cur?.name || cur?.label || cur?.id || '');
}
// A BOOKMARK IS THE LEAF. A ring item's id is one edition's word for a seat
// (`<bookId>_<chapter>_<verse>`, and a book id is per edition — O-92); the
// utterance the item carries (W-21: it travels ON the item) is the leaf
// every edition shares. The seat is kept by that, and found again on
// whatever ring is up by asking each item for its utterance.
const leafOf = item => item?.meta?.utterances?.[0] ?? item?.id ?? null;
const itemForLeaf = leaf => (currentApp?.nav?.items || []).find(it => it && (it.meta?.utterances?.includes?.(leaf) || it.id === leaf)) || null;
function enterBasement() {
  const cur = currentApp?.nav?.getCurrent?.();
  basementLens = null; basementLoose = [];
  if (cur?.id && detailSectorVisible) {
    const id = leafOf(cur), edition = currentEdition();
    let at = null;
    try { at = seatOrder(cur); } catch (_) { at = null; }
    basementArrival = { key: seatKey(id, edition), id, edition, label: arrivalLabel(cur), at };
    basementLabels[basementArrival.key] = basementArrival.label;
    basementPlaces[basementArrival.key] = at;
    basementLoose.push(basementArrival.key);
  } else basementArrival = null;
}
// THE JUMP IS UNSEEN (Howell, 2026-09-14: "trucking out of the basement
// should go directly to the bookmarked verse. The jump should take place
// instantly and unseen"). It happens at the START of the ascent, while the
// main floor is still invisible — the ring is set to the chosen seat with no
// glide at all, and by the time the floor has faded in it was always there.
// (The first cut let the floor return and then glided the ring to the seat,
// on O-123's reason that an arrival should be the ring's own journey; a
// journey nobody is meant to see is not that case.)
function jumpToChosen() {
  const chosenKey = basementLens, arrivedKey = basementArrival?.key ?? null;
  if (!chosenKey || chosenKey === arrivedKey || !currentApp) return;
  const { id: chosen, edition: want } = seatParts(chosenKey);
  const seatHere = () => {
    const item = itemForLeaf(chosen);   // this edition's seat on the shared leaf, if the ring up holds it
    if (item && typeof currentApp.glideToItem === 'function') { currentApp.glideToItem(item.id, 0); return true; }
    // Not on the ring up — at root, on a book or a chapter ring: the adapter
    // seats the primary at the leaf, drilling for the reader (O-129).
    try { return Boolean(seatAtLeaf(chosen, currentApp)); } catch (_) { return false; }
  };
  // A BOOKMARK CARRIES ITS EDITION (Howell, 2026-09-14: a bookmark for the
  // Italian ESODO 25:37 chosen from the Hebrew "takes the user to Hebrew
  // Exodus 25:37, instead of Italian ESODO 25:37 as it should"). The seat is
  // the leaf, so it can be found in any edition; the bookmark says which
  // edition the reader was in, and the return goes there. Seat first in the
  // edition up — unseen, the floor is still dark — then commit the bookmark's
  // edition, and the ordinary reseat carries the reader across to the same
  // leaf in that tongue. When the edition up does not seat the leaf at all,
  // the edition changes first and the seating follows its reseat.
  const here = currentEdition();
  if (!want || want === here) { seatHere(); return; }
  const seated = seatHere();
  // O-72's position filter would refuse an edition that does not hold the
  // seat the reader is leaving; the bookmark's edition holds the seat they
  // are going to, so the filter is lifted for the commit and re-read after.
  dimensionBridge.setEditionsHere(null);
  const committed = dimensionBridge.setTranslation(want);
  if (!committed) { refreshEditionsHere(); return; }
  if (!seated) editionSettlePromise.then(() => { seatHere(); refreshEditionsHere(); }).catch(() => {});
  else editionSettlePromise.then(() => refreshEditionsHere()).catch(() => {});
}
function leaveBasement() {
  basementArrival = null; basementLens = null; basementLoose = [];
}
// Keep or drop the seat under a key; a bare leaf id means this edition.
function toggleKeep(keyOrId) {
  const vol = currentVolumeId;
  if (!vol || !keyOrId) return false;
  const key = keyOrId.includes('@') ? keyOrId : seatKey(keyOrId, currentEdition());
  const { id, edition } = seatParts(key);
  if (isBookmarked(vol, id, edition)) {
    basementLabels[key] = BASEMENT.label(key);
    basementPlaces[key] = keptSeat(key)?.at ?? basementPlaces[key] ?? null;
    dropBookmark(vol, id, edition);
    if (!basementLoose.includes(key)) basementLoose.push(key);
  } else {
    keepBookmark(vol, { id, label: BASEMENT.label(key), edition, at: basementPlaces[key] ?? null });
  }
  return true;
}
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
let bookmarkPrompt = null;   // O-128: the volume's own words for "bookmark this", per tongue
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
function setPrimaryVisual(scale, blurPx, away = null) {
  // `away` (O-126): the DESCENT to the basement. The primary is not receded
  // and blurred — it LEAVES, sliding up out of view and fading, because from
  // the basement no floor above is visible. { offsetY, opacity }, or null.
  const offsetX = away?.offsetX || 0;
  const offsetY = away?.offsetY || 0;
  const opacity = away ? away.opacity : 1;
  const scaled = Math.abs(scale - 1) > 0.001;   // receded (< 1) or past the head (> 1)
  const slid = Math.abs(offsetX) >= 0.5 || Math.abs(offsetY) >= 0.5 ? `translate(${offsetX.toFixed(1)} ${offsetY.toFixed(1)}) ` : '';
  const tf = scaled || slid ? `${slid}${scaled ? scaleAboutCentre(scale) : ''}`.trim() : null;
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
  // Gone means gone to the finger too: a plane at opacity 0 above the basement
  // must not swallow the taps and drags meant for the basement's ring.
  const gone = opacity < 0.001;
  if (app) { app.style.filter = filter; app.style.opacity = opacity < 0.999 ? String(opacity) : ''; app.style.pointerEvents = gone ? 'none' : ''; }
  // EVERY HTML OVERLAY THAT BELONGS TO THE PRIMARY PLANE RECEDES WITH IT.
  // The verse panel was the only one when this was written; the margin and the
  // marks beside the verse arrived later and stayed sharp and full-size while
  // the ring behind them travelled away — Howell, 2026-08-27: "the sigla,
  // margin notes, and legend do not recede and blur as the other primary
  // stratum elements do... all of these margin elements should appear to move
  // away from the user, becoming distant and blurry, while maintaining their
  // positions relative to the focus ring and magnifier."
  //
  // They are listed rather than discovered, so a NEW overlay is a deliberate
  // addition to this line and not a thing that silently fails to travel.
  for (const id of ['detail-panel', 'margin-panel', 'margin-marks']) {
  const panel = document.getElementById(id);
  if (panel) {
    const cx = viewport.width / 2, cy = viewport.height / 2;
    // Scale about the viewport CENTRE — the point the SVG ring/logo scale
    // about — so the verse text stays seated on the blue circle. The panel is
    // fixed at inset:0, so (cx,cy) is its centre; transform-origin is defined
    // pre-transform, so it's stable across successive scales. (Reading
    // getBoundingClientRect here slid the origin on a second recede, Howell
    // 2026-07-21.)
    panel.style.transformOrigin = `${cx}px ${cy}px`;
    panel.style.transform = `${slid ? `translate(${offsetX.toFixed(1)}px, ${offsetY.toFixed(1)}px) ` : ''}${scaled ? `scale(${scale})` : ''}`.trim();
    panel.style.filter = filter;
    panel.style.opacity = opacity < 0.999 ? String(opacity) : '';
    panel.style.pointerEvents = gone ? 'none' : '';
  }
  }
}
function setStratumVisual(el, scale, blurPx, opacity = 1, offsetX = 0, offsetY = 0) {
  if (!el) return;
  // The recede TRANSFORM rides the inner <g>; the BLUR + opacity ride the
  // outer <svg> — WebKit honors a filter on an <svg>, not on a <g> (Howell
  // 2026-07-27, the strata half of the iOS blur fix).
  const inner = el.querySelector?.('.stratum-inner') || el;
  const still = Math.abs(offsetX) < 0.5 && Math.abs(offsetY) < 0.5;
  if (Math.abs(scale - 1) < 0.001 && blurPx < 0.01 && opacity > 0.999 && still) {   // at rest — and 2.6× is not rest
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

// Where the primary goes when the basement is front. Howell's phone checks,
// 2026-09-14: "The user should pass through them and they should fly behind
// the user's head, just as the Tertiary Stratum does when migrating down to
// the Secondary Stratum" — and then, on the geometry, one course the whole
// way. So the primary LEAVES as a departing chooser leaves: it keeps scaling
// about the centre past the film plane, sharp, out past the frame, gone only
// at the end, since from the basement no floor above is visible. (The second
// cut receded it into the distance — the wrong direction: going down is going
// FORWARD, through the floor; the third slid it off on a diagonal — the
// broken course.)
const PRIMARY_GONE = () => ({ scale: EXIT_SCALE, blur: 0, opacity: 0, offsetX: 0, offsetY: 0 });
// THE BASEMENT IS UNDER THE FLOOR (Howell, phone check 2026-09-14: "the
// incoming Zero Stratum Focus Ring is visible long before the Detail Sector
// has begun to fade away (the Zero Stratum Focus Ring can be seen through
// the 'floor')"). The strata layer sits ABOVE the primary — right for the
// upper floors, which are lenses over it — so for any glide that touches the
// basement, and while the basement is front, the layer drops BELOW the
// primary and its panels (styles: #strata-layer.is-below), and the ring is
// revealed only as the floor dissolves.
const strataBelow = below => { if (strataLayer?.classList) strataLayer.classList.toggle('is-below', Boolean(below)); };
// One render call shape for every plane, the basement included.
const stratumOpts = (ch, items, selectedIndex, rotating = false) => ({
  id: ch.id, viewport, items, selectedIndex,
  mirrored: ch.mirrored, labelFor: ch.label, centerMagnified: ch.centerMag, rotating,
  classFor: ch.classFor || null, allowEmpty: Boolean(ch.allowEmpty), labelsBeside: Boolean(ch.labelsBeside), lensShift: ch.lensShift || 0
});

function renderStack() {
  if (strataFront < 0) {
    // THE BASEMENT IS FRONT (O-126): the primary has left, the choosers are
    // not in play, and the basement's ring stands alone with nothing behind.
    // Settle where the flight ended — still at EXIT_SCALE, still gone. Settling
    // to scale 1 un-zoomed the verse text for a frame before the opacity took
    // hold ("an unzoomed artifact of text that pops on briefly during the
    // settle" — Howell, 2026-09-14); nothing must change at the settle.
    const gone = PRIMARY_GONE();
    setPrimaryVisual(gone.scale, gone.blur, gone);
    // SETTLED, the layer comes back ABOVE the (now invisible) primary. Under
    // it, the primary's own nodes — which set pointer-events of their own —
    // took every touch meant for the basement's ring, and it would not turn
    // (Howell, 2026-09-14: "we need to put in the hooks so we can rotate that
    // basement focus ring"). Below the floor only while the floor is there
    // to be seen through: during the flight.
    strataBelow(false);
    CHOOSERS.forEach(ch => hideStratum(strataLayer, ch.id));
    const items = BASEMENT.items();
    const g = renderStratum(strataLayer, stratumOpts(BASEMENT, items, Math.max(0, items.indexOf(BASEMENT.selected()))));
    if (g) setStratumVisual(g, 1, 0, 1);
  } else {
  hideStratum(strataLayer, BASEMENT.id);
  strataBelow(false);
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
  }
  if (dimensionButton) dimensionButton.setAttribute('aria-pressed', String(isStrataOpen()));
  // The front stratum is drag-rotatable; the layer and its full-area hit target
  // catch pointer events ONLY while a stratum is front — at the primary they
  // stay out of the way so the ring below gets every tap and swipe.
  if (strataLayer) {
    const strataLive = strataFront !== 0;   // a chooser above, or the basement below
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
  if (strataHit) strataHit.style.pointerEvents = strataFront !== 0 ? 'auto' : 'none';
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
const activeChooser = () => (strataFront > 0 ? CHOOSERS[strataFront - 1] : strataFront < 0 ? BASEMENT : null);

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

// Is the press on the lodestar itself?
function lensHit(event, ch) {
  const lens = strataLayer?.querySelector(`#${ch.id} .secondary-strata-node.is-magnified`);
  if (!lens) return false;
  const rect = strataLayer.getBoundingClientRect();
  const x = event.clientX - rect.left, y = event.clientY - rect.top;
  return Math.hypot(Number(lens.getAttribute('cx')) - x, Number(lens.getAttribute('cy')) - y) <= viewport.SSd * 0.09;
}

// Re-render ONLY the front stratum at a (fractional) center index, front depth.
// rotating (default) = the empty hollow lens with every node streaming through;
// false = the settled, filled lodestar (used at the end of the springback).
function renderFrontStratumAt(centerIndex, rotating = true) {
  const ch = activeChooser();
  if (!ch) return;
  const items = ch.items();
  const g = renderStratum(strataLayer, stratumOpts(ch, items, centerIndex, rotating));
  if (g) setStratumVisual(g, 1, 0, 1); // front plane: sharp, in place
  if (rotating && ch !== BASEMENT) previewFromLens(ch, items, centerIndex);
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
        // THE LENS KEEPS (O-126): in the basement, a tap on the lens itself
        // keeps the seat under it, or drops a kept one — the one gesture the
        // basement adds, on the one control that means "here".
        else if (ch === BASEMENT && items.length && lensHit(event, ch)) toggleKeep(items[target]);
      }
      if (!items.length) return;   // an empty basement: nothing to settle
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
// ONE GEOMETRY THE WHOLE WAY (O-126, Howell's phone check 2026-09-14). A
// plane behind the film plane recedes by a scale about the viewport centre —
// every point on it moves on a radial course from the centre. A plane
// arriving from, or leaving to, "behind the user's head" used to TRAVEL
// instead: a translate along a fixed diagonal (Howell 2026-07-21 — the
// entering plane then started a hair past 100% and a scale read "as a pop").
// Two transforms, so at 100% the course broke; he tracked the Secondary's
// magnifier: "approximately 265 degrees (almost due West)... As soon as the
// Secondary Stratum passes through its 100% scale... its course suddenly
// shifts to approximately 215 degrees." A truck keeps ONE geometry: past the
// film plane the plane goes on scaling about the same centre, out past the
// frame, and fades only at the end of its flight; entering, the reverse. The
// diagonal slide is retired, and its two constants with it.
// Where a plane is "behind the head". 2.6x cleared the ring and its nodes but
// not the magnified LABEL, which runs from the lens back toward the centre —
// a scale about the centre moves a point in proportion to its distance from
// it, so the label's inner end, a hand's breadth from the centre, was still
// in the frame at 2.6x (Howell's screenshots, 2026-09-14: "text that does not
// have enough time to get out of the way"). At 6x anything more than a sixth
// of a half-viewport from the centre is off it; the scrub sets the pace.
const EXIT_SCALE = 6;
const lerp = (a, b, t) => a + (b - a) * t;
const easeInOut = t => (t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2);
let strataAnim = null;

// Each plane's settled visual for a given front (level < 0 ⇒ off-stack, hidden).
function layerStates(front) {
  const below = front < 0;   // the basement is front: the primary is GONE, not receded (O-126)
  const states = { __primary: below
    ? PRIMARY_GONE()
    : { scale: STRATA_DEPTHS[front], blur: STRATA_BLURS[front], opacity: 1, offsetX: 0, offsetY: 0 } };
  // The basement's ring arrives and leaves exactly as a chooser's does — the
  // diagonal travel transitionStrata gives an entering or leaving plane.
  states[BASEMENT.id] = { scale: 1, blur: 0, opacity: below ? 1 : 0, offsetX: 0, offsetY: 0 };
  CHOOSERS.forEach((ch, ci) => {
    const level = front - (ci + 1);
    states[ch.id] = level >= 0
      ? { scale: STRATA_DEPTHS[level], blur: STRATA_BLURS[level], opacity: 1, offsetX: 0, offsetY: 0 }
      : { scale: 1, blur: 0, opacity: 0, offsetX: 0, offsetY: 0 };
  });
  return states;
}

// A GLIDE BETWEEN TWO FLOORS, driven by whoever holds it (O-126, Howell's
// phone check 2026-09-14: "ideally the slider would be interactive. The
// animation would be tied to the slider's position, and only settle upon
// release. The user should be able to hold the slider between strata and see
// the animation pause"). `beginGlide` renders every plane present at either
// end and returns `frameAt(e)` — e in [0, 1] from the departing floor to the
// arriving one — and `settle()`. A TAP drives it on a clock (transitionStrata
// below); the SLIDER drives it from the thumb's position and settles on
// release. Nothing about the state (strataFront, the funnel, the basement
// visit) changes inside a glide; that is the caller's, at the settle.
function beginGlide(fromFront, toFront) {
  if (strataAnim) { strataAnim.cancel(); strataAnim = null; }
  // A truck begun while a chooser ring is mid-turn (a second finger, or a
  // springback still gliding) must not leave that turn dangling: its drag,
  // its snap and its uncommitted PREVIEW are dropped here, so the floors
  // render from committed state and no preview edition outlives the ring it
  // was previewed on.
  if (strataSnap) { cancelAnimationFrame(strataSnap); strataSnap = null; }
  strataDrag = null;
  strataPreview = null;
  lastPreviewKey = null;
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
    // Past the film plane the plane keeps scaling about the same centre — the
    // course the magnifier was already on — until it is off the frame. NO
    // DISSOLVE (Howell, phone check 2026-09-14: "There should be no change in
    // the opacity of these two strata. The visual elements of these strata
    // should migrate off screen with no transparency"): it leaves whole, and
    // the settle prunes it once it is gone.
    if (!inFrom && inTo) from[ch.id] = { ...to[ch.id], scale: EXIT_SCALE, opacity: 1 };
    if (inFrom && !inTo) to[ch.id] = { ...from[ch.id], scale: EXIT_SCALE, opacity: 1 };
  });
  // THE BASEMENT'S RING (O-126): the reader trucks IN through the main floor
  // to reach it, so it comes up from the distance the way a chooser does and
  // goes back down the same way; rendered only when one end is the basement.
  if (fromFront < 0 || toFront < 0) {
    strataBelow(true);   // under the floor for the whole flight, either way
    const items = BASEMENT.items();
    groups[BASEMENT.id] = renderStratum(strataLayer, stratumOpts(BASEMENT, items, Math.max(0, items.indexOf(BASEMENT.selected()))));
    const far = { scale: STRATA_DEPTHS[STRATA_DEPTHS.length - 1], blur: STRATA_BLURS[STRATA_BLURS.length - 1], opacity: 0, offsetX: 0, offsetY: 0 };
    if (fromFront >= 0 && toFront < 0) from[BASEMENT.id] = far;
    if (fromFront < 0 && toFront >= 0) to[BASEMENT.id] = far;
  } else hideStratum(strataLayer, BASEMENT.id);

  // Populate the primary's tangent chain for the DESTINATION now, so the links
  // are already there as it recedes (static re-render, off the per-frame path).
  if (currentApp && typeof currentApp.setTangentFill === 'function') {
    currentApp.setTangentFill(STRATA_TANGENT_SPANS[toFront] || 0);
  }

  // A plane's opacity across its flight: whole for most of the way, gone only
  // at the end; and arriving, present once it is well inside the frame. A
  // plane that is visible at both ends simply stays whole.
  const fadeAt = (f, t, e) => (f > 0.5 && t < 0.5 ? 1 - Math.max(0, (e - 0.6) / 0.4)
    : f < 0.5 && t > 0.5 ? Math.min(1, e / 0.4)
    : lerp(f, t, e));
  const glide = {
    e: 0,
    // Hold each plane's STARTING blur through the motion — a receded plane must
    // never sharpen (Howell 2026-07-21); a front plane holds 0 and recedes
    // sharp as before. Constant radius = the blurred layer renders once, only
    // the scale moves. Blur snaps to its destination on settle (renderStack).
    // A primary going DOWN to the basement wears the far blur as it goes: it
    // is leaving, and nothing waits to see it sharp again.
    frameAt(e) {
      glide.e = e;
      // THE FLOOR IS THIN (Howell, phone check 2026-09-14): the Detail Sector's
      // colour and text fill the screen, so the primary must dissolve on the
      // way down — but SHORT, in the last stretch of its flight, "so the user
      // will feel that she has passed through the floor into the basement";
      // and back up through it just as quickly at the start of the ascent.
      const FLOOR = 0.15;
      const primaryOpacity = toFront < 0 ? 1 - Math.max(0, (e - (1 - FLOOR)) / FLOOR)
        : fromFront < 0 ? Math.min(1, e / FLOOR)
        : lerp(from.__primary.opacity, to.__primary.opacity, e);
      setPrimaryVisual(lerp(from.__primary.scale, to.__primary.scale, e), toFront < 0 ? to.__primary.blur : from.__primary.blur, {
        opacity: primaryOpacity
      });
      [...CHOOSERS, BASEMENT].forEach(ch => {
        const g = groups[ch.id]; if (!g) return;
        const f = from[ch.id], t = to[ch.id];
        setStratumVisual(g, lerp(f.scale, t.scale, e), f.blur, fadeAt(f.opacity, t.opacity, e),
          lerp(f.offsetX || 0, t.offsetX || 0, e), lerp(f.offsetY || 0, t.offsetY || 0, e));
      });
    },
    // Final depths + blur for whatever strataFront now says, prune the hidden.
    settle() { strataAnim = null; renderStack(); }
  };
  return glide;
}

// The TAP's driver: the glide on a clock, eased both ways.
function transitionStrata(fromFront, toFront) {
  const glide = beginGlide(fromFront, toFront);
  let raf = 0, start = 0, cancelled = false;
  const frame = now => {
    if (cancelled) return;
    if (!start) start = now;
    const e = easeInOut(Math.min(1, (now - start) / STRATA_TWEEN_MS));
    glide.frameAt(e);
    if (e < 1) { raf = requestAnimationFrame(frame); }
    else glide.settle();
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
const minStrataFront = () => -1;   // the basement (O-126) — one floor below the text
// GO TO A FLOOR (O-126). The slider addresses a stratum directly, in either
// direction; the tap still cycles inward through this. Returns whether
// anything moved.
function goToStratum(to) {
  if (!dimensionAvailable()) return false;
  to = Math.max(minStrataFront(), Math.min(maxStrataFront(), Math.round(to)));
  const from = strataFront;
  if (from === to) return false;
  if (to < 0) enterBasement();          // the descent carries the verse
  if (from < 0) jumpToChosen();         // the ascent finds the floor already at the seat
  strataFront = to;
  transitionStrata(from, to);
  arriveAt(from, to);
  return true;
}
// WHAT ARRIVING AT A FLOOR CHANGES, beyond the picture — shared by the tap's
// timed glide and the slider's settle.
function arriveAt(from, to) {
  // Arriving at the text re-reads the position filter (O-72) for the planes
  // above it. Done AFTER the transition is kicked off, never before: the
  // departing planes render their nodes one last time inside the glide, and
  // a ring that loses a node while it is gliding away flickers (O-77).
  if (to === 0) refreshEditionsHere();
  if (from < 0) leaveBasement();        // back up — to the bookmark under the lens, if one
  // THE GLOBE NO LONGER TURNS WITH THE MIGRATION (Howell, phone check
  // 2026-09-14): "That was useful when the input was a tap, but the slider
  // is its own visual feedback." The turn used to ride here, synced to the
  // strata tween. Its other occasion — the hello when the globe ARRIVES at a
  // leaf (updateDimensionButton) — is untouched.
  if (dimensionButton) dimensionButton.setAttribute('aria-pressed', String(isStrataOpen()));
  placeThumb();
}
// THE TAP'S ROUND (Howell, 2026-09-14): languages, editions, the text, the
// basement, and round to the languages — one floor down per tap, the
// basement included, the wrap from the bottom back to the top.
function cycleStrata() {
  goToStratum(strataFront <= minStrataFront() ? maxStrataFront() : strataFront - 1);
}
function resetStrata() {
  if (strataAnim) { strataAnim.cancel(); strataAnim = null; }
  strataFront = 0;
  basementArrival = null; basementLens = null; basementLoose = [];
  CHOOSERS.forEach(ch => hideStratum(strataLayer, ch.id));
  hideStratum(strataLayer, BASEMENT.id);
  renderStack();
  placeThumb();
}
// The globe shows only where a dimension EXISTS and the reader stands at one
// of the two language-question moments (Howell 2026-07-27): a LEAF (detail
// sector open — "what did the original say?") or the volume's FRONT DOOR
// (the adapter-declared threshold item magnified — "give me this book in my
// tongue"). Between the two — drilling down or backing out — it is clutter
// and hides; any open stack recedes back to the primary. A volume boot
// (including a gateway transit) resets the stack. The door is declared by
// the adapter, so the host stays volume-agnostic. (The front-door predicate
// of O-96 is retired under O-129: the globe is at every level.)
// WHICH EDITIONS HOLD WHERE THE READER IS STANDING — the adapter's answer,
// bound per volume (H-29's carry-out, Howell 2026-08-19). A volume whose
// adapter does not answer returns null, and null means "no restriction"
// rather than "nothing" — the host never learns which volumes those are, and
// the suite forbids it naming one.
let editionsHoldingItem = () => null;
let seatAtLeaf = () => false;   // O-129: the adapter seats the primary at a leaf the ring up does not hold
let seatOrder = () => null;     // O-128: where a seat stands, for the basement's order
let hitSeats = () => [];        // O-135: the Greatest Hits, seated in the edition up
let editionSettlePromise = Promise.resolve();   // the last edition change's reseat, for whoever must follow it
// WHICH EMBLEM BELONGS WHERE THE READER IS STANDING (H-31), the adapter's
// answer, bound per volume. Null from a volume that declares none.
let cornerImageAt = () => null;
// AND WHICH COLOUR IS UNDER IT (O-79). Same signal, same shape: null from a
// volume declaring none, and null leaves the volume's own detail-sector
// colour in place rather than blanking the badge.
let cornerColorAt = () => null;
// (The launch funnel and its O-75/O-77 flag lived here until O-143 retired them.)
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

// Which chapter? The mark asks at chapter grain since W-231, and the answer
// is null whenever the reader is above a chapter — a book ring, a testament
// ring, the root — so the question falls back to the book, then the edition.
function currentChapterId() {
  return chapterIdOf(currentApp?.nav?.getCurrent?.());
}

function updateIncompleteMark() {
  if (typeof document === 'undefined') return;
  let show = false;
  try {
    const active = dimensionStore.getState().edition || null;
    const volume = currentManifest?.__wallVolume;

    // UN-GATED FROM THE FLAG, BY RULING THIS TIME (O-124, Howell 2026-09-01).
    // It was un-gated once before, on 2026-08-15, and that was an error made
    // from a design he had not ruled: unconfirmed books were UNREACHABLE off
    // the flag, so there was nothing on screen to caveat and the banner would
    // have shamed a reader looking at confirmed text only. Both halves of
    // that are now reversed by his word — unconfirmed material is reachable,
    // marked, and the mark tells the truth at chapter grain (W-231). So the
    // mark shows wherever what is in hand is not confirmed, on any network.
    //
    // ONLY FOR A VOLUME THAT CAN ANSWER AT THE FINER GRAIN. A volume without
    // `isNodeConfirmed` keeps the old flag-gated path below, unchanged: this
    // ruling was made about one volume and must not surprise the others.
    if (typeof volume?.isNodeConfirmed === 'function') {
      show = Boolean(active)
        && !volume.isNodeConfirmed(active, { bookId: currentBookId(), chapterId: currentChapterId() });
    } else if (dimensionBridge.completeOverrideActive()) {
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
    document.documentElement.classList.remove('incomplete-mark-showing');
    return;
  }
  if (!incompleteMarkEl) {
    incompleteMarkEl = document.createElement('div');
    incompleteMarkEl.id = 'incomplete-mark';
    incompleteMarkEl.textContent = 'NOT PROOFREAD';
    document.body.appendChild(incompleteMarkEl);
  }
  incompleteMarkEl.style.display = '';
  // The mark took the copyright's band (O-103); the notice stands down while
  // it is there, because an opaque band covers the notice's first line only
  // and the notice wraps to two on a phone.
  document.documentElement.classList.add('incomplete-mark-showing');
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

// THE READER'S POSITION, PUSHED TO THE CHOOSER (H-29's carry-out).
//
// It rides `updateDimensionButton` because that is the ONE function already
// called on every change of position — the nav change, the detail-sector
// change, the boot, the gateway arrival — and a second subscription to the
// same events is a second thing to keep in step. It runs before the FROZEN
// guard, because the answer must be current even on the frames where the
// button is held mid-wipe or hidden — the strata read it when they open, not
// when it was last computed. It runs after the no-button guard, because a
// page with no globe has no chooser to filter.
// THE CORNER FOLLOWS THE READER (H-31). Howell's report was that the Torah
// scroll never became a crown of thorns for the New Testament, and half of
// that was here: `index.js` painted the emblem ONCE at boot and no code path
// repainted it, so even correct data could not have shown.
//
// It rides the same signals as the NOT PROOFREAD badge and the section label,
// for the same reason H-26 gives: only a change of BOOK can change the answer
// within an edition, and an edition change can change it outright. The swap
// itself is a no-op when the name is unchanged, so calling it freely is cheap.
function updateCornerImage() {
  try {
    const at = currentApp?.nav?.getCurrent?.();
    const name = cornerImageAt(at);
    // null = this volume declares no emblems, so leave its own corner alone.
    // '' = the volume was ASKED and this edition has none, so CLEAR it —
    // otherwise the badge keeps another edition's mark, which is what put a
    // Torah scroll over Swete's Greek (2026-08-24).
    if (name) currentApp?.setCornerImage?.(name);
    else if (name === '') currentApp?.setCornerImage?.('');
    // THE CIRCLE TRAVELS WITH THE EMBLEM (O-79), in the same call rather than
    // on a signal of its own: they are one badge, and two subscriptions to
    // the same event are two things to keep in step. Set second, so a volume
    // that answers the image and throws on the colour still repaints the art.
    const color = cornerColorAt(at);
    if (color) currentApp?.setCornerColor?.(color);
  } catch (_) { /* a volume that cannot answer keeps whatever it painted */ }
}

function refreshEditionsHere() {
  let codes = null;
  try { codes = editionsHoldingItem(currentApp?.nav?.getCurrent?.()); } catch (_) { codes = null; }
  dimensionBridge.setEditionsHere(codes);
}

function updateDimensionButton() {
  if (!dimensionButton) return;
  refreshEditionsHere();
  if (cornerIconHold) return; // frozen mid-wipe: the icon is part of the image
  // AT EVERY LEVEL (O-129, Howell 2026-09-14: "Proceed to make the Dimension
  // Button visible and functioning at every level"). O-96's two homes — root
  // and the leaf, the rings between them "clutter" — were ruled for a tap
  // that opened a chooser. The slider is a readout whose position is the
  // stratum, the basement is the reader's own tool and wanted most when
  // NOT at a verse, and the edition question has an answer at every level
  // (editionsHoldingItem answers by book off a verse). So: wherever the
  // volume has a dimension, the globe is there.
  const show = dimensionAvailable();
  const arriving = show && dimensionButton.hidden;
  dimensionButton.hidden = !show;
  if (show) placeThumb();   // measured while visible (O-126)
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
// THE LAUNCH FUNNEL IS RETIRED (O-143, Howell 2026-09-15: "The app should
// always boot to the primary stratum."). Every launch used to open on the
// language plane and walk the reader in — ruling 2 of 2026-07-30, "two quick
// taps" — before the globe stood at every level (O-129) and became a slider
// (O-126). Now the reader lands on the text, in the remembered edition or the
// volume's default, and the tongue is a truck away at any moment. The
// funnel's two workarounds went with it: the unfiltered launch plane (O-75)
// and the arrival that closed it (O-77) — the position filter (O-72) is
// simply on from the first frame, as it is everywhere else.
// ── THE GLOBE IS A SLIDER (O-126, Howell 2026-09-14) ───────────────────────
// "The dimension button has always been a little awkward, tapping to
// traverse the different strata. I'd rather make it a slider." Its vertical
// position IS the stratum: home is the text; one notch up the editions, two
// the languages; one notch DOWN the basement. Dragging it crosses the notches
// live — each crossing is the same transition a tap made — and the release
// snaps to the nearest. A tap (no travel) still cycles inward. (Ghost notches at the resting places
// were drawn in the first cut and struck on his phone check the same day:
// "We don't need the ghost rings.")
// THE TRAVEL (Howell, phone check 2026-09-14: "50% longer. Since it can't go
// any lower... it will have to go higher. The four stops should remain
// equidistant" — then, tried: "Split the difference. Make it 25% longer than
// it was before."). The stops are 1.5625 button heights apart (was 1.25);
// the LOWEST stop, the basement, keeps its old place 1.25 heights below the
// globe's CSS rest position, so every stop above it — the text included —
// sits higher than before. The thumb's offset is measured from that rest.
const NOTCH_RATIO = 1.5625;  // stop spacing, in button heights
const BASEMENT_DROP = 1.25;  // the LOWEST point of travel, in button heights below the CSS rest
// THE OVERRUN (O-128, Howell 2026-09-14): below the basement stop the thumb
// can be pulled half a stop further against a spring — the Focus Ring's own
// springback feel — and HELD there to bookmark (below). The travel shifted
// up by the overrun so its lowest point stays where it was.
const SLIDER_OVERRUN = 0.5;  // stops, below the basement stop
const OVERRUN_GIVE = 0.5;    // the spring: the thumb moves this fraction of the finger's travel past the stop
let slide = null;           // { startY, startFront, lastY, moved }
let suppressClick = false;  // a drag's release must not also count as a tap
const buttonPx = () => ((typeof dimensionButton?.getBoundingClientRect === 'function' ? dimensionButton.getBoundingClientRect().height : 0) || 64);
const notchPx = () => buttonPx() * NOTCH_RATIO;
// How far ABOVE the CSS rest the thumb sits at floor position p (fractional while held).
const thumbRise = p => (p - minStrataFront() + SLIDER_OVERRUN) * notchPx() - BASEMENT_DROP * buttonPx();
function placeThumb() {
  if (!dimensionButton || slide) return;   // a held thumb follows the finger, not the state
  try { dimensionButton.style.setProperty('--thumb-y', `${(-thumbRise(strataFront)).toFixed(1)}px`); } catch (_) { /* stub DOM */ }
}
// THE SCRUB (Howell, phone check 2026-09-14). While the thumb is held, the
// glide between the two floors it sits between is driven by its position:
// e = how far along the segment the thumb is. Held still between floors, the
// picture holds still. Nothing commits until release, which settles to the
// nearer floor over the time that part of the tween would have taken. Drag
// across a whole floor without stopping and the segment behind is committed
// as the next one begins.
let scrub = null;   // { from, to, glide } — the segment the thumb is inside
const SCRUB_MAX_SEGMENTS = 6;   // a bound on one move event's crossings
// ONE STROKE, ONE SIDE OF THE TEXT (O-147, Howell 2026-09-16): "it is not
// possible or should not be possible to slide in one stroke from the
// basement to the secondary stratum." The reader slides up to change a
// language or an edition, or down to keep or recall a bookmark, "and in each
// case, after having made their change, the user only wants to return to
// the primary stratum and read a verse." So a stroke is bound to the side of
// the text it starts on: begun above, it travels between the text and the
// languages; begun in the basement, between the basement and the text;
// begun AT the text, its first movement chooses the side. The text is the
// stop in both directions. Cleared at release.
let strokeSide = 0;   // +1 above the text, -1 below it, 0 not yet chosen
function strokeBounds(p) {
  if (!strokeSide) {
    const origin = scrub ? scrub.from + scrub.glide.e * (scrub.to - scrub.from) : strataFront;
    if (origin > 0.001) strokeSide = 1;
    else if (origin < -0.001) strokeSide = -1;
    else if (p > 0.001) strokeSide = 1;
    else if (p < -0.001) strokeSide = -1;
  }
  if (strokeSide > 0) return { lo: 0, hi: maxStrataFront() };
  if (strokeSide < 0) return { lo: minStrataFront(), hi: 0 };
  return { lo: 0, hi: 0 };
}
function beginSegment(from, to) {
  if (to < 0) enterBasement();          // the ring must know what the reader brings down
  if (from < 0) jumpToChosen();         // unseen: the floor is invisible at e = 0
  scrub = { from, to, glide: beginGlide(from, to) };
  strataAnim = { cancel: () => { scrub = null; } };
}
// End the segment the thumb is inside: at its far floor (commit) or back at
// its near one (revert — nothing changed, and a basement visit begun for the
// picture is unbegun).
function endSegment(commit) {
  if (!scrub) return;
  const { from, to, glide } = scrub;
  scrub = null;
  if (commit) {
    glide.frameAt(1);
    strataFront = to;
    glide.settle();
    arriveAt(from, to);
  } else {
    glide.frameAt(0);
    if (to < 0) { basementArrival = null; basementLens = null; basementLoose = []; }
    glide.settle();
  }
}
function scrubTo(p) {
  const { lo, hi } = strokeBounds(p);
  p = Math.max(lo, Math.min(hi, p));
  for (let n = 0; n < SCRUB_MAX_SEGMENTS; n += 1) {
    if (!scrub) {
      const target = p > strataFront + 0.001 ? strataFront + 1 : p < strataFront - 0.001 ? strataFront - 1 : null;
      if (target === null || target < minStrataFront() || target > maxStrataFront()) return;
      beginSegment(strataFront, target);
    }
    const { from, to, glide } = scrub;
    const e = (p - from) / (to - from);
    if (e >= 1) { endSegment(true); continue; }
    if (e <= 0) { endSegment(false); continue; }
    glide.frameAt(e);
    return;
  }
}
let scrubSettle = null;   // rAF of a settle in flight
function releaseScrub() {
  strokeSide = 0;   // the stroke is over; the next one chooses its own side
  if (!scrub) return;
  const { glide } = scrub;
  const commit = glide.e >= 0.5;
  const target = commit ? 1 : 0;
  const startE = glide.e, span = Math.abs(target - startE);
  if (span < 0.001) { endSegment(commit); return; }
  let start = 0;
  const step = now => {
    if (!start) start = now;
    const t = Math.min(1, (now - start) / (STRATA_TWEEN_MS * span));
    const k = 1 - Math.pow(1 - t, 3);   // easeOutCubic — the settle of a released thing
    glide.frameAt(startE + (target - startE) * k);
    if (t < 1) { scrubSettle = requestAnimationFrame(step); }
    else { scrubSettle = null; endSegment(commit); }
  };
  scrubSettle = requestAnimationFrame(step);
}
// ── HOLD TO BOOKMARK (O-128, Howell 2026-09-14) ─────────────────────────────
// "The user must hold the button in the extreme position longer to bookmark
// the verse. A quick pull down of the button to the bottom only takes the
// user to the basement without bookmarking." While the thumb is held in the
// overrun with the basement front and a verse in hand (the provisional seat
// under the lens), the volume's phrase shows beside the globe and the seat
// FILLS as the hold runs — the filling is the progress — and at HOLD_MS it
// is kept. Let go sooner and nothing happened: the seat empties, the phrase
// goes, the thumb springs back. The phrase is the VOLUME's, in the reader's
// tongue (display_config.bookmark_prompt): the engine has no word for what a
// leaf is called. From the front door there is no verse in hand, so the
// overrun is only a spring.
const HOLD_MS = 1100;
const HOLD_DEPTH = 0.15;   // stops into the overrun before the hold is a hold
let hold = null;           // { id, start, timer, raf } while the thumb is held in the overrun
const bookmarkHint = (() => {
  if (!dimensionButton || typeof document === 'undefined') return null;
  try {
    const h = document.createElement('div');
    h.id = 'bookmark-hint';
    h.setAttribute('aria-live', 'polite');
    dimensionButton.parentNode?.insertBefore?.(h, dimensionButton);
    return h;
  } catch (_) { return null; }
})();
const bookmarkPhrase = () => {
  const lang = dimensionBridge.getSelection()?.language || null;
  const p = bookmarkPrompt;
  if (!p) return '';
  if (typeof p === 'string') return p;
  return p[lang] || p.default || '';
};
function showHint(text) {
  if (!bookmarkHint?.classList) return;
  bookmarkHint.textContent = text;
  if (typeof dimensionButton.getBoundingClientRect === 'function') {
    const r = dimensionButton.getBoundingClientRect();
    bookmarkHint.style.top = `${(r.top + r.height / 2).toFixed(0)}px`;
    bookmarkHint.style.right = `${(window.innerWidth - r.left + 12).toFixed(0)}px`;
  }
  bookmarkHint.classList.toggle('is-showing', Boolean(text));
}
function hideHint() { if (bookmarkHint?.classList) bookmarkHint.classList.remove('is-showing'); }
// The provisional seat under the lens fills with the hold.
function fillProvisional(f) {
  const lens = strataLayer?.querySelector?.('#basement .secondary-strata-node.is-magnified.is-provisional');
  if (!lens) return;
  lens.style.fill = f > 0 ? 'var(--color-orbital)' : '';
  lens.style.fillOpacity = f > 0 ? String(f) : '';
}
function holdBegin() {
  if (hold || strataFront !== -1 || scrub || !basementArrival) return;
  const { key, id, edition } = basementArrival;
  if (isBookmarked(currentVolumeId, id, edition)) return;
  if (BASEMENT.selected() !== key) return;   // the hold keeps the seat UNDER THE LENS, and that is the arrival
  hold = { key, id, edition, start: (typeof performance !== 'undefined' ? performance.now() : Date.now()), timer: setTimeout(() => holdKeep(), HOLD_MS), raf: 0 };
  showHint(bookmarkPhrase());
  const tick = () => {
    if (!hold) return;
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    fillProvisional(Math.min(1, (now - hold.start) / HOLD_MS));
    hold.raf = requestAnimationFrame(tick);
  };
  hold.raf = requestAnimationFrame(tick);
}
function holdCancel() {
  if (!hold) return;
  clearTimeout(hold.timer);
  cancelAnimationFrame(hold.raf);
  hold = null;
  hideHint();
  fillProvisional(0);
}
function holdKeep() {
  if (!hold) return;
  const { key, id, edition } = hold;
  cancelAnimationFrame(hold.raf);
  hold = null;
  hideHint();
  keepBookmark(currentVolumeId, { id, label: BASEMENT.label(key), edition, at: basementPlaces[key] ?? basementArrival?.at ?? null });
  basementLens = key;
  renderStack();   // the seat is drawn kept: filled, for good
}

if (dimensionButton) {
  dimensionButton.addEventListener('pointerdown', event => {
    if (!dimensionAvailable()) return;
    if (strataAnim && !scrub) return;   // a tap's own glide is running: let it land
    if (scrubSettle) { cancelAnimationFrame(scrubSettle); scrubSettle = null; }   // caught mid-settle: the thumb takes over
    // Where the thumb stands now, as a floor position — mid-segment if caught.
    const here = scrub ? scrub.from + scrub.glide.e * (scrub.to - scrub.from) : strataFront;
    slide = { startY: event.clientY, lastY: event.clientY, startFront: here, moved: false };
    try { dimensionButton.setPointerCapture(event.pointerId); } catch (_) { /* unsupported */ }
  });
  dimensionButton.addEventListener('pointermove', event => {
    if (!slide) return;
    slide.lastY = event.clientY;
    const dy = slide.startY - event.clientY;   // up is positive: toward the languages
    if (!slide.moved) {
      if (Math.abs(dy) <= STRATA_TAP_SLOP) return;
      slide.moved = true;
      dimensionButton.classList.add('is-sliding');
    }
    const raw = slide.startFront + dy / notchPx();
    const min = minStrataFront();
    // The stroke's side (O-147): the thumb stops at the text coming back
    // from either side, and only a stroke on the basement's side reaches the
    // overrun below it.
    const { lo, hi } = strokeBounds(raw);
    if (lo > min && raw < lo) {
      dimensionButton.style.setProperty('--thumb-y', `${(-thumbRise(lo)).toFixed(1)}px`);
      holdCancel();
      scrubTo(lo);
      return;
    }
    if (raw < min && lo === min) {
      // Into the overrun: the thumb follows against the spring, the floors do
      // not go below the basement, and a deep enough hold is a hold.
      const over = Math.min(SLIDER_OVERRUN, (min - raw) * OVERRUN_GIVE);
      dimensionButton.style.setProperty('--thumb-y', `${(-thumbRise(min - over)).toFixed(1)}px`);
      scrubTo(min);
      if (over >= HOLD_DEPTH) holdBegin(); else holdCancel();
      return;
    }
    holdCancel();
    const p = Math.max(lo, Math.min(hi, raw));
    dimensionButton.style.setProperty('--thumb-y', `${(-thumbRise(p)).toFixed(1)}px`);
    scrubTo(p);
  });
  const release = () => {
    if (!slide) return;
    const { moved } = slide;
    slide = null;
    dimensionButton.classList.remove('is-sliding');
    if (moved) suppressClick = true;
    holdCancel();     // a hold that has not reached HOLD_MS is nothing
    releaseScrub();   // clears the stroke's side too (O-147)
    strokeSide = 0;
    placeThumb();     // the springback from the overrun rides the thumb's transition
  };
  ['pointerup', 'pointercancel'].forEach(type => dimensionButton.addEventListener(type, release));
  dimensionButton.addEventListener('click', () => {
    if (suppressClick) { suppressClick = false; return; }
    cycleStrata();
  });
}

// THE PROOFREADER'S SHORTCUT (O-123, Howell 2026-08-31: "I want you to cheat,
// just for the sake of proofreading... count nodes between the origin verse
// and the destination verse and then rotate the Focus Ring by that number of
// nodes. Like I said, it's cheating, no human could do that").
//
// It is cheating, and that is the point: a driven proofreading pass needs to
// stand at one verse and be at another a second later, where a reader needs
// the journey. What it does NOT do is fake the arrival — it makes the ring's
// own journey, the same call a tap makes, so everything a reader would meet
// on landing happens: the settle, the eclipse decision, the margin fetch, the
// corner emblem, the repaint. That matters more than the speed: several of
// this month's bugs lived in the ARRIVAL, and a shortcut that skipped it
// would proofread a screen no reader ever sees.
//
// Gated on the LAN proofread override, so it does not exist for a reader.
if (typeof window !== 'undefined' && proofreadOverrideActive()) {
  window.__wheelProofread = {
    /** How many seats the ring holds. */
    count: () => currentApp?.nav?.items?.length ?? 0,
    /** Where the ring stands: index, seat id, and how far to a named seat. */
    where: () => {
      const nav = currentApp?.nav;
      const i = nav?.getCurrentIndex?.() ?? -1;
      return { index: i, id: nav?.items?.[i]?.id ?? null, total: nav?.items?.length ?? 0 };
    },
    /** The index of a seat named the way the chain names it. */
    indexOf: id => currentApp?.nav?.items?.findIndex(it => it?.id === id) ?? -1,
    /**
     * Travel to a seat and report what happened. Returns the distance in
     * NODES — which is the thing Howell asked for — or an error string, never
     * a silent no-op: a shortcut that quietly fails would proofread the verse
     * it was already on and call it the next one.
     */
    seek: id => {
      const nav = currentApp?.nav;
      if (!nav?.items?.length) return { ok: false, why: 'no ring' };
      const to = nav.items.findIndex(it => it?.id === id);
      if (to < 0) return { ok: false, why: 'no such seat on this ring', id };
      const from = nav.getCurrentIndex();
      const moved = currentApp.rotateToIndex(to, { durationMs: 220 });
      return { ok: moved !== false, from, to, nodes: to - from, id };
    }
  };
}

if (typeof window !== 'undefined') {
  window.__wheelDimension = {
    get: () => dimensionBridge.getSelection(),
    set: id => dimensionBridge.setTranslation(id) || dimensionBridge.setLanguage(id),
    languages: () => dimensionBridge.languagesAvailable(),
    // Null while the launch funnel is up (O-75), the reader's position after.
    here: () => dimensionBridge.editionsHere(),
    // IS THE LAUNCH FUNNEL STILL UP? (O-77.) Read-only, for the guard that
    // could otherwise only watch its shadow: `here` goes from null to a list
    // when the funnel closes, but null is also what a volume with no answer
    // gives, so the two are worth being able to tell apart from outside.
    // How far the strata have travelled: 0 = the reader is at the text.
    front: () => strataFront,
    cycle: cycleStrata,
    // O-126: the slider's address, and the basement's state.
    slide: goToStratum,
    scrub: scrubTo,
    release: releaseScrub,
    // O-128: the hold in the overrun, and its state.
    holdBegin, holdCancel,
    hold: () => (hold ? { id: hold.id, key: hold.key } : null),
    min: minStrataFront,
    basement: () => ({ arrival: basementArrival, lens: basementLens, items: BASEMENT.items(), kept: bookmarksOf(currentVolumeId).map(b => seatKey(b.id, b.edition)) }),
    keep: toggleKeep
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
  // THE OVERRIDE THAT IS NOT YET READ, and the constraint that will bind it
  // when it is (O-3, recorded 2026-08-23 under W-139's sweep — the entry had
  // no home outside the ledger). When per-volume travel colours are chosen,
  // the engine reads two OPTIONAL data-declared keys that replace the
  // derivation above: `--theme-color-orbital` and
  // `--theme-color-orbital-label`. Nothing declares them today, so the
  // derivation is the whole story and this comment is the contract.
  //
  // THE HARD CONSTRAINT, learned by measurement rather than taste: an orbital
  // value must read on BOTH grounds — the theme background AND the logo disc
  // that search mode dims to. The demo red measured 1.0:1 against the search
  // blue, which is invisible, and that is why the derived band-gray replaced
  // it. A declared override skips the derivation and therefore skips the
  // safety the derivation happens to give: whoever declares one owes the
  // second measurement.
  // THE BAND IS THE DARKER, THE NODES THE LIGHTER (O-166, Howell 2026-09-18:
  // "make the focus ring band the darker color. And all of the nodes, parent
  // button, magnifier, focus ring, child pyramid, make all of these nodes the
  // lighter color, which is the current focus ring band color"). The same
  // pair of shades as before, swapped: the volume's declared band colour is
  // the one colour every node wears, and the band is that colour one step
  // darker — which overrides the band set above, once darkenHex exists.
  root.style.setProperty('--theme-color-orbital', active.band);
  root.style.setProperty('--theme-color-band', darkenHex(active.band, 0.78));
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
const marginPanel = document.getElementById('margin-panel');
const marginMarks = document.getElementById('margin-marks');
// ── THE MARGIN'S OWN STATE, ON THE GLASS (?margin=debug) ────────────────────
// Inert unless asked for. It exists because of how this evening went: three
// separate times a fix was declared done and was not, and each time the only
// way to find out was Howell reloading on a phone and reporting what he saw.
// I could not see the glass and was inferring the machinery's state from a
// photograph of its output, which is how a lens that could not be TAPPED
// looked exactly like a toggle that did not WORK.
//
// So this prints what the machinery BELIEVES, beside what it drew: how many
// screens it thinks this verse needs, which half it is showing, how many notes
// and marks it found. A screenshot of that is a fact rather than an inference.
const MARGIN_DEBUG = (() => {
  try { return new URLSearchParams(location.search).get('margin') === 'debug'; }
  catch { return false; }
})();
let marginDebugEl = null;
function marginDebug(line) {
  if (!MARGIN_DEBUG) return;
  if (!marginDebugEl) {
    marginDebugEl = document.createElement('div');
    marginDebugEl.id = 'margin-debug';
    document.body.appendChild(marginDebugEl);
  }
  marginDebugEl.textContent = line;
}

// Toggle detail panel visibility in sync with the Detail Sector animation.
// The panel fades in after the blue circle has finished expanding,
// and hides immediately when the circle begins collapsing.
// THE TEXT ARRIVES LAST, UNDER THE FINGER (O-159 step three, Howell
// 2026-09-17). On a held drill into a leaf, the verse, its notes and the
// manuscript key used to fade in over 0.35 s only after the drill landed —
// a separate event after the ballet. Their content is drawn at the commit,
// so they now fade in over the last third of the swipe on the scrub's clock,
// as the circle finishes opening; the landing's own "visible" class then
// takes over at full opacity, and a spring-back leaves them hidden.
window.addEventListener('detail-sector-arriving', () => {
  const panels = [detailPanel, marginPanel, marginMarks].filter(Boolean);
  if (!panels.length) return;
  const clear = () => panels.forEach(el => { el.style.transition = ''; el.style.opacity = ''; el.style.willChange = ''; });
  // On their own layer for the flight, so each frame's opacity is composited
  // rather than the whole page of text repainted (O-160).
  panels.forEach(el => { el.style.willChange = 'opacity'; });
  scrubDriver(600, t => {
    const o = Math.max(0, Math.min(1, (t - 2 / 3) * 3));
    panels.forEach(el => { el.style.transition = 'none'; el.style.opacity = String(o); });
  }, {
    onCommit: () => {
      panels.forEach(el => { el.style.opacity = '1'; });
      requestAnimationFrame(() => requestAnimationFrame(clear));
    },
    onAbort: () => {
      panels.forEach(el => { el.style.opacity = '0'; });
      requestAnimationFrame(() => requestAnimationFrame(clear));
    }
  });
});

window.addEventListener('detail-sector-change', (e) => {
  const { visible } = e.detail || {};
  // THE TEXT LEAVES UNDER THE FINGER (O-151 step two, Howell 2026-09-16: "All
  // of the text pops off suddenly soon after the animation begins"). The
  // verse, its notes and the manuscript key are page elements outside the
  // drawing, so the scrub never caught their 0.35 s fade: they left on their
  // own clock at the first frame. When a drill is under a finger they now
  // fade over the first third of the swipe, driven by it, and their classes
  // change only when the drill lands; struck, they are back at full at once.
  //
  // AND IT LEAVES BY MOVING, NOT FADING (O-161, Howell 2026-09-17: fades are
  // "a cheat" against the grammar — everything but the two vessel rings
  // MOVES with the thumb along the drill axis, and all of it in the SAME
  // direction: the ring's nodes flow to the sky, the sky's off screen toward
  // the hub, and the text LEADS them). So the verse, its notes and the key
  // leave as one block toward the hub — off the screen's corner — shrinking
  // as they go, at full ink, and are gone by two-thirds of the swipe, ahead
  // of the nodes. A fade remains only where no hub is known.
  //
  // THE NOTES GO UNDER THE BAND (O-171, Howell 2026-09-19): the verse leaves
  // toward the hub, but the notes and the manuscript key sit on the ground
  // beside the band, like the level's word — so they slide toward the band
  // as a block and vanish under its outer edge, masked away there, clear by
  // three quarters of the swipe. Only the verse text leaves the screen.
  const panels = [detailPanel, marginPanel, marginMarks].filter(Boolean);
  const textPanels = [detailPanel].filter(Boolean);
  const notePanels = [marginPanel, marginMarks].filter(Boolean);
  const hub = e.detail?.hub || null;
  const band = e.detail?.band || null;
  if (!visible && panels.length) {
    const clear = () => panels.forEach(el => { el.style.transition = ''; el.style.opacity = ''; el.style.transform = ''; el.style.willChange = ''; el.style.maskImage = ''; el.style.webkitMaskImage = ''; });
    let leave = null, dive = null;
    if (hub && Number.isFinite(hub.x) && Number.isFinite(hub.y)) {
      const vw = window.innerWidth, vh = window.innerHeight;
      const dx = hub.x - vw / 2, dy = hub.y - vh / 2, len = Math.hypot(dx, dy) || 1;
      const travel = Math.hypot(vw, vh) * 0.9;   // clear of the screen along the hub's line
      leave = { ux: dx / len, uy: dy / len, travel };
      panels.forEach(el => { el.style.willChange = 'transform'; });
      if (band && Number.isFinite(band.radius) && notePanels.length) {
        // The notes' own centre and farthest corner, from the children that
        // hold ink; the outer edge of the band is the line they vanish at.
        const outer = band.radius + (band.width || 0) / 2;
        let cx = 0, cy = 0, n = 0, far = 0;
        notePanels.forEach(el => [...el.children].forEach(ch => {
          const r = ch.getBoundingClientRect();
          if (!r.width || !r.height) return;
          cx += r.left + r.width / 2; cy += r.top + r.height / 2; n += 1;
          [[r.left, r.top], [r.right, r.top], [r.left, r.bottom], [r.right, r.bottom]].forEach(([x, y]) => { far = Math.max(far, Math.hypot(x - hub.x, y - hub.y)); });
        }));
        if (n) {
          cx /= n; cy /= n;
          const ddx = hub.x - cx, ddy = hub.y - cy, dl = Math.hypot(ddx, ddy) || 1;
          dive = { ux: ddx / dl, uy: ddy / dl, travel: Math.max(0, far - outer) + (band.width || 0) + 8 };
          const mask = `radial-gradient(circle at ${hub.x}px ${hub.y}px, transparent ${outer}px, #000 ${outer + 0.5}px)`;
          notePanels.forEach(el => { el.style.maskImage = mask; el.style.webkitMaskImage = mask; });
        }
      }
    }
    const scrubbed = scrubDriver(600, t => {
      if (leave) {
        // PACED WITH THE CIRCLE (Howell: at two-thirds it was "way too fast" —
        // gone while the circle had shrunk a fifth). It gathers speed as it
        // goes, so it stays with the circle through the first half and leads
        // the nodes off only at the end.
        const p = Math.pow(t, 1.5);
        const k = 1 - 0.6 * p;
        textPanels.forEach(el => { el.style.transition = 'none'; el.style.transform = `translate(${(leave.ux * leave.travel * p).toFixed(1)}px, ${(leave.uy * leave.travel * p).toFixed(1)}px) scale(${k.toFixed(3)})`; });
        if (dive) {
          const q = Math.min(1, t / 0.75);
          notePanels.forEach(el => { el.style.transition = 'none'; el.style.transform = `translate(${(dive.ux * dive.travel * q).toFixed(1)}px, ${(dive.uy * dive.travel * q).toFixed(1)}px)`; });
        } else {
          notePanels.forEach(el => { el.style.transition = 'none'; el.style.transform = `translate(${(leave.ux * leave.travel * p).toFixed(1)}px, ${(leave.uy * leave.travel * p).toFixed(1)}px) scale(${k.toFixed(3)})`; });
        }
      } else {
        const o = Math.max(0, 1 - t * 3);
        panels.forEach(el => { el.style.transition = 'none'; el.style.opacity = String(o); });
      }
    }, {
      onCommit: () => {
        if (detailPanel) detailPanel.classList.remove('detail-panel--visible');
        if (marginPanel) marginPanel.classList.remove('margin-panel--visible');
        if (marginMarks) marginMarks.classList.remove('margin-marks--visible');
        panels.forEach(el => { el.style.opacity = '0'; });
        requestAnimationFrame(() => requestAnimationFrame(clear));
      },
      onAbort: () => {
        panels.forEach(el => { el.style.opacity = '1'; el.style.transform = ''; el.style.maskImage = ''; el.style.webkitMaskImage = ''; });
        requestAnimationFrame(() => requestAnimationFrame(clear));
      }
    });
    if (scrubbed) {
      detailSectorVisible = false;
      updateDimensionButton();
      updateSearchButton();
      return;
    }
  }
  if (detailPanel) {
    detailPanel.classList.toggle('detail-panel--visible', Boolean(visible));
  }
  // The margin follows the sector it sits beside: it appears when the reader
  // is at a leaf and goes when they leave. It is NOT a second panel with its
  // own life — a note belongs to a verse, and there is no verse above a leaf.
  if (marginPanel) {
    marginPanel.classList.toggle('margin-panel--visible', Boolean(visible));
  }
  if (marginMarks) {
    marginMarks.classList.toggle('margin-marks--visible', Boolean(visible));
  }
  // The dimension button follows the sill: present at a leaf, gone over a
  // child pyramid (which also recedes any open stack back to the primary).
  detailSectorVisible = Boolean(visible);
  updateDimensionButton();
  updateSearchButton();
});

let detailRenderSeq = 0; // stale-verify guard: each render invalidates pending checks
function renderDetail(selected, adapterInstance, manifest, adapterNormalized, { translation, wrapAttempt = 0, part } = {}) {
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
    // O-112: a poem verse carries its metrical lines, sliced from the seated
    // text at the side-file's offsets. Cache-only here - an unfetched poem
    // reads as prose until the arrival reflex repaints, the margin's pattern.
    const pv = currentManifest?.__wallVolume;
    const offs = pv?.poemAtSync?.(selected?.meta?.externalFile, translation, selected?.meta?.verseKey);
    if (Array.isArray(offs) && offs.length > 1 && typeof payload.text === 'string') {
      const txt = payload.text;
      payload.poemLines = offs.map((o, i) => txt.slice(o, i + 1 < offs.length ? offs[i + 1] : txt.length).trim()).filter(Boolean);
    }
    // O-84: which half of a split verse to show. An explicit part rides a
    // preview (the reading tap paints ahead of the ring); otherwise the
    // settled half is the ring's own state, so text and eclipse agree.
    payload.part = Number.isFinite(part) ? part : (currentApp?.getVersePart?.() ?? 0);
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
  const arcBounds = computeDetailSectorBounds(vpm.width, vpm.height, null, copyrightBottomPx());
  const panelRect = detailPanel.getBoundingClientRect();
  const renderBounds = { ...arcBounds, width: panelRect.width, height: panelRect.height };


  window.__wheelVerseBounds = renderBounds; // probe's verse-wrap autopsy reads this (?probe=1)
  const node = plugin.render(payload, renderBounds, { createElement: tag => document.createElement(tag) });
  if (node) detailContent.appendChild(node);
  // THE PAINT IS THE TRUTH FOR THE PART COUNT TOO (Howell, 2026-09-14, the
  // English Esther 8:9 "appears to be truncated... It's not a split verse").
  // It was: the layout drew the first of two halves, but the ring's cached
  // count for the seat said one, so the node settled centred, no crescent
  // named a second half, and the lens toggle — which asks the ring — had
  // nothing to toggle. A count and a layout that disagree are a stale count:
  // the layout just measured in whatever face is really in layout, the
  // count was taken earlier under whatever was true then. So when the sector
  // draws two parts for a seat the ring believes is one, the count is
  // corrected and the ring re-seats — the same resettle the font's arrival
  // uses — and the reader gets their crescent and their second half.
  if (payload?.uniform && Number(node?.dataset?.parts || 0) === 2 && selected?.id) {
    const key = `${selected.id}|${translation}|${vpm.width}x${vpm.height}`;
    if (versePartsCache.get(key) === 1) {
      versePartsCache.set(key, 2);
      currentApp?.resettle?.();
    }
  }

  // ── THE MARGIN, BEYOND THE RING (W-127, W-165) ────────────────────────────
  // Swete's apparatus, on the ground outside the arc. It is fetched per book
  // and cached, so this is a synchronous paint after the first verse of a book
  // and the reader never waits on it.
  //
  // IT IS DELIBERATELY NOT PART OF THE PAYLOAD. The Detail Sector renders one
  // item through one plugin; a margin is a SECOND thing about the same verse,
  // on its own ladder, absent for every edition but one and for most books of
  // that one. Folding it into the payload would make its ordinary absence
  // look like a missing verse (W-131, W-133).
  // The half the sector was told to draw — NOT re-read from the app. Reading
  // it twice from two places is how the verse and its notes come to disagree,
  // and on a preview the app's own value is still the old one.
  renderMargin(selected, translation, seqOfMargin(), payload?.part ?? 0);
  if (MARGIN_DEBUG) {
    // Both halves of the fact that was two facts until tonight: the half the
    // SECTOR was told to draw, and the half the APP believes it is on. They
    // must agree; when they did not, the ring and the words disagreed.
    marginDebug(`${selected?.meta?.verseKey ?? '?'}  drawn ${payload?.part ?? 0}`
      + `  app ${currentApp?.getVersePart?.() ?? '?'}`);
  }

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
  // A LAYOUT MEASURED BEFORE THE FACE ARRIVED IS PROVISIONAL (O-118). Howell,
  // 2026-08-30: "Genesis 1:1 renders differently at boot than it does after
  // turning the focus ring away and back." It did. The boot layout wrapped at
  // eighteen characters where twenty-seven fit and set its type six per cent
  // large — the signature of a wrap measured in the Georgia fallback and then
  // PAINTED in EB Garamond, whose Greek is much the narrower of the two. The
  // verifier below could not see it: it asks whether a line overflows its box,
  // and this failure UNDER-fills the box, which is invisible to that question
  // and to every question the instrument was asking.
  //
  // The cure that existed was one global one-shot re-render when the face
  // lands, registered during boot — and the boot splash renders the first
  // verse AFTER that, so on a warm font cache the shot was already spent on
  // nothing and the provisional layout stood until a rotation happened to
  // redraw it. So the latch moves from the boot to THE RENDER: a detail that
  // was laid out without the real face remembers as much and re-lays itself
  // the moment the face arrives, whatever the ordering was. The face loads
  // once, so this costs at most one extra render, and the seq guard drops it
  // if the reader has moved on.
  if (!verseFaceReady()) {
    onVerseFontReady(() => {
      if (seq !== detailRenderSeq) return;
      invalidateVerseMeasurement();
      versePartsCache.clear();
      currentApp?.resettle?.();
      renderDetail(selected, adapterInstance, manifest, adapterNormalized,
        { translation, wrapAttempt, part });
    });
  }
  if (wrapAttempt < 3 && typeof requestAnimationFrame === 'function') {
    // AND THE WATCH OUTLASTS THE FRAME (O-121). Two frames is ~32ms and the
    // real face can reach layout hundreds of milliseconds later — which is
    // exactly the boot case, and exactly why rotating the ring "fixed" it:
    // the rotation was simply a redraw that happened after the face landed.
    // So the check is re-asked on a short schedule until it either finds
    // drift (and re-renders, which starts a fresh watch) or the face has
    // plainly settled. Five span measurements, then silence.
    const verify = () => {
      if (seq !== detailRenderSeq) return true; // superseded: someone else is watching
      let overflows = false;
      detailContent.querySelectorAll('.detail-text-line').forEach(el => {
        if ((el.scrollWidth || 0) - (el.clientWidth || 0) > 2) overflows = true;
      });
      // AND UNDER-FILL IS A FAILURE TOO (O-119). Howell, 2026-08-30, after
      // the first attempt at this: "Cold boot failed." It did, because the
      // guard added then trusted `document.fonts` — and the comment directly
      // above this block already says that promise resolves BEFORE the face
      // reaches layout, which is the whole reason this paint-witness exists.
      // The instrument was asking the paint one question, "did a line run
      // PAST its box", and Howell's Genesis 1:1 fails the opposite way: the
      // wrap measured in the wide-Greek fallback broke at eighteen characters
      // in a row that holds twenty-seven, so every line sits comfortably
      // INSIDE its box and the old question answers no.
      //
      // Now the paint is asked both. Post-paint the real face IS in layout,
      // so a measurement taken here is honest: if any line could still have
      // taken the first word of the line below it, the wrap was measured in
      // some other face and the whole layout is stale. Prose only — a poem's
      // lines are metrical and must NOT be joined, which is why this asks the
      // payload rather than the pixels.
      const underfilled = () => {
        // ONLY THE MEASURED PATH IS ASKED. Cards and labels wrap by a
        // character-count budget that is deliberately conservative, so they
        // look under-filled by construction and would re-render to the cap
        // every time, changing nothing.
        if (!payload?.uniform) return false;
        if (Array.isArray(payload?.poemLines) && payload.poemLines.length > 1) return false;
        const els = Array.from(detailContent.querySelectorAll('.detail-text-line'));
        if (els.length < 2) return false;
        let probe = null;
        try {
          const cs = window.getComputedStyle?.(els[0]);
          if (!cs) return false;
          probe = document.createElement('span');
          probe.style.cssText = 'position:absolute;left:0;top:-9999px;opacity:0;white-space:nowrap;'
            + 'pointer-events:none;margin:0;padding:0;';
          probe.style.fontFamily = cs.fontFamily;
          probe.style.fontSize = cs.fontSize;
          document.body.appendChild(probe);   // never inside the panel: it wears a scale
          for (let i = 0; i < els.length - 1; i += 1) {
            const box = parseFloat(els[i].style?.maxWidth || els[i].style?.width || '0');
            const here = (els[i].textContent || '').trim();
            const next = (els[i + 1].textContent || '').trim().split(/\s+/)[0];
            if (!box || !here || !next) continue;
            probe.textContent = `${here} ${next}`;
            if (probe.getBoundingClientRect().width <= box - 1) return true;
          }
        } catch (_) { return false; } finally { try { probe?.remove(); } catch (_) { /* detached */ } }
        return false;
      };
      // AND THE PLAINEST QUESTION OF ALL, WHICH TOOK THREE TRIES TO ASK
      // (O-121): does the layout's own first line still measure what it
      // measured when the layout was made? Howell settled it — "the bug
      // disappears with the probe=1 tag, but without it I still see the 3
      // line incorrect version" — which means the probe's extra measurement
      // per layout was the cure, and the real face was arriving late. The
      // under-fill witness above could not see that, because it re-measures
      // in whatever face is active NOW and the stale layout was measured in
      // the same one: self-consistent, and wrong.
      //
      // This asks nothing about fonts. It compares a number to itself across
      // two frames. If it moved, the face moved under the layout and every
      // break in it is stale.
      if (!overflows && !faceMarkDrifted() && !underfilled()) return false;
      invalidateVerseMeasurement();
      versePartsCache.clear(); // part counts derive from the measurement (O-84)
      // KEEPING THE HALF IT WAS DRAWING. The retry re-wraps the same text
      // after a font reaches layout, so dropping the part here would have
      // silently snapped a reader on the second half back to the first, in a
      // repaint they never asked for and could not have attributed.
      renderDetail(selected, adapterInstance, manifest, adapterNormalized,
        { translation, wrapAttempt: wrapAttempt + 1, part });
      return true;
    };
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (verify()) return;
      for (const ms of [250, 750, 1500, 3000]) {
        setTimeout(() => { if (seq === detailRenderSeq) verify(); }, ms);
      }
    }));
  }
}

let marginRenderSeq = 0;
const seqOfMargin = () => ++marginRenderSeq;

// Paint the margin note covering this verse, or clear it. Every early return
// here is an ORDINARY state, not a failure: no volume, no apparatus for the
// edition, no capture for the book, or a block held for a reading the printed
// page has to settle. The reader meets a bare margin and nothing says sorry.
async function renderMargin(selected, translation, seq, part = 0) {
  if (!marginPanel) return;
  const clear = () => {
    if (seq !== marginRenderSeq) return;
    while (marginPanel.firstChild) marginPanel.removeChild(marginPanel.firstChild);
    if (marginMarks) marginMarks.textContent = '';
  };
  const bookId = selected?.meta?.externalFile;
  const address = selected?.meta?.verseKey;
  const volume = currentManifest?.__wallVolume;
  if (!bookId || !address || !translation || typeof volume?.marginAt !== 'function') { clear(); return; }
  const hadIt = typeof volume.marginAtSync === 'function'
    && volume.marginAtSync(bookId, translation, address) !== null;
  let found = null;
  try {
    found = await volume.marginAt(bookId, translation, address);
  } catch {
    found = null;
  }
  // AN APPARATUS THAT JUST ARRIVED CHANGES AN ANSWER ALREADY GIVEN. The ring
  // asked how many screens this item needed before the fetch returned and was
  // told one. Dropping the cache lets it ask again now that there is something
  // to answer with — the same reflex the verse measurement already has when a
  // font reaches layout after the wrap was computed.
  //
  // AND THE RING MUST BE MADE TO ASK. Clearing the cache fixes the NEXT
  // question, but the node already seated asked its question before the fetch
  // returned, and nothing was re-asking on its behalf: reached cold — boot,
  // then straight down the child pyramid, no rotation — a split verse sat
  // CENTERED in the lens as if whole, and healed only when a rotation forced
  // a re-settle (Howell, Leviticus 1:8, 2026-08-28). The eclipse flag is
  // computed fresh on every ring render, so one redraw at the current
  // rotation is the whole cure.
  // O-112: the poem rides the same wire. Fetched beside the apparatus so a
  // poem verse reached cold learns its lines the same way it learns its
  // notes - and the same reflex re-asks the ring and repaints the text.
  const hadPoem = typeof volume.poemAtSync === 'function'
    && volume.poemAtSync(bookId, translation, address) !== null;
  let poemArrived = false;
  if (typeof volume.poemAt === 'function') {
    try { poemArrived = !hadPoem && (await volume.poemAt(bookId, translation, address)) !== null; }
    catch { poemArrived = false; }
  }
  if (poemArrived && seq === marginRenderSeq) {
    versePartsCache.clear();
    currentApp?.resettle?.();
    currentDetailRerender?.(currentApp?.getVersePart?.() ?? 0);
  }
  if (!hadIt && found?.entries?.length) {
    versePartsCache.clear();
    // Re-PARK, not just re-paint (O-111): the eclipse offset is settled
    // geometry, so the seated node is sent on a short corrective glide. If
    // the ring is mid-journey, this is a no-op and the journey's own
    // arrival re-check re-parks instead.
    currentApp?.resettle?.();
  }
  if (seq !== marginRenderSeq) return;   // a newer verse superseded this one
  clear();
  // THE MARKS DO NOT DEPEND ON THERE BEING A NOTE. A verse may carry a
  // siglum in the margin and no apparatus at all — Isaiah 3:9 is one — so
  // these are painted before the early return, not after it.
  if (marginMarks && found?.marks?.length) {
    marginMarks.textContent = '';
    const line = document.createElement('div');
    line.className = 'margin-marks-sigla';
    // Same raising rule as the note: the app lifts the hands, the font never.
    for (const run of apparatusRuns(found.marks.join('  '))) {
      const piece = document.createElement('span');
      if (run.sup) piece.className = 'margin-sup';
      else if (run.italic) piece.className = 'margin-italic';
      piece.textContent = run.text;
      line.appendChild(piece);
    }
    marginMarks.appendChild(line);
  }
  // THE LEGEND HAS ONE HOME AND IT IS THE MARGIN'S FOOT. It was briefly given a
  // second, under the sigla at the head of the screen, and Howell's answer was
  // that he still could not see it "in its usual position" — which is the right
  // objection: two places to look for the same kind of statement is one more
  // than a reader should have to learn. The marks' manuscripts join the note's
  // there, deduplicated, in the order they are met.
  if (!found?.entries?.length && !found?.marksNamed?.length) return;
  const vpm = measureViewport();
  const named = [...(found.manuscripts || [])];
  for (const m of found.marksNamed || []) {
    if (!named.some(x => x.siglum === m.siglum)) named.push({ ...m, fromMark: true });
  }
  // The two lists arrive each in Swete's order; merged they are not, because a
  // mark's manuscript is appended after the note's. Sorted once, here, on the
  // same key both carry.
  named.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const node = renderMarginNote(found.entries, {
    width: vpm.width,
    height: vpm.height,
    part,
    manuscripts: named,
    create: tag => document.createElement(tag),
  });
  if (node && seq === marginRenderSeq) marginPanel.appendChild(node);
  if (MARGIN_DEBUG) {
    marginDebug(`${address}  drawn ${part}`
      + `  notes ${found.entries?.length ?? 0}`
      + `  marks ${(found.marks || []).join('') || '-'}`
      + `  named ${(found.marksNamed || []).map(m => m.siglum).join('') || '-'}`);
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

  // THE PARENT BUTTON AND THE LENS SWIPE (O-131, O-132) — their own
  // screen-vertical swipes are superseded by the compass below (O-152); a
  // press on either is still its control's tap if it never travels, and the
  // click that follows a stroke is swallowed by these timestamps.
  let parentSwipeFiredAt = 0;
  // THE COMPASS DECIDES (O-152, Howell 2026-09-16), superseding O-142's angle
  // to the hub and the lens's and parent's own screen-vertical swipes (O-131,
  // O-132). Every drag on the glass — open ground, a ring node, the verse
  // panel, the lens, the parent button — is undecided for its first
  // DECIDE_PX, the ring holding still; then its compass bearing decides, by
  // the bands in src/core/stroke.js: Northwest ± 10° turns the ring
  // clockwise, Southeast ± 10° counter-clockwise, the 140° through north and
  // east drills OUT, the 140° through south and west drills IN, and the four
  // 10° gaps between them do nothing until the finger lifts. At a leaf a
  // drill in does nothing; at the top a drill out does nothing. Once decided,
  // a stroke is measured only along its own axis. A press that never travels
  // DECIDE_PX is the tap it always was. The pyramid's stars still drill on
  // touch.
  // 8 px, the tap slop (O-152 amended: the log showed slow strokes taking
  // 350–800 ms to travel 14 px with nothing moving).
  const DECIDE_PX = 8;             // the stroke declares itself here; the ring waits that long
  let stroke = null;               // { x0, y0, decided, pendingDelta, dead } for the drag under way
  let freeDrill = null;            // { kind, x0, y0, ux, uy, ctl, travel, e, undo } — a drill a stroke began
  let controlPress = null;         // { x0, y0, isParent, dead } — a press on the lens or the parent button
  const lean = () => diagonalLean(viewport?.width, viewport?.height);
  // The two reference bearings that widen rotation (O-152 amended): from the
  // magnifier to the upper-left and to the lower-right corner of the page.
  const bandOpts = () => {
    try {
      const vp = getViewportInfo(viewport.width, viewport.height);
      const m = getMagnifierPosition(vp);
      return { ul: bearingOf(0 - m.x, 0 - m.y), lr: bearingOf(vp.width - m.x, vp.height - m.y) };
    } catch (_) { return {}; }
  };
  const ROTATE_GAIN = Math.SQRT2;  // a stroke along the Northwest axis turns the ring as the old diagonal drag did
  // PROGRESS STARTS WHERE THE FINGER IS WHEN THE FLIGHTS ARE READY (O-152
  // amended: the log showed a first drill taking 447 ms to build its flights,
  // by which time the finger was 30% along and everything jumped there).
  // Until every flight is caught the drill holds at its start; then the
  // origin is re-based under the finger, so the drill always begins at zero.
  const freeDrillProgress = (fd, event) => {
    if (!fd.based) {
      if (!fd.ctl?.captured?.()) return 0;
      fd.x0 = event.clientX; fd.y0 = event.clientY; fd.based = true;
      logTap('drill-based', {});
      return 0;
    }
    const travelled = (event.clientX - fd.x0) * fd.ux + (event.clientY - fd.y0) * fd.uy;
    return Math.max(0, Math.min(1, travelled / Math.max(40, fd.travel)));
  };
  // Begin a drill from a stroke that started at (x0, y0); false when there is
  // nothing to drill that way — which the compass rule reads as nothing at all.
  const beginFreeDrill = (kind, event, x0, y0) => {
    const app = getApp();
    if (!app) return false;
    const axis = axisFor(kind, lean());
    const fd = { kind, x0, y0, ux: axis.ux, uy: axis.uy, e: 0, pointerId: event?.pointerId ?? null };
    if (kind === 'in') {
      const idx = app.largestPyramidIndex?.() ?? -1;
      if (idx < 0) return false;   // a leaf: nothing below
      fd.undo = () => { const p = app.view?.parentButtonOuter; if (typeof p?.onclick === 'function') p.onclick(event); };
      logTap('stroke-drill-in', { idx });
      beginDrill(fd, app, () => app.handlePyramidNodeClick(idx));
    } else {
      const p = app.view?.parentButtonOuter;
      if (typeof p?.onclick !== 'function') return false;   // the top: nothing above
      const wasAt = app.nav?.getCurrent?.() || null;
      fd.undo = () => { if (wasAt) app.drillIntoItem?.(wasAt); };
      logTap('stroke-drill-out', {});
      beginDrill(fd, app, () => p.onclick(event));
    }
    if (!fd.ctl) return false;
    freeDrill = fd;
    return true;
  };
  // THE DRILL IS SCRUBBED (O-138, Howell 2026-09-15): "I don't like to have
  // swipes that act like taps." Past the threshold the swipe LAUNCHES the
  // drill exactly as the tap would — the same door — but under a scrub: the
  // flights are caught at their first frame, and from there to the far
  // vessel the finger owns their clock. Let go past halfway and they settle;
  // short of it they spring back and the navigation is undone, unseen. The
  // distance from lens to parent disc, on the glass, is the whole travel.
  const drillTravelPx = app => {
    const a = app?.view?.magnifierCircle?.getBoundingClientRect?.();
    const b = app?.view?.parentButtonOuter?.getBoundingClientRect?.();
    if (!a || !b || !a.width || !b.width) return 160;
    const d = Math.hypot((a.left + a.width / 2) - (b.left + b.width / 2), (a.top + a.height / 2) - (b.top + b.height / 2));
    return Math.max(80, d);
  };
  // Begin a scrubbed drill through `launch` (the tap's own path). If nothing
  // took off — the guards spoke, no sky — the scrub is forgotten and the
  // gesture is over.
  const beginDrill = (sw, app, launch) => {
    const tLaunch = performance.now();
    logTap('phase', { name: 'drill-start', p: 0 });
    window.__wheelFrameKind = sw?.kind || '?';
    const ctl = beginScrubbedMigration(app?.flightRoot?.() || null);
    try { launch(); } catch (_) { /* the drill's own guards spoke */ }
    logTap('drill-launch', { ms: Math.round(performance.now() - tLaunch), launched: ctl.launched() });
    if (!ctl.launched()) { ctl.cancel(); return; }
    sw.ctl = ctl; sw.travel = drillTravelPx(app); sw.e = 0;
  };
  const onPointerMove = event => {
    if (event.isPrimary === false) return;   // a second finger has no say (O-169)
    if (freeDrill) {
      freeDrill.e = freeDrillProgress(freeDrill, event);
      freeDrill.ctl.scrubTo(freeDrill.e);
      if (!freeDrill.probed && freeDrill.e > 0.3 && typeof window.__probeRing === 'function') { freeDrill.probed = true; setTimeout(() => window.__probeRing('drill ' + freeDrill.kind), 50); }
      return;
    }
    if (controlPress) {
      if (controlPress.dead) return;
      const vx = event.clientX - controlPress.x0, vy = event.clientY - controlPress.y0;
      if (Math.hypot(vx, vy) < DECIDE_PX) return;
      const press = controlPress;
      const bearing = bearingOf(vx, vy);
      const kind = classifyBearing(bearing, lean(), bandOpts());
      logTap('control-stroke', { kind, parent: press.isParent, bearing: Math.round(bearing) });
      // Whatever it decides, the press is no longer a tap on its control.
      if (press.isParent) parentSwipeFiredAt = Date.now(); else lensSwipeFiredAt = Date.now();
      if (kind === 'cw' || kind === 'ccw') {
        controlPress = null;
        isDragging = true; recentMoves = []; gestureTravelPx = Math.hypot(vx, vy);
        lastX = event.clientX; lastY = event.clientY; lastTime = event.timeStamp;
        stroke = { x0: press.x0, y0: press.y0, decided: true, pendingDelta: 0 };
        const axis = axisFor('cw', lean());
        getApp()?.choreographer?.rotate((vx * axis.ux + vy * axis.uy) * sensitivity * ROTATE_GAIN);
        return;
      }
      if ((kind === 'in' || kind === 'out') && beginFreeDrill(kind, event, press.x0, press.y0)) {
        controlPress = null;
        freeDrill.e = freeDrillProgress(freeDrill, event);
        freeDrill.ctl.scrubTo(freeDrill.e);
        return;
      }
      press.dead = true;   // a dead zone, or nothing to drill that way: nothing until lift
      return;
    }
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
    // Only movement along the rotation axis turns the ring (O-152).
    const rotAxis = axisFor('cw', lean());
    const delta = (dx * rotAxis.ux + dy * rotAxis.uy) * sensitivity * ROTATE_GAIN;
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
    // The stroke declares itself (O-152): until DECIDE_PX the turn is held
    // back; then the compass decides — a turn pays the held-back turn at
    // once, a drill leaves the ring, a dead zone does nothing until lift.
    if (stroke && stroke.dead) return;
    if (stroke && !stroke.decided) {
      stroke.pendingDelta += delta;
      const vx = event.clientX - stroke.x0, vy = event.clientY - stroke.y0;
      if (Math.hypot(vx, vy) < DECIDE_PX) return;
      stroke.decided = true;
      const bearing = bearingOf(vx, vy);
      const kind = classifyBearing(bearing, lean(), bandOpts());
      logTap('stroke-decided', { kind, bearing: Math.round(bearing), vx: Math.round(vx), vy: Math.round(vy), bands: bandOpts() });
      if (kind === 'cw' || kind === 'ccw') { app.choreographer.rotate(stroke.pendingDelta); return; }
      pendingTapNode = null; pendingAdvanceTap = false;
      if ((kind === 'in' || kind === 'out') && beginFreeDrill(kind, event, stroke.x0, stroke.y0)) { isDragging = false; return; }
      stroke.dead = true;
      return;
    }
    app.choreographer.rotate(delta);
  };

  // When touch pointerdown manually dispatches a node onclick, suppress the
  // browser's delayed native click so the same node doesn't rotate twice.
  svg.addEventListener('click', event => {
    const now = Date.now();
    // A swipe that already migrated (O-131) must not be followed by the tap's click.
    if (parentSwipeFiredAt && now - parentSwipeFiredAt < 700 && event.target?.closest?.('.focus-ring-parent-circle, .focus-ring-parent-label')) {
      parentSwipeFiredAt = 0;
      event.preventDefault();
      event.stopPropagation();
      return;
    }
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
    if (event.isPrimary === false) { logTap('second-pointer-ignored', {}); return; }   // one finger drives (O-169)
    if (freeDrill) settleOrphanDrill('next-touch');
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
      // The parent vessel (or its words): watch for the swipe (O-131). The
      // capture goes on the CIRCLE, so a plain tap's click still lands on it.
      const parentEl = event.target.closest('.focus-ring-parent-circle, .focus-ring-parent-label') ? app.view?.parentButtonOuter : null;
      if (parentEl && typeof parentEl.onclick === 'function') {
        // The parent's vessel: its stroke is decided by the compass (O-152).
        controlPress = { x0: event.clientX, y0: event.clientY, isParent: true, dead: false };
        try { parentEl.setPointerCapture?.(event.pointerId); } catch (_) { /* unsupported */ }
      } else if (!searchRestore && event.target.closest('.focus-ring-magnifier-circle, .focus-ring-magnifier-label')) {
        // The lens (not in search): its stroke is decided by the compass (O-152).
        controlPress = { x0: event.clientX, y0: event.clientY, isParent: false, dead: false };
        try { app.view?.magnifierCircle?.setPointerCapture?.(event.pointerId); } catch (_) { /* unsupported */ }
      }
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
    stroke = { x0: event.clientX, y0: event.clientY, decided: false, pendingDelta: 0, dead: false };
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

  // A scrubbed drill settles on release (O-138): past halfway it goes
  // through; short of it, it springs back and the host's undo takes the
  // navigation back in the same task.
  const releaseDrill = (sw, type) => {
    if (!sw?.ctl) return;
    const app = getApp();
    const commit = type !== 'pointercancel' && sw.e >= 0.5;
    sw.ctl.release(commit, { onAbort: () => { if (app && typeof sw.undo === 'function') app.withInstantMigration(sw.undo); } });
  };
  // A DRILL WHOSE FINGER IS LOST IS SETTLED, NEVER LEFT HALF-FLOWN (O-169,
  // Howell 2026-09-18, three photographs of vanished nodes: clones frozen
  // mid-flight, the reals hidden). A held drill ended only on the drawing's
  // own pointerup — so a finger lifted where that event never reached the
  // drawing, a capture lost to the browser, a second finger, or the page
  // going to the background left the scrub open with everything it held.
  // Every such end now settles the drill by where the finger was.
  const settleOrphanDrill = why => {
    if (!freeDrill) return;
    logTap('drill-orphan-settled', { why, e: Math.round((freeDrill.e || 0) * 100) / 100 });
    releaseDrill(freeDrill, why === 'pointercancel' ? 'pointercancel' : 'pointerup');
    freeDrill = null; controlPress = null; stroke = null;
  };
  if (typeof window !== 'undefined') {
    ['pointerup', 'pointercancel'].forEach(type => window.addEventListener(type, event => {
      if (freeDrill && (freeDrill.pointerId == null || event.pointerId === freeDrill.pointerId)) settleOrphanDrill(type);
    }, true));
    document.addEventListener('visibilitychange', () => { if (document.hidden) settleOrphanDrill('hidden'); });
    svg.addEventListener('lostpointercapture', event => {
      if (freeDrill && (freeDrill.pointerId == null || event.pointerId === freeDrill.pointerId)) settleOrphanDrill('lostpointercapture');
    });
  }
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(type => {
    svg.addEventListener(type, event => {
      if (event.isPrimary === false) return;   // a second finger has no say (O-169)
      if (controlPress && type !== 'pointerleave') controlPress = null;
      if (freeDrill) { if (type !== 'pointerleave') { releaseDrill(freeDrill, type); freeDrill = null; } }
      if (type !== 'pointerleave') stroke = null;
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
    // THE LEVEL'S WORDS COME WITH THE NAMES (O-144, 2026-09-15). They came
    // from the language registry until the wall retired it (H-14), and the
    // lookup answered null for a month while nobody noticed the caption gone.
    // The naming kit is where a tongue's words for its levels live now; the
    // registry lookup stays as the belt for a volume that still has one.
    namesMap.vocabulary = ln.vocabulary || dimensionBridge.languageVocabulary(lang);
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
  // WHERE THIS VOLUME'S OWN IMAGES LIVE (W-114). The host stays agnostic: it
  // carries the string and never learns what is in the picture.
  options.assetBase = config.assetBase || '';
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
  bookmarkPrompt = root?.display_config?.bookmark_prompt || null;
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
  // THE MARGIN MAKES ROOM FOR THE LENS CAPTION (O-150). Notes are drawn only
  // at a leaf, so the caption to keep clear of is the leaf level's word, read
  // live from the formatter (it follows the reader's tongue); a volume that
  // declares no captions declares no keep-out.
  {
    const leafLevelForCaption = root?.display_config?.leaf_level || null;
    setMarginKeepOut(config?.levelCaptions === true && leafLevelForCaption ? {
      text: () => labelFormatter({ item: { level: leafLevelForCaption }, context: 'caption' }) || '',
      direction: () => (typeof handlerSet.textDirection === 'function' ? handlerSet.textDirection() : 'ltr')
    } : null);
  }
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
  const adapterGetGapLabel = typeof handlerSet.getGapLabel === 'function' ? handlerSet.getGapLabel : null;
  // The volume's dimension front door, if its adapter declares one (the
  // globe-at-the-threshold rule — see updateDimensionButton).
  seatAtLeaf = typeof handlerSet.seatAtLeaf === 'function' ? handlerSet.seatAtLeaf : () => false;
  seatOrder = typeof handlerSet.seatOrder === 'function' ? handlerSet.seatOrder : () => null;
  hitSeats = typeof handlerSet.hitSeats === 'function' ? handlerSet.hitSeats : () => [];
  // The chooser offers the editions that hold where the reader stands (H-29).
  editionsHoldingItem = typeof handlerSet.editionsHoldingItem === 'function' ? handlerSet.editionsHoldingItem : () => null;
  // The corner emblem belongs to the division the reader is in (H-31). A
  // volume that declares none answers null and its corner never changes,
  // which is every volume but one.
  cornerImageAt = typeof handlerSet.cornerImageFor === 'function' ? handlerSet.cornerImageFor : () => null;
  cornerColorAt = typeof handlerSet.detailSectorColorFor === 'function' ? handlerSet.detailSectorColorFor : () => null;

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
    prominenceOf: layoutBindings.prominenceOf,
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
    levelCaptions: config?.levelCaptions === true,
    shouldCenterLabel,
    contextOptions: { ...options, locale: resolvedLocale },
    onParentClick: parentHandler,
    getParentLabel: adapterGetParentLabel,
    getParentLabelSuffix: adapterGetParentLabelSuffix,
    getGapLabel: adapterGetGapLabel,
    getTextDirection: typeof handlerSet.textDirection === 'function' ? handlerSet.textDirection : null,
    getParentActionable: typeof handlerSet.getParentActionable === 'function' ? handlerSet.getParentActionable : null,
    getParentIcon: typeof handlerSet.getParentIcon === 'function' ? handlerSet.getParentIcon : null,
    pyramid: pyramidConfig,
    pyramidLayoutSpec: pyramidLayout,
    pyramidNormalized: adapterNormalized || normalized,
    pyramidAdapter: adapter,
    detailTapAdvances: Boolean(adapter?.capabilities?.detailTapAdvances),
    // Leaf-advance paints the text ahead of the ring's arrival — same
    // renderer the settle hook uses, resolving the translation live.
    onDetailPreview: (item, o) => renderDetail(item, adapter, manifest, adapterNormalized,
      { translation: activeTranslation(), part: o?.part }),
    // O-84: the ring asks how many Detail Sector screens an item needs so a
    // split verse settles as a partial eclipse. Answered HERE because the
    // host owns the detail bounds, and answered by the same flow machinery
    // that will render the text, so ring and sector cannot disagree.
    versePartsFor: item => {
      try {
        const translation = activeTranslation();
        const vpm = measureViewport();
        const key = `${item?.id}|${translation}|${vpm.width}x${vpm.height}`;
        const hit = versePartsCache.get(key);
        if (hit !== undefined) return hit;
        const payload = adapter?.detailFor
          ? adapter.detailFor(item, manifest, { normalized: adapterNormalized, translation })
          : null;
        let parts = 1;
        if (payload?.uniform && typeof payload.text === 'string') {
          const bounds = computeDetailSectorBounds(vpm.width, vpm.height, null, copyrightBottomPx());
          // O-112: a poem verse is measured by its own line-per-line flow -
          // the prose count would under- or over-state its screens.
          const offs = volumeForParts()?.poemAtSync?.(item?.meta?.externalFile, translation, item?.meta?.verseKey);
          if (Array.isArray(offs) && offs.length > 1) {
            const txt = payload.text;
            const pls = offs.map((o, i) => txt.slice(o, i + 1 < offs.length ? offs[i + 1] : txt.length).trim()).filter(Boolean);
            parts = poemPartCount(pls, bounds);
          } else {
            parts = versePartCount(payload.text, bounds);
          }
        }
        // O-86: THE ECLIPSE TRIGGER WIDENS. A verse short enough to read whole
        // may still carry notes too extensive for the margin, and Howell ruled
        // those split the same way — "we simply display those notes in halves".
        // So two parts when EITHER overflows. Asked from cache and without
        // waiting: an apparatus still in flight answers one, and the cache is
        // dropped when it lands so the ring asks again.
        if (parts < 2) {
          const volume = currentManifest?.__wallVolume;
          const found = volume?.marginAtSync?.(item?.meta?.externalFile, translation, item?.meta?.verseKey);
          if (found?.entries?.length) {
            parts = marginPartCount(found.entries, found.manuscripts, { width: vpm.width, height: vpm.height });
          }
        }
        versePartsCache.set(key, parts);
        return parts;
      } catch (_) { return 1; }
    }
  });
  currentApp = app;
  currentManifest = manifest;
  currentDetailRerender = part => renderDetail(app?.nav?.getCurrent?.(), adapter, manifest, adapterNormalized,
    { translation: activeTranslation(), part });
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
    // THE KEY IS THE BOOK, OR THE DIVISION ITEM WHEN NO BOOK IS IN HAND
    // (O-149): at root both divisions have no book, so a turn from the Old
    // Testament to the New changed nothing this signal could see, and the
    // emblem never swapped.
    const markKey = () => currentBookId() ?? `item:${currentApp?.nav?.getCurrent?.()?.id ?? ''}`;
    let lastMarkedBook = markKey();
    app.nav.onChange(() => {
      const book = markKey();
      if (book === lastMarkedBook) return;
      lastMarkedBook = book;
      updateIncompleteMark();
      updateCornerImage();
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
  // AND IN BROWSE MODE IT NAMES THE HALF (Howell 2026-08-27). The lens had
  // exactly one job and only in search; it now has a second, and only where
  // there is a second half to name. On an undivided node the tap is inert,
  // which is the state it has always been in and must stay in — the lens is
  // not a general-purpose button and must never grow into one.
  if (app?.view?.magnifierCircle) {
    app.view.magnifierCircle.addEventListener('click', () => {
      if (lensSwipeFiredAt && Date.now() - lensSwipeFiredAt < 700) { lensSwipeFiredAt = 0; return; }   // the swipe already drilled (O-132)
      if (searchRestore) { strikeSettledChar(); return; }
      app.toggleVersePart?.();
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
  renderDetail(app?.nav?.getCurrent?.(), adapter, manifest, adapterNormalized,
    { translation: activeTranslation(), part: app?.getVersePart?.() ?? 0 });
  rememberReadingPosition(); // the boot position counts too
  // The globe follows the magnifier: at the volume's front door it appears,
  // one step of descent hides it (nav change), the leaf brings it back
  // (detail-sector-change). This call catches the boot/gateway arrival.
  updateDimensionButton();
  updateCornerImage();
  app?.nav?.onChange?.(() => {
    // THE HALF IS PASSED, NEVER LEFT TO A FALLBACK. This called renderDetail
    // with no `part`, so the text took whatever the app's `versePart` happened
    // to hold at that instant — a value set by a different code path at a
    // different moment. That is how the ring came to show the second half of a
    // verse while the sector showed the first: not one wrong assignment, but
    // two sources for one fact. There is one source now and every caller reads
    // it out loud.
    renderDetail(app?.nav?.getCurrent?.(), adapter, manifest, adapterNormalized,
      { translation: activeTranslation(), part: app?.getVersePart?.() ?? 0 });
    updateDimensionButton();
    rememberReadingPosition();
  });
  dimensionBridge.onSettle(translation => {
    // THE FUNNEL IS NOT CLOSED BY A COMMIT (O-77). It used to be — "a
    // committed choice ends the launch question, whether or not the strata
    // have receded yet" — and that sentence reads perfectly right up until
    // you remember that TURNING THE LANGUAGE RING IS A COMMIT. The springback
    // settles on the node under the lens and calls `select` on it, so the
    // reader's very first rotation, the one gesture the funnel exists to
    // invite, switched O-72's position filter on underneath the ring they
    // were still turning. Howell, from the LAN: rotate onto the Greek and
    // back, and the Hebrew is gone — struck off by a filter reading the seat
    // the Greek had just reseated him to.
    //
    // A commit is a STEP THROUGH the funnel, not the end of it. The funnel
    // ends where it always said it did: when the reader arrives at the text.
    window.__wheelTapTrace?.push({ ev: 'dim-settle', tr: translation || '' });
    // THE SHELF FOLLOWS THE READER (W-16): refresh the live names table
    // FIRST, then repaint. The chain is not rebuilt and nothing moves — the
    // reader keeps their exact place; only the words change, on the ring, in
    // the magnifier, in the parent button and across the pyramid. Apocalypsis
    // becomes Offenbarung des Johannes where it stands.
    refreshNamesMap();
    if (typeof app?.refreshPyramid === 'function') app.refreshPyramid();
    if (typeof app?.setParentButtons === 'function') app.setParentButtons({ showOuter: true });
    // A NEW EDITION IS A NEW READING and starts at the first half: the verse
    // is different text of a different length and its old half means nothing.
    // Stated rather than left to a default, because "0" here is a decision.
    renderDetail(app?.nav?.getCurrent?.(), adapter, manifest, adapterNormalized,
      { translation, part: 0 });
    // Remember the choice, so the next launch's funnel confirms it (ruling 2)
    // rather than presenting the pinned default as though nothing was chosen.
    const sel = dimensionBridge.getSelection();
    remember(volume, { language: sel.language || null, edition: sel.translation || null });
    // The committed edition travels with the options, and the volume may warm
    // whatever it needs to seat the reader by it next time a ring is built.
    options.activeEdition = translation || options.activeEdition;
    // The preview is over: what was hovered is now committed, and a stale
    // preview edition would send every later name through a crossing that is
    // no longer happening (O-94).
    options.previewEdition = null;
    // THE READER IS CARRIED ACROSS, NOT LEFT BEHIND. Once whatever the volume
    // needs has landed, give it the chance to RE-SEAT: the reader is standing
    // on a particular thing, and a volume whose editions divide their contents
    // differently must put them where that thing actually sits — which is not
    // the same index, and sometimes not the same number. A volume that returns
    // false (or declares no handler) keeps the reader exactly where they are,
    // which is the right answer whenever the editions agree.
    editionSettlePromise = Promise.resolve(config.onEditionSettle?.(translation || null))
      .then(() => handlerSet.reseatOnEditionChange?.({
        selected: app?.nav?.getCurrent?.(), app
      }))
      // AFTER the reseat, not before it (O-76). The reader may have been
      // carried to a different book — to another division entirely, when the
      // new edition shares nothing with where they stood — and both the
      // emblem and the chooser's position answer are read off where they now
      // ARE. Computing either from the old seat paints the last edition's
      // corner and offers the last edition's neighbours.
      // The sky follows the ring (O-95). At root the child pyramid holds the
      // books of the settled division, and the reseat may have landed on a
      // different one — the pyramid refreshed above, BEFORE the crossing, so
      // it would otherwise keep the old edition's books under the new
      // edition's division.
      .then(() => { updateCornerImage(); refreshEditionsHere(); app?.refreshPyramid?.(); })
      .catch(() => {});
    updateIncompleteMark();
    updateCornerImage();
  });
  // Re-wrap the open detail the moment EB Garamond truly lands (Howell
  // 2026-07-27): the first wrap may have measured in the Georgia fallback,
  // which on iOS is NARROWER than the serif that then paints — the line ran
  // past the fence to the glass edge. One-shot per font arrival; fires
  // immediately (harmless re-render) if the face was already loaded.
  onVerseFontReady(() => {
    versePartsCache.clear(); // the real serif re-measures everything (O-84)
    renderDetail(
      app?.nav?.getCurrent?.(), adapter, manifest, adapterNormalized,
      { translation: activeTranslation(), part: app?.getVersePart?.() ?? 0 });
  });
  // Generic post-boot hook: adapters may schedule volume-specific startup
  // work (e.g. a featured-item prefetch) without the host
  // carrying volume literals (Phase B audit, H1).
  if (typeof handlerSet.onBoot === 'function') {
    handlerSet.onBoot({
      app,
      items,
      selectedIndex,
      // The adapter repaints through this when a chapter's text lands, which
      // can happen while a reader is on the second half of a verse. It carries
      // the half for the same reason the wrap retry does.
      renderDetail: item => renderDetail(item, adapter, manifest, adapterNormalized,
        { translation: activeTranslation(), part: app?.getVersePart?.() ?? 0 })
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
    // WHICH EDITION IS UNDER THE LENS (O-94). The chain still holds the
    // committed edition's book ids, so whoever names a book during a preview
    // must reach the hovered edition's own word for it through the leaf. The
    // adapter reads this; the settle clears it.
    options.previewEdition = edition;
    if (typeof app?.refreshPyramid === 'function') app.refreshPyramid();
    if (typeof app?.setParentButtons === 'function') app.setParentButtons({ showOuter: true });
    renderDetail(app?.nav?.getCurrent?.(), adapter, manifest, adapterNormalized,
      { translation: edition, part: 0 });   // a new edition starts at the first half
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
  // Every launch lands on the text (O-143). The proofread deep link (O-122)
  // used to be the one exception to a launch funnel that no longer exists.
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
