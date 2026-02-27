import { BaseDetailPlugin } from '../plugin-registry.js';
import { selectFontTier, wrapLines, makeLineSpan } from './line-layout.js';

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
      const [tierClass, tierPercent] = selectFontTier(text, lineTable);

      const container = create('div');
      container.className = `detail-sector-content detail-text detail-text--arc ${tierClass}`;

      const SSd = bounds.SSd;
      if (SSd && container.style?.setProperty) {
        container.style.setProperty('--detail-SSd', `${SSd}px`);
      }

      const wrappedLines = wrapLines(text, lineTable, tierPercent);
      wrappedLines.forEach((lineText, idx) => {
        const lineInfo = lineTable[idx];
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

