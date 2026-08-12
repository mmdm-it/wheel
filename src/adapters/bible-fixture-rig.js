// THE H-11 FIXTURE RIG (O-45, phase 1a) — ADMITTED SCAFFOLDING, BUILT TO DIE.
//
// Phase 1a's acceptance test is that opaque Genesis 1 renders from the H-11
// layout WHILE every other unit stays Vulgate-shaped beside it, and that the
// reader cannot tell. This is the wiring that makes that happen, and it is the
// only file that knows the fixture exists.
//
// IT LIVES IN adapters/ ON PURPOSE. The substitution names a scripture address
// — GENE, chapter 1, a chapters/ path — and adapters own volume semantics.
// Engine-general code must never learn any of those words (O-43), which is
// exactly why the declaration below sits here and the mechanism sits there.
//
// WHAT IT DOES, in order, and each step is one of the four moves:
//   4. fetch the unit's N per-edition text files and convert them to the one
//      shape every reader below already speaks (unit-text.js, the fourth move)
//   2. guarantee the chart is loaded, because the addresses come from it
//   1. supply the result under the substituted key, so the walk finds it
//   3. declare the substitution, which is the rig read at boot
//
// BUILT TO BE DELETED, like the route beside it. When 1b re-cuts the first
// real unit, this file and dev-fixture-route.js go — not deprecated, not left
// inert behind a flag — together with `declareTextSubstitution` and
// `legacyTextFile` in unit-source.js. Everything else in the splice is
// permanent, which is the point of having done it this way.
import { readDevFixtureRoute } from '../core/dev-fixture-route.js';
import { normalizeUnitText } from '../core/unit-text.js';
import { declareTextSubstitution } from '../core/unit-source.js';
import { resolvePath } from '../core/identity.js';
import { supplyChapterPayload } from './volume-helpers.js';

const BASE = './test/fixtures/h11/gutenberg';
const VERSION = 'v1';

// THE DECLARATION. Every join the rig makes is written down here, in one
// object, rather than derived from anything — ruling (a), and the reason the
// rig can be deleted by deleting a file.
//
// `replaces.file` is the legacy address the substitution keys on. It is a
// path rather than a book-and-chapter pair because that is what the six text
// sites actually resolve, so the comparison is between two strings that
// already exist and nothing has to be reconstructed to make them meet.
const DECLARATION = {
  unitId: 'bc22df',
  replaces: { unit: 'GENE', container: '1', file: 'data/gutenberg/chapters/GENE/001.json' },
  edition: 'VUL'
};

const fetchJson = async path => {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${path}`);
  return response.json();
};

export async function installBibleFixtureRig({ search, location } = {}) {
  const route = readDevFixtureRoute({ search, location, declare: DECLARATION });
  if (!route) return null;                       // off-LAN, or nobody asked

  const at = parts => resolvePath({ base: BASE, version: VERSION, ...parts });

  // THE UNIT DECLARES ITS OWN EDITIONS. Reading them from volume.json rather
  // than from a constant here is what makes the all-or-nothing check below
  // mean anything: a hand-typed list would be checked against itself.
  const volume = await fetchJson(at({ kind: 'volume' }));
  const declared = (volume?.editions || []).map(e => e.code).filter(Boolean);
  if (!declared.length) {
    throw new Error('[fixture-rig] the fixture volume declares no editions — there is nothing to render');
  }

  // MOVE 2 — THE CHART, GUARANTEED LOADED BEFORE ANYTHING WALKS.
  // The addresses come from the chart's seats, and the walk that needs them is
  // synchronous. So this is awaited at boot rather than resolved lazily: a
  // chart that arrives after the walk would leave the unit enumerated by the
  // wrong shape, which is the O-45 failure wearing a different hat.
  const chart = await fetchJson(at({ kind: 'chart', edition: route.edition, unitId: route.unitId }));
  const order = (chart?.seats || []).map(seat => String(seat.label));
  if (!order.length) {
    throw new Error(`[fixture-rig] ${route.unitId} has a chart with no seats — nothing declares the reading order`);
  }

  // MOVE 4 — every declared edition, eagerly, one settlement. The policy and
  // its cost are argued in unit-text.js; the reason it is not re-decided here
  // is that a rig inventing a second answer is how two policies start.
  const files = await Promise.all(declared.map(code =>
    fetchJson(at({ kind: 'text', edition: code, unitId: route.unitId }))));
  const editions = Object.fromEntries(declared.map((code, i) => [code, files[i]]));
  const records = normalizeUnitText({ editions, declared, order });

  // MOVE 1 — the payload, in the shape the loader already reads, under the key
  // the walk will resolve to. `book_key` and `sequence` are the retired fields
  // (H-11), supplied here deliberately: the loader builds the verse ids from
  // them, and under the rig those ids must come out as the LEGACY ones or the
  // reader-level diff is not empty. When 1b makes the unit real it carries its
  // own identity and this wrapper is what goes.
  const cacheKey = `${BASE}/${VERSION}/${route.unitId}`;
  supplyChapterPayload(cacheKey, {
    book_key: DECLARATION.replaces.unit,
    sequence: DECLARATION.replaces.container,
    verses: records
  });

  // MOVE 3 — the declaration itself. From here the walk substitutes, and
  // nothing else in the engine knows a fixture was involved.
  declareTextSubstitution({ from: DECLARATION.replaces.file, to: cacheKey });

  return {
    ...route,
    cacheKey,
    editions: declared,
    addresses: order.length,
    replaces: DECLARATION.replaces
  };
}
