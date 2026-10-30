// THE DEPLOY FILTER — the CLEARED gate at the door (O-231, 2026-10-28).
//
// It replaces the proofread-and-allowlist gate (O-56, O-81): the CHECKED gate is
// open (O-229) and clearance is DATA — build-volume leaves an uncleared edition
// out of volume.json and names it in uncleared.json. So the filter publishes
// every edition volume.json names, leaves the rest behind, copies only the
// versioned folder, and REFUSES if an uncleared code survives anywhere in what
// would leave. The fixtures are invented (WF-14).
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = 'scripts/deploy-pd-filter.mjs';
const V = '2026.01.01';
let dir;
const src = () => path.join(dir, 'src');
const dest = () => path.join(dir, 'dest');
const w = (rel, obj) => { const p = path.join(src(), rel); mkdirSync(path.dirname(p), { recursive: true }); writeFileSync(p, typeof obj === 'string' ? obj : JSON.stringify(obj)); };

function build({ published = ['PUB'], uncleared = ['UNC'], textOf = {}, namesNote = 'a note', leak = null } = {}) {
  rmSync(src(), { recursive: true, force: true }); rmSync(dest(), { recursive: true, force: true });
  w(`${V}/volume.json`, { editions: published.map(code => ({ code, language: 'latin', hasChart: true })), display_config: { editions: { coming: { latin: [...published, ...uncleared, 'Someday'] } } } });
  w(`${V}/uncleared.json`, { codes: uncleared, editions: uncleared.map(code => ({ code, map: 'Shelf name' })) });
  for (const code of [...published, ...uncleared]) {
    w(`${V}/charts/${code}/index.json`, { edition: code, books: [] });
    w(`${V}/text/${code}/b0.json`, { book: 'b0', edition: textOf[code] || code, text: { '1:1': 'in principio', '1:2': 'terra autem' } });
    w(`${V}/margin/${code}/b0.json`, { book: 'b0', edition: code, margin: [] });
  }
  w(`${V}/names/latin.json`, { _note: namesNote, books: { b0: 'Liber' }, overrides: Object.fromEntries(uncleared.map(c => [c, { b0: 'Secret' }])) });
  w(`${V}/names/hungarian.json`, { books: { b9: 'Könyv' } });
  w('declaration.json', { editions: [] }); w('staging/x/books/A.json', { secret: true }); w('naming/latin.json', {});
  if (leak) w(`${V}/ranks.json`, { leaves: { note: leak } });
}
const run = (versionArg = V) => {
  const args = [SCRIPT, src(), dest()]; if (versionArg) args.push(versionArg);
  const r = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf-8' });
  return { code: r.status, out: r.stdout || '', err: r.stderr || '' };
};
const has = rel => existsSync(path.join(dest(), V, rel));

describe('deploy filter — the CLEARED gate at the door (O-231)', () => {
  before(() => { dir = mkdtempSync(path.join(tmpdir(), 'deploy-filter-')); });
  after(() => { rmSync(dir, { recursive: true, force: true }); });

  it('publishes every edition volume.json names, and says how much it read', () => {
    build(); const r = run();
    assert.equal(r.code, 0, r.err);
    assert.match(r.out, /2 text records in 1 cleared edition/);
    assert.ok(has('text/PUB/b0.json') && has('charts/PUB/index.json') && has('margin/PUB/b0.json'));
  });
  it('leaves an uncleared edition behind — text, chart, margin — and the sidecar too', () => {
    build(); run();
    for (const rel of ['text/UNC/b0.json', 'charts/UNC/index.json', 'margin/UNC/b0.json', 'uncleared.json']) assert.equal(has(rel), false, rel);
  });
  it('copies only the versioned folder: the declaration, naming kits and staging never leave', () => {
    build(); run();
    assert.equal(existsSync(path.join(dest(), 'declaration.json')), false);
    assert.equal(existsSync(path.join(dest(), 'staging')), false);
    assert.equal(existsSync(path.join(dest(), 'naming')), false);
  });
  it('names an uncleared edition on the shelf by its shelf name, never its code', () => {
    build(); run();
    const v = JSON.parse(readFileSync(path.join(dest(), V, 'volume.json'), 'utf-8'));
    assert.deepEqual(v.display_config.editions.coming.latin, ['PUB', 'Shelf name', 'Someday']);
  });
  it('strips the names files of uncleared entries and of every note; a tongue with nothing published loses its file', () => {
    build(); run();
    const n = JSON.parse(readFileSync(path.join(dest(), V, 'names/latin.json'), 'utf-8'));
    assert.equal(n._note, undefined); assert.equal(n.overrides.UNC, undefined); assert.equal(n.books.b0, 'Liber');
    assert.equal(has('names/hungarian.json'), false);
  });
  it('REFUSES, and writes nothing, if an uncleared code survives anywhere', () => {
    build({ leak: 'see UNC' }); const r = run();
    assert.notEqual(r.code, 0); assert.match(r.err, /still names the uncleared UNC/);
    assert.equal(existsSync(dest()), false);
  });
  it('refuses a text file whose own edition disagrees with its directory', () => {
    build({ textOf: { PUB: 'OTHER' } }); const r = run();
    assert.notEqual(r.code, 0); assert.match(r.err, /sits in another edition's directory/);
  });
  it('refuses an empty volume, and a version it cannot find', () => {
    build({ published: [] }); assert.notEqual(run().code, 0);
    build(); assert.notEqual(run('1999.01.01').code, 0);
  });
  it('falls back to the ENGINE\'s declared version when none is passed', () => {
    const m = /BIBLE_VOLUME_VERSION\s*=\s*['"]([^'"]+)['"]/.exec(readFileSync(path.join(root, 'src/volume-configs.js'), 'utf-8'));
    assert.ok(m, 'the engine declares its volume version');
  });
});
