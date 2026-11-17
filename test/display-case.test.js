// THE RING AND THE PARENT BUTTON SHOUT (O-305). A Latin-script name is set in
// capitals whatever punctuation the printer gave it; other scripts keep the
// form their own rule gives them. And the glow copy of a label is told the
// theme's case rule by a road it can hear.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { toDisplayCase } from '../src/adapters/volume-helpers.js';

describe('display case (O-305)', () => {
  it('a printer\'s apostrophe, dash or quotation mark does not stop a Latin name being capitals', () => {
    assert.equal(toDisplayCase('L’alpha'), 'L’ALPHA');
    assert.equal(toDisplayCase('alpha — beta'), 'ALPHA — BETA');
    assert.equal(toDisplayCase('“alpha”'), '“ALPHA”');
    assert.equal(toDisplayCase('L\'alpha'), 'L\'ALPHA');
  });
  it('other scripts are untouched by the wider rule', () => {
    assert.equal(toDisplayCase('Бытие'), 'Бытие');
    assert.equal(toDisplayCase('בראשית'), 'בראשית');
    assert.equal(toDisplayCase('Γένεσις'), 'ΓΕΝΕΣΙΣ');
  });
  it('the theme that sets labels verbatim says so in a property the halo copy inherits', () => {
    const css = readFileSync(new URL('../styles/base.css', import.meta.url), 'utf8');
    assert.match(css, /:root\[data-theme="bible"\]\s*\{\s*--focus-label-transform:\s*none;\s*\}/);
  });
});

// O-309: over a text ground the globe may be solid, at the leaf alone.
describe('the globe at a leaf may wear a declared colour', () => {
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../styles/base.css', import.meta.url), 'utf8');
  it('the theme sets it only where declared, and the leaf is marked on the root', () => {
    assert.match(main, /if \(active\.globeAtLeaf\) root\.style\.setProperty\('--theme-globe-leaf', active\.globeAtLeaf\);\s*else root\.style\.removeProperty\('--theme-globe-leaf'\);/);
    assert.match(main, /classList\.toggle\('detail-open', Boolean\(visible\)\)/);
  });
  it('the rule reaches the globe only while the sector is open, and the basement ink wins', () => {
    assert.match(css, /:root\.detail-open #dimension-button svg \{ color: var\(--color-globe, var\(--theme-globe-leaf, #363636\)\); \}/);
  });
});
