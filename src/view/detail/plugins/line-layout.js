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
 */
export const FONT_TIERS = [
  ['font-tier-1', 4.5],
  ['font-tier-2', 4.0],
  ['font-tier-3', 3.5],
  ['font-tier-4', 3.0]
];

/**
 * Estimate how many lines are needed to render `words` at a given font tier.
 *
 * `lineTable[].maxChars` is calibrated for tier-4 (3% SSd).
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
 * Select the largest font tier whose text fits within the provided line table.
 *
 * Pass a sub-slice of the full line table to enforce a max-line budget.
 * e.g. `selectFontTier(title, lineTable.slice(0, 2))` picks the largest tier
 * that fits the title in at most 2 lines.
 *
 * @param {string} text
 * @param {Array} lineTable
 * @returns {[string, number]} [cssClass, tierPercent]
 */
export function selectFontTier(text, lineTable) {
  if (!lineTable || lineTable.length === 0) return FONT_TIERS[FONT_TIERS.length - 1];
  const words = text.split(/\s+/).filter(Boolean);
  for (const tier of FONT_TIERS) {
    const needed = estimateLineCount(words, lineTable, tier[1]);
    if (needed <= lineTable.length) return tier;
  }
  return FONT_TIERS[FONT_TIERS.length - 1];
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
export function makeLineSpan(create, text, cssClass, lineInfo) {
  const span = create('span');
  span.className = `detail-text-line ${cssClass}`;
  span.textContent = text;
  if (span.style) {
    span.style.position  = 'absolute';
    span.style.left      = `${lineInfo.leftX}px`;
    span.style.top       = `${lineInfo.y}px`;
    span.style.maxWidth  = `${lineInfo.availableWidth}px`;
  }
  return span;
}
