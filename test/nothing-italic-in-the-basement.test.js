// NOTHING IN THE BASEMENT IS ITALIC (O-275, Howell 2026-11-08: "remove the
// italics so nothing is italicized in the basement"). The side of the ring
// tells a landmark from a bookmark; the mark classes colour and face nothing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = f => readFileSync(join(here, '..', f), 'utf8');

test('no basement rule slants or colours a name or a legend word', () => {
  const css = read('styles/base.css');
  for (const sel of ['.secondary-strata-label', '.secondary-strata-legend']) {
    const rules = [...css.matchAll(new RegExp(`${sel.replace('.', '\\.')}[^{]*\\{([^}]*)\\}`, 'g'))].map(m => m[1]);
    assert.ok(rules.length, `${sel} has rules`);
    for (const body of rules) assert.doesNotMatch(body, /font-style\s*:\s*italic/, `${sel}: no italic`);
  }
  assert.doesNotMatch(css, /is-(landmark|bookmark)[^\n]*(fill|font-style):/, 'a mark is a hook, not a colour or a face');
  assert.doesNotMatch(css, /#7f1d1d|#16337a/, 'the dark red and dark blue are gone');
});

test('the page fetches no italic faces for the ring', () => {
  assert.doesNotMatch(read('index.html'), /Montserrat:ital|Noto\+Sans:ital/);
});
