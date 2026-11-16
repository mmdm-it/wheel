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
