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
//   T1 ── ALPH  containers "1" (u1,u2) and "2" (u3,u4)   → a chapter crossing
//      └─ BETH  container  "1" (u1,u2)                    → a book crossing
//   T2 ── GAMM  container  "1" (u1,u2)                    → a testament crossing
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
  return {
    testaments: [
      { id: 'T1', order: 0, books: [book('ALPH'), book('BETH')] },
      { id: 'T2', order: 1, books: [book('GAMM')] }
    ],
    units: [book('ALPH'), book('BETH'), book('GAMM')],
    editions: [{ code: edition, language: 'english', hasChart: true, proofread: true }],
    namesByLanguage: {
      english: {
        testaments: { T1: 'First', T2: 'Second' },
        books: { ALPH: 'Alpha', BETH: 'Beta', GAMM: 'Gamma' }
      }
    },
    displayConfig: {},
    spineFor: id => spines[id] || null,
    chartFor: (id, ed) => (ed === edition ? CHARTS[id] || null : null),
    textFor: () => null,
    has: id => Boolean(UNITS[id]),
    toRoot: () => ({
      display_config: {},
      testaments: {
        T1: { sort_number: 0, books: { ALPH: { sort_number: 0 }, BETH: { sort_number: 1 } } },
        T2: { sort_number: 1, books: { GAMM: { sort_number: 0 } } }
      }
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
