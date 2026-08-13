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
