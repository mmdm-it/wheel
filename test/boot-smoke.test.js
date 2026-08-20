// THE BOOT SMOKE TEST — the gap two bugs walked through in one day
// (2026-07-30). Every other suite exercises a PIECE: a builder, the geometry,
// the bridge. None of them ever boots the app, so a crash in bootVolume itself
// is invisible to a fully green run. Twice in one session that cost a white
// screen on the phone: a `config.bootSplash` read a few lines before `config`
// existed, and a verse ring that reached only one book.
//
// This file boots main.js for real — it self-executes — against a stubbed DOM
// and the actual manifests on disk, and asserts only that the instrument comes
// up. It is deliberately shallow: not what the app looks like, only that it
// LIVES. Node runs each test file in its own process, so the globals here
// cannot leak into another suite.

import assert from 'node:assert/strict';
import { describe, it, before } from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installBrowserGlobals } from './helpers/browser-globals.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

// Elements main.js looks up by id. Anything it asks for that isn't here
// returns null, which the code already tolerates (every lookup is guarded).

describe('the app boots', () => {
  let errors = [];
  let byId;

  before(async () => {
    // `?proofread=true` IS REQUIRED FOR THIS VOLUME NOW (H-14). The corpus
    // carries `proofread: false` for its one offered edition, so without the
    // override the volume is DARK — which is the ruled behaviour, not a
    // failure, and is asserted separately below. Booting the reader's happy
    // path therefore means lifting the gate the way Howell's phone does.
    ({ byId } = installBrowserGlobals('?volume=bible&proofread=true'));
    const realError = console.error;
    console.error = (...args) => { errors.push(args.join(' ')); };
    // main.js self-executes bootVolume at import.
    await import('../src/main.js');
    // Let the boot's awaits and one animation frame settle.
    await new Promise(r => setTimeout(r, 150));
    console.error = realError;
  });

  it('reaches the end of boot without a fatal error', () => {
    const fatal = errors.filter(e => /Failed to initialize|volume validation failed/.test(e));
    assert.deepEqual(fatal, [], `boot reported: ${fatal.join(' | ')}`);
  });

  it('does not paint the boot-error message into the detail sector', () => {
    const content = byId.get('detail-content');
    const text = String(content?.textContent || '');
    assert.ok(!/Failed to initialize/.test(text), `detail sector shows: ${text}`);
  });

  // THE LAUNCH FUNNEL OFFERS EVERY SERVABLE LANGUAGE (O-75), and this cell
  // exists because nothing else in the suite could see the defect.
  //
  // Howell's ruling 2 of 2026-07-30: every launch opens on the LANGUAGE plane
  // and the reader travels inward. O-72 then taught the chooser to offer only
  // the editions holding where the reader stands — right for a sideways move
  // at a leaf, wrong for the launch question, because the app boots INTO the
  // text. So the funnel opened already filtered by a position the reader had
  // not chosen, and the Greek New Testament — which holds no verse of Genesis
  // — was unreachable from launch. One screenshot found it.
  //
  // Every cell O-72 shipped still passed: they test the adapter, the bridge,
  // and the seam between them. The defect was in the HOST's decision about
  // WHEN to push a position, which only a real boot can observe. That is why
  // this assertion lives here, in the file that boots main.js for real,
  // rather than beside the ones it belongs to by subject.
  it('THE LAUNCH FUNNEL CARRIES NO POSITION FILTER, so nothing is narrowed away', () => {
    // Asserted as the INVARIANT rather than as a list of languages, because
    // this suite boots the one-book fixture and a language list would pass
    // there whatever the filter did. `here === null` is the fact: no position
    // has been pushed, so every servable edition is on offer.
    const here = globalThis.window?.__wheelDimension?.here?.();
    assert.equal(here, null,
      'the funnel was filtered by the verse the app happened to boot into — '
      + `an edition not holding it is unreachable from launch (got ${JSON.stringify(here)})`);
  });
});

// THE FUNNEL ENDS AT THE TEXT, NOT AT THE FIRST TURN OF A RING (O-77).
//
// O-75 stopped the launch funnel opening pre-filtered. It did not ask what
// CLOSES the funnel, and the answer on the day was "a committed choice" —
// which reads perfectly right up until you remember that TURNING THE LANGUAGE
// RING IS A COMMIT: the springback settles on the node under the lens and
// calls `select` on it. So the reader's very first rotation — the one gesture
// the funnel exists to invite — switched O-72's position filter on underneath
// the ring they were still turning, and the ring re-reads its nodes on every
// frame. Howell, from the LAN: rotate onto the Greek and back, and the Hebrew
// is gone.
//
// A PROBE OF THE OLD CODE FOUND THE OTHER HALF, which nobody had reported:
// travelling inward to the text left the funnel flag RAISED, so `here` stayed
// null at the leaf and O-72's filter never came on at all for a reader who
// simply confirmed their language and started reading. The flag was being
// lowered at exactly the wrong moment in both directions.
//
// These cells run in their own describe so they own the state they mutate:
// they turn the globe, which the smoke cells above must not see.
describe('the launch funnel closes when the reader arrives at the text', () => {
  // The app booted ONCE, in the describe above: `main.js` self-executes at
  // import and ESM caches it, so a second import is not a second launch.
  // These cells read that same instrument and turn its globe.
  let D;
  before(() => {
    D = globalThis.window?.__wheelDimension;
    assert.ok(D, 'the booted app exposed no dimension handle');
  });

  // The globe travels inward: language (2) → edition (1) → the text (0).
  const cycle = async () => { D.cycle(); await new Promise(r => setTimeout(r, 400)); };

  it('opens on the language plane with the funnel up and no filter', () => {
    assert.equal(D.front(), 2, 'every launch opens on the LANGUAGE plane (Howell ruling 2)');
    assert.equal(D.funnel(), true);
    assert.equal(D.here(), null);
  });

  it('STAYS UP WHILE THE READER IS STILL INSIDE IT — one plane in is not arrival', async () => {
    await cycle();
    assert.equal(D.front(), 1, 'the edition plane');
    assert.equal(D.funnel(), true,
      'the funnel closed while the reader was still choosing — from here O-72 '
      + 'narrows the chooser by a seat the reader has not settled on');
    assert.equal(D.here(), null,
      `a position filter was pushed mid-funnel (got ${JSON.stringify(D.here())})`);
  });

  it('CLOSES AT THE TEXT, and O-72\'s filter comes on there', async () => {
    await cycle();
    assert.equal(D.front(), 0, 'the reader is at the text');
    assert.equal(D.funnel(), false, 'arrival at the text ends the launch question');
    assert.notEqual(D.here(), null,
      'the funnel flag was still raised at the leaf, so the chooser offers '
      + 'editions that do not hold where the reader is standing — O-72 dead');
  });

  it('does not re-open when the globe is tapped again — that is a sideways move', async () => {
    await cycle();
    assert.equal(D.front(), 2, 'the globe rounds back to the language plane');
    assert.equal(D.funnel(), false, 'a launch happens once; this is O-72\'s question');
    assert.notEqual(D.here(), null, 'and it is answered with the reader\'s position');
  });
});

// AND THE HALF A ONE-EDITION BOOT CANNOT WATCH, read off the source instead.
//
// The defect Howell reported needs TWO editions to observe: a commit only
// fires when the edition actually changes, and the boot fixture enumerates
// one on purpose (O-65 — the Vulgate is on disk and deliberately unreachable,
// which two cells in `fixture-h11` and `bible-volume` pin). Declaring a second
// edition to make this watchable would falsify a ruled invariant to test an
// unrelated one, so it is not done.
//
// What is left is to pin the rule at the site where it was got wrong. This is
// a source read and says so; it catches exactly one regression — the line
// coming back — and claims nothing more.
describe('a committed choice does not close the launch funnel', () => {
  it('the settle handler does not lower the funnel flag', () => {
    const src = readFileSync(path.join(repoRoot, 'src/main.js'), 'utf-8');
    const start = src.indexOf('dimensionBridge.onSettle(');
    assert.ok(start > 0, 'the settle handler moved — re-point this cell');
    // To the end of the handler: the next top-level `});` at its indent.
    const end = src.indexOf('\n  });', start);
    assert.ok(end > start, 'could not find the end of the settle handler');
    const body = src.slice(start, end);
    assert.ok(!/bootFunnelOpen\s*=/.test(body),
      'the settle handler closes the launch funnel again (O-77): turning the '
      + 'language ring IS a commit, so this switches O-72\'s filter on under a '
      + 'ring the reader is still turning, and the language they came from '
      + 'vanishes off it');
  });
});

// The SECOND bug of the day, guarded precisely rather than by smoke: boot used
// to build its own verse ring that walked ONE book from the entry chapter to
// that book's end, so a reader booting at Matthew 16:18 could rotate no
// earlier than Matthew 16:1 and no later than Matthew 28:20. Everything before
// the current chapter and after the current book was unreachable.
// RE-POINTED AT THE WALL (H-14), not retired. The behaviour it guards — the
// ring is the WHOLE volume, not the entry book — is a reader-facing promise
// that survives the migration; only its cargo changed. What it can no longer
// do is prove the point with a second book, because the volume enumerates one
// until 1b lands. That limit is stated here rather than papered over: this
// cell now proves the ring spans the whole enumeration, and the cross-book
// reach it was originally written for returns when a second increment does.
describe('the boot verse ring spans the whole volume', () => {
  it('runs from the volume\'s first verse to its last, seated at the entry verse', async () => {
    const { volumeConfigs } = await import('../src/volume-configs.js');
    const manifest = await volumeConfigs.bible.loadManifest();
    const volume = manifest.__wallVolume;
    const unitId = volume.units[0].id;

    const chain = await volumeConfigs.bible.buildChain(manifest, {
      level: 'verse', cousinMode: true, arrangement: 'cousins-with-gaps',
      bookId: unitId, chapterId: '1', verseId: '2',
      translation: volume.editions[0].code
    }, {});
    const real = chain.items.filter(Boolean);

    assert.equal(chain.items[chain.selectedIndex]?.id, `${unitId}_1_2`, 'seated at the entry verse');
    assert.equal(real[0].id, `${unitId}_1_1`, 'reaches back before the entry verse');
    assert.equal(real.length, 31, 'and forward to the last verse the volume enumerates');
    assert.equal(real[real.length - 1].id, `${unitId}_1_31`);
  });

  it('the ring holds NOTHING the enumeration does not carry', async () => {
    // The absence half of H-14's done condition, at ring level: seventy-eight
    // books sit in the legacy cargo on disk and none may appear here.
    const { volumeConfigs } = await import('../src/volume-configs.js');
    const manifest = await volumeConfigs.bible.loadManifest();
    const volume = manifest.__wallVolume;
    const chain = await volumeConfigs.bible.buildChain(manifest, {
      level: 'verse', cousinMode: true, arrangement: 'cousins-with-gaps',
      translation: volume.editions[0].code
    }, {});
    const books = new Set(chain.items.filter(Boolean).map(i => i.bookKey));
    assert.deepEqual([...books], [volume.units[0].id], 'exactly one book, the one enumerated');
    for (const legacy of ['GENE', 'EXO', 'MATHE', 'APOC']) {
      assert.ok(!books.has(legacy), `${legacy} is legacy cargo and must be unreachable`);
    }
  });
});
