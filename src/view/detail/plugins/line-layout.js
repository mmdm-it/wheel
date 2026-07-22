/**
 * Shared line-layout helpers for arc-following text rendering.
 *
 * Both TextDetailPlugin and CardDetailPlugin need:
 *   - font-tier selection
 *   - character-count based text wrapping against a line table
 *
 * All font sizes are expressed as a percentage of SSd and controlled
 * entirely by CSS.  JS only picks the tier class and applies geometry.
 */

/**
 * Font tiers in descending size order: [cssClass, sizePercentOfSSd].
 * The CSS file defines `font-size: calc(N/100 * var(--detail-SSd))` for each.
 *
 * Tiers 1-3 are large display sizes for verse text in the arc Detail Sector.
 * Tiers 4-6 are the legacy range, still used for card titles and short labels.
 */
export const FONT_TIERS = [
  ['font-tier-1', 10.5],
  ['font-tier-2',  8.0],
  ['font-tier-3',  6.0],
  ['font-tier-4',  4.5],
  ['font-tier-5',  3.5],
  ['font-tier-6',  3.0]
];

/**
 * Restricted tier set for card titles and short labels.
 * Capped at 4.5% SSd so volume card headings stay compact.
 */
export const CARD_FONT_TIERS = [
  ['font-tier-4', 4.5],
  ['font-tier-5', 3.5],
  ['font-tier-6', 3.0]
];

/**
 * Estimate how many lines are needed to render `words` at a given font tier.
 *
 * `lineTable[].maxChars` is calibrated for tier-6 (3% SSd).
 * For larger fonts fewer characters fit per line, so we scale maxChars down.
 *
 * @param {string[]} words
 * @param {Array<{ maxChars: number }>} lineTable
 * @param {number} tierPercent - font size as % of SSd (e.g. 4.5)
 * @returns {number} lines needed, or Infinity if text overflows the table
 */
export function estimateLineCount(words, lineTable, tierPercent) {
  const scale = 3.0 / tierPercent;
  let lineIdx = 0;
  let current = '';

  for (const word of words) {
    if (lineIdx >= lineTable.length) return Infinity;
    const test = current ? `${current} ${word}` : word;
    const maxChars = Math.floor(lineTable[lineIdx].maxChars * scale);
    if (test.length <= maxChars) {
      current = test;
    } else {
      lineIdx++;
      if (lineIdx >= lineTable.length) return Infinity;
      current = word;
    }
  }
  return current ? lineIdx + 1 : lineIdx;
}

/**
 * Compute the number of line-table slots a single rendered text line occupies
 * at a given tier.  The line-table pitch is calibrated for tier-6 (3% SSd ×
 * line-height 1.4 = 4.2% SSd per slot).  Larger tiers need proportionally
 * more slots so their glyphs don't overlap.
 *
 * stride = ceil(tierPct × lineHeight / 4.2)
 * This is viewport-size independent because SSd cancels out.
 *
 * @param {number} tierPercent  - font size as % of SSd
 * @returns {number}
 */
export function tierStride(tierPercent) {
  const LH = tierPercent >= 6 ? 1.3 : 1.4;
  return Math.max(1, Math.ceil(tierPercent * LH / 4.2));
}

/**
 * Select the largest font tier whose text fits within the provided line table.
 *
 * Pass a sub-slice of the full line table to enforce a max-line budget.
 * e.g. `selectFontTier(title, lineTable.slice(0, 2))` picks the largest tier
 * that fits the title in at most 2 lines.
 *
 * @param {string} text
 * @param {Array}  lineTable
 * @param {Array}  [tiers]   - defaults to FONT_TIERS
 * @returns {[string, number, number]} [cssClass, tierPercent, stride]
 */
// The rows a strided layout will actually SEAT lines on: rows 0, s, 2s, …
// Budgets must come from these rows, not from rows 0,1,2,… — the fence's
// rows narrow with depth (tapered arc), so a wide shallow row's budget
// applied to a narrow deep seat overflows it (Phase C audit M2).
export function stridedRows(lineTable, stride) {
  if (!Array.isArray(lineTable) || stride <= 1) return lineTable;
  return lineTable.filter((_, i) => i % stride === 0);
}

// The longest verse in the volume — Esther 8:9, Vulgate (425 chars, 62 words).
// Verse text sizes to THIS reference, not to itself, so every verse shares one
// calm type size instead of short verses ballooning to fill the sector (Howell
// 2026-07-21, retiring an old auto-fit idea). Device-adaptive: fit against the
// LIVE line table, so the shared size is as large as the longest verse allows
// on the screen at hand. If the longest verse fits, every verse fits.
export const LONGEST_VERSE_REFERENCE =
  'Accitisque scribis et librariis regis (erat autem tempus tertii mensis, qui '
  + 'appellatur Siban) vigesima et tertia die illius scriptæ sunt epistolæ, ut '
  + 'Mardochæus voluerat, ad Judæos, et ad principes, procuratoresque et judices, '
  + 'qui centum viginti septem provinciis ab India usque ad Æthiopiam præsidebant : '
  + 'provinciæ atque provinciæ, populo et populo juxta linguas et litteras suas, et '
  + 'Judæis, prout legere poterant et audire.';

// ── Uniform verse flow ────────────────────────────────────────────────
// Verses don't use the discrete font tiers — those quantise both the size
// (coarse steps) and the vertical placement (integer row strides), and the
// two wastes stack up so the longest verse only reaches half the sector
// (Howell 2026-07-21: "the font can be twice as large"). Instead a verse gets
// a CONTINUOUS size — the largest at which the longest verse fills the sector
// — and flows at its true line height, arc-aware, so nothing is wasted. All
// verses share that one size.
//
// Wrapping MEASURES real glyph widths (canvas.measureText in the actual serif
// at the actual size), never a per-character estimate: an estimate over-
// measures EB Garamond (~0.44em) as if it were 0.50em, breaking every line
// ~12% early and by a constant PROPORTION, which bent the ragged right edge
// concentric with the arc and stranded words that plainly fit (Howell
// 2026-07-21). Real measurement breaks at the true edge, so the right margin
// goes ragged-but-full and every word that fits stays up.
const VERSE_FONT_STACK = "'EB Garamond', Georgia, serif";
const VERSE_CHAR_EM = 0.50;     // fallback estimate only (no canvas, e.g. tests)
const VERSE_LINE_HEIGHT = 1.30; // vertical pitch between verse lines
const VERSE_FILL = 1.0;         // fraction of sector height the longest verse may use

// Measure with the ACTUAL DOM — a hidden span in the real font — NOT canvas.
// Safari's canvas measureText under-measures a web font even after it loads
// (it disagrees with what it paints), which packed verses wide to the very edge
// on iPhone while Chrome measured true (Howell 2026-07-22). A DOM span can't
// disagree with the render. It also self-corrects for load timing: before EB
// Garamond arrives the span falls back to Georgia (WIDER), so the wrap breaks
// early and can't overflow; once the font lands the measure is exact.
let measureSpan;
function getMeasureSpan() {
  if (measureSpan !== undefined) return measureSpan;
  measureSpan = null;
  try {
    if (typeof document !== 'undefined' && document.body && typeof document.createElement === 'function') {
      const s = document.createElement('span');
      s.style.cssText = 'position:absolute;left:-9999px;top:0;visibility:hidden;white-space:nowrap;pointer-events:none;';
      s.style.fontFamily = VERSE_FONT_STACK;
      document.body.appendChild(s);
      measureSpan = s;
    }
  } catch (_) { measureSpan = null; }
  return measureSpan;
}
// Whether the real serif has loaded — the size cache keys on it, so the shared
// verse size recomputes (from the Georgia estimate to the exact EB Garamond)
// the moment the font arrives. document.fonts.ready is the honest signal
// (document.fonts.check() lies — returns true too early).
let verseFontLoaded = false;
if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() => { verseFontLoaded = true; }).catch(() => {});
}
function verseFontReady() { return verseFontLoaded; }
function measureWidth(text, fontPx) {
  const span = getMeasureSpan();
  if (span) {
    span.style.fontSize = `${fontPx}px`;
    span.textContent = text;
    return span.getBoundingClientRect().width;
  }
  return text.length * fontPx * VERSE_CHAR_EM; // node/tests: no DOM
}

// availableWidth / leftX at an arbitrary y, interpolated from the REAL (arc-
// tapered) line table so wrapping obeys the same fence the tiers do.
function sectorMetricAt(lineTable, y) {
  if (!lineTable.length) return { leftX: 0, width: 0 };
  if (y <= lineTable[0].y) return { leftX: lineTable[0].leftX, width: lineTable[0].availableWidth };
  const last = lineTable[lineTable.length - 1];
  if (y >= last.y) return { leftX: last.leftX, width: last.availableWidth };
  for (let i = 1; i < lineTable.length; i += 1) {
    const b = lineTable[i];
    if (y <= b.y) {
      const a = lineTable[i - 1];
      const t = (y - a.y) / ((b.y - a.y) || 1);
      return {
        leftX: a.leftX + (b.leftX - a.leftX) * t,
        width: a.availableWidth + (b.availableWidth - a.availableWidth) * t
      };
    }
  }
  return { leftX: last.leftX, width: last.availableWidth };
}

// Flow `text` at fontPx; lines seated at their true height, arc-aware, wrapped
// by MEASURED width. Returns { lines:[{text,y,leftX,availableWidth}], overflow }.
function flowVerseAt(text, bounds, fontPx) {
  const lineH = fontPx * VERSE_LINE_HEIGHT;
  const lt = bounds.lineTable || [];
  const top = bounds.topY;
  const bottom = top + (bounds.bottomY - top) * VERSE_FILL;
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let y = top, cur = '';
  if (y + lineH > bottom) return { lines, overflow: true }; // sector too short for one line
  const seat = () => { const m = sectorMetricAt(lt, y); lines.push({ text: cur, y, leftX: m.leftX, availableWidth: m.width }); };
  for (const w of words) {
    const m = sectorMetricAt(lt, y);
    const test = cur ? `${cur} ${w}` : w;
    if (measureWidth(test, fontPx) <= m.width) { cur = test; continue; }
    if (!cur) { cur = w; continue; } // a lone word wider than its column: keep it (never loop)
    seat();
    y += lineH; cur = w;
    if (y + lineH > bottom) return { lines, overflow: true }; // next line has no room, words remain
  }
  if (cur) seat();
  return { lines, overflow: false };
}

// The uniform verse font size (px) for this sector: the largest at which the
// LONGEST verse just fits. Device-adaptive; memoised per sector geometry AND
// font-load state (so the fallback-measured size is replaced once the real
// serif arrives).
const verseSizeCache = new Map();
export function uniformVerseFontPx(bounds) {
  const key = `${bounds.SSd}:${bounds.topY}:${bounds.bottomY}:${bounds.leftBound}:${bounds.rightBound}:${verseFontReady()}`;
  const hit = verseSizeCache.get(key);
  if (hit !== undefined) return hit;
  let lo = bounds.SSd * 0.025, hi = bounds.SSd * 0.11;
  for (let i = 0; i < 16; i += 1) {
    const mid = (lo + hi) / 2;
    if (!flowVerseAt(LONGEST_VERSE_REFERENCE, bounds, mid).overflow) lo = mid; else hi = mid;
  }
  verseSizeCache.set(key, lo);
  return lo;
}

// Lay out ONE verse at the shared uniform size. Returns the size to apply and
// the seated lines; a verse longer than the reference (shouldn't happen) has
// its last line ellipsized rather than overrunning the sector.
export function layoutVerse(text, bounds) {
  const fontPx = uniformVerseFontPx(bounds);
  // The size is the one the LONGEST verse fills the sector at, so every verse
  // fits; lines are wrapped to their measured width, so no line runs long.
  // NEVER ellipsise scripture, even on a defensive overflow (Howell 2026-07-22).
  const { lines } = flowVerseAt(text, bounds, fontPx);
  return { fontPx, lines };
}

export function selectFontTier(text, lineTable, tiers = FONT_TIERS) {
  if (!lineTable || lineTable.length === 0) {
    const fb = tiers[tiers.length - 1];
    return [fb[0], fb[1], tierStride(fb[1])];
  }
  const words = text.split(/\s+/).filter(Boolean);
  const linePitch = lineTable.length > 1 ? lineTable[1].y - lineTable[0].y : 0;
  for (const tier of tiers) {
    const [cssClass, pct] = tier;
    const stride = tierStride(pct);
    const seats = stridedRows(lineTable, stride);
    const textLines = estimateLineCount(words, seats, pct);
    if (textLines <= seats.length) {
      if (linePitch > 0) {
        const SSd_approx = linePitch / 0.042;
        const fontHeightPx = (pct / 100) * SSd_approx * (pct >= 6 ? 1.3 : 1.4);
        console.log(
          `[font-tier] selected:${cssClass} (${pct}% SSd)` +
          ` | textLines:${textLines}` +
          ` | stride:${stride}` +
          ` | slotsUsed:${textLines * stride}/${lineTable.length}` +
          ` | linePitch:${linePitch.toFixed(1)}px` +
          ` | fontHeight:${fontHeightPx.toFixed(1)}px` +
          ` | text:"${text.slice(0, 40)}${text.length > 40 ? '\u2026' : ''}"`
        );
      }
      return [cssClass, pct, stride];
    }
  }
  const fb = tiers[tiers.length - 1];
  console.log(`[font-tier] OVERFLOW → fallback:${fb[0]} | text:"${text.slice(0, 40)}"`);
  return [fb[0], fb[1], tierStride(fb[1])];
}

/**
 * Wrap `text` into an array of line strings against the provided line table
 * at the given font tier.  Truncates with '…' if the text overflows.
 *
 * @param {string} text
 * @param {Array<{ maxChars: number }>} lineTable
 * @param {number} tierPercent
 * @returns {string[]}
 */
export function wrapLines(text, lineTable, tierPercent) {
  const scale = 3.0 / tierPercent;
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let lineIdx = 0;
  let current = '';

  for (const word of words) {
    if (lineIdx >= lineTable.length) {
      if (lines.length > 0) lines[lines.length - 1] = lines[lines.length - 1].trimEnd() + '…';
      break;
    }
    const test = current ? `${current} ${word}` : word;
    const maxChars = Math.floor(lineTable[lineIdx].maxChars * scale);
    if (test.length <= maxChars) {
      current = test;
    } else {
      if (current) {
        lines.push(current);
        lineIdx++;
      }
      if (lineIdx >= lineTable.length) {
        if (lines.length > 0) lines[lines.length - 1] = lines[lines.length - 1].trimEnd() + '…';
        break;
      }
      current = word;
    }
  }
  if (current && lineIdx < lineTable.length) lines.push(current);
  return lines;
}

/**
 * Create an absolutely-positioned text span for one arc line.
 *
 * @param {Function} create   - `document.createElement`-compatible factory
 * @param {string}   text     - line text content
 * @param {string}   cssClass - space-separated class string
 * @param {{ y: number, leftX: number, availableWidth: number }} lineInfo
 * @returns {HTMLElement}
 */
export function makeLineSpan(create, text, cssClass, lineInfo, { centerWidth = 0 } = {}) {
  const span = create('span');
  span.className = `detail-text-line ${cssClass}`;
  span.textContent = text;
  if (span.style) {
    span.style.position  = 'absolute';
    span.style.top       = `${lineInfo.y}px`;
    if (centerWidth > 0) {
      // Centered on the VIEWPORT, not within the arc-indented line: the
      // line keeps its vertical seat in the table, but spans the full
      // width so the text sits on the screen's centre line.
      span.style.left      = '0px';
      span.style.width     = `${centerWidth}px`;
      span.style.textAlign = 'center';
    } else {
      span.style.left      = `${lineInfo.leftX}px`;
      span.style.maxWidth  = `${lineInfo.availableWidth}px`;
    }
  }
  return span;
}
