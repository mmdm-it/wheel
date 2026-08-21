import { BaseDetailPlugin } from '../plugin-registry.js';
import { selectFontTier, layoutVerse, wrapLines, makeLineSpan, stridedRows } from './line-layout.js';

export class TextDetailPlugin extends BaseDetailPlugin {
  canHandle(item) {
    return item?.type === 'text' || typeof item?.text === 'string';
  }

  render(item, bounds = {}, options = {}) {
    const create = options.createElement
      || (typeof document !== 'undefined' ? document.createElement.bind(document) : null);
    if (!create) throw new Error('TextDetailPlugin.render: no createElement available');

    const text = item?.text ?? item?.name ?? '';
    const lineTable = bounds?.lineTable;

    // ── Arc-following layout ─────────────────────────────────────────
    if (lineTable && lineTable.length > 0) {
      // Verses share ONE continuous size — the largest at which the longest
      // verse fills the sector — and flow at their true line height, so the
      // page reads calm and constant, filling the sector (Howell 2026-07-21).
      // Everything else keeps the discrete tiers, fit to its own text.
      if (item?.uniform) {
        // O-84: a verse that doesn't fit whole shows in two parts, and the
        // host says which part the reader is on (the ring's partial eclipse
        // is the visible half of the same state).
        const { fontPx, lines } = layoutVerse(text, bounds, item.part === 1 ? 1 : 0);
        const container = create('div');
        container.className = 'detail-sector-content detail-text detail-text--arc';
        if (container.style) container.style.fontSize = `${fontPx.toFixed(1)}px`;
        // W-1: the script the text is actually in. `lang` drives the CSS's
        // long-dormant RTL rules (and the browser's font/shaping choice);
        // `dir` states the run direction outright, so the Hebrew reads
        // right-to-left instead of pretending to be Latin.
        if (item.lang && container.setAttribute) container.setAttribute('lang', item.lang);
        if (item.dir && container.setAttribute) container.setAttribute('dir', item.dir);
        const rtl = item.dir === 'rtl';
        lines.forEach(lineInfo => {
          container.appendChild(makeLineSpan(create, lineInfo.text, '', lineInfo, { rtl }));
        });
        // (W-6's flagged-Latin mark — an italic voice and a footer naming the
        // substitute — was removed 2026-07-30 with the substitution itself:
        // NO ASTERISKS. A reader now sees their own edition or nothing.)
        return container;
      }

      const [tierClass, tierPercent, stride] = selectFontTier(text, lineTable);

      const container = create('div');
      container.className = `detail-sector-content detail-text detail-text--arc ${tierClass}`;

      const SSd = bounds.SSd;
      if (SSd && container.style?.setProperty) {
        container.style.setProperty('--detail-SSd', `${SSd}px`);
      }

      // Wrap against the rows the lines will actually SIT on (every
      // stride-th row) — the fence narrows with depth, and budgeting from
      // sequential rows overflowed deep seats (Phase C audit M2).
      const seats = stridedRows(lineTable, stride);
      const wrappedLines = wrapLines(text, seats, tierPercent);
      wrappedLines.forEach((lineText, idx) => {
        const lineInfo = seats[idx];
        if (!lineInfo) return;
        container.appendChild(makeLineSpan(create, lineText, '', lineInfo));
      });

      return container;
    }

    // ── Fallback: plain text (legacy / test path) ───────────────────
    const container = create('div');
    container.className = 'detail-sector-content detail-text';
    container.textContent = text;
    if (container.style) {
      if (bounds?.width)  container.style.maxWidth  = `${bounds.width}px`;
      if (bounds?.height) container.style.maxHeight = `${bounds.height}px`;
    }
    return container;
  }

  getMetadata() {
    return { name: 'TextDetailPlugin', version: '1.0.0', contentTypes: ['text'] };
  }
}

