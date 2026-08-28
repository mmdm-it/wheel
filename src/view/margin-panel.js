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
import { computeMarginArea } from '../geometry/margin-area.js';
import { splitVerse } from './detail/plugins/line-layout.js';

/** The footer is set smaller than the note, and this is the largest size that
 *  still leaves room for the worst case. Measured on a phone: at this size one
 *  or two manuscripts leave five of six rows for the note, three leave four,
 *  and six — the corpus's heaviest verses — still leave three. Going smaller
 *  buys nothing until six. */
const FOOTER_RATIO = 0.026;
const FOOTER_LINE = 1.25;

/** Greedy wrap into the lens's rows, from a given first row. */
function flow(text, area, fromRow) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let i = 0;
  for (let r = fromRow; r < area.lineTable.length; r++) {
    const row = area.lineTable[r];
    const maxChars = Math.max(4, Math.floor(row.availableWidth / (area.fontPx * 0.46)));
    let line = '';
    while (i < words.length) {
      const next = line ? `${line} ${words[i]}` : words[i];
      if (next.length > maxChars && line) break;
      line = next;
      i += 1;
    }
    if (!line) break;
    lines.push({ row, text: line });
  }
  return { lines, remaining: words.slice(i).join(' ') };
}

/**
 * How many screens this verse's notes need — 1 or 2, never more, matching the
 * Detail Sector's own hard cap. The ring asks this to decide whether to settle
 * the node centred or as a partial eclipse, so it MUST agree with what the
 * renderer will do: it asks the same flow rather than estimating.
 */
export function marginPartCount(entries, manuscripts, { width, height, area = null } = {}) {
  const a = area || computeMarginArea(width, height);
  if (!a.lineTable.length) return 1;
  const body = bodyOf(entries);
  if (!body) return 1;
  const rows = a.lineTable.length - footerRows(manuscripts, a);
  if (rows <= 0) return 2;
  return flow(body, { ...a, lineTable: a.lineTable.slice(0, rows) }, 0).remaining ? 2 : 1;
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
  const reserved = footerRows(manuscripts, a);
  const noteRows = Math.max(1, a.lineTable.length - reserved);
  const noteArea = { ...a, lineTable: a.lineTable.slice(0, noteRows) };

  const first = whole ? flow(whole, noteArea, 0) : { lines: [], remaining: '' };
  let body = whole;
  if (first.remaining) {
    const [x, y] = splitVerse(whole);
    body = part === 1 ? y : x;
  }
  const laid = whole ? flow(body, noteArea, 0) : { lines: [], remaining: '' };

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
  // So the body is read the way the lookup reads it: the leading run of
  // characters that are manuscripts, taken from each token. Every letter in
  // that run is cited; a Greek word beginning with a capital stops at its
  // first lowercase letter and cites nothing.
  const known = new Set(manuscripts.map(m => m.siglum));
  const cited = new Set();
  for (const token of String(body).split(/[\s|\]()*,.]+/)) {
    let i = 0;
    while (i < token.length && known.has(token[i])) { cited.add(token[i]); i += 1; }
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
    span.style.fontSize = `${a.fontPx.toFixed(1)}px`;
    span.style.lineHeight = `${a.pitch.toFixed(1)}px`;
    span.textContent = text;
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
