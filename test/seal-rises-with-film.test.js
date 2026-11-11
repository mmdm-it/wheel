// The seal arrives with the primary stratum on the boot film (Howell,
// 2026-11-11): always present and never moved by a truck, except on a fresh
// boot, where it rides the film as one of the primary plane's overlays.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../styles/base.css', import.meta.url), 'utf8');

test('the film puts the seal on the primary plane', () => {
  assert.match(main, /if \(overture\) sealRides = true;/);
  assert.match(main, /'incomplete-mark', 'seal'\]\) \{\n  const panel = document\.getElementById\(id\);\n  if \(id === 'seal' && !sealRides\) continue;/);
});
test('it keeps its half ink while it recedes, and never takes the finger', () => {
  assert.match(main, /id === 'seal' \? 0\.5 \* opacity : opacity/);
  assert.match(main, /if \(id !== 'seal'\) panel\.style\.pointerEvents/);
});
test('every way out of the film takes it off the plane, so later trucks leave it still', () => {
  assert.match(main, /o\.abort\(\); sealRest\(\);/);
  assert.match(main, /arrive: \(\) => \{ bootOvertureLive = null; sealRest\(\);/);
  assert.match(main, /maxStrataFront\(\) >= 2\)\) sealRest\(\);/);
});
test('at rest it stands at half ink with no transform of its own', () => {
  const rule = css.slice(css.indexOf('#seal {'), css.indexOf('}', css.indexOf('#seal {')));
  assert.match(rule, /opacity: 0\.5;/);
  assert.doesNotMatch(rule, /transform/);
});
