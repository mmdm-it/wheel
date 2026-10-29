// The day grid: a 7-column, Sunday-start week-grid pyramid — the one child
// pyramid that is an ARRAY, not a star field (Howell 2026-07-19). Its dance
// is a RIBBON: the infinite week-grid of the whole timeline scrolling
// through the CPUA window, mechanically coupled to ring rotation (the
// sprocket doctrine — a second chain geared to the ring). On settle, the
// window hard-crops to the magnified month's own weeks.
//
// Everything here is arithmetic — month lengths, weekdays, leap years —
// computed, never fetched.
//
// THE RECKONING IS HISTORICAL, NOT PROLEPTIC (Howell's 1582 ruling): dates
// from 15 October 1582 onward are GREGORIAN; everything before 4 October
// 1582 is JULIAN, the reckoning those days were actually lived under. The
// ten days between — 5–14 October 1582 — never existed, and this module
// simply cannot produce them. The seam is not a special case bolted onto
// the grid: it falls out of the arithmetic, because serials count REAL
// ELAPSED DAYS and no serial maps to a day nobody lived.
//
// Two consequences worth knowing: the WEEKDAY CYCLE IS UNBROKEN across
// the reform (Thursday 4 Oct is followed by Friday 15 Oct — Gregory moved
// the date, never the week), and pre-reform leap years follow the Julian
// rule (every 4th year, no century exception), so 1500 and 1300 are leap.
//
// Pure module: geometry in, geometry out; no DOM access.

import { computeCPUA } from './usable-areas.js';

const DAYS_PER_WEEK = 7;

// Astronomical year for arithmetic: the timeline has no year zero, so
// 1 BC (yearNumber -1) is astronomical 0, 2 BC is -1, etc.
const astro = yearNumber => (yearNumber < 0 ? yearNumber + 1 : yearNumber);

// Gregory XIII's reform: the last Julian day, the first Gregorian day,
// and the ten ghosts in between.
export const GREGORIAN_REFORM = {
  yearNumber: 1582,
  month: 10,
  lastJulianDay: 4,
  firstGregorianDay: 15,
  missingDays: [5, 6, 7, 8, 9, 10, 11, 12, 13, 14]
};

// Epoch offsets for the two civil-date algorithms (both put serial 0 at
// 1970-01-01, a Thursday); the Julian constant differs by the two days
// the two reckonings had already drifted apart by year 1.
const GREGORIAN_EPOCH_SHIFT = -719468;
const JULIAN_EPOCH_SHIFT = -719470;

const gregorianSerial = (yearNumber, month, day) => {
  const y = astro(yearNumber) - (month <= 2 ? 1 : 0);
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const doy = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe + GREGORIAN_EPOCH_SHIFT;
};

// The Julian analog: the same March-anchored civil algorithm on a plain
// 4-year cycle (1461 days), with no century exception to subtract.
const julianSerial = (yearNumber, month, day) => {
  const y = astro(yearNumber) - (month <= 2 ? 1 : 0);
  const doy = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1;
  return 365 * y + Math.floor(y / 4) + doy + JULIAN_EPOCH_SHIFT;
};

// The instant the Gregorian reckoning begins: serial of 15 October 1582.
export const REFORM_SERIAL = gregorianSerial(
  GREGORIAN_REFORM.yearNumber, GREGORIAN_REFORM.month, GREGORIAN_REFORM.firstGregorianDay
);

// Which reckoning was this date lived under?
const isJulianDate = (yearNumber, month, day) => (
  yearNumber < GREGORIAN_REFORM.yearNumber
  || (yearNumber === GREGORIAN_REFORM.yearNumber
    && (month < GREGORIAN_REFORM.month
      || (month === GREGORIAN_REFORM.month && day <= GREGORIAN_REFORM.lastJulianDay)))
);

/**
 * Did this date ever happen? False for exactly the ten days Gregory cut
 * out of October 1582 (and only those — every other slot in the timeline
 * is a day someone lived through).
 */
export function dayExists(yearNumber, month, day) {
  return !(yearNumber === GREGORIAN_REFORM.yearNumber
    && month === GREGORIAN_REFORM.month
    && day > GREGORIAN_REFORM.lastJulianDay
    && day < GREGORIAN_REFORM.firstGregorianDay);
}

export function isLeapYear(yearNumber) {
  const y = astro(yearNumber);
  // Julian rule before the reform, Gregorian from 1582 on. (The two rules
  // agree on every year from 1582 until 1700 — the first century year the
  // reform actually changed — so the switch year is not observable here.)
  if (yearNumber < GREGORIAN_REFORM.yearNumber) return y % 4 === 0;
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

const MONTH_LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/**
 * The number the month's LAST DAY wears (October 1582 still ends on the
 * 31st). For how many days a month actually contained, see monthDaySpan.
 */
export function daysInMonth(yearNumber, month) {
  if (month === 2 && isLeapYear(yearNumber)) return 29;
  return MONTH_LENGTHS[month - 1] ?? 30;
}

/**
 * How many days the month REALLY held — 21 for October 1582, where the
 * last day is still the 31st. This is the honest measure for anything
 * that paces or scrolls through a month.
 */
export function monthDaySpan(yearNumber, month) {
  const nextMonth = month === 12 ? 1 : month + 1;
  let nextYear = month === 12 ? yearNumber + 1 : yearNumber;
  if (month === 12 && nextYear === 0) nextYear = 1; // no year zero
  return daySerial(nextYear, nextMonth, 1) - daySerial(yearNumber, month, 1);
}

/**
 * Serial day number: REAL ELAPSED DAYS, 0 = 1970-01-01 (a Thursday).
 * Julian arithmetic before the reform, Gregorian after, so the count
 * never includes a day nobody lived. The ten ghost days of October 1582
 * have no serial of their own; should one be asked for (a hand-typed
 * URL, say), it resolves to the moment the reckoning resumed.
 */
export function daySerial(yearNumber, month, day) {
  if (!dayExists(yearNumber, month, day)) return REFORM_SERIAL;
  return isJulianDate(yearNumber, month, day)
    ? julianSerial(yearNumber, month, day)
    : gregorianSerial(yearNumber, month, day);
}

// 0 = Sunday … 6 = Saturday (Howell: weeks start on Sunday). Derived from
// the serial, so the week runs unbroken straight through the reform.
export function dayOfWeek(yearNumber, month, day) {
  const s = daySerial(yearNumber, month, day);
  return ((s + 4) % 7 + 7) % 7; // serial 0 = Thursday = 4
}

const civilFromDayOfYear = (yearShifted, doy) => {
  const mp = Math.floor((5 * doy + 2) / 153);
  const day = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const month = mp + (mp < 10 ? 3 : -9);
  const y = yearShifted + (month <= 2 ? 1 : 0);
  // Back to no-year-zero numbering.
  return { yearNumber: y <= 0 ? y - 1 : y, month, day };
};

// Inverse of daySerial — needed to label ribbon cells during the scroll.
// Never returns one of the ten ghosts: they have no serial to arrive on.
export function serialToDate(serial) {
  if (serial < REFORM_SERIAL) {
    const z = serial - JULIAN_EPOCH_SHIFT;
    const quad = Math.floor(z / 1461);
    const rem = z - quad * 1461;
    let yearOfQuad = Math.floor(rem / 365);
    if (yearOfQuad === 4) yearOfQuad = 3; // the leap day closing the cycle
    return civilFromDayOfYear(quad * 4 + yearOfQuad, rem - yearOfQuad * 365);
  }
  const z = serial - GREGORIAN_EPOCH_SHIFT;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  return civilFromDayOfYear(yoe + era * 400, doy);
}

/**
 * The settled view: the magnified month's own weeks, hard-cropped —
 * cells outside the month are absent (Howell: no dimmed neighbors).
 * Returns rows of 7 slots; empty slots are null.
 *
 * Walks the month by SERIAL rather than counting 1..31, so October 1582
 * lays itself down as history did — ...3, 4, 15, 16... in adjacent seats,
 * the week unbroken and the jump living in the numerals.
 */
export function monthWeeks(yearNumber, month) {
  const first = daySerial(yearNumber, month, 1);
  const last = first + monthDaySpan(yearNumber, month) - 1;
  const rows = [];
  let row = new Array(DAYS_PER_WEEK).fill(null);
  let col = ((first + 4) % 7 + 7) % 7;
  for (let serial = first; serial <= last; serial += 1) {
    row[col] = serialToDate(serial).day;
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
 * THE WEDGE LATTICE (designed live with Howell, 2026-07-19 evening): the
 * day grid is not rectangular — it is a wedge of the instrument's own
 * radial grammar. A SECOND HUB sits on the magnifier→hub axis beyond the
 * original (making the wedge less wedge-shaped, more square); six RAYS at
 * 2° spacing are the week rows; seven concentric ARCS are the weekday
 * columns, Sunday on the OUTERMOST arc (nearest the ring band). Day
 * numerals sit on the intersections. The lattice itself is invisible —
 * only the ?wedge=1 diagnostic draws it, from this same math.
 */
export const WEDGE = {
  HUB_DIST_MUL: 1.5,   // second hub: this × the magnifier→hub distance
  FAN_ROTATION_DEG: 14, // whole fan clockwise off the axis (13 + Howell's +1)
  RAY_STEP_DEG: 2,      // between week rows
  // Seven rays: index 0 = the TOP ray, the WEEKDAY HEADER (S M T W T F S);
  // indices 1..6 = week rows 1..6. In this quadrant of the circle,
  // INCREASING angle moves UP the screen.
  RAY_OFFSETS_DEG: [4, 2, 0, -2, -4, -6, -8]
};

export const WEEKDAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function computeWedgeLattice(viewport, arcParams, magnifier) {
  const width = viewport.width ?? 0;
  const SSd = viewport.SSd ?? width;
  const magX = magnifier.x ?? magnifier.cx ?? 0;
  const magY = magnifier.y ?? magnifier.cy ?? 0;
  const hubX = arcParams.hubX ?? width * 2;
  const hubY = arcParams.hubY ?? 0;

  const dx = hubX - magX;
  const dy = hubY - magY;
  const d1 = Math.hypot(dx, dy) || 1;
  const hub2 = {
    x: magX + (dx / d1) * d1 * WEDGE.HUB_DIST_MUL,
    y: magY + (dy / d1) * d1 * WEDGE.HUB_DIST_MUL
  };
  const base = Math.atan2(magY - hub2.y, magX - hub2.x)
    + (WEDGE.FAN_ROTATION_DEG * Math.PI) / 180;

  // Radii: derived from what is ON THE GLASS, canonically (volume-
  // independent — anchoring to the logo made the lattice shift between
  // volumes, and blind construction let inner columns fall off other
  // viewports). The innermost arc (Saturday) sits just inside the reach
  // of the canonical top-right corner — the closest any arc can come to
  // the screen — and the outermost (Sunday) just short of the ring band
  // at the magnifier; seven even steps between.
  const rBand = Math.hypot(magX - hub2.x, magY - hub2.y);
  const corner = { x: width - SSd * 0.02, y: SSd * 0.15 };
  const rCorner = Math.hypot(corner.x - hub2.x, corner.y - hub2.y);
  // Howell's tuned construction: gaps of 1/8 the corner→band span, family
  // clustered toward the corner (Sunday well SHORT of the band — the
  // visible-span first cut stretched it nearly to the ring). Tightened a
  // touch further per the second sitting.
  const step = ((rBand - rCorner) / 8) * 0.765; // 0.9, tightened 15% more —
                                                // anchored at the INNERMOST arc
                                                // (Saturday holds; larger arcs
                                                // draw inward)
  // Binding cell: the BOTTOM ray (most clockwise, furthest right at small
  // radii) at the innermost arc must stay on the glass — solve exactly.
  const lowRayAngle = base + (WEDGE.RAY_OFFSETS_DEG[6] * Math.PI) / 180;
  const cosLow = Math.cos(lowRayAngle);
  const rEdge = cosLow < 0
    ? (hub2.x - (width - SSd * 0.045)) / -cosLow
    : 0;
  const rIn = Math.max(rCorner - step * 1.5, rEdge); // Saturday


  return {
    hub2,
    base,
    step,
    // Ray index 0 = the weekday header; weeks 1..6 sit on rays 1..6.
    rayAngle: idx => base + ((WEDGE.RAY_OFFSETS_DEG[idx] ?? 0) * Math.PI) / 180,
    // Continuous version for the rotating ribbon: fractional rows allowed;
    // rowOffset 0 = week row 1's ray; later weeks descend (decreasing angle).
    angleForRowOffset: rowOffset => base
      + ((WEDGE.RAY_OFFSETS_DEG[1] - rowOffset * WEDGE.RAY_STEP_DEG) * Math.PI) / 180,
    // Weekday column (0 = Sunday … 6 = Saturday) → radius; SUNDAY is the
    // OUTERMOST arc (greatest radius, nearest the ring band).
    radiusFor: weekday => rIn + step * (6 - weekday),
    pointAt(angle, radius) {
      return { x: hub2.x + Math.cos(angle) * radius, y: hub2.y + Math.sin(angle) * radius };
    }
  };
}

// THE NIAGARA'S GAPS (O-236, Howell 2026-10-29): the ring of months parts
// its years with empty slots, and the falling dates part with them rather
// than vanishing. A SEAM is the first day after such a gap and the rows of
// empty water that gap is worth; every date from the seam on sits that many
// rows further down the fall, so each month's days stay level with the
// month on the ring. One gap slot is worth a long month's rows, the pace the
// ribbon already runs at through December and January either side of it.
export const GAP_ROWS_PER_SLOT = 31 / DAYS_PER_WEEK;

// The emblem's fixed length per viewport (O-237), memoised across frames.
const EMBLEM_LENGTHS = new Map();

const rowOfSerial = serial => (serial + 4) / DAYS_PER_WEEK; // week rows since the Sunday of serial 0
const seamShift = (serial, seams) => seams.reduce((n, seam) => (serial >= seam.serial ? n + seam.rows : n), 0);

/**
 * Where the fall stands, in (seam-shifted) week rows, with the magnifier a
 * `fraction` of a slot off this month's seat — the ribbon's gearing, stated
 * once so the host can ease between two months across a gap.
 */
export function ribbonRowAt(yearNumber, month, fraction = 0, seams = []) {
  const start = daySerial(yearNumber, month, 1);
  return rowOfSerial(start + fraction * monthDaySpan(yearNumber, month)) + seamShift(start, seams);
}

/**
 * Layout the day pyramid on the wedge lattice.
 *
 * At rest: the magnified month's weeks, hard-cropped (its days only), week
 * row 1 on the top ray, day numerals on the intersections.
 * In motion: the RIBBON AS ROTATION — the infinite week sequence turns
 * about the second hub, geared to the ring; anchor-month cells full-
 * strength, neighbors dimmed.
 */
export function computeDayGridLayout(viewport, magnifier, arcParams = {}, opts = {}) {
  const width = viewport.width ?? 0;
  const height = viewport.height ?? 0;
  const SSd = viewport.SSd ?? width;
  const { yearNumber = 1, month = 1, fraction = 0, rotating = false } = opts;
  // Header letters come from the volume's own naming when it offers them
  // (so a translation moves the lattice and the prose together); the
  // built-in row is the fallback, and keeps this module volume-agnostic.
  const weekdayLetters = Array.isArray(opts.weekdayLetters) && opts.weekdayLetters.length === 7
    ? opts.weekdayLetters
    : WEEKDAY_LETTERS;

  const lattice = computeWedgeLattice(viewport, arcParams, magnifier);

  // Cell size from the lattice's own gaps: radial step vs angular gap at
  // the middle radius, whichever is tighter.
  const midR = lattice.radiusFor(3);
  const angularGap = midR * (WEDGE.RAY_STEP_DEG * Math.PI) / 180;
  const nodeR = Math.min(lattice.step, angularGap) * 0.38; // +15% then +10% (sittings)
  const labelFontPx = Math.max(11, Math.min(20, nodeR * 1.05));

  const nodes = [];
  // TODAY wears the present moment's colors in the lattice (Howell
  // 2026-07-19): the one cell the reader is standing on.
  const now = new Date();
  const todayY = now.getFullYear();
  const todayM = now.getMonth() + 1;
  const todayD = now.getDate();
  const pushCell = (angle, weekday, dayNum, dim, key, itemFields = null) => {
    const p = lattice.pointAt(angle, lattice.radiusFor(weekday));
    if (p.x < -nodeR || p.x > width + nodeR || p.y < -nodeR || p.y > height + nodeR) return;
    const isToday = Boolean(itemFields
      && itemFields.yearNumber === todayY
      && itemFields.monthNumber === todayM
      && itemFields.dayNumber === todayD);
    nodes.push({
      id: key,
      label: String(dayNum),
      item: itemFields
        ? { id: key, name: String(dayNum), level: 'day', ...itemFields }
        : { id: key, name: String(dayNum), level: 'weekday' }, // header: inert
      arc: 'grid',
      // Numerals align with their RAY, like every child label in the
      // instrument (the view rotates by angle + 180°; the ray angle from
      // the second hub gives the same rising tilt the ring labels wear).
      angle,
      x: p.x,
      y: p.y,
      r: nodeR,
      labelScale: 1,
      labelFontPx,
      dim: Boolean(dim),
      now: isToday
    });
  };

  if (!rotating) {
    // The weekday header pops on WITH the settled month (S M T W T F S on
    // the top ray) and disappears during the scroll (Howell 2026-07-19).
    weekdayLetters.forEach((letter, ci) => {
      pushCell(lattice.rayAngle(0), ci, letter, false, `wd:${ci}`);
    });
    const rows = monthWeeks(yearNumber, month);
    rows.forEach((row, ri) => {
      row.forEach((dayNum, ci) => {
        if (dayNum === null) return; // hard crop — the month's own days only
        pushCell(lattice.rayAngle(ri + 1), ci, dayNum, false, `d:${yearNumber}:${month}:${dayNum}`,
          { yearNumber, monthNumber: month, dayNumber: dayNum });
      });
    });
    return { nodes, gridMode: true };
  }

  // The rotating ribbon: week rows sweep about the second hub, geared to
  // the ring via the fractional chain position. The ribbon is geared to
  // REAL days, so scrubbing October 1582 travels the 21 days it held, not
  // 31. In a gap between years the host passes the fall's position itself
  // (anchorRow, eased between the months either side) and every date dims,
  // since no month is under the glass.
  const seams = Array.isArray(opts.seams) ? opts.seams : [];
  const inGap = Boolean(opts.inGap);
  const monthStart = daySerial(yearNumber, month, 1);
  const startSerial = Number.isFinite(opts.startSerial)
    ? opts.startSerial
    : monthStart + fraction * monthDaySpan(yearNumber, month);
  const anchorRow = Number.isFinite(opts.anchorRow)
    ? opts.anchorRow
    : ribbonRowAt(yearNumber, month, fraction, seams);
  const centerRow = Math.floor(rowOfSerial(startSerial));
  // The band is an edge too: a ribbon cell never sits on the ring. Laid
  // edge to edge, the lower rows otherwise ran onto the band and its month
  // names; a cell that would touch the band's inner edge is not drawn.
  const ringHubX = arcParams.hubX;
  const ringHubY = arcParams.hubY ?? 0;
  const bandInner = Number.isFinite(arcParams.radius) ? arcParams.radius * 0.99 : Infinity;
  const clearOfBand = (angle, weekday) => {
    if (!Number.isFinite(ringHubX)) return true;
    const p = lattice.pointAt(angle, lattice.radiusFor(weekday));
    return Math.hypot(p.x - ringHubX, p.y - ringHubY) + nodeR <= bandInner;
  };
  // Returns the row's cells drawn and its nearest and farthest offsets.
  const pushRow = rowAbs => {
    const before = nodes.length;
    const sundaySerial = rowAbs * 7 - 4;
    let lo = Infinity, hi = -Infinity;
    for (let c = 0; c < 7; c += 1) {
      const serial = sundaySerial + c;
      const offset = rowAbs + seamShift(serial, seams) - anchorRow + 2; // anchor near mid-fan
      lo = Math.min(lo, offset); hi = Math.max(hi, offset);
      const angle = lattice.angleForRowOffset(offset);
      if (!clearOfBand(angle, c)) continue;
      const date = serialToDate(serial);
      const inAnchor = !inGap && date.yearNumber === yearNumber && date.month === month;
      // THE FIRST OF EVERY MONTH STANDS OUT (O-238, Howell 2026-10-29): full
      // strength in the fall like the magnified month's own days, in the
      // same white — a colour would distract — so each month's start is
      // legible as it passes.
      const firstOfMonth = date.day === 1;
      pushCell(angle, c, date.day, !inAnchor && !firstOfMonth, `d:${date.yearNumber}:${date.month}:${date.day}`,
        { yearNumber: date.yearNumber, monthNumber: date.month, dayNumber: date.day });
      // …and stands clear of the fade the whole sky wears while the ring
      // turns (.is-rotating, 0.35), which is what Howell actually saw: the
      // first cut only undimmed the cell, and the turning fade hid that.
      if (firstOfMonth && nodes.length && nodes[nodes.length - 1].label === '1') nodes[nodes.length - 1].fullStrength = true;
    }
    return { drawn: nodes.length - before, lo, hi };
  };
  // The ribbon runs EDGE TO EDGE (O-235, Howell 2026-10-29): it used to be
  // a fixed twelve rows, so in a tall viewport the lower right sat empty
  // ahead of the ribbon instead of feeding it days. Now rows are laid
  // outward from the anchor in both directions until one falls wholly off
  // the glass beyond the fan — days enter at the viewport's edge and leave
  // at the top. A row lost in a gap's empty water draws nothing but does
  // not end the fall; only a row past the fan does. The cap only bounds a
  // pathological viewport; culling does the work.
  const RIBBON_ROW_CAP = 48;
  for (let dr = 0; dr <= RIBBON_ROW_CAP; dr += 1) {
    const row = pushRow(centerRow + dr);
    if (row.drawn === 0 && row.lo > 8) break;
  }
  for (let dr = -1; dr >= -RIBBON_ROW_CAP; dr -= 1) {
    const row = pushRow(centerRow + dr);
    if (row.drawn === 0 && row.hi < -4) break;
  }
  // THE EMBLEM IN THE GAP (O-237, Howell 2026-10-29): each gap's empty
  // water carries the volume's own artwork, centred in it — midway between
  // the last row before the seam and the first after, on the middle arc —
  // and turned like the numerals around it, so it lines up on the hub and
  // falls with the dates. Its box is the water's: the seven columns wide
  // (along the ray) and the clear rows tall (across them).
  const emblems = [];
  // The emblem's clear length along a ray of the given angle: from the
  // Saturday side out to just short of the ring, along its centre line and
  // both long edges, capped at the seven columns.
  const rNear = lattice.radiusFor(6) - nodeR;
  const rCap = lattice.radiusFor(0) + nodeR;
  // Measured against the ARTWORK, not its box: the box is the whole
  // water's height, but the artwork is fitted inside it at its own
  // proportions (emblemAspect, width over height, when the host knows it),
  // so its long edges sit only (length / aspect) apart.
  const aspect = Number.isFinite(opts.emblemAspect) && opts.emblemAspect > 0 ? opts.emblemAspect : null;
  const clearReach = (angle, h) => {
    if (!Number.isFinite(ringHubX)) return rCap - rNear;
    const ux = Math.cos(angle), uy = Math.sin(angle);
    const offRing = r => {
      const art = aspect ? Math.min(h, (r - rNear) / aspect) : h;
      return [-art / 2, 0, art / 2].some(t => {
        const x = lattice.hub2.x + ux * r - uy * t, y = lattice.hub2.y + uy * r + ux * t;
        return Math.hypot(x - ringHubX, y - ringHubY) > bandInner - nodeR * 0.5;
      });
    };
    for (let r = rNear; r <= rCap; r += 1) if (offRing(r)) return r - 1 - rNear;
    return rCap - rNear;
  };
  // The least reach over every ray whose emblem centre is on the glass —
  // a fixed length for this viewport, memoised across frames (the search
  // walks a few hundred rays and must not run at every frame of a turn).
  const emblemLength = h => {
    const key = `${width}x${height}:${Math.round(ringHubX)}:${Math.round(h * 10)}:${aspect ?? '-'}`;
    if (EMBLEM_LENGTHS.has(key)) return EMBLEM_LENGTHS.get(key);
    let least = rCap - rNear;
    for (let off = -30; off <= 40; off += 0.25) {
      const a = lattice.angleForRowOffset(off);
      const c = lattice.pointAt(a, rNear + (rCap - rNear) / 2);
      if (c.x < 0 || c.x > width || c.y < 0 || c.y > height) continue;
      least = Math.min(least, clearReach(a, h));
    }
    if (EMBLEM_LENGTHS.size > 64) EMBLEM_LENGTHS.clear();
    EMBLEM_LENGTHS.set(key, least);
    return least;
  };
  for (const seam of seams) {
    const lastPre = Math.floor(rowOfSerial(seam.serial - 1)) + seamShift(seam.serial - 1, seams);
    const firstPost = Math.floor(rowOfSerial(seam.serial)) + seamShift(seam.serial, seams);
    const clearRows = firstPost - lastPre - 1;
    if (!(clearRows >= 1.5)) continue;
    const angle = lattice.angleForRowOffset((lastPre + firstPost) / 2 - anchorRow + 2);
    const h = clearRows * angularGap; // the row gap at the middle arc, as for the cells
    // ONE SIZE FROM ENTRANCE TO EXIT (Howell 2026-10-29: "The Niagara is
    // consistent from entrance to exit. The logo should remain the same
    // size"). The band is an edge for the emblem as for the dates, so its
    // length along the ray is the LEAST clear reach anywhere on its path
    // across the glass — fixed for the viewport, never shrinking as it
    // rises — and it rides at one radius.
    const w = emblemLength(h);
    if (!(w >= lattice.step * 2)) continue;
    const p = lattice.pointAt(angle, rNear + w / 2);
    const reach = Math.max(w, h) / 2;
    if (p.x < -reach || p.x > width + reach || p.y < -reach || p.y > height + reach) continue;
    emblems.push({ x: p.x, y: p.y, angle, width: w, height: h });
  }
  return { nodes, emblems, gridMode: true };
}
