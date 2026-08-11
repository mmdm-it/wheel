// THE DEV FIXTURE ROUTE (phase 1a, Howell 2026-08-11) — ADMITTED SCAFFOLDING.
//
// It exists to put the H-11 fixture in front of a phone before a single real
// unit has been re-cut, so the migration can be SEEN rendering rather than
// argued about. It is not a feature, it is a rig.
//
// BUILT TO BE DELETED. The moment 1b's first real increment supersedes it,
// this file goes — not deprecated, not left inert with a flag, deleted. Its
// only caller is the fixture wiring, and the whole of it is one decision
// function, so removing it is a two-line change rather than an excavation.
//
// FOUR CONSTRAINTS, all Howell's, and each one is why a line here exists:
//
//   1. LAN-GATED. Off the house network it is inert — not degraded, inert.
//      The gate fails closed (see lan-gate.js), so anything unrecognised is
//      treated as public and this returns nothing at all.
//   2. IN THE ?proofread=true FAMILY. It is opt-in by query parameter, like
//      the certification override beside it, so nothing changes for a reader
//      who does not ask.
//   3. ONE JOB. It answers "should the rig be on, and with what?" and holds
//      no opinion about how anything renders.
//   4. IT PINS THE EDITION. The fixture carries two editions and the corpus
//      carries fourteen; on any other edition the substituted unit would have
//      no text. Falling through to the legacy unit there would make a unit
//      half-present ALONG THE EDITION DIMENSION — a coexistence mode O-42's
//      all-or-nothing rule never contemplated, and which 1b must answer
//      properly for real editions. A rig that prefigures an unruled behaviour
//      is worse than one that admits it is rigging the test.
import { isOnLan } from './lan-gate.js';

const PARAM = 'fixture';
const VALUE = 'h11';

export function readDevFixtureRoute({
  search = (typeof window !== 'undefined' ? window.location.search : ''),
  location = (typeof window !== 'undefined' ? window.location : null),
  declare = null
} = {}) {
  if (!declare) return null;                       // nothing declared: no rig
  if (!isOnLan(location)) return null;             // fails closed, off-LAN
  let asked = false;
  try {
    asked = new URLSearchParams(search || '').get(PARAM) === VALUE;
  } catch {
    return null;                                   // unparseable: inert
  }
  if (!asked) return null;

  // THE SUBSTITUTION IS DECLARED, NOT INFERRED (Howell's ruling (a)).
  // The rig says plainly which legacy address the fixture unit stands in for.
  // Nothing here derives that from an id, a name or a count — the join is
  // scaffolding, it is written down as scaffolding, and it dies with this file.
  const { unitId, replaces, edition } = declare;
  if (!unitId || !replaces || !edition) return null;
  return { unitId, replaces, edition, pinned: true };
}

export const DEV_FIXTURE_PARAM = PARAM;
export const DEV_FIXTURE_VALUE = VALUE;
