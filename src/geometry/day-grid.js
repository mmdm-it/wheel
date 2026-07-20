// The day grid: a 7-column, Sunday-start week-grid pyramid — the one child
// pyramid that is an ARRAY, not a star field (Howell 2026-07-19). Its dance
// is a RIBBON: the infinite week-grid of the whole timeline scrolling
// through the CPUA window, mechanically coupled to ring rotation (the
// sprocket doctrine — a second chain geared to the ring). On settle, the
// window hard-crops to the magnified month's own weeks.
//
// Everything here is arithmetic — month lengths, weekdays, leap years —
// computed, never fetched. Proleptic Gregorian throughout; the Julian
// rules and October 1582's ten missing days are C.6's seam, marked below.
//
// Pure module: geometry in, geometry out; no DOM access.

import { computeCPUA } from './usable-areas.js';

const DAYS_PER_WEEK = 7;

// Astronomical year for arithmetic: the timeline has no year zero, so
// 1 BC (yearNumber -1) is astronomical 0, 2 BC is -1, etc.
const astro = yearNumber => (yearNumber < 0 ? yearNumber + 1 : yearNumber);

export function isLeapYear(yearNumber) {
  const y = astro(yearNumber);
  // C.6 seam: proleptic GREGORIAN leap rule for all years; before the 1582
  // reform the historical rule was JULIAN (every 4th year) — revisit with
  // the days ring.
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

const MONTH_LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export function daysInMonth(yearNumber, month) {
  if (month === 2 && isLeapYear(yearNumber)) return 29;
  return MONTH_LENGTHS[month - 1] ?? 30;
}

// Serial day number (days since 1970-01-01) via the days-from-civil
// algorithm — valid across negative years. 0 = 1970-01-01 (a Thursday).
export function daySerial(yearNumber, month, day) {
  let y = astro(yearNumber);
  const m = month;
  y -= m <= 2 ? 1 : 0;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + day - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

// 0 = Sunday … 6 = Saturday (Howell: weeks start on Sunday).
export function dayOfWeek(yearNumber, month, day) {
  const s = daySerial(yearNumber, month, day);
  return ((s + 4) % 7 + 7) % 7; // serial 0 = Thursday = 4
}

// Inverse of daySerial — needed to label ribbon cells during the scroll.
export function serialToDate(serial) {
  let z = serial + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  let y = yoe + era * 400;
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const day = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const month = mp + (mp < 10 ? 3 : -9);
  y += month <= 2 ? 1 : 0;
  // Back to no-year-zero numbering.
  const yearNumber = y <= 0 ? y - 1 : y;
  return { yearNumber, month, day };
}

/**
 * The settled view: the magnified month's own weeks, hard-cropped —
 * cells outside the month are absent (Howell: no dimmed neighbors).
 * Returns rows of 7 slots; empty slots are null.
 */
export function monthWeeks(yearNumber, month) {
  const lead = dayOfWeek(yearNumber, month, 1);
  const count = daysInMonth(yearNumber, month);
  const rows = [];
  let row = new Array(DAYS_PER_WEEK).fill(null);
  let col = lead;
  for (let d = 1; d <= count; d += 1) {
    row[col] = d;
    col += 1;
    if (col === DAYS_PER_WEEK) {
      rows.push(row);
      row = new Array(DAYS_PER_WEEK).fill(null);
      col = 0;
    }
  }
  if (col > 0) rows.push(row);
  return rows;
}

/**
 * Layout the day-grid pyramid inside the usable region.
 *
 * At rest (rotating=false): the magnified month's weeks, hard-cropped.
 * In motion (rotating=true): the RIBBON — continuous week rows around the
 * fractional timeline position, every cell labeled with its true date,
 * cells of the anchor month full-strength, neighbors present but dimmed
 * (continuity is the point of the ribbon; the crop applies at rest).
 *
 * @param {Object} viewport      getViewportInfo output
 * @param {Object} magnifier     magnifier position {x, y}
 * @param {Object} opts          { yearNumber, month, fraction, rotating, logoBounds }
 * @returns {{ nodes: Array, gridMode: true }}
 */
export function computeDayGridLayout(viewport, magnifier, arcParams = {}, opts = {}) {
  const width = viewport.width ?? 0;
  const SSd = viewport.SSd ?? width;
  const magnifierY = magnifier.y ?? magnifier.cy ?? 0;
  const { yearNumber = 1, month = 1, fraction = 0, rotating = false, logoBounds = null } = opts;

  // Region: THE canonical CPUA (usable-areas.js). The grid additionally
  // refuses holes: its bottom row must clear the magnifier's vessel zone
  // entirely, so its effective floor is the vessel's top edge when that is
  // higher than the CPUA floor — derived from canon, not a local margin.
  const cpua = computeCPUA(viewport, arcParams, magnifier, { logoBounds });
  const top = cpua.top;
  const bottom = cpua.bottom; // the control-deck floor already clears the magnifier
  const baseLeft = Math.max(cpua.left, SSd * 0.04); // half-cell breathing off the raw edge
  const right = cpua.right;
  const cols = DAYS_PER_WEEK;

  const fitGrid = rowsCount => {
    let left = baseLeft;
    let cellW = (right - left) / cols;
    let rowH = rotating ? cellW : Math.min(cellW, (bottom - top) / Math.max(rowsCount, 1));
    for (let i = 0; i < 3; i += 1) {
      const bottomRowY = rotating ? bottom - rowH / 2 : top + (rowsCount - 0.5) * rowH;
      const minX = cpua.arcXAt(bottomRowY);
      left = Math.max(baseLeft, (Number.isFinite(minX) ? minX : baseLeft) + cellW * 0.4);
      cellW = (right - left) / cols;
      rowH = rotating ? cellW : Math.min(cellW, (bottom - top) / Math.max(rowsCount, 1));
    }
    return { left, cellW, rowH };
  };

  const nodes = [];
  const makePushCell = (left, cellW, nodeR, labelFontPx) => (colIdx, y, dayNum, dim, key) => {
    const x = left + (colIdx + 0.5) * cellW;
    if (y < top + nodeR || y > bottom - nodeR) return;
    // Canon safety net: a cell the CPUA rejects is not drawn (the fitted
    // grid should already sit inside; this is belt-and-suspenders).
    if (!cpua.contains(x, y, Math.min(nodeR, cellW * 0.2))) return;
    nodes.push({
      id: key,
      label: String(dayNum),
      item: { id: key, name: String(dayNum), level: 'day' },
      arc: 'grid',
      // The view rotates every pyramid label by (angle + 180°); π here makes
      // that identity — angle 0 rendered the numbers upside-down.
      angle: Math.PI,
      x,
      y,
      r: nodeR,
      labelScale: 1,
      labelFontPx,
      dim: Boolean(dim)
    });
  };

  if (!rotating) {
    const rows = monthWeeks(yearNumber, month);
    const { left, cellW, rowH } = fitGrid(rows.length);
    const nodeR = Math.min(cellW * 0.36, SSd * 0.032);
    const labelFontPx = Math.max(11, Math.min(20, nodeR * 1.05));
    const pushCell = makePushCell(left, cellW, nodeR, labelFontPx);
    rows.forEach((row, ri) => {
      row.forEach((dayNum, ci) => {
        if (dayNum === null) return; // hard crop — no neighbors at rest
        pushCell(ci, top + (ri + 0.5) * rowH, dayNum, false, `d:${yearNumber}:${month}:${dayNum}`);
      });
    });
    return { nodes, gridMode: true };
  }

  // The ribbon: continuous week rows around the fractional position.
  const ribbonRows = Math.max(3, Math.floor((bottom - top) / ((right - baseLeft) / cols)));
  const { left, cellW, rowH } = fitGrid(ribbonRows);
  const nodeR = Math.min(cellW * 0.36, SSd * 0.032);
  const labelFontPx = Math.max(11, Math.min(20, nodeR * 1.05));
  const pushCell = makePushCell(left, cellW, nodeR, labelFontPx);
  const visibleRows = Math.max(3, Math.floor((bottom - top) / rowH));
  const monthStart = daySerial(yearNumber, month, 1);
  const serialFloat = monthStart + fraction * daysInMonth(yearNumber, month);
  // Week row index of a serial: rows count from the week containing serial 0,
  // aligned to Sunday (serial 0 is a Thursday; Sunday of that week is -4).
  const rowFloat = (serialFloat + 4) / DAYS_PER_WEEK;
  const firstRow = Math.floor(rowFloat) - Math.floor(visibleRows / 2);
  const subRow = rowFloat - Math.floor(rowFloat);
  for (let r = firstRow; r <= firstRow + visibleRows + 1; r += 1) {
    const sundaySerial = r * DAYS_PER_WEEK - 4;
    const y = top + (r - firstRow - subRow + 0.5) * rowH;
    for (let c = 0; c < cols; c += 1) {
      const date = serialToDate(sundaySerial + c);
      const inAnchor = date.yearNumber === yearNumber && date.month === month;
      pushCell(c, y, date.day, !inAnchor, `d:${date.yearNumber}:${date.month}:${date.day}`);
    }
  }
  return { nodes, gridMode: true };
}
