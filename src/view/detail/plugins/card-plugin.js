import { BaseDetailPlugin } from '../plugin-registry.js';
import { selectFontTier, wrapLines, makeLineSpan } from './line-layout.js';

/** Maximum lines to allocate to the title section. */
const TITLE_MAX_LINES = 2;
/** Maximum lines to allocate to the body subtitle. */
const BODY_MAX_LINES  = 2;
/** Number of blank-line gaps between sections. */
const SECTION_GAP     = 1;

export class CardDetailPlugin extends BaseDetailPlugin {
  canHandle(item) {
    return item?.type === 'card' || (item && item.title && item.body);
  }

  render(item, bounds = {}, options = {}) {
    const create = options.createElement
      || (typeof document !== 'undefined' ? document.createElement.bind(document) : null);
    if (!create) throw new Error('CardDetailPlugin.render: no createElement available');

    const lineTable = bounds?.lineTable;

    // ── Arc-following layout ─────────────────────────────────────────
    if (lineTable && lineTable.length > 0) {
      const SSd = bounds.SSd;
      const container = create('div');
      container.className = 'detail-sector-content detail-card--arc';
      if (SSd && container.style?.setProperty) {
        container.style.setProperty('--detail-SSd', `${SSd}px`);
      }

      let lineIdx = 0;

      // ── Title: largest tier that fits in TITLE_MAX_LINES ────────────
      const titleText = item?.title ?? item?.name ?? '';
      if (titleText && lineIdx < lineTable.length) {
        const titleBudget = lineTable.slice(lineIdx, lineIdx + TITLE_MAX_LINES);
        const [tierClass, tierPercent] = selectFontTier(titleText, titleBudget);
        const titleLines = wrapLines(titleText, lineTable.slice(lineIdx), tierPercent)
          .slice(0, TITLE_MAX_LINES);
        titleLines.forEach(text => {
          if (lineIdx >= lineTable.length) return;
          container.appendChild(
            makeLineSpan(create, text, `detail-card-title ${tierClass}`, lineTable[lineIdx++])
          );
        });
      }

      // ── Body subtitle at tier-4 ──────────────────────────────
      const bodyText = item?.body ?? item?.text ?? '';
      if (bodyText && lineIdx < lineTable.length) {
        const bodyLines = wrapLines(bodyText, lineTable.slice(lineIdx), 3.0)
          .slice(0, BODY_MAX_LINES);
        bodyLines.forEach(text => {
          if (lineIdx >= lineTable.length) return;
          container.appendChild(
            makeLineSpan(create, text, 'detail-card-body font-tier-4', lineTable[lineIdx++])
          );
        });
      }

      // ── Description: remaining lines at tier-4 ──────────────────
      const descText = item?.description ?? '';
      if (descText && lineIdx < lineTable.length) {
        lineIdx += SECTION_GAP; // blank line before description
        const descLines = wrapLines(descText, lineTable.slice(lineIdx), 3.0);
        descLines.forEach(text => {
          if (lineIdx >= lineTable.length) return;
          container.appendChild(
            makeLineSpan(create, text, 'detail-card-description font-tier-4', lineTable[lineIdx++])
          );
        });
      }

      return container;
    }

    // ── Fallback: simple stacked card (no line table) ───────────────
    const card = create('div');
    card.className = 'detail-sector-content detail-card';

    if (item?.image) {
      const img = create('img');
      img.className = 'detail-card-image';
      img.alt = item?.title ?? item?.name ?? '';
      img.src = item.image;
      card.appendChild(img);
    }

    const title = create('div');
    title.className = 'detail-card-title';
    title.textContent = item?.title ?? item?.name ?? '';
    card.appendChild(title);

    const body = create('div');
    body.className = 'detail-card-body';
    body.textContent = item?.body ?? item?.text ?? '';
    card.appendChild(body);

    if (item?.description) {
      const desc = create('div');
      desc.className = 'detail-card-description';
      desc.textContent = item.description;
      card.appendChild(desc);
    }

    if (card.style) {
      if (bounds?.width)  card.style.maxWidth  = `${bounds.width}px`;
      if (bounds?.height) card.style.maxHeight = `${bounds.height}px`;
    }
    return card;
  }

  getMetadata() {
    return { name: 'CardDetailPlugin', version: '1.0.0', contentTypes: ['card'] };
  }
}
