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
