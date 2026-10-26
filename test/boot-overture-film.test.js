// THE OVERTURE'S TURNS (O-225, Howell 2026-10-26). The truck in is the app's
// only tutorial, and it showed a drill and never a turn: English and the
// Douay were in the lens from the first frame. Now each floor TURNS before it
// is left — the language ring from its first seat to the reader's tongue, the
// edition ring from its last seat back to the reader's edition — rests, and
// then trucks. These cells walk the exported driller with a fake drive and
// hold the film's shape: the beats and their order, the pace of a turn, the
// seat an arriving ring lands on, and that a tap's finish ends the preview
// and lands on the text.
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { filmBeats, turnEase, makeDriller } from '../src/view/boot-overture.js';

const kinds = beats => beats.map(b => b.kind).join(' ');

describe('the overture film: turn, rest, truck (O-225)', () => {
  it('with nothing to turn through the film is the two trucks it always was', () => {
    const { beats, totalMs } = filmBeats({});
    assert.strictEqual(kinds(beats), 'truck truck');
    assert.strictEqual(totalMs, 2 * 1400);
    assert.strictEqual(beats[0].seat, null, 'no turn waits, so the arriving ring lands on its committed seat');
  });

  it('a turn on each floor adds turn and rest before each truck, timed by the seats passed', () => {
    const { beats, totalMs } = filmBeats({ turnA: { from: 0, to: 4 }, turnB: { from: 7, to: 1 } });
    assert.strictEqual(kinds(beats), 'turn rest truck turn rest truck');
    assert.strictEqual(beats[0].ms, 4 * 500, 'Hebrew to English: four seats');
    assert.strictEqual(beats[3].ms, 6 * 500, 'the newest promise back to the Douay: six seats');
    assert.strictEqual(totalMs, 4 * 500 + 300 + 1400 + 6 * 500 + 300 + 1400);
    assert.deepStrictEqual(beats[2].seat, { 1: 7 }, 'the arriving edition ring lands with its lens where the next turn starts');
    for (let i = 1; i < beats.length; i += 1) assert.strictEqual(beats[i].start, beats[i - 1].start + beats[i - 1].ms);
  });

  it('a turn runs at one steady pace through the middle and eases only at its ends', () => {
    assert.strictEqual(turnEase(0, 6), 0);
    assert.ok(Math.abs(turnEase(1, 6) - 1) < 1e-9);
    const mid = [0.3, 0.4, 0.5, 0.6, 0.7].map(u => turnEase(u, 6));
    const speeds = mid.slice(1).map((p, i) => p - mid[i]);
    for (const v of speeds) assert.ok(Math.abs(v - speeds[0]) < 1e-9, 'constant speed through the middle');
    assert.ok(turnEase(0.05, 6) < 0.05, 'slower than linear while getting up to speed');
    for (let u = 0; u < 1; u += 0.01) assert.ok(turnEase(u + 0.01, 6) > turnEase(u, 6), 'monotonic');
  });
});

// A fake engine: every call recorded, a glide that remembers its frames.
function fakeDrive({ turnA = null, turnB = null } = {}) {
  const log = [];
  let front = null;
  const drive = {
    log,
    turn: f => (f === 2 ? turnA : f === 1 ? turnB : null),
    setFront: f => { front = f; log.push(['setFront', f]); },
    front: () => front,
    render: () => log.push(['render']),
    glide: (a, b, opts) => { log.push(['glide', a, b, opts?.seatAt || null]); const g = { e: null, frameAt(e) { g.e = e; }, settle() { log.push(['settle']); } }; return g; },
    turnAt: (f, c) => log.push(['turnAt', f, c]),
    turnRest: (f, i) => log.push(['turnRest', f, i]),
    turnEnd: () => log.push(['turnEnd']),
    thumb: () => {}, unslide: () => {}, arrive: () => log.push(['arrive'])
  };
  return drive;
}

describe('the driller walks the floors on the film\'s clock (O-225)', () => {
  it('stands at the language ring with the lens on the first seat, and turns it to the reader\'s tongue', () => {
    const drive = fakeDrive({ turnA: { from: 0, to: 4 }, turnB: { from: 7, to: 1 } });
    const d = makeDriller(drive);
    d.stand();
    assert.deepStrictEqual(drive.log.filter(e => e[0] === 'turnRest'), [['turnRest', 2, 0]], 'standing, the lens is on Hebrew, not English');
    drive.log.length = 0;
    d.at(0); d.at(1000); d.at(1999);
    const turns = drive.log.filter(e => e[0] === 'turnAt');
    assert.ok(turns.length >= 3);
    assert.ok(turns.every(e => e[1] === 2), 'the language ring turns, at the front');
    const centers = turns.map(e => e[2]);
    assert.ok(centers[0] < 0.01 && centers[centers.length - 1] > 3.99, `from the first seat to the fifth: ${centers}`);
    assert.ok(centers[1] > centers[0] && centers[2] > centers[1], 'forward');
    assert.ok(!drive.log.some(e => e[0] === 'glide'), 'no truck yet');
  });

  it('rests on the tongue, then trucks in with the edition ring landing on the newest seat, turns it back and trucks to the text', () => {
    const drive = fakeDrive({ turnA: { from: 0, to: 4 }, turnB: { from: 7, to: 1 } });
    const d = makeDriller(drive);
    d.stand();
    d.at(2100);                          // the rest after the turn
    assert.deepStrictEqual(drive.log.filter(e => e[0] === 'turnRest').pop(), ['turnRest', 2, 4], 'at rest the lens is filled on English');
    drive.log.length = 0;
    d.at(2400);                          // the first truck
    const g = drive.log.find(e => e[0] === 'glide');
    assert.deepStrictEqual(g, ['glide', 2, 1, { 1: 7 }], 'the edition ring arrives with its lens on the newest seat');
    assert.ok(drive.log.findIndex(e => e[0] === 'turnEnd') < drive.log.indexOf(g), 'the preview ends before the truck paints');
    drive.log.length = 0;
    d.at(2300 + 1400 + 10);              // the edition ring's turn begins
    assert.deepStrictEqual(drive.log.filter(e => e[0] === 'setFront').pop(), ['setFront', 1]);
    assert.deepStrictEqual(drive.log.find(e => e[0] === 'turnRest'), ['turnRest', 1, 7], 'the turn starts where the truck landed');
    d.at(2300 + 1400 + 1500);
    const centers = drive.log.filter(e => e[0] === 'turnAt' && e[1] === 1).map(e => e[2]);
    assert.ok(centers[0] > 6.9 && centers[centers.length - 1] < centers[0], `backward from the newest seat: ${centers}`);
    drive.log.length = 0;
    d.at(2300 + 1400 + 3000 + 300 + 100);   // the second truck
    assert.deepStrictEqual(drive.log.find(e => e[0] === 'glide'), ['glide', 1, 0, null]);
    assert.strictEqual(d.migrationMs, 2000 + 300 + 1400 + 3000 + 300 + 1400);
  });

  it('a finish mid-turn ends the preview and lands on the text', () => {
    const drive = fakeDrive({ turnA: { from: 0, to: 4 } });
    const d = makeDriller(drive);
    d.stand(); d.at(900);
    drive.log.length = 0;
    d.finish();
    const names = drive.log.map(e => e[0]);
    assert.strictEqual(names[0], 'turnEnd');
    assert.ok(names.includes('render') && drive.front() === 0, 'rendered at the text');
    assert.strictEqual(names[names.length - 1], 'arrive');
  });

  it('with no turns the driller is the old two-floor walk', () => {
    const drive = fakeDrive({});
    const d = makeDriller(drive);
    d.stand();
    assert.ok(!drive.log.some(e => e[0] === 'turnRest'), 'nothing to stand the lens on but the committed seat');
    d.at(10); d.at(1500);
    const glides = drive.log.filter(e => e[0] === 'glide');
    assert.deepStrictEqual(glides, [['glide', 2, 1, null], ['glide', 1, 0, null]]);
    assert.strictEqual(d.migrationMs, 2800);
  });
});
