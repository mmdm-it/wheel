// IDENTITY — mint · parse · compare · resolve-to-path (H-11, phase 1a).
//
// VOLUME-GENERAL BY CONTRACT. Nothing here may assume any one volume's
// subject: H-2's note says so, and the reason is concrete rather than tidy.
// A second volume meets this same problem with its own containers (décades,
// lunar months), its own misalignments (sunset-boundary days spanning two
// cut days), and its own declared policies — and it parses ids by SHAPE
// today (the night audit's N40). It inherits this cure or pays for its own
// migration later.
//
// The rule this file holds itself to, and the forbidden-literals lint
// enforces: IF A SENTENCE HERE COULD NOT BE SAID OF EVERY VOLUME, IT DOES
// NOT BELONG HERE. That lint caught this very file on its first run — the
// module whose whole contract is "assume no volume" had named two in its
// own header. Reworded rather than exempted; a guard loosened to admit the
// file that failed it is not a guard.
//
// WHAT THIS REPLACES, and why the replacement is not like-for-like:
//
//   /^([A-Z][A-Z_]*)_(\d+)_(\d+)$/   — a subject-shaped regex
//   id.lastIndexOf(':')               — a hand-rolled split
//
// Both READ MEANING OUT OF THE TEXT of an id. Under H-11 the top-level id is
// OPAQUE: the filesystem stops spelling out what a thing IS, and `chapter_id`, `book_key`,
// `sequence` and `_external_file` retire. An opaque id has no meaning in its
// characters to read, so a parser that infers from spelling is not merely
// old — it is asking a question the new ids refuse to answer.
//
// THE ONE RULE THAT SHAPES EVERY FUNCTION BELOW: an opaque id cannot be
// ordered by its own text. W-32 says position may order but may not identify;
// this is its converse, and it bites harder. `u12` does not sort after `u9`,
// and `GENE` does not sort before `EXOD` in any alphabet that matters. ORDER
// IS DECLARED DATA, never read from the id — and WHOSE data is the caller's
// business, not this module's. (This said "order comes from the spine" until
// W-96 made the spine a superset in no edition's order; the order a reader
// moves through is the edition's, declared by its chart.)
// `compare` therefore REFUSES to guess: give it the order or it throws.

const SEP_DEFAULT = '/';

// A scheme is a volume's declaration of its own id shape. The levels are
// NAMES, not positions with meaning — `parse` hands back the level names the volume gave
// because the volume said those are its levels, not because the engine
// recognises any one of them when it sees it.
export function createScheme({ levels, separator = SEP_DEFAULT } = {}) {
  if (!Array.isArray(levels) || !levels.length) {
    throw new Error('identity: a scheme needs a non-empty levels array');
  }
  if (typeof separator !== 'string' || !separator.length) {
    throw new Error('identity: a scheme needs a non-empty separator');
  }
  for (const level of levels) {
    if (typeof level !== 'string' || !level.length) {
      throw new Error('identity: every level must be a non-empty name');
    }
  }
  // A separator that can occur inside a segment makes parse ambiguous, and the
  // ambiguity would surface as a wrong READING rather than an error — the
  // derived-view failure named on the board. Refuse at construction.
  return Object.freeze({ levels: Object.freeze([...levels]), separator });
}

// MINT — parts to id. Order follows the scheme's levels, so a caller cannot
// silently reorder them by passing an object with different key order.
export function mint(scheme, parts) {
  const out = [];
  for (const level of scheme.levels) {
    const value = parts?.[level];
    if (value === undefined || value === null || value === '') break;
    const s = String(value);
    if (s.includes(scheme.separator)) {
      throw new Error(
        `identity: "${level}" value ${JSON.stringify(s)} contains the separator `
        + `${JSON.stringify(scheme.separator)} — minting it would produce an id that `
        + 'parses back into different parts than it was made from');
    }
    out.push(s);
  }
  if (!out.length) throw new Error('identity: mint needs at least the first level');
  return out.join(scheme.separator);
}

// PARSE — id to parts, by POSITION under the scheme, never by pattern.
// A partial id is legitimate and common: a container's id is a prefix of the
// ids it contains, and the reader stands at a container far more often than at
// a leaf. Extra
// segments are an error rather than a truncation, because silently dropping
// a level is how a reader lands somewhere plausible and wrong.
export function parse(scheme, id) {
  if (typeof id !== 'string' || !id.length) return null;
  const segments = id.split(scheme.separator);
  if (segments.length > scheme.levels.length) return null;
  if (segments.some(s => !s.length)) return null;
  const parts = {};
  segments.forEach((segment, i) => { parts[scheme.levels[i]] = segment; });
  parts.depth = segments.length;
  parts.level = scheme.levels[segments.length - 1];
  return parts;
}

// The id of the container one level up. `null` at the top — an id with no
// parent is a fact, not a failure.
export function parentOf(scheme, id) {
  const parts = parse(scheme, id);
  if (!parts || parts.depth < 2) return null;
  return id.slice(0, id.lastIndexOf(scheme.separator));
}

export function isAncestor(scheme, ancestorId, descendantId) {
  if (!ancestorId || !descendantId || ancestorId === descendantId) return false;
  return descendantId.startsWith(ancestorId + scheme.separator);
}

// COMPARE — and the refusal is the feature.
//
// `order` maps an id to its position, and it is REQUIRED. There is no
// fallback to string comparison, deliberately: a lexicographic fallback would
// work on a tidy fixture, pass its tests, and then seat a reader wrongly the
// first time real data disagreed with the alphabet.
// That is the derived-view failure exactly — correct-looking, wrong about the
// shape. An id we cannot order is a question we must not answer by guessing.
export function compare(scheme, order, a, b) {
  if (typeof order !== 'function') {
    throw new Error(
      'identity: compare needs an order function — an opaque id carries no '
      + 'order in its text, and guessing one from the alphabet is how a reader '
      + 'gets seated somewhere plausible and wrong');
  }
  if (a === b) return 0;
  const ia = order(a);
  const ib = order(b);
  // A NEGATIVE index counts as absent, not as "very early". `indexOf` is the
  // natural way to write an order function and it returns -1 for a miss — a
  // module that accepted that would sort every unknown id FIRST, silently and
  // plausibly. Caught by its own test, which used exactly that idiom.
  const missing = i => !Number.isFinite(i) || i < 0;
  if (missing(ia) || missing(ib)) {
    throw new Error(
      `identity: no declared order for ${JSON.stringify(missing(ia) ? a : b)} `
      + '— order is declared by the caller, so an id absent from that declaration '
      + 'cannot be placed');
  }
  return ia - ib;
}

// RESOLVE-TO-PATH — the H-11 layout, stated once.
//
//   volume.json                     the slim boot
//   spine/{unitId}.json             every leaf the unit holds + spans/absent/lost
//                                   (a SUPERSET under W-96, in no edition's order)
//   text/{EDITION}/{unitId}.json    text belongs to an (edition, address) pair
//   charts/{EDITION}/{unitId}.json  + a per-edition index
//   names/{lang}.json
//
// The DATA VERSION rides the path (H-11 item 4), which is what makes these
// files immutable and cacheable forever — and what unlocks O-38's leaf-file
// caching, currently withheld because unversioned paths would serve
// yesterday's verses. A push changes a path, not the world.
//
// Note what is absent: no CONTAINER level. Containers ceased to be a storage
// level under H-11 — they are the render-time projection the spec already
// declared them to be, and O-44 rules they come from the chart. Asking this
// for a container's file is a question with no answer, and it throws rather
// than inventing one.
export function resolvePath({ base = '', version = '', kind, edition, unitId, lang } = {}) {
  const root = [base, version].filter(Boolean).join('/');
  const join = (...parts) => [root, ...parts].filter(Boolean).join('/');
  switch (kind) {
    case 'volume':      return join('volume.json');
    case 'spine':       return join('spine', `${req(unitId, 'unitId')}.json`);
    case 'text':        return join('text', req(edition, 'edition'), `${req(unitId, 'unitId')}.json`);
    case 'chart':       return join('charts', req(edition, 'edition'), `${req(unitId, 'unitId')}.json`);
    // The margin is a SEPARATE TREE from the text on purpose (W-165). An
    // edition's apparatus is captured and verified on its own ladder, per
    // unit, and gates nothing in either direction (W-131/W-133) — so a unit
    // with no margin file is an ordinary, silent state and never an error.
    case 'margin':      return join('margin', req(edition, 'edition'), `${req(unitId, 'unitId')}.json`);
    case 'poetry':      return join('poetry', req(edition, 'edition'), `${req(unitId, 'unitId')}.json`);
    // The manuscripts an edition's apparatus cites, named. ONE FILE PER
    // EDITION and not per unit: it is the edition's own front matter.
    case 'marginLegend': return join('margin', `${req(edition, 'edition')}-legend.json`);
    case 'chartIndex':  return join('charts', req(edition, 'edition'), 'index.json');
    case 'names':       return join('names', `${req(lang, 'lang')}.json`);
    case 'container':
      throw new Error(
        'identity: there is no container file under H-11 — containers are a '
        + 'render-time projection, not a storage level, and O-44 rules they are the '
        + 'chart\'s. Ask for the spine or the text of the unit.');
    default:
      throw new Error(`identity: unknown path kind ${JSON.stringify(kind)}`);
  }
}

function req(value, name) {
  if (value === undefined || value === null || value === '') {
    throw new Error(`identity: resolvePath needs ${name}`);
  }
  return String(value);
}
