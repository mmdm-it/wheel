// THE MARGIN PANEL — Swete's apparatus, set on the ground beyond the ring.
//
// THREE THINGS ARE DRAWN HERE, in this order of priority when space runs out:
//   the NOTE      — Swete's own words, and the reason the margin exists;
//   the FOOTER    — our gloss naming the manuscripts the note cites;
//   nothing else.
// The footer is truncated before the note, never the other way round. Dropping
// a line of apparatus to make room for an explanation of a letter would be
// exactly backwards, and the arithmetic WILL hit that wall — Genesis 28:22
// names four manuscripts in one verse and eighteen verses name six.
//
// ── THE ECLIPSE, WIDENED (O-86, ruled 2026-08-22; built 2026-08-26) ─────────
// A verse too long for the Detail Sector already shows in two parts, and the
// ring says which part the reader is on by seating the node short of the lens
// or past it (O-84). Howell: "even if a verse is short enough to be viewed on
// one page, if that verse's notes are too extensive, we simply display those
// notes in halves." That is O-86 in his own words, made a fortnight before
// there was any apparatus to overflow.
//
// So the trigger widens: two parts when the verse overflows OR its notes do.
// The VERSE STAYS WHOLE across both halves when only the notes overflow —
// scripture is not split to make room for a note about it — and the split
// itself is splitVerse's, the same balanced word-boundary cut the Detail
// Sector uses, so joining the halves with one space reproduces the notes
// exactly. Presentation only: nothing renumbered, nothing cut.
import { computeMarginArea, MARGIN_SPEC } from '../geometry/margin-area.js';
import { splitVerse } from './detail/plugins/line-layout.js';
import { siglumRun, SIGLUM_SPLIT, GREEK_LOWER, apparatusRuns } from '../core/margin-source.js';

/** The footer is set smaller than the note, and this is the largest size that
 *  still leaves room for the worst case. Measured on a phone: at this size one
 *  or two manuscripts leave five of six rows for the note, three leave four,
 *  and six — the corpus's heaviest verses — still leave three. Going smaller
 *  buys nothing until six. */
const FOOTER_RATIO = 0.026;
const FOOTER_LINE = 1.25;

/** The lens at a smaller register: font (and so pitch) scaled, geometry kept. */
const scaledMarginSpec = scale => ({ ...MARGIN_SPEC, FONT_RATIO: MARGIN_SPEC.FONT_RATIO * scale });

/** THE SMALLEST TYPE THIS APPARATUS IS EVER SET IN, as a fraction of the short
 *  side — 14.4px on Howell's phone. Ruled 2026-08-29, reading the floor cases
 *  on the glass: "10.8 px is too small. I'd like to make 14.4 the floor. We'll
 *  have to come up with another solution for the clipped tails."
 *
 *  IT IS AN ABSOLUTE SIZE, NOT A MULTIPLE OF THE BASE, and that is the whole
 *  point of the constant. The floor used to be six tenths of whatever the base
 *  happened to be, so any future change to the base moved the smallest type
 *  the reader ever sees WITHOUT anyone deciding to. Stated as its own ratio,
 *  the base can be lowered to cut the split count — which is the dial that
 *  actually governs splitting — and the legibility floor stays where Howell
 *  put it.
 *
 *  MEASURED, and the two dials are very nearly independent: across all 15,580
 *  entries at 360x740, the BASE governs how many notes split (2,230 at 18px,
 *  844 at 14.4px) while the FLOOR governs how many lose a tail (62 at 10.8px,
 *  182 at 14.4px) — the clipped count barely moves when the base does. Raising
 *  the floor therefore buys legibility at a price paid in tails, and the price
 *  is the same whatever the base. Howell has accepted that trade and named the
 *  tails as their own problem. */
const NOTE_FLOOR_RATIO = 0.04;

/** The note's face, stated once — the measurer and the stylesheet must agree. */
const NOTE_FACE = "'EB Garamond', Georgia, serif";

/**
 * DOES THIS TEXT FIT THIS WIDTH — measured, not estimated, wherever a canvas
 * exists. The wrap used to allow characters-times-a-coefficient per row, and
 * the coefficient flattered Garamond's Greek just enough that a nearly full
 * line painted wider than its row and the stylesheet's overflow:hidden ATE
 * THE TAIL IN SILENCE — Howell circled three losses on one Leviticus screen,
 * a lemma's bracket among them, and every one was standing in the data. The
 * verse text learned this same lesson in the wrap saga: measure with the
 * actual font, estimate only where there is no glass to measure against
 * (the test runner), and keep the clip as a backstop, never as an editor.
 */
function makeFits(area) {
  if (typeof document !== 'undefined' && document.createElement) {
    try {
      const ctx = document.createElement('canvas').getContext('2d');
      if (ctx) {
        ctx.font = `${area.fontPx}px ${NOTE_FACE}`;
        return (text, width) => ctx.measureText(text).width <= width;
      }
    } catch { /* fall through to the estimate */ }
  }
  return (text, width) => text.length <= Math.max(4, Math.floor(width / (area.fontPx * 0.46)));
}

/** Greedy wrap into the lens's rows, from a given first row.
 *  A WORD LONGER THAN ITS ROW BREAKS WITH A HYPHEN, as Swete's own compositor
 *  breaks it — the page prints διχοτομη-/ματα — instead of painting past the
 *  row's edge into the clip. Display only: the data never carries the hyphen. */
export function flow(text, area, fromRow, fits = makeFits(area)) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let i = 0;
  for (let r = fromRow; r < area.lineTable.length; r++) {
    const row = area.lineTable[r];
    let line = '';
    while (i < words.length) {
      const next = line ? `${line} ${words[i]}` : words[i];
      if (!fits(next, row.availableWidth)) {
        if (line) break;
        // A lone word too long for the row: the longest prefix that fits
        // with its hyphen, never fewer than one character, and the rest of
        // the word rejoins the stream for the next row.
        let k = words[i].length - 1;
        while (k > 1 && !fits(words[i].slice(0, k) + '-', row.availableWidth)) k -= 1;
        line = words[i].slice(0, k) + '-';
        words[i] = words[i].slice(k);
        break;
      }
      line = next;
      i += 1;
    }
    if (!line) break;
    lines.push({ row, text: line });
  }
  return { lines, remaining: words.slice(i).join(' ') };
}

/**
 * WHERE A NOTE SETTLES: AGAINST THE BOTTOM, NOT UNDER THE CEILING (Howell,
 * 2026-08-28: "justify the margin notes vertically... those two uppermost
 * lines that we recently made available only be used as a last resort").
 * The lens's top rows are its narrowest — they exist so a LONG note can fit
 * at all — and a short note that starts there hangs high and cramped when
 * the wide rows below stand empty. So the note is flowed from the lowest
 * starting row that still holds all of it, which packs its last line against
 * the footer; the narrow ceiling rows fill only when the text genuinely
 * needs their length. Exported for the suite: the choice is geometry and
 * must be testable without a DOM.
 */
export function settleRow(text, area, fits = makeFits(area)) {
  for (let k = area.lineTable.length - 1; k > 0; k--) {
    if (!flow(text, area, k, fits).remaining) return k;
  }
  return 0;
}

/**
 * How many screens this verse's notes need — 1 or 2, never more, matching the
 * Detail Sector's own hard cap. The ring asks this to decide whether to settle
 * the node centred or as a partial eclipse, so it MUST agree with what the
 * renderer will do: it asks the same flow rather than estimating.
 */
/** The registers a note may be set at, largest first, down to the floor. */
function noteLadder() {
  const min = NOTE_FLOOR_RATIO / MARGIN_SPEC.FONT_RATIO;
  const out = [];
  for (let s = 1; s >= min - 1e-9; s -= 0.1) out.push(Math.max(s, min));
  return out;
}

/** The lens with the footer's rows already taken out of it. */
function noteAreaOf(area, manuscripts) {
  const reserved = footerRows(manuscripts, area);
  return { ...area, lineTable: area.lineTable.slice(0, Math.max(1, area.lineTable.length - reserved)) };
}

/**
 * THE LARGEST REGISTER AT WHICH THE WHOLE NOTE STANDS ON ONE SCREEN, or null
 * if even the floor cannot hold it (O-117).
 *
 * SHRINKING NOW COMES BEFORE SPLITTING, WHICH IS THE ORDER EVERYONE ASSUMED IT
 * ALREADY HAD. Howell, 2026-08-29: "I always assumed that the program would
 * try shrinking a note's font before splitting the note." It did not — the
 * note was measured at the base size, split if it overflowed, and only THEN
 * was a still-overflowing half shrunk, as damage control on the tail (O-113).
 * So a note that would have stood whole one step down was cut in two without
 * ever being offered the smaller register.
 *
 * Measured over all 15,580 entries at 360x740: trying the ladder first seats
 * 1,386 notes that split today, taking the volume's eclipsing verses from
 * 3,558 to 2,348. Only those 1,386 notes change size at all — 8.9% — and
 * none is set below the floor. Every note that fits at the base still looks
 * exactly as it did.
 *
 * The ring and the panel MUST agree about this, so both ask this one function
 * rather than each carrying its own idea of what fits.
 */
function seatWhole(body, manuscripts, width, height, base) {
  const sizable = Number.isFinite(width) && Number.isFinite(height);
  for (const scale of (sizable ? noteLadder() : [1])) {
    const area = scale === 1 ? base : computeMarginArea(width, height, scaledMarginSpec(scale));
    const noteArea = noteAreaOf(area, manuscripts);
    const fits = makeFits(area);
    if (!flow(body, noteArea, 0, fits).remaining) return { area, noteArea, fits };
  }
  return null;
}

export function marginPartCount(entries, manuscripts, { width, height, area = null } = {}) {
  const a = area || computeMarginArea(width, height);
  if (!a.lineTable.length) return 1;
  const body = bodyOf(entries);
  if (!body) return 1;
  if (a.lineTable.length - footerRows(manuscripts, a) <= 0) return 2;
  // One screen if ANY register on the ladder holds the whole note (O-117),
  // not merely if the base size does.
  return seatWhole(body, manuscripts, width, height, a) ? 1 : 2;
}

function bodyOf(entries) {
  const list = Array.isArray(entries) ? entries : (entries ? [entries] : []);
  return list.map(e => (typeof e === 'string' ? e : e?.text) || '').filter(Boolean).join(' | ');
}

function footerRows(manuscripts, area) {
  if (!manuscripts?.length) return 0;
  const pitch = area.viewport.SSd * FOOTER_RATIO * FOOTER_LINE;
  return Math.ceil((manuscripts.length * pitch) / area.pitch);
}

/**
 * Render the notes standing against ONE verse, for one half of the eclipse.
 */
export function renderMarginNote(entries, {
  width, height, create, area = null, part = 0, manuscripts = [],
} = {}) {
  const make = create || (typeof document !== 'undefined' ? document.createElement.bind(document) : null);
  const whole = bodyOf(entries);
  // A MANUSCRIPT MAY NEED NAMING WHERE THERE IS NO NOTE. Genesis 1:1 carries no
  // apparatus entry of its own and still stands in Alexandrinus, and the reader
  // is owed that name in the place names are given. Returning early on an empty
  // note took the legend with it, which is why the very first verse of the
  // corpus showed a siglum at the head of the screen and nothing to explain it.
  if (!make || (!whole && !manuscripts.length)) return null;
  const a = area || computeMarginArea(width, height);
  if (!a.lineTable.length) return null;

  // THE FOOTER TAKES ITS ROWS FIRST, so the note is flowed into what is left
  // rather than discovering the collision after painting. It is the note that
  // then splits across the eclipse — which is the right way round, because the
  // footer is the same on both halves and the note is not.
  // Reserved from the WHOLE note's manuscripts, deliberately: the two halves
  // must reserve the same rows or the note would reflow between them, and a
  // line of apparatus that moves when you toggle is worse than a spare row.
  const noteArea = noteAreaOf(a, manuscripts);

  const fits = makeFits(a);
  // THE LADDER IS TRIED WHOLE BEFORE THE NOTE IS EVER CUT (O-117). Only when
  // no register down to the floor can hold it does the eclipse get involved.
  const seated = whole ? seatWhole(whole, manuscripts, width, height, a) : null;
  let effArea = seated ? seated.area : a;
  let effNoteArea = seated ? seated.noteArea : noteArea;
  let effFits = seated ? seated.fits : fits;
  let body = whole;
  if (whole && !seated) {
    const [x, y] = splitVerse(whole);
    body = part === 1 ? y : x;
  }
  let laid = whole
    ? flow(body, effNoteArea, settleRow(body, effNoteArea, effFits), effFits)
    : { lines: [], remaining: '' };
  // A HALF THAT STILL OVERFLOWS THE LENS SHRINKS RATHER THAN LOSES ITS TAIL
  // (O-113). The two-screen cap is real, and a page-length note's half can
  // exceed the lens's rows — Genesis 25:3's Raguel clause was silently
  // absent from BOTH screens, standing in the data the whole time. The
  // lens is recomputed at a smaller register until the half fits, floored at
  // the legibility floor; the apparatus is already the page's small voice, and
  // a smaller register beats a silent hole in it — down to the point where the
  // smaller register is itself the injury, which is where Howell set the floor
  // (NOTE_FLOOR_RATIO). Below it the tail is a separate problem with a
  // separate answer, not something to be solved by shrinking further.
  const minScale = NOTE_FLOOR_RATIO / MARGIN_SPEC.FONT_RATIO;
  for (let scale = 0.9; laid.remaining && scale >= minScale - 1e-9; scale -= 0.1) {
    effArea = computeMarginArea(width, height, scaledMarginSpec(scale));
    effNoteArea = noteAreaOf(effArea, manuscripts);
    effFits = makeFits(effArea);
    laid = flow(body, effNoteArea, settleRow(body, effNoteArea, effFits), effFits);
  }
  const aOut = effArea;

  // THE FOOTER NAMES WHAT IS ON THIS SCREEN, NOT WHAT IS IN THE WHOLE NOTE.
  // The rule was stated before it was implemented and the implementation broke
  // it: a reader is never told what a letter means unless that letter is in
  // front of them, and on the first half of a split note two of the three
  // manuscripts named were in the other half. Howell caught it in a pair of
  // screenshots where the footer did not change while the note did.
  // WHICH MANUSCRIPTS THIS HALF ACTUALLY CITES — and "cites" cannot be tested
  // with a word boundary, which is how this got it wrong. Swete runs sigla
  // together to write agreement: in "τη φωνη AR" the R is preceded by the A,
  // so a rule demanding a separator in front of it dropped the Verona Psalter
  // from the legend of a Psalm that names it. Howell caught it on the glass
  // after the LOOKUP had already been fixed for the same reason — the third
  // time this week that a group of sigla was treated as a letter.
  //
  // SO IT READS THE BODY WITH THE LOOKUP'S OWN READER, not a second copy of
  // the same idea. Three copies of this logic existed and all three were wrong
  // in different weeks; the fix that mattered was not correcting the third but
  // deleting it. There is one reader now and both layers call it.
  const known = new Set(manuscripts.map(m => m.siglum));
  const cited = new Set();
  for (const token of String(body).split(SIGLUM_SPLIT)) {
    const { run, stoppedAt } = siglumRun(token, c => known.has(c));
    if (!run || (stoppedAt !== null && GREEK_LOWER.test(stoppedAt))) continue;
    for (const c of run) cited.add(c);
  }
  const shown = whole ? manuscripts.filter(m => m.fromMark || cited.has(m.siglum)) : manuscripts;

  const container = make('div');
  container.className = 'margin-note';
  container.setAttribute('lang', 'grc');

  for (const { row, text } of laid.lines) {
    const span = make('div');
    span.className = 'margin-note-line';
    span.style.position = 'absolute';
    span.style.left = `${row.leftX.toFixed(1)}px`;
    span.style.top = `${row.y.toFixed(1)}px`;
    span.style.width = `${Math.max(0, row.availableWidth).toFixed(1)}px`;
    span.style.fontSize = `${aOut.fontPx.toFixed(1)}px`;
    span.style.lineHeight = `${aOut.pitch.toFixed(1)}px`;
    // The hands raised by the panel itself, in the note's own face — never by
    // a fallback font, which raised a question mark on Howell's phone.
    for (const run of apparatusRuns(text)) {
      const piece = make('span');
      if (run.sup) piece.className = 'margin-sup';
      else if (run.italic) piece.className = 'margin-italic';
      piece.textContent = run.text;
      span.appendChild(piece);
    }
    container.appendChild(span);
  }

  // ── THE MANUSCRIPTS, NAMED ──────────────────────────────────────────────
  // Only the letters standing in THIS verse's notes, in the order the page
  // sets them. A reader is never told what a letter means unless the letter is
  // in front of them, and never told about the wrong volume's manuscript,
  // because the lookup goes through the volume the unit belongs to.
  const fpx = a.viewport.SSd * FOOTER_RATIO;
  const fpitch = fpx * FOOTER_LINE;
  const base = a.bottomY - shown.length * fpitch;
  shown.forEach((m, i) => {
    const line = make('div');
    line.className = 'margin-note-source';
    line.style.position = 'absolute';
    line.style.left = `${a.leftX.toFixed(1)}px`;
    line.style.top = `${(base + i * fpitch).toFixed(1)}px`;
    line.style.fontSize = `${fpx.toFixed(1)}px`;
    line.style.lineHeight = `${fpitch.toFixed(1)}px`;
    // THE NAME, NOT THE CONCORDANCE. Swete prints "Codex Alexandrinus (= III,
    // Holmes)" — the Holmes-Parsons number is a scholar's cross-reference to
    // another edition's numbering, and clutter to a reader who wants to know
    // whose reading they are looking at. Dropped HERE, at the glass, and never
    // from the data: the legend keeps Swete's line whole because that is what
    // his page says.
    //
    // ANY TRAILING PARENTHESIS, not only one opening with "=". The first cut
    // matched "(= III, Holmes)" and Howell's screenshot caught what it missed:
    // the Cotton Genesis's line reads "(I, Holmes)" with no equals sign at
    // all, so that one manuscript went on wearing its concordance number while
    // every other name was clean.
    line.textContent = `${m.siglum} · ${String(m.name).replace(/\s*\([^)]*\)\s*$/, '')}`;
    container.appendChild(line);
  });
  return container;
}
