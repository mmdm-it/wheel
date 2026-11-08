// THE LATIN KEEPS ITS U (2026-11-08). EB Garamond carries a `locl` table for
// lang="la" that sets every u as v — Dominvs, tvvm — which is the font's
// conceit and not the edition's orthography. The stylesheet switches that
// table off for Latin-tagged verse text; this holds the switch in place.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(path.join(root, 'styles/base.css'), 'utf-8');

test('Latin-tagged verse text has the locl feature switched off', () => {
  const m = /\.detail-text--arc\[lang="la"\]\s*\{([^}]*)\}/.exec(css);
  assert.ok(m, 'no rule for .detail-text--arc[lang="la"]');
  assert.match(m[1], /font-feature-settings\s*:\s*"locl"\s+0\s*;/);
});
