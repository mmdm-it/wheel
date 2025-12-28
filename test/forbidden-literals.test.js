import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const forbiddenTerms = [
  'bible',
  'catalog',
  'calendar',
  'places',
  'gutenberg',
  'mmdm'
];

const skipDirs = new Set([
  'node_modules',
  'data',
  'docs',
  'scripts',
  'styles',
  'test'
]);

const skipPaths = new Set([
  path.join('src', 'adapters'),
  path.join('src', 'pyramid'),
  path.join('src', 'navigation', 'cousin-builder.js'),
  'index.html'
]);

const allowedExtensions = new Set(['.js', '.mjs']);

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    const relPath = path.relative(repoRoot, entryPath);
    if (entry.isDirectory()) {
      if (skipDirs.has(entry.name)) continue;
      // skip any nested path that matches a skip path prefix
      const shouldSkip = Array.from(skipPaths).some(skip => relPath.startsWith(skip + path.sep));
      if (shouldSkip) continue;
      files.push(...await walk(entryPath));
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (!allowedExtensions.has(ext)) continue;
      if (skipPaths.has(relPath)) continue;
      files.push(relPath);
    }
  }
  return files;
}

async function scanFile(relPath) {
  const absPath = path.join(repoRoot, relPath);
  const content = await fs.readFile(absPath, 'utf8');
  const hits = [];
  forbiddenTerms.forEach(term => {
    const regex = new RegExp(`\\b${term}\\b`, 'i');
    if (regex.test(content)) {
      hits.push(term);
    }
  });
  return hits.length ? { relPath, hits } : null;
}

describe('forbidden volume literals', () => {
  it('does not allow volume-specific literals in shared code', async () => {
    const files = await walk(path.join(repoRoot, 'src'));
    const results = (await Promise.all(files.map(scanFile))).filter(Boolean);
    const failures = results.filter(({ relPath }) => !relPath.startsWith(path.join('src', 'adapters')));
    if (failures.length) {
      const detail = failures.map(f => `${f.relPath}: ${f.hits.join(', ')}`).join('\n');
      assert.fail(`Forbidden volume literals found:\n${detail}`);
    }
  });
});
