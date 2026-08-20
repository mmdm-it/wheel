// A SYNTHETIC WALL VOLUME for tests that need boundaries the real cargo has
// not got yet (H-14).
//
// The Genesis-1 fixture IS the Bible until 1b lands: one testament, one book,
// one container. That is the right fixture for proving the real data PATH end
// to end, and the wrong one for proving GRAMMAR — a chapter crossing, a book
// crossing and a testament crossing simply do not exist in it, so any cell
// asserting the 2/4/6 gap ladder against it would silently shrink to "one
// chapter still works" while keeping its name and its green tick.
//
// Two questions, two fixtures. This is the second one, and it is shared so
// that the shape is defined once rather than drifting between suites.
//
//   D1 ── ALPH  containers "1" (u1,u2) and "2" (u3,u4)   → a chapter crossing
//      └─ BETH  container  "1" (u1,u2)                    → a book crossing
//   D2 ── GAMM  container  "1" (u1,u2)                    → a division crossing
//
// The top level is the EDITION'S division of itself (H-29), declared in its
// chart index rather than stored on the volume — so this helper answers
// `divisionsFor(edition)` and its `units` are flat, exactly as volume.json is.
//
// Every rank of the ladder appears exactly once, which is what makes a wrong
// rank visible rather than averaged away.

const UNITS = {
  ALPH: { leaves: 4, testament: 'T1', order: 0 },
  BETH: { leaves: 2, testament: 'T1', order: 1 },
  GAMM: { leaves: 2, testament: 'T2', order: 0 }
};

const CHARTS = {
  ALPH: {
    groups: [{ label: '1', from: 1, to: 2 }, { label: '2', from: 3, to: 4 }],
    seats: [
      { label: '1', utterances: ['ALPH-u1'] }, { label: '2', utterances: ['ALPH-u2'] },
      { label: '1', utterances: ['ALPH-u3'] }, { label: '2', utterances: ['ALPH-u4'] }
    ]
  },
  BETH: {
    groups: [{ label: '1', from: 1, to: 2 }],
    seats: [{ label: '1', utterances: ['BETH-u1'] }, { label: '2', utterances: ['BETH-u2'] }]
  },
  GAMM: {
    groups: [{ label: '1', from: 1, to: 2 }],
    seats: [{ label: '1', utterances: ['GAMM-u1'] }, { label: '2', utterances: ['GAMM-u2'] }]
  }
};

const book = id => ({
  id, leaves: UNITS[id].leaves, order: UNITS[id].order, testamentId: UNITS[id].testament
});

export function makeWallVolume({ edition = 'ED' } = {}) {
  const spines = Object.fromEntries(Object.entries(UNITS).map(([id, u]) => [
    id, { utterances: Array.from({ length: u.leaves }, (_, i) => `${id}-u${i + 1}`) }
  ]));
  // TWO DIVISIONS, DECLARED BY THE EDITION (H-29) — the fixture keeps its
  // crossing, which is the whole reason it exists, but the crossing is now the
  // EDITION'S statement rather than the volume's. `units` is flat, as
  // `volume.json` is.
  const DIVISIONS = [
    { label: 'First', image: 'first_emblem', from: 1, to: 2, books: ['ALPH', 'BETH'] },
    { label: 'Second', image: 'second_emblem', from: 3, to: 3, books: ['GAMM'] }
  ];
  const units = [book('ALPH'), book('BETH'), book('GAMM')];
  return {
    units,
    editions: [{ code: edition, language: 'english', hasChart: true, proofread: true }],
    namesByLanguage: {
      english: { books: { ALPH: 'Alpha', BETH: 'Beta', GAMM: 'Gamma' } }
    },
    displayConfig: {},
    spineFor: id => spines[id] || null,
    chartFor: (id, ed) => (ed === edition ? CHARTS[id] || null : null),
    textFor: () => null,
    has: id => Boolean(UNITS[id]),
    bookOrderFor: () => units.map(u => u.id),
    divisionsFor: ed => (ed === edition ? DIVISIONS.map(d => ({ ...d })) : []),
    toRoot: ed => ({
      display_config: {},
      testaments: Object.fromEntries((ed === edition || ed === undefined ? DIVISIONS : [])
        .map((d, order) => [`division-${order}`, {
          sort_number: order,
          name: d.label,
          image: d.image,
          books: Object.fromEntries(d.books.map((id, i) => [id, { sort_number: i }]))
        }]))
    })
  };
}

// The manifest wrapper, with the volume hung NON-ENUMERABLY exactly as the
// real boot does. That detail is not cosmetic: a plain sibling key breaks the
// key-count heuristic that unwraps the root, which cost a logo and a colour
// scheme once already. A helper that differs from production here would hide
// the next occurrence.
export function makeWallManifest(opts) {
  const volume = makeWallVolume(opts);
  const manifest = { Gutenberg_Bible: volume.toRoot() };
  Object.defineProperty(manifest, '__wallVolume', { value: volume, enumerable: false });
  return manifest;
}
