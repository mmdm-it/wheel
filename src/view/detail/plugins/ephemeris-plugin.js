import { BaseDetailPlugin } from '../plugin-registry.js';
import { NOW_NODE_FILL, NOW_LABEL_FILL } from '../../node-appearance.js';
import { makeLineSpan } from './line-layout.js';

// The day ephemeris card — the wall print's day cell as a Detail Sector
// payload (docs/DETAIL_SECTOR_LOADS.md). Weekday at the top (NO date — the
// magnifier already carries it; Howell: no redundancy), then the day's own
// rows (another reckoning's name for the day), and AT THE FOOT of the sector
// Fano's tables: alba/tramonto, alta/bassa marea, moon quarter when the
// print names one (O-255, Howell 2026-10-30: "move them down to the bottom
// of the detail sector, staying a safe distance away from the dimension
// slider, and make the font about half as big. It can be very small"). The
// tables take the LAST lines of the table that lie above the deck — the
// host passes the slider's top, less a safe distance, as bounds.deckTop —
// one pitch apart, at the small tier. Pure display: in this volume the
// sector tap means NEXT, so nothing here is interactive.

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
    // TODAY'S CARD WEARS THE NOW COLOURS (O-247): the weekday in yellow on
    // a red disc — the same two fills the ring node and the star wear — and
    // nothing else on the card is ever coloured (the Sunday red is retired).
    const titleClass = item?.now
      ? 'detail-ephemeris-title detail-ephemeris-title--now'
      : 'detail-ephemeris-title';
    const dressNow = span => {
      if (!item?.now || !span?.style) return span;
      const word = create('span');
      word.className = 'detail-now-word';
      word.textContent = span.textContent;
      word.style.color = NOW_LABEL_FILL;
      const disc = create('span');
      disc.className = 'detail-now-disc';
      disc.style.background = NOW_NODE_FILL;
      span.textContent = '';
      span.appendChild(disc);
      span.appendChild(word);
      return span;
    };
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
        container.appendChild(dressNow(
          makeLineSpan(create, titleText, titleClass, lineTable[lineIdx],
            { centerWidth: item?.titleAlign === 'center' ? (bounds?.width || 0) : 0 })
        ));
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
      // Fano's tables at the foot: the last lines above the deck, in order,
      // never climbing into the rows above.
      const tables = Array.isArray(item?.tables) ? item.tables : [];
      const deckTop = Number.isFinite(bounds?.deckTop) ? bounds.deckTop : Infinity;
      const pitch = lineTable.length > 1 ? lineTable[1].y - lineTable[0].y : 0;
      const clear = lineTable.filter((line, i) => i >= lineIdx && line.y + pitch <= deckTop);
      clear.slice(-tables.length).forEach((line, i) => {
        const span = create('span');
        span.className = 'detail-text-line detail-ephemeris-table';
        span.textContent = tables[tables.length - Math.min(tables.length, clear.length) + i];
        if (span.style) {
          span.style.position = 'absolute';
          span.style.top = `${line.y}px`;
          span.style.left = `${line.leftX}px`;
          span.style.width = `${line.availableWidth}px`;
          span.style.textAlign = 'center';
        }
        container.appendChild(span);
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
    card.appendChild(dressNow(title));
    rows.forEach(text => {
      const row = create('div');
      row.className = 'detail-ephemeris-row';
      row.textContent = text;
      card.appendChild(row);
    });
    (Array.isArray(item?.tables) ? item.tables : []).forEach(text => {
      const row = create('div');
      row.className = 'detail-ephemeris-table';
      row.textContent = text;
      card.appendChild(row);
    });
    return card;
  }

  getMetadata() {
    return { name: 'EphemerisDetailPlugin', version: '1.0.0', contentTypes: ['ephemeris'] };
  }
}
