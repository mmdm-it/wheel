// The seal rises with the boot film (Howell, 2026-11-11): always present and
// never moved by a truck, except on a fresh boot, where it is absent before
// the boot verse and rises into its corner on the film's last truck in.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../styles/base.css', import.meta.url), 'utf8');

test('the seal is below the glass while the film is live', () => {
  assert.match(main, /if \(overture\) sealRise\(0\);/);
});
test('it rides the film\'s floor position, so only the last truck in raises it', () => {
  assert.match(main, /thumb: p => \{ sealRise\(1 - p\);/);
});
test('every way out of the film leaves it at rest', () => {
  assert.match(main, /o\.abort\(\); sealRise\(1\);/);
  assert.match(main, /arrive: \(\) => \{ bootOvertureLive = null; sealRise\(1\);/);
  assert.match(main, /maxStrataFront\(\) >= 2\)\) sealRise\(1\);/);
});
test('at rest (no variable set) it stands in place at half ink', () => {
  const rule = css.slice(css.indexOf('#seal {'), css.indexOf('}', css.indexOf('#seal {')));
  assert.match(rule, /opacity: calc\(0\.5 \* var\(--seal-rise, 1\)\)/);
  assert.match(rule, /translateY\(calc\(\(1 - var\(--seal-rise, 1\)\) \* 120%\)\)/);
});
