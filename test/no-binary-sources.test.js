// NO SOURCE FILE MAY LOOK BINARY TO A SEARCH.
//
// `bible-volume.js` built its chart cache keys as `${unitId}\0${edition}`. A
// NUL is a fine separator — unit ids are hex, edition codes alphanumeric, so
// neither can contain one — and it made the file BINARY as far as grep is
// concerned.
//
// The cost was not theoretical. Wilbur searched src/ for a comment, got
// nothing, and reasonably reported that it was absent; the comment was there,
// and a 500-line core file had simply been excluded from the search. grep
// gives no warning for this and exits 1, so "not found" is indistinguishable
// from "not searched" — the same shape as every other instrument this project
// has caught reporting success over something it never looked at.
//
// A tool that silently skips part of the repository is worse than one that
// fails, because both sessions reason from what searches return. So: no
// control characters in tracked source, other than the tab and newline that
// legitimately appear in text.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function sourceFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(full));
    else if (/\.(js|mjs|cjs|css|html|json|md)$/.test(entry.name)) out.push(full);
  }
  return out;
}

describe('no tracked source file reads as binary to a search', () => {
  it('src/, styles/, scripts/ and test/ carry no control characters', () => {
    const dirs = ['src', 'styles', 'scripts', 'test'].map(d => path.join(root, d));
    const offenders = [];
    for (const dir of dirs) {
      for (const file of sourceFiles(dir)) {
        const text = readFileSync(file, 'utf8');
        // Everything below 0x20 except tab (09) and newline (0A), plus a bare
        // carriage return (0D) is fine to allow — the concern is NUL and its
        // neighbours, which are what make a file "binary".
        const bad = [...text].filter(ch => {
          const c = ch.charCodeAt(0);
          return c < 0x20 && c !== 0x09 && c !== 0x0a && c !== 0x0d;
        });
        if (bad.length) {
          offenders.push(`${path.relative(root, file)} (${bad.length}× U+${bad[0].charCodeAt(0)
            .toString(16).padStart(4, '0').toUpperCase()})`);
        }
      }
    }
    assert.deepEqual(offenders, [],
      'these files contain control characters and grep will silently skip them:\n  '
      + offenders.join('\n  ')
      + '\n  A search returning nothing from such a file means "not searched", not "not present".');
  });
});
