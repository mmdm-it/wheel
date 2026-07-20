import { BaseDetailPlugin } from '../plugin-registry.js';
import { makeLineSpan } from './line-layout.js';

// The day ephemeris card — the wall print's day cell as a Detail Sector
// payload (docs/DETAIL_SECTOR_LOADS.md). Weekday at the top (NO date — the
// magnifier already carries it; Howell: no redundancy), then the ephemeris
// rows: alba/tramonto, alta/bassa marea, moon quarter when the print names
// one. Feast days wear the print's red on the weekday. Pure display: in
// this volume the sector tap means NEXT, so nothing here is interactive.

/** Blank-line gap after the title. */
const SECTION_GAP = 1;

export class EphemerisDetailPlugin extends BaseDetailPlugin {
  canHandle(item) {
    return item?.type === 'ephemeris';
  }

  render(item, bounds = {}, options = {}) {
    const create = options.createElement
      || (typeof document !== 'undefined' ? document.createElement.bind(document) : null);
    if (!create) throw new Error('EphemerisDetailPlugin.render: no createElement available');

    const titleText = item?.title ?? '';
    const titleClass = item?.festivo
      ? 'detail-ephemeris-title detail-ephemeris-title--festivo'
      : 'detail-ephemeris-title';
    const rows = Array.isArray(item?.rows) ? item.rows : [];
    const lineTable = bounds?.lineTable;

    // ── Arc-following layout (the live sector) ─────────────────────────
    // Sizing rulings (Howell 2026-07-20): the weekday wears the parent
    // button's own font (its size lives in CSS, not a tier); the numbers
    // are twice the old tier, sit lower, and CENTER within each line's
    // fence-bounded span — away from the ring, in the middle of the
    // sector's real estate.
    if (lineTable && lineTable.length > 0) {
      const container = create('div');
      container.className = 'detail-sector-content detail-ephemeris--arc';
      if (bounds.SSd && container.style?.setProperty) {
        container.style.setProperty('--detail-SSd', `${bounds.SSd}px`);
      }
      let lineIdx = 0;
      if (titleText && lineIdx < lineTable.length) {
        container.appendChild(
          makeLineSpan(create, titleText, titleClass, lineTable[lineIdx],
            { centerWidth: item?.titleAlign === 'center' ? (bounds?.width || 0) : 0 })
        );
        lineIdx += 2 + SECTION_GAP; // the parent-size weekday spans ~2 pitches
      }
      rows.forEach(text => {
        if (lineIdx >= lineTable.length) return;
        const line = lineTable[lineIdx];
        const span = create('span');
        span.className = 'detail-text-line detail-ephemeris-row';
        span.textContent = text;
        if (span.style) {
          span.style.position = 'absolute';
          span.style.top = `${line.y}px`;
          span.style.left = `${line.leftX}px`;
          span.style.width = `${line.availableWidth}px`;
          span.style.textAlign = 'center';
        }
        container.appendChild(span);
        lineIdx += 2; // double-size rows breathe two pitches apart
      });
      return container;
    }

    // ── Fallback: simple stacked rows (tests, no line table) ───────────
    const card = create('div');
    card.className = 'detail-sector-content detail-ephemeris';
    const title = create('div');
    title.className = titleClass;
    title.textContent = titleText;
    if (item?.titleAlign === 'center' && title.style) title.style.textAlign = 'center';
    card.appendChild(title);
    rows.forEach(text => {
      const row = create('div');
      row.className = 'detail-ephemeris-row';
      row.textContent = text;
      card.appendChild(row);
    });
    return card;
  }

  getMetadata() {
    return { name: 'EphemerisDetailPlugin', version: '1.0.0', contentTypes: ['ephemeris'] };
  }
}
