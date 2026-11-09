// THE ARRIVAL SITS AMONG ITS NEIGHBOURS (O-279, Howell 2026-11-09): the
// verse the reader brings down to the basement is seated in the volume's
// order, under the lens, with its neighbours on either side — not appended
// after the chain as its last seat. A verse that is already oft-quoted or
// kept is that seat, drawn as such; only a stranger is hollow and dashed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inOrder } from '../src/core/bookmarks.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = p => fs.readFileSync(path.join(here, '..', p), 'utf8');

test('a loose seat with a known place is sorted among the kept and the hits; one without a place comes last', () => {
  const genesis = { id: 'g', edition: 'e', at: { rank: [0, 1, 1], tail: '' }, kept: '2026-01-01' };
  const matthew = { id: 'm', edition: 'e', at: { rank: [39, 5, 3], tail: '' }, kept: '2026-01-02' };
  const arrival = { id: 'p', edition: 'e', at: { rank: [18, 22, 1], tail: '' }, kept: '' };   // Psalms, brought down
  const unplaced = { id: 'x', edition: 'e', at: null, kept: '' };
  assert.deepEqual(inOrder([genesis, matthew, arrival, unplaced]).map(b => b.id), ['g', 'p', 'm', 'x']);
});

test('the host seats the loose ones by their places and puts the arrival under the lens', () => {
  const main = read('src/main.js');
  const items = main.slice(main.indexOf('const BASEMENT = {'), main.indexOf('label: key => keptSeat(key)'));
  assert.match(items, /seated\.push\(\{ id, edition, at: basementPlaces\[k\] \?\? null, kept: '' \}\)/, 'a loose seat enters the order with its place');
  assert.match(items, /return inOrder\(seated\)\.map\(b => seatKey\(b\.id, b\.edition\)\);/, 'one order for every seat on the ring');
  assert.doesNotMatch(items, /keys\.push\(k\)/, 'nothing is appended after the order');
  assert.match(main, /selected: \(\) => basementLens \?\? basementArrival\?\.key/, 'the lens goes to the arrival');
  // An arrival that is already a hit or kept is that seat: the key is the same, and it is not added twice.
  assert.match(items, /if \(have\.has\(k\)\) continue;/);
  // Its look: a hit is a hit, a kept seat is kept, and only a stranger is provisional.
  assert.match(main, /classFor: key => \(keptSeat\(key\) \? '' : isHit\(key\) \? 'is-hit' : 'is-provisional'\)/);
});

test('the stranger under the lens is hollow and dashed', () => {
  const css = read('styles/base.css');
  assert.match(css, /\.secondary-strata-node\.is-magnified\.is-provisional\s*\{[^}]*stroke-dasharray/);
});
