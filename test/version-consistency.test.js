import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

// Guards the versioning policy in docs/VERSIONING.md: package.json is the
// source of truth, and README + CHANGELOG must agree with it.

const SEMVER = /^\d+\.\d+\.\d+$/;

async function read(rel) {
  return fs.readFile(path.join(repoRoot, rel), 'utf8');
}

describe('version consistency', () => {
  it('package.json version is plain semver', async () => {
    const pkg = JSON.parse(await read('package.json'));
    assert.match(pkg.version, SEMVER, `package.json version "${pkg.version}" is not X.Y.Z`);
  });

  it('README Current Version matches package.json', async () => {
    const pkg = JSON.parse(await read('package.json'));
    const readme = await read('README.md');
    const section = readme.match(/## Current Version\n(- v[^\s(]+)/);
    assert.ok(section, 'README.md is missing a "## Current Version" section with a "- vX.Y.Z" line');
    assert.equal(
      section[1],
      `- v${pkg.version}`,
      `README Current Version says "${section[1]}" but package.json is ${pkg.version}`
    );
  });

  it('README inline "current vX.Y.Z" references match package.json', async () => {
    const pkg = JSON.parse(await read('package.json'));
    const readme = await read('README.md');
    for (const m of readme.matchAll(/current `v(\d+\.\d+\.\d+)`/g)) {
      assert.equal(
        m[1],
        pkg.version,
        `README says current \`v${m[1]}\` but package.json is ${pkg.version}`
      );
    }
  });

  it('CHANGELOG newest entry matches package.json', async () => {
    const pkg = JSON.parse(await read('package.json'));
    const changelog = await read('CHANGELOG.md');
    // Accept both entry styles present in the file: "## X.Y.Z — title" and
    // "## [X.Y.Z] - date". Skip [Unreleased] and data-version entries.
    const first = changelog.match(/^## \[?(\d+\.\d+\.\d+)\]?/m);
    assert.ok(first, 'CHANGELOG.md has no version entry heading');
    assert.equal(
      first[1],
      pkg.version,
      `CHANGELOG newest entry is ${first[1]} but package.json is ${pkg.version}`
    );
  });
});
