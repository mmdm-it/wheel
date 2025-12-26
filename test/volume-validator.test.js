import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { validateVolumeRoot } from '../src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.join(__dirname, '..');

const volumes = [
  {
    name: 'catalog',
    path: path.join(root, 'data', 'mmdm', 'mmdm_catalog.json'),
    selector: manifest => manifest?.MMdM
  },
  {
    name: 'calendar',
    path: path.join(root, 'data', 'calendar', 'manifest.json'),
    selector: manifest => manifest?.Calendar
  },
  {
    name: 'places',
    path: path.join(root, 'data', 'places', 'manifest.json'),
    selector: manifest => manifest?.Places
  },
  {
    name: 'bible',
    path: path.join(root, 'data', 'gutenberg', 'manifest.json'),
    selector: manifest => manifest?.Gutenberg_Bible
  }
];

for (const vol of volumes) {
  test(`${vol.name} manifest passes validation`, async () => {
    const raw = await readFile(vol.path, 'utf8');
    const manifest = JSON.parse(raw);
    const volumeRoot = vol.selector(manifest);
    const result = validateVolumeRoot(volumeRoot);
    assert.equal(result.ok, true, `expected ok for ${vol.name}`);
    assert.deepEqual(result.errors, [], `expected no errors for ${vol.name}`);
  });
}
