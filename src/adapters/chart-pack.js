// THE CHART PACK'S READER (W-307, Howell 2026-11-20: "Go ahead and shrink the
// edition table"). An edition's bundle of charts is the largest thing a boot
// waits for — four megabytes of JSON, some 290 KB gzipped, for an edition of
// a whole volume — and nearly all of it is the same two keys written tens of
// thousands of times round two short strings. The corpus derives a pack from
// each bundle that says the same thing in a tenth of the characters and about
// half the gzipped bytes, and this turns a pack back into the charts the rest
// of the engine has always been handed. Nothing downstream can tell.
//
//   { edition, pack: 1, charts: { <unit>: { shards, groups, labels, b, n?, x? } } }
//
//   labels  the seats' labels in order: a run of whole numbers counting up
//           by one is [first, howMany]; any other label is itself, a string.
//   b       every seat's utterance ids in order, each without its leading
//           "u", as the four bytes its eight hex digits spell, run together
//           and written in base64. (The ids are random, so gzip can do no
//           better than the four bytes an id is — which base64 lets it reach
//           and hex does not.)
//   n       only where a seat does not hold exactly one utterance:
//           { <seat index>: how many it holds }.
//   x       only where a seat carries a key besides its label and its
//           utterances: { <seat index>: { those keys } }.
//
// A chart the writer would not vouch for in this form is carried whole, under
// `whole`. The writer lives with the corpus; the two are kept in step by the
// same worked example pinned in each repository's suite.
const HEX = Array.from({ length: 256 }, (_, i) => (i < 16 ? '0' : '') + i.toString(16));
const bytesOf = b64 => (typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('latin1'));

/** Is this a pack this reader understands? */
export const isChartPack = pack => Boolean(pack) && pack.pack === 1 && Boolean(pack.charts) && typeof pack.charts === 'object';

/** One packed chart back to { book, edition, shards, groups, seats: [{ label, utterances }] }. */
export function unpackChart(unitId, edition, packed) {
  if (packed.whole) return packed.whole;
  const { labels, b, n, x, ...rest } = packed;
  const bytes = bytesOf(b || '');
  const seats = [];
  let at = 0;
  const seat = label => {
    const i = seats.length;
    const count = n && n[i] !== undefined ? n[i] : 1;
    const utterances = new Array(count);
    for (let k = 0; k < count; k += 1, at += 4) {
      utterances[k] = `u${HEX[bytes.charCodeAt(at)]}${HEX[bytes.charCodeAt(at + 1)]}${HEX[bytes.charCodeAt(at + 2)]}${HEX[bytes.charCodeAt(at + 3)]}`;
    }
    seats.push(x && x[i] ? { label, utterances, ...x[i] } : { label, utterances });
  };
  for (const entry of labels || []) {
    if (Array.isArray(entry)) for (let k = 0; k < entry[1]; k += 1) seat(String(entry[0] + k));
    else seat(entry);
  }
  if (at !== bytes.length) throw new Error(`chart-pack: ${unitId} spells ${bytes.length / 4} utterances and seats ${at / 4}`);
  return { book: unitId, edition, ...rest, seats };
}

/** A whole pack back to { <unit>: chart }, or null where it is not a pack. */
export function unpackCharts(pack) {
  if (!isChartPack(pack)) return null;
  const charts = {};
  for (const unitId of Object.keys(pack.charts)) charts[unitId] = unpackChart(unitId, pack.edition, pack.charts[unitId]);
  return charts;
}

/**
 * Which unit of a pack seats this utterance, without unpacking it — the early
 * loader's one question (O-317). Null where none does.
 */
export function unitSeatingUtterance(pack, utterance) {
  if (!isChartPack(pack) || !/^u[0-9a-f]{8}$/.test(String(utterance))) return null;
  const needle = String.fromCharCode(...[1, 3, 5, 7].map(i => parseInt(utterance.slice(i, i + 2), 16)));
  for (const unitId of Object.keys(pack.charts)) {
    const packed = pack.charts[unitId];
    if (packed.whole) {
      if ((packed.whole.seats || []).some(s => (s.utterances || []).includes(utterance))) return unitId;
      continue;
    }
    const bytes = bytesOf(packed.b || '');
    for (let i = bytes.indexOf(needle); i >= 0; i = bytes.indexOf(needle, i + 1)) if (i % 4 === 0) return unitId;
  }
  return null;
}
