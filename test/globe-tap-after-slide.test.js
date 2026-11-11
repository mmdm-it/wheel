// THE FIRST TAP ON THE GLOBE COUNTS (Howell, 2026-11-08: from the basement,
// "tapping on the dimension button to return to the primary stratum always
// requires a second tap. The first tap does nothing"). The slider's release
// sets suppressClick so the click a drag produces is not also a tap — but a
// finger's drag produces NO click, so the flag outlived the stroke and ate
// the next tap. The press that follows must begin with the flag cleared.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, '..', 'src', 'main.js'), 'utf8');

test('the globe\'s pointerdown clears suppressClick before anything can return early', () => {
  const m = src.match(/dimensionButton\.addEventListener\('pointerdown', event => \{\n([^\n]*)\n/);
  assert.ok(m, 'the globe has a pointerdown handler');
  assert.match(m[1], /^\s*suppressClick = false;/, 'first statement of the press clears the stale flag');
});

test('a drag\'s release still suppresses the click a mouse will send', () => {
  assert.match(src, /if \(moved\) suppressClick = true;/);
  assert.match(src, /if \(suppressClick\) \{ suppressClick = false; return; \}\n\s*tapGlobe\(\);/);
});
