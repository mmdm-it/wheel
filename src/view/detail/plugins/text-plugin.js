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
        const { fontPx, lines } = layoutVerse(text, bounds);
        const container = create('div');
        container.className = 'detail-sector-content detail-text detail-text--arc';
        if (container.style) container.style.fontSize = `${fontPx.toFixed(1)}px`;
        lines.forEach(lineInfo => {
          container.appendChild(makeLineSpan(create, lineInfo.text, '', lineInfo));
        });
        // W-6, FLAGGED LATIN — THE RULED MARK (Howell, bench 2026-07-27,
        // from three sketches): a verse whose text is a SUBSTITUTE (the
        // reader's edition lacks it; the Vulgate stands in) speaks in
        // ITALIC, with a small upright footer notice in the READER'S chosen
        // language, RIGHT-aligned so it reads as an annotation, never as
        // the verse's last line. (Consequence noted in the ledger: italics
        // now mean substitution — W-2's supplied-words rendering must find
        // another voice.)
        if (item?.substituted && lines.length) {
          const last = lines[lines.length - 1];
          container.className += ' detail-substituted--italic';
          const s = create('span');
          s.className = 'detail-text-line detail-sub-footer';
          s.textContent = item.substituted.notice || 'latin text · translation not available';
          if (s.style) {
            s.style.position = 'absolute';
            s.style.top = `${(last.y + fontPx * 1.45)}px`;
            s.style.left = `${last.leftX}px`;
            s.style.width = `${last.availableWidth}px`;
            s.style.textAlign = 'right';
          }
          container.appendChild(s);
        }
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

