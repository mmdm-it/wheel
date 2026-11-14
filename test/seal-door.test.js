// The seal is the door between the app's two halves (O-292, Howell
// 2026-11-11): each half's seal opens the other, and the two drawings trade
// corners across the diagonal while the ring stays.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { volumeConfigs } from '../src/volume-configs.js';
import { flightFrame, swapAxis, contentShift, flightInk, SWAP_MS } from '../src/view/seal-swap.js';
import { withExtension } from '../src/view/volume-logo.js';

const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');

describe('the two halves name each other as doors', () => {
  it('the first half opens the second and the second the first', () => {
    const a = volumeConfigs.bible, b = volumeConfigs.church;
    assert.equal(a.door, 'church');
    assert.equal(b.door, 'bible');
  });
  it('the second half wears its own ground, marble, over the first half\'s theme', () => {
    assert.notEqual(volumeConfigs.church.palette.bg, volumeConfigs.bible.palette.bg, 'the Church wears its own colours (O-297)');
    assert.equal(volumeConfigs.church.theme, volumeConfigs.bible.theme);
    assert.equal(volumeConfigs.church.palette.dark, undefined, 'no dark dress is left to try (O-299)');
  });
  // THE CHURCH IS THE CATECHISM, READ BY THE FIRST HALF'S OWN READER (O-299).
  it('the second half is the first half\'s reader over a data root of its own', () => {
    const a = volumeConfigs.bible, b = volumeConfigs.church;
    for (const k of ['extractRoot', 'loadSupplemental', 'buildOptions', 'formatLabel', 'pruneToOffered', 'buildChain', 'activate']) {
      assert.equal(b[k], a[k], `${k} is the reader's, not a second copy`);
    }
    assert.notEqual(b.loadManifest, a.loadManifest, 'each loads its own cargo');
    assert.notEqual(b.manifestPath, a.manifestPath);
    assert.ok(b.assetBase.startsWith(`${b.manifestPath}/`), 'its drawings come from its own root');
    assert.notEqual(b.assetBase, a.assetBase);
    assert.equal(b.id, 'church');
    assert.equal(b.landscape, null, 'the sideways page is the first half\'s own words');
    assert.equal(b.stampLetter, undefined, 'one volume answers to a stamp letter');
    assert.equal(b.strata, undefined); assert.equal(b.nowButton, undefined);
  });
  it('a volume points the text loader at itself each time it takes the glass', () => {
    assert.match(main, /const manifest = await fetchManifest\(resolvedVolume\);\n(\s*\/\/[^\n]*\n)*\s*config\.activate\?\.\(manifest\);/);
    const configs = readFileSync(new URL('../src/volume-configs.js', import.meta.url), 'utf8');
    const loader = configs.slice(configs.indexOf('function wallLoader('), configs.indexOf("const DEFAULT_VOLUME"));
    assert.doesNotMatch(loader, /setUnitTextLoader\(/, 'a manifest is loaded once and kept: the loader may not register anything');
    assert.match(loader, /recall\(volumeId\)\.edition/, 'the remembered edition is the volume\'s own');
  });
  it('crossing seeds the arriving half\'s own edition, and the leaving half\'s hook is dropped first', () => {
    const seed = main.slice(main.indexOf('const reseed = '), main.indexOf('const remembered = recall(volume).edition;'));
    assert.match(seed, /dimensionsSeededFor !== volume/);
    assert.ok(seed.indexOf('dimensionBridge.onSettle(null);') > 0, 'the hook is dropped');
    assert.ok(seed.indexOf('dimensionBridge.onSettle(null);') < seed.indexOf('if (reseed || !dimensionStore.getState().language)'), 'before the store moves');
    assert.doesNotMatch(main, /data-dress|[?&]dress=/, 'the trial dresses are gone');
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

// NOTHING FADES (O-293): the contents of both halves travel the drawings'
// diagonal, the old half out ahead of the badge's drawing and the new half in
// behind the seal.
describe('the contents migrate', () => {
  const axis = swapAxis(390, 844);
  it('they travel from the upper right toward the lower left', () => {
    assert.ok(axis.ux < 0 && axis.uy > 0);
    assert.ok(Math.abs(Math.hypot(axis.ux, axis.uy) - 1) < 1e-9);
  });
  it('the old half starts at rest and ends clear of the glass, whatever corner it stood in', () => {
    assert.deepEqual(contentShift(axis, 0, 'out'), { x: 0, y: 0 });
    const end = contentShift(axis, 1, 'out');
    for (const [x, y] of [[0, 0], [390, 0], [0, 844], [390, 844]]) {
      const px = x + end.x, py = y + end.y;
      assert.ok(px <= 0 || py >= 844, `corner ${x},${y} still on the glass at ${px},${py}`);
    }
  });
  it('the new half starts clear of the glass and ends at rest', () => {
    const start = contentShift(axis, 0, 'in');
    assert.deepEqual(start, contentShift(axis, 1, 'out'));
    const end = contentShift(axis, 1, 'in');
    assert.ok(Math.abs(end.x) < 1e-9 && Math.abs(end.y) < 1e-9);
  });
  it('the contents outrun the drawing behind them: pushed, not overtaken', () => {
    assert.ok(axis.reach > Math.hypot(390, 844));
  });
  it('a drawing\'s ink follows its size: the sky shrinking to the seal is never a dark blot', () => {
    // the Bible's sky (1540 px at a tenth) down to the Church's seal (60 px at a half)
    const mid = flightInk(1540, 60, 0.1, 0.5, 0.5, 390);
    assert.ok(mid < 0.25, `half way down the sky is inked ${mid}`);
    assert.ok(Math.abs(flightInk(1540, 60, 0.1, 0.5, 1, 390) - 0.5) < 1e-9);
    assert.equal(flightInk(60, 100, 0.5, 0.5, 0.3), 0.5, 'two drawings of one ink keep it');
  });
  it('a drawing wider than the glass hands over to itself in place at either end', () => {
    assert.equal(flightInk(1540, 60, 0.1, 0.5, 0, 390), 0);
    assert.equal(flightInk(60, 1540, 0.5, 0.1, 1, 390), 0);
  });
  it('the crossing is slow enough to follow', () => {
    assert.ok(SWAP_MS >= 1500);
  });
  it('the swap carries the live half and never sets its ink', () => {
    const swap = readFileSync(new URL('../src/view/seal-swap.js', import.meta.url), 'utf8');
    assert.match(swap, /content\?\.setAttribute\('transform'/);
    assert.match(swap, /outgoing\?\.setAttribute\('transform'/);
    assert.doesNotMatch(swap, /(content|outgoing|carried\.forEach\(el => \{ el)\.style\.opacity/);
    assert.match(main, /land: \(\) => app\?\.landCorner\?\.\(\)/);
    assert.match(main, /content: liveTop\.find\(el => el\.classList\.contains\('focus-content-group'\)\)/);
  });
});

// THE DISC TRAVELS WITH ITS EMBLEM (O-295, Howell 2026-11-11: "the purple
// circle, or blue circle as the case may be, needs to travel with the crown
// of thorns or the Torah scroll. For now, the St. Peter's artwork does not
// need any circle behind it in either corner").
describe('the disc travels with its emblem', () => {
  const swap = readFileSync(new URL('../src/view/seal-swap.js', import.meta.url), 'utf8');
  const logo = readFileSync(new URL('../src/view/volume-logo.js', import.meta.url), 'utf8');
  it('the badge can be declared without a disc (the Church\'s declaration, in its own cargo, says so)', () => {
    assert.match(logo, /circleOpacity: this\._renderConfig\?\.disc === false \? 0 : 0\.5,/);
    assert.match(logo, /discInfo\(\) \{\s*if \(!this\._renderConfig \|\| this\._renderConfig\.disc === false\) return null;/);
  });
  it('the seal wears the departing emblem on its disc, remembered for the half it opens', () => {
    assert.match(main, /if \(logoSrc\) remember\(to, \{ sealArt: logoSrc, sealDisc: cornerDisc \? \{ colour: cornerDisc\.colour, ratio: cornerDisc\.ratio \} : null \}\);/);
    assert.match(main, /sealEl\.style\.background = sealDisc\?\.colour/);
  });
  it('the disc flies from where it stood to where it lands, and the discs in place stand aside', () => {
    assert.match(swap, /discFlight\.el\.setAttribute\('r', /);
    assert.match(swap, /if \(oldCircle\) oldCircle\.style\.visibility = 'hidden';/);
    assert.match(swap, /liveDisc\.style\.visibility = 'hidden';/);
  });
});

// O-296: the swap is made from the primary stratum only; elsewhere the seal
// stays, inert, and never trucks the reader home on its own.
describe('the swap is made from the primary stratum only', () => {
  it('away from the primary, or while a stratum travels, the seal does not answer', () => {
    assert.match(main, /const swapAllowedHere = \(\) => strataFront === 0 && !strataAnim;/);
    const swap = main.slice(main.indexOf('function swapThroughSeal() {'), main.indexOf('// Browser Back across a gateway pushState'));
    assert.match(swap, /if \(!swapAllowedHere\(\)\) return;/);
    assert.doesNotMatch(swap, /strataFront\s*=[^=]|renderStack|truck/i, 'it never moves the strata itself');
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
    assert.match(main, /if \(transit\?\.mode === 'swap'\) \{\s*try \{[^]{0,400}?playSealSwap\(/);
  });
});
