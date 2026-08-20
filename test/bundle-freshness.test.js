// THE BUNDLE MUST NOT BE OLDER THAN THE SOURCE (O-61).
//
// The failure this closes, in the shape it actually took: on 2026-08-15 the
// suite passed 444 cells against `src/` while the LAN served a `dist/app.js`
// nine hours old. Every "verified" reported that day was true of the source
// and silently untrue of the app in Howell's hand. He tested, found an empty
// shelf, and reported a bug that had already been fixed — twice, because the
// stale bundle was also hiding a second defect underneath it.
//
// Nothing connected the two. `npm test` reads `src/`; the browser reads
// `dist/app.js`; no gate compared them. WORKFLOW step 1 says to run
// `npm run build`, so the procedure was right and the discipline simply
// failed — which is the argument for a check rather than a reminder.
//
// WHAT IT DOES NOT DO. A MISSING bundle is not a failure: CI checks out a
// tree with no `dist/` (it is gitignored) and builds nothing, and a fresh
// clone is in the same state. Nothing is being served in either case, so
// there is nothing to be stale. The guard fires only when a bundle EXISTS and
// is older than something it was built from — the one case where a person can
// be looking at a lie.
//
// SOURCE means what the bundle is built FROM: `src/**` and the version
// `package.json` stamps into it. Not `styles/` or `index.html`, which the
// browser fetches directly and which therefore cannot go stale this way; not
// `test/`, which is never bundled.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { statSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BUNDLE = path.join(root, 'dist', 'app.js');

function sourceFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(full));
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

// A SILENT SKIP IS A PASS, AND THIS ONE HAS BEEN PASSING OVER NOTHING (O-74).
//
// The cell opened `if (!existsSync(BUNDLE)) return;` — a bare early exit,
// which node's runner reports as a PASSING test. `dist/` is gitignored and CI
// never builds, so on every CI run since this guard was written it has
// reported "the built bundle is not older than its source" about a bundle
// that was not there.
//
// The absence is legitimate — CI serves nothing, so nothing can be stale —
// and that is exactly why this must SKIP rather than fail. What it must not
// do is report a measurement it did not take. A declared skip carries its
// reason into the output; a bare return is indistinguishable from a check
// that ran and found nothing wrong.
//
// FOUND BY WILBUR'S WARNING, not by my own reading. He audited his suite for
// checks that read through the wall after CI caught me writing one, found the
// same disease in a cell of his own, and told me to look. I had grepped this
// file's neighbourhood twice today without seeing it.
const BUNDLE_EXISTS = existsSync(BUNDLE);

describe('the built bundle is not older than its source (O-61)', () => {
  it('dist/app.js is newer than every file it is built from', {
    skip: BUNDLE_EXISTS ? false : 'no dist/app.js in this checkout — nothing built, nothing served, nothing to be stale'
  }, () => {

    const bundleTime = statSync(BUNDLE).mtimeMs;
    const inputs = [...sourceFiles(path.join(root, 'src')), path.join(root, 'package.json')];
    const newer = inputs
      .filter(f => existsSync(f) && statSync(f).mtimeMs > bundleTime)
      .map(f => path.relative(root, f));

    assert.deepEqual(newer, [],
      'dist/app.js is OLDER than these — the app being served is not the app being tested.\n'
      + `  ${newer.slice(0, 8).join('\n  ')}${newer.length > 8 ? `\n  …and ${newer.length - 8} more` : ''}\n`
      + '  Run `npm run build`. (O-61: a green suite over a stale bundle is how a\n'
      + '  fixed bug gets reported twice.)');
  });
});
