// THE NOTES STAY ON THE LAN (2026-11-10): a data folder sent to a public door
// without the cleared-copy filter loses every `_` key on the way, keeps its
// pictures, leaves its fetched sources behind, and gets fresh braces.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { scrubTree, withoutNotes, GZ_FLOOR } from '../scripts/scrub-notes.mjs';

let dir;
const w = (rel, body) => { const p = path.join(dir, 'src', rel); mkdirSync(path.dirname(p), { recursive: true }); writeFileSync(p, body); };

describe('scrub-notes — the corpus\'s reasons never leave', () => {
  before(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'scrub-notes-'));
    w('manifest.json', JSON.stringify({ Vol: { _why: 'what he said', display_config: { _landscape: 'and why', landscape: { info: { default: 'info' }, _phone: 'his number because' } } } }));
    w('manifest.json.gz', 'stale brace');
    w('small.json', JSON.stringify({ a: 1 }));
    w('big.json', JSON.stringify({ _source: 'measured from', rows: Array.from({ length: 400 }, (_, i) => ({ i, name: `row ${i}` })) }, null, 1));
    w('assets/logo.png', 'PNG');
    w('sources/fetched.json', JSON.stringify({ _secret: true }));
  });
  after(() => { rmSync(dir, { recursive: true, force: true }); });

  it('removes every key beginning _ at every depth, and nothing else', () => {
    assert.deepEqual(withoutNotes({ _a: 1, b: { _c: 2, d: [{ _e: 3, f: 4 }] } }), { b: { d: [{ f: 4 }] } });
    assert.equal(withoutNotes('x'), 'x');
  });
  it('copies the tree without its notes, its stale braces or its sources, and makes braces above the floor', () => {
    const dest = path.join(dir, 'dest');
    const r = scrubTree(path.join(dir, 'src'), dest);
    const m = JSON.parse(readFileSync(path.join(dest, 'manifest.json'), 'utf8'));
    assert.deepEqual(m, { Vol: { display_config: { landscape: { info: { default: 'info' } } } } });
    assert.equal(existsSync(path.join(dest, 'manifest.json.gz')), false, 'small after scrubbing: no brace, and the stale one is not copied');
    assert.equal(readFileSync(path.join(dest, 'small.json'), 'utf8'), JSON.stringify({ a: 1 }), 'untouched bytes where nothing was removed');
    const big = readFileSync(path.join(dest, 'big.json'));
    assert.ok(big.length >= GZ_FLOOR);
    assert.equal(JSON.parse(big.toString('utf8'))._source, undefined);
    assert.equal(gunzipSync(readFileSync(path.join(dest, 'big.json.gz'))).toString('utf8'), big.toString('utf8'), 'the brace is the scrubbed file');
    assert.equal(readFileSync(path.join(dest, 'assets/logo.png'), 'utf8'), 'PNG');
    assert.equal(existsSync(path.join(dest, 'sources')), false);
    assert.equal(r.notes, 2);
  });
});
