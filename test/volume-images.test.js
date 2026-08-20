// THE ENGINE SHIPS NO PICTURE THAT ASSERTS ANYTHING (W-114).
//
// Howell, 2026-08-19, on being told the crown of thorns lived in the engine's
// `assets/`: *"It should be on the Cargo side. It is cargo. The engine is
// agnostic. A crown of thorns is not agnostic in the least."*
//
// THE TEST IS WHAT THE IMAGE ASSERTS, NOT WHAT IT DECORATES. This engine must
// render a marine-engine catalogue as readily as scripture, so a crown of
// thorns in its `assets/` is the same defect as a book name in its renderer —
// the argument that put the names in cargo a month ago, arriving at the
// pictures.
//
// WHY AN ALLOWLIST RATHER THAN A PATTERN. There is no way to look at a PNG and
// tell whether it claims something about a corpus; only a person can. So the
// list below is the record of that judgement, one line of reasoning per file,
// and a new image landing in `assets/` fails this cell until someone writes
// its line. Failing is the point: the moment to think about whether a picture
// is agnostic is the moment it arrives, not the audit two months later. Same
// shape as `forbidden-literals` and the deploy gate's `PD_ALLOWLIST`.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readdirSync, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { joinAssetPath } from '../src/index.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Every entry is a judgement that this file says nothing about any volume's
// contents. Adding one is a decision; the reason is the entry.
const AGNOSTIC = new Map([
  ['dimension-sphere.png', 'UI chrome — the dimension button\'s globe. True of every volume.'],
  ['qr.png', 'Marketing. Points at the app, not into a corpus.'],
  ['fonts', 'A font is HOW you render, never WHAT you say (and §1c: not ours to license either way).']
]);

// HELD, NOT CLEARED — empty, and the mechanism stays.
//
// It held `catalog_logo.png` for about twenty minutes. The catalogue declared
// `logo_base_path: "assets/"` while cargo's copy sat in `mmdm/art/` with no
// `mmdm/assets/` at all, so deleting the engine's copy would have shipped a
// blank corner rather than a correct one. Cargo placed the file; the hold and
// the copy went together, exactly as the entry said they would.
//
// The map stays because the next such gap will not announce itself either,
// and an empty allowlist carrying its own reasoning is cheaper than
// rediscovering why one was wanted.
const HELD = new Map();

describe('the engine ships no volume-specific image (W-114)', () => {
  it('assets/ holds only what is agnostic, or what is explicitly held', () => {
    const entries = readdirSync(path.join(repoRoot, 'assets'));
    const unexplained = entries.filter(name => !AGNOSTIC.has(name) && !HELD.has(name));
    assert.deepEqual(unexplained, [],
      'a new file in assets/ must be justified as agnostic — say what it asserts, '
      + 'or move it to the volume whose content it is');
  });

  it('THE TWO BIBLE EMBLEMS ARE GONE — the crown especially', () => {
    // Named rather than inferred: these are the files the ruling was about,
    // and a cell that only counts entries would pass if one came back under a
    // new name while the other left.
    for (const gone of ['gutenberg_logo.png', 'torah_scroll.png']) {
      assert.equal(existsSync(path.join(repoRoot, 'assets', gone)), false,
        `${gone} asserts something about the Bible and must live with it`);
    }
  });

  it('THE CATALOGUE IS CARGO\'S TOO — gone from here AND served from there', () => {
    assert.equal(existsSync(path.join(repoRoot, 'assets/catalog_logo.png')), false,
      'the catalogue\'s logo is the catalogue\'s content');
    // The other half of the same fact. A cell asserting only the deletion
    // passes just as happily on a blank corner, which is the failure this
    // whole ruling would otherwise trade for the one it fixes.
    assert.equal(existsSync(path.join(repoRoot, 'data/mmdm/assets/catalog_logo.png')), true,
      'cargo must serve what the engine stopped serving');
  });

  it('nothing still HELD has quietly become permanent', () => {
    assert.deepEqual([...HELD.keys()], [],
      'a hold is a dated exception, never a home — clear it, or write why it stands');
  });
});

describe('the emblem resolves against the volume\'s data root, not the app root', () => {
  it('joins the volume root to the base path the DATA declares', () => {
    assert.equal(joinAssetPath('./data/gutenberg/2026.07.29/', 'assets/'),
      './data/gutenberg/2026.07.29/assets/');
    assert.equal(joinAssetPath('./data/mmdm/', 'assets/'), './data/mmdm/assets/');
  });

  it('normalises exactly one slash, from either side', () => {
    assert.equal(joinAssetPath('./data/x', '/assets/'), './data/x/assets/');
    assert.equal(joinAssetPath('./data/x/', 'assets/'), './data/x/assets/');
    assert.equal(joinAssetPath('./data/x//', '//assets/'), './data/x/assets/');
  });

  it('A VOLUME DECLARING NO ROOT IS UNCHANGED — the string stays as the data wrote it', () => {
    // W-114 is explicit that the data's string does not change. A volume that
    // has not been moved behind this rule must behave exactly as before, or
    // the migration is a flag day rather than a per-volume one.
    assert.equal(joinAssetPath('', 'assets/'), 'assets/');
    assert.equal(joinAssetPath(null, 'assets/'), 'assets/');
    assert.equal(joinAssetPath(undefined, 'assets/'), 'assets/');
  });

  it('the volume configs actually declare a root, or the resolution is inert', () => {
    // The joiner can be perfect and reach nothing. This is the cell that
    // would have caught the wiring being right and unused.
    const src = readdirSync(path.join(repoRoot, 'src'));
    assert.ok(src.includes('volume-configs.js'));
    const text = readFileSync(path.join(repoRoot, 'src/volume-configs.js'), 'utf8');
    assert.match(text, /assetBase:\s*`\$\{BIBLE_VOLUME_BASE\}\/\$\{BIBLE_VOLUME_VERSION\}\//,
      'the Bible resolves against its DATA VERSION root — that is what makes the emblem cacheable forever');
    assert.match(text, /assetBase:\s*'\.\/data\/mmdm\/'/,
      'the catalogue resolves against its volume root');
  });
});
