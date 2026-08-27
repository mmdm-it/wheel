// THE MARGIN PANEL — Swete's apparatus, set on the ground beyond the ring.
//
// FIRST LIGHT, 2026-08-26. Everything about how this LOOKS is provisional and
// meant to be argued with: the type size is O-91's 5%, ruled "provisional until
// his eye meets a note", and this is the first build in which an eye can.
//
// WHAT IT DELIBERATELY DOES NOT DO YET:
//   - it does not SPLIT a note that overruns (O-86 rules that a note too long
//     for the margin splits across half-settles). It clips, visibly, and says
//     how much it clipped, because a silent truncation of a critical apparatus
//     is the worst of both — it looks complete and is not.
//   - it does not interpret. Swete's sigla, brackets and abbreviations are set
//     exactly as the page has them. Expanding "om" to "omits" would be editing
//     an edition to make it friendlier, which is the one thing this corpus does
//     not do.
import { computeMarginArea } from '../geometry/margin-area.js';

export function renderMarginNote(block, { width, height, create, area = null } = {}) {
  const make = create || (typeof document !== 'undefined' ? document.createElement.bind(document) : null);
  if (!make || !block?.text) return null;
  const a = area || computeMarginArea(width, height);
  if (!a.lineTable.length) return null;

  const container = make('div');
  container.className = 'margin-note';
  // The apparatus is Greek with Latin sigla running through it. It is tagged
  // as Greek because that is what the running text of an entry is, and the
  // sigla are single capitals the shaper will not mangle either way.
  container.setAttribute('lang', 'grc');

  const wrapped = wrapToTable(block.text, a);
  wrapped.lines.forEach((line, i) => {
    const row = a.lineTable[i];
    const span = make('div');
    span.className = 'margin-note-line';
    span.style.position = 'absolute';
    span.style.left = `${row.leftX.toFixed(1)}px`;
    span.style.top = `${row.y.toFixed(1)}px`;
    span.style.width = `${Math.max(0, row.availableWidth).toFixed(1)}px`;
    span.style.fontSize = `${a.fontPx.toFixed(1)}px`;
    span.style.lineHeight = `${a.pitch.toFixed(1)}px`;
    span.textContent = line;
    container.appendChild(span);
  });

  // THE OVERRUN IS SAID OUT LOUD, not swallowed. Until O-86's split is built,
  // a reader must be able to tell that they are looking at part of a note.
  if (wrapped.remaining > 0) {
    const more = make('div');
    more.className = 'margin-note-more';
    more.style.position = 'absolute';
    const last = a.lineTable[Math.min(wrapped.lines.length, a.lineTable.length) - 1];
    more.style.left = `${last.leftX.toFixed(1)}px`;
    more.style.top = `${(last.y + a.pitch).toFixed(1)}px`;
    more.style.fontSize = `${(a.fontPx * 0.55).toFixed(1)}px`;
    more.textContent = `+${wrapped.remaining} more characters`;
    container.appendChild(more);
  }
  return container;
}

/**
 * Greedy wrap into the lens's rows. Estimated from an average glyph width
 * rather than measured: the apparatus is set at one size in one face, and the
 * Detail Sector's post-paint verifier already owns the hard case (a font that
 * reaches layout after the measurement — the iOS overflow endgame).
 */
function wrapToTable(text, area) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let i = 0;
  for (const row of area.lineTable) {
    const maxChars = Math.max(4, Math.floor(row.availableWidth / (area.fontPx * 0.46)));
    let line = '';
    while (i < words.length) {
      const next = line ? `${line} ${words[i]}` : words[i];
      if (next.length > maxChars && line) break;
      line = next;
      i += 1;
    }
    if (!line) break;
    lines.push(line);
  }
  const remaining = words.slice(i).join(' ').length;
  return { lines, remaining };
}
