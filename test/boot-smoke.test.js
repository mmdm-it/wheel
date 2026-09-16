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
  it('THE APP BOOTS TO THE PRIMARY (O-143): the text is up and the position filter is on from the first frame', () => {
    const D = globalThis.window?.__wheelDimension;
    assert.equal(D?.front?.(), 0, 'every launch lands on the text (Howell 2026-09-15; the funnel of 2026-07-30 is retired)');
    assert.notEqual(D?.here?.(), null, 'O-72\'s filter is simply on — there is a "here" from the start');
  });
});

// THE TAP'S ROUND FROM THE TEXT (O-126, O-143). The launch funnel that these
// cells once walked — language, edition, text — is retired: the app boots to
// the Primary. What remains to pin is that the globe's tap goes round from
// there and that the position filter (O-72) is on at every stop.
//
// These cells run in their own describe so they own the state they mutate:
// they turn the globe, which the smoke cells above must not see.
describe('the tap\'s round from the text (O-143)', () => {
  let D;
  before(() => {
    D = globalThis.window?.__wheelDimension;
    assert.ok(D, 'the booted app exposed no dimension handle');
  });
  const cycle = async () => { D.cycle(); await new Promise(r => setTimeout(r, 400)); };
  it('opens on the text, filtered by where the reader stands', () => {
    assert.equal(D.front(), 0, 'the Primary (O-143)');
    assert.notEqual(D.here(), null);
  });
  it('one tap goes down to the basement, the next rounds to the languages, then in to the editions and home', async () => {
    await cycle(); assert.equal(D.front(), -1, 'the basement');
    await cycle(); assert.equal(D.front(), 2, 'the languages');
    assert.notEqual(D.here(), null, 'the filter stays on: a sideways move, not a launch question');
    await cycle(); assert.equal(D.front(), 1, 'the editions');
    await cycle(); assert.equal(D.front(), 0, 'home');
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
    // O-92: the volume has no book list — the first book is the first
    // EDITION'S first, which is what the reader boots into.
    const edition = volume.editions[0].code;
    const unitId = volume.booksFor(edition)[0].id;

    const chain = await volumeConfigs.bible.buildChain(manifest, {
      level: 'verse', cousinMode: true, arrangement: 'cousins-with-gaps',
      bookId: unitId, chapterId: '1', verseId: '2',
      translation: edition
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
    const edition = volume.editions[0].code;
    assert.deepEqual([...books], [volume.booksFor(edition)[0].id],
      'exactly one book, the one the edition declares (O-92)');
    for (const legacy of ['GENE', 'EXO', 'MATHE', 'APOC']) {
      assert.ok(!books.has(legacy), `${legacy} is legacy cargo and must be unreachable`);
    }
  });
});
