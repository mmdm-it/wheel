// The seal is the door between the app's two halves (O-292, Howell
// 2026-11-11): each half's seal opens the other, and the two drawings trade
// corners across the diagonal while the ring stays.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { volumeConfigs } from '../src/volume-configs.js';
import { flightFrame } from '../src/view/seal-swap.js';
import { withExtension } from '../src/view/volume-logo.js';

const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');

describe('the two halves name each other as doors', () => {
  it('the first half opens the second and the second the first', () => {
    const a = volumeConfigs.bible, b = volumeConfigs.church;
    assert.equal(a.door, 'church');
    assert.equal(b.door, 'bible');
  });
  it('the second half wears the first half\'s ground, so the ring does not change colour', () => {
    assert.deepEqual(volumeConfigs.church.palette, volumeConfigs.bible.palette);
    assert.equal(volumeConfigs.church.theme, volumeConfigs.bible.theme);
  });
  it('its drawings are read from the first half\'s data root, and its dress swaps the corners', () => {
    assert.equal(volumeConfigs.church.assetBase, volumeConfigs.bible.assetBase);
    const m = { Calendar: { display_config: { splash: { x: 1 }, volume_name: 'x' }, years: {} } };
    const root = volumeConfigs.church.extractRoot(m);
    assert.equal(root.display_config.detail_sector.default_image, 'st_peters.svg');
    assert.equal(root.display_config.seal, 'crown_of_thorns.png');
    assert.equal(root.display_config.splash, undefined, 'no card on arrival');
    assert.equal(root.display_config.day_extras, false, 'no drawing of the day and no Fano tables');
    assert.equal(volumeConfigs.church.extractRoot(m), root, 'dressing twice is dressing once');
  });
  it('no other volume has a door', () => {
    for (const [id, cfg] of Object.entries(volumeConfigs)) if (id !== 'bible' && id !== 'church') assert.equal(cfg.door, undefined, id);
  });
});

describe('the flight', () => {
  const from = { left: 10, top: 790, width: 60, height: 45 }, to = { left: 290, top: 12, width: 100, height: 100 };
  it('starts where the drawing stood and ends where the other one stands', () => {
    assert.deepEqual(flightFrame(from, to, 0), { dx: 0, dy: 0, sx: 1, sy: 1 });
    const end = flightFrame(from, to, 1);
    assert.equal(end.dx, 280); assert.equal(end.dy, -778);
    assert.ok(Math.abs(end.sx * from.width - to.width) < 1e-9);
    assert.ok(Math.abs(end.sy * from.height - to.height) < 1e-9);
  });
  it('crosses the middle of the diagonal half way', () => {
    const mid = flightFrame(from, to, 0.5);
    assert.equal(from.left + mid.dx, 150); assert.equal(from.top + mid.dy, 401);
  });
});

describe('the wiring', () => {
  it('a drawing name may carry its own type; a bare name is a PNG', () => {
    assert.equal(withExtension('crown_of_thorns'), 'crown_of_thorns.png');
    assert.equal(withExtension('st_peters.svg'), 'st_peters.svg');
  });
  it('the seal is a target only where a door is declared, and never during the film', () => {
    assert.match(main, /sealEl\.classList\.toggle\('is-door', Boolean\(sealUrl && sealDoor\)\)/);
    assert.match(main, /if \(!to \|\| !volumeConfigs\[to\] \|\| sealSwapping \|\| sealRides \|\| bootOvertureLive\) return;/);
  });
  it('a swap transit plays the swap, not the wipe', () => {
    assert.match(main, /if \(transit\?\.mode === 'swap'\) \{\s*try \{\s*playSealSwap\(/);
  });
});
