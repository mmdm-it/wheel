// THE MARGIN SOURCE — an edition's apparatus, fetched per unit (W-165).
//
// WHY THIS IS ITS OWN MODULE AND NOT A FIELD ON THE TEXT.
// The apparatus is captured, verified and flagged on a ladder of its own, per
// unit, and gates nothing in either direction (W-131, W-133). An edition ships
// fully proofread with its margin empty, for as long as that takes. A loader
// that fetched both together would make the margin's absence indistinguishable
// from the text's, which is exactly the state those rulings exist to keep
// separate — so this fails SILENTLY and on its own: no margin file, no margin,
// and the verse reads as it always did.
//
// WHAT A MARGIN FILE HOLDS. A list of blocks, each covering a RUN of verses:
//   { from: "1:1", to: "1:13", type: "footnote", text: "…" }
// The run is not a convenience. A block is one printed page's apparatus, and
// splitting it into per-verse entries was built first and refuted: Swete counts
// erased letters the same way he numbers verses, so 17% of the split entries
// came out filed under a verse they said nothing about. The block is also how
// the page reads — its entries lean on each other, and a reader holding the
// printed page sees the whole foot of it at once.
//
// SO THE LOOKUP IS A RANGE LOOKUP, and the ranges tile the unit in order with
// no gap and no overlap (the corpus suite pins exactly that). Binary search
// over the seat ORDER, not over the label: "10:2" sorts before "9:1" as a
// string, and an edition may address a verse the chart does not.
import { resolvePath } from './identity.js';

const cache = new Map();   // `${edition}|${unitId}` → { blocks, index } | null
let legendCache;           // one per edition; undefined = not asked, null = none

/**
 * Load one unit's margin. Resolves to null when the unit has none — which is
 * the ordinary case for every edition but the Septuagint, and for the units of
 * that edition whose apparatus is still held.
 */
export async function loadMargin({ base, version, edition, unitId, fetchJson, identityOf }) {
  if (!edition || !unitId) return null;
  const key = `${edition}|${unitId}`;
  if (cache.has(key)) return cache.get(key);
  let value = null;
  try {
    const file = await fetchJson(resolvePath({ base, version, kind: 'margin', edition, unitId }));
    // The file must ANSWER FOR THE UNIT IT WAS FETCHED FOR. A mis-routed fetch
    // that resolves puts one unit's apparatus under another's verses, which is
    // the misfiling this whole design exists to prevent — and it would look
    // perfectly plausible on screen, because one page of variants resembles
    // another.
    //
    // WHICH FIELD CARRIES THAT IDENTITY IS THE VOLUME'S BUSINESS, not this
    // module's, so the caller hands in `identityOf`. That is not ceremony:
    // O-43 forbids engine-general code from speaking a volume's word for its
    // own levels, and the field in this particular volume's files is spelled
    // with that word. The guard caught it on the first run of this file, and
    // the fix it asks for is the right one — the check stays, and the
    // vocabulary moves to the adapter that owns it.
    const declared = typeof identityOf === 'function' ? identityOf(file) : undefined;
    if (file && declared === unitId && Array.isArray(file.margin)) {
      value = { blocks: file.margin, source: file.source || '', marks: file.marks || {} };
    }
  } catch {
    value = null;   // no margin is a state, not a failure
  }
  cache.set(key, value);
  return value;
}

/**
 * The block covering `address` ("ch:v"), or null.
 *
 * `order` is the edition's own seat labels in its own order — the same list the
 * text cache is keyed by. Positions come from it rather than from parsing the
 * label, because the label is the EDITION's address and only its own chart
 * knows where that address sits.
 */
export function blockAt(margin, address, order) {
  if (!margin || !address || !order?.length) return null;
  const at = order.indexOf(String(address));
  if (at < 0) return null;
  let lo = 0, hi = margin.blocks.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const b = margin.blocks[mid];
    const from = order.indexOf(b.from);
    const to = order.indexOf(b.to);
    if (from < 0 || to < 0) return null;      // an unaddressable block covers nothing
    if (at < from) hi = mid - 1;
    else if (at > to) lo = mid + 1;
    else return b;
  }
  return null;
}

/**
 * The notes standing against one address, in the order the page sets them.
 *
 * A block is one printed page's apparatus; W-166 broke it into entries, each
 * addressed to the verse it concerns, and some to a RUN of verses ("4—5 …" is
 * one note about two). So this collects every entry whose address covers the
 * one asked for.
 *
 * THE BLOCK'S `lead` IS NOT AN ENTRY and is deliberately not returned here. It
 * is the fragment standing before the page's first address — usually a note on
 * the unit's title, sometimes a sentence carrying over from the page before —
 * and it belongs to no verse. Attaching it to one would be filing it, which is
 * the thing this whole design refuses to do on a guess.
 */
export function entriesAt(block, address, order) {
  if (!block?.entries?.length || !address || !order?.length) return [];
  const at = order.indexOf(String(address));
  if (at < 0) return [];
  return block.entries.filter(e => {
    const from = order.indexOf(e.at);
    if (from < 0) return false;
    if (e.to === undefined) return from === at;
    const to = order.indexOf(e.to);
    return to >= 0 && at >= from && at <= to;
  });
}

/** Cache-only: what loadMargin has already fetched for this unit, or null.
 *  The ring asks "how many screens does this need" SYNCHRONOUSLY, and an
 *  apparatus that has not arrived yet must answer "one" rather than block —
 *  the same shape the seated text already uses. When it does arrive the host
 *  drops its part-count cache so the question is asked again. */
export function marginCached(edition, unitId) {
  return cache.get(`${edition}|${unitId}`) ?? null;
}

export function legendCached() { return legendCache ?? null; }

/**
 * THE POEM'S LINES, fetched per unit like the apparatus (W-210/O-112). Swete
 * sets a fifth of the corpus as verse; the side-file maps each poem verse to
 * the character offsets in the SEATED text where its metrical lines begin —
 * built read-only against the repaired text, with alignment fallbacks, so a
 * verse with no entry here simply reads as prose.
 */
const poetryCache = new Map();
export async function loadPoetry({ base, version, edition, unitId, fetchJson, identityOf }) {
  if (!edition || !unitId) return null;
  const key = `${edition}|${unitId}`;
  if (poetryCache.has(key)) return poetryCache.get(key);
  let value = null;
  try {
    const file = await fetchJson(resolvePath({ base, version, kind: 'poetry', edition, unitId }));
    const declared = typeof identityOf === 'function' ? identityOf(file) : undefined;
    if (file && declared === unitId && file.poetry && typeof file.poetry === 'object') {
      value = file.poetry;
    }
  } catch {
    value = null;   // prose is a state, not a failure
  }
  poetryCache.set(key, value);
  return value;
}
export function poetryCached(edition, unitId) { return poetryCache.get(`${edition}|${unitId}`) ?? null; }

export function clearMarginCache() { cache.clear(); poetryCache.clear(); legendCache = undefined; }

/**
 * The addresses a chart seats, in its own order, spelled the way a reader's
 * position is spelled: the container's label, a colon, the seat's.
 *
 * THIS EXISTS BECAUSE ITS ABSENCE FAILED SILENTLY. The first build handed
 * `blockAt` the chart's raw seat labels, which are FLAT ordinals within the
 * unit — "1", "2", "3" … 1172 — while a margin block is addressed
 * "container:seat". Every lookup missed, every lookup correctly returned null,
 * and null is the ordinary answer for a unit with no apparatus. Nothing was
 * wrong on any screen and nothing was in the log: the defect wore the exact
 * face of the normal case, which is the only kind that survives a demo.
 *
 * `groups` are the runs of consecutive seats sharing one container label.
 */
export function addressOrder(chart) {
  const seats = chart?.seats || [];
  const order = [];
  for (const group of chart?.groups || []) {
    for (let i = group.from; i <= group.to; i += 1) {
      const seat = seats[i - 1];
      if (seat) order.push(`${group.label}:${seat.label}`);
    }
  }
  return order;
}

/**
 * The edition's manuscript legend, or null.
 *
 * THE LEGEND IS PER VOLUME and that is the whole reason it is a structure
 * rather than a lookup table. Swete's edition is three volumes, each preface
 * naming only the manuscripts collated for that volume, and a letter is reused
 * between them: C is one manuscript in volume II and unused in volume I; V is
 * one in volume III and a different one inside that volume's own appendix.
 * Reading a siglum against the wrong volume's list returns the name of a REAL
 * manuscript every time, which is what makes the mistake invisible.
 */
export async function loadMarginLegend({ base, version, edition, fetchJson }) {
  if (legendCache !== undefined) return legendCache;
  legendCache = null;
  try {
    const file = await fetchJson(resolvePath({ base, version, kind: 'marginLegend', edition }));
    if (file && Array.isArray(file.volumes)) legendCache = file;
  } catch { legendCache = null; }
  return legendCache;
}

/**
 * THE ONE READER OF A SIGLUM RUN. Swete writes agreement by running sigla
 * together — "AR" is two manuscripts, "ℵAQΓ" is four — and this returns the
 * letters at the START of a token that are manuscripts, stopping at the first
 * character that is not.
 *
 * IT EXISTS BECAUSE THE SAME MISTAKE WAS MADE THREE TIMES IN ONE WEEK, in
 * three layers, each assuming a group of sigla was a letter: the latinisation
 * converted a lone capital and left the letters inside a group alone; the
 * lookup read a token's first character and discarded the rest; and the
 * display demanded a word boundary the page does not put there. Each was
 * found separately, by a reader, after the previous one had been declared
 * fixed — because each fix corrected a COPY of the logic and left the others
 * standing.
 *
 * Three correct copies is not the same as one correct implementation. A fourth
 * layer will be written one day and it will get this wrong too unless there is
 * nothing left to get wrong.
 *
 * The stopping rule is what keeps a Greek word out: a proper noun beginning
 * with a capital that happens to be a siglum stops at its first lowercase
 * letter, and the caller may reject the run on that ground. A siglum carrying
 * a modifier — an asterisk, a hand number — stops at the modifier and keeps
 * the manuscript.
 */
export function siglumRun(token, isSiglum) {
  let n = 0;
  while (n < token.length && isSiglum(token[n])) n += 1;
  return { run: token.slice(0, n), stoppedAt: n < token.length ? token[n] : null };
}

/** How a stretch of apparatus is broken into tokens. Shared, so that the
 *  layer deciding WHICH manuscripts a note names and the layer deciding which
 *  of them to PRINT cannot disagree about where a token ends. */
export const SIGLUM_SPLIT = /[\s|\]()*,.]+/;
/** A lowercase Greek letter — the signal that a capital began a WORD. */
export const GREEK_LOWER = /[\u03B1-\u03C9\u1F00-\u1FFF]/;

/**
 * THE HANDS ARE RAISED BY THE APP, NOT BY FONT LUCK. The apparatus encodes a
 * corrector's mark with Unicode superscript characters — A¹, Qᵐᵍ, Bᵃᵇ — and
 * EB Garamond has no glyphs for them, so every one was rendered by whatever
 * fallback font the device found. Worse: a plain character BETWEEN two
 * fallback characters can be swept into their run, which is how a baseline
 * question mark in A¹?ᵃ? came out small and raised on Howell's phone while
 * its twin two characters later sat on the floor (2026-08-28 — the page
 * raises the hand letters and never the queries).
 *
 * So display code splits apparatus text into runs: superscript characters
 * become their PLAIN equivalents marked sup:true, for the renderer to raise
 * itself — same face as the body text, smaller and lifted by CSS.
 *
 * AND THE QUERIES RIDE WITH THE HANDS. Swete prints the whole compound
 * raised — A followed by a small high 1?a?, each query qualifying the hand
 * before it — and no computer alphabet HAS a raised question mark, which is
 * the deepest reason this raising belongs to the app: the data physically
 * cannot carry it. A query immediately after a raised mark joins that run; a
 * query standing on its own — Q?, (? — stays on the line. (First shipped the
 * other way round, from a misreading of Howell's report; his photograph of
 * the page settled it, 2026-08-28.) The degree sign of 1° and 2° is not in
 * the map on purpose: Garamond has it.
 */
const SUP_PLAIN = { '¹':'1','²':'2','³':'3','⁴':'4','⁰':'0',
  'ᵃ':'a','ᵇ':'b','ᶜ':'c','ᵈ':'d','ᵉ':'e','ᶠ':'f','ᵍ':'g','ʰ':'h','ⁱ':'i',
  'ᵏ':'k','ˡ':'l','ᵐ':'m','ⁿ':'n','ᵒ':'o','ᵖ':'p','ʳ':'r','ˢ':'s','ᵗ':'t',
  'ᵘ':'u','ᵛ':'v','ʷ':'w','ˣ':'x','ʸ':'y','ᶻ':'z' };
export function apparatusRuns(text) {
  const runs = [];
  for (const c of String(text)) {
    const plain = SUP_PLAIN[c];
    const last = runs[runs.length - 1];
    if (plain !== undefined) {
      if (last?.sup) last.text += plain;
      else runs.push({ text: plain, sup: true });
    } else if (c === '?' && last?.sup) last.text += c;
    else if (last && !last.sup) last.text += c;
    else runs.push({ text: c, sup: false });
  }
  return runs;
}

// Swete's Roman numerals marking a container turn inside a page of
// apparatus. They are Latin capitals because that is what the page prints,
// but they are NOT manuscripts: one stands 1,822 times in volume I alone,
// which would make it commoner than two of the actual codices combined.
const NOT_SIGLA = new Set(['I', 'X']);

/**
 * The manuscripts named in a stretch of apparatus, in the order they appear:
 * [{ siglum, name }]. Only letters the unit's OWN volume names are returned,
 * and only letters actually standing in the text — a reader is never told what
 * a letter means unless that letter is in front of them.
 */
export function manuscriptsIn(text, legend, unitId) {
  if (!legend || !text || !unitId) return [];
  const volume = legend.volumes.find(v => v.units?.includes(unitId));
  if (!volume) return [];
  const named = volume.sigla || {};
  const order = Object.keys(named);
  const out = [];
  const seen = new Set();
  // A TOKEN MAY NAME SEVERAL MANUSCRIPTS AT ONCE, and reading only its first
  // letter dropped the rest. Swete writes agreement by running the sigla
  // together — "AR" is the Alexandrinus AND the Verona Psalter, "ℵAQΓ" is four
  // — and Howell caught it on a Psalm whose note read AR while the legend
  // named A alone.
  //
  // The run is taken from the START and only while every character is a
  // manuscript this volume knows, which is what keeps a Greek word out: a
  // proper noun beginning with a capital that happens to be a siglum stops at
  // its first lowercase letter and is rejected, while "A*vid" stops at the
  // asterisk and correctly yields A.
  for (const token of String(text).split(SIGLUM_SPLIT)) {
    const { run, stoppedAt } = siglumRun(token, c => c in named);
    if (!run) continue;
    // Stopped because the next character is Greek text — this was a word, not
    // a group of sigla.
    if (stoppedAt !== null && GREEK_LOWER.test(stoppedAt)) continue;
    for (const c of run) {
      if (seen.has(c) || NOT_SIGLA.has(c)) continue;
      seen.add(c);
      out.push({ siglum: c, name: named[c], order: order.indexOf(c) });
    }
  }
  // IN SWETE'S OWN ORDER, NOT THE ORDER WE HAPPENED TO MEET THEM (Howell,
  // 2026-08-27: "sort the legend alphabetically by code"). His front matter
  // lists the manuscripts alphabetically with the aleph at their head and the
  // Greek-lettered ones after the Latin, so the volume's list IS the order —
  // and quoting it costs nothing while inventing a sort would put the aleph
  // and the gamma wherever a codepoint happens to fall.
  out.sort((a, b) => a.order - b.order);
  return out;
}

/** The marks Swete set in the margin BESIDE this address, or an empty list.
 *
 *  These are not apparatus. They are the editor pointing at the verse in front
 *  of him — which manuscripts carry it, or that one of them begins a section
 *  here — and they were held back from the margin for a year's worth of good
 *  reason that turned out to answer the wrong question: the scan lost which
 *  WORD a mark stood against, and a reader needs the VERSE, which it kept.
 */
export function marksAt(margin, address) {
  if (!margin?.marks || !address) return [];
  const at = margin.marks[String(address)];
  return Array.isArray(at) ? at : [];
}
