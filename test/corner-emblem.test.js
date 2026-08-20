// THE CORNER EMBLEM FOLLOWS THE READER (H-31).
//
// Howell's report, 2026-08-19: *"The Torah Scroll does not change to a crown
// of thorns for the New testament."* It had two causes and both had to go:
//
//   1. the image was declared once for the whole VOLUME, so there was nothing
//      per-division to read — fixed in cargo under H-31;
//   2. it was painted ONCE at boot by `index.js` and no code path repainted
//      it, so even correct data could not have shown.
//
// The second is what these cells guard. They are deliberately split the same
// way the code is: the ADAPTER answers which emblem belongs where the reader
// stands, because that is a question about divisions and books; the RENDERER
// swaps one attribute without disturbing an animation in flight.
//
// WHY THE SWAP IS NOT A RE-RENDER, which is the part that would be rewritten
// wrongly by someone tidying later: `render()` clears the group and resets
// `_expanded` and `_animating`. The crossing this feature exists for happens
// at a LEAF, where the badge is expanded — so re-rendering would drop it to
// collapsed geometry with no animation while the host went on believing it
// was open.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { bibleAdapter } from '../src/adapters/bible-adapter.js';

// One edition spanning two divisions — the Vulgate case, which is the only
// one where the emblem changes WITHOUT the edition changing, and therefore
// the only one that tests the reader moving rather than the reader choosing.
const SPANNING = [
  { label: 'Vetus Testamentum', image: 'torah_scroll', from: 1, to: 2, books: ['A', 'B'] },
  { label: 'Novum Testamentum', image: 'crown_of_thorns', from: 3, to: 4, books: ['C', 'D'] }
];

const makeManifest = (divisionsFor, editions = [{ code: 'LAT' }]) => {
  const m = { Gutenberg_Bible: { testaments: {} } };
  Object.defineProperty(m, '__wallVolume', {
    value: { units: ['A', 'B', 'C', 'D'].map(id => ({ id })), editions, divisionsFor },
    enumerable: false
  });
  return m;
};

const handlers = (manifest, edition = 'LAT') => bibleAdapter.createHandlers({
  manifest, namesMap: {}, options: { activeEdition: edition, translation: edition }
});

describe('which emblem belongs where the reader is standing (H-31)', () => {
  it('CHANGES AS THE READER CROSSES, inside one edition', () => {
    const h = handlers(makeManifest(() => SPANNING.map(d => ({ ...d }))));
    // Malachi, then Matthew — the crossing Howell described.
    assert.equal(h.cornerImageFor({ level: 'verse', bookKey: 'B', meta: {} }), 'torah_scroll');
    assert.equal(h.cornerImageFor({ level: 'verse', bookKey: 'C', meta: {} }), 'crown_of_thorns');
  });

  it('answers for a book item as readily as a verse', () => {
    const h = handlers(makeManifest(() => SPANNING.map(d => ({ ...d }))));
    assert.equal(h.cornerImageFor({ level: 'book', id: 'D' }), 'crown_of_thorns');
  });

  it('AT ROOT IT IS THE FIRST DIVISION\'S — the one about to be entered', () => {
    const h = handlers(makeManifest(() => SPANNING.map(d => ({ ...d }))));
    assert.equal(h.cornerImageFor({ level: 'bibleRoot', id: 'X' }), 'torah_scroll');
  });

  it('a one-division edition wears its own emblem everywhere', () => {
    const greek = [{ label: 'Ἡ Καινὴ Διαθήκη', image: 'crown_of_thorns', from: 1, to: 2, books: ['C', 'D'] }];
    const h = handlers(makeManifest(() => greek.map(d => ({ ...d }))), 'GRC');
    assert.equal(h.cornerImageFor({ level: 'verse', bookKey: 'C', meta: {} }), 'crown_of_thorns');
    assert.equal(h.cornerImageFor({ level: 'bibleRoot' }), 'crown_of_thorns');
  });

  it('NULL RATHER THAN A GUESS when nothing is declared', () => {
    // Null leaves whatever the volume config painted. Returning a default
    // here would put one volume's picture on another's corner, which is the
    // whole subject of W-114.
    const h = handlers(makeManifest(() => []));
    assert.equal(h.cornerImageFor({ level: 'verse', bookKey: 'A', meta: {} }), null);
    const noVolume = bibleAdapter.createHandlers({
      manifest: {}, namesMap: {}, options: { activeEdition: 'LAT' }
    });
    assert.equal(noVolume.cornerImageFor({ level: 'verse', bookKey: 'A', meta: {} }), null);
    const noEdition = handlers(makeManifest(() => SPANNING), null);
    assert.equal(noEdition.cornerImageFor({ level: 'verse', bookKey: 'A', meta: {} }), null);
  });

  it('a book in no division falls back rather than blanking the corner', () => {
    // A gap in divisions is a data fault the volume already screams about
    // (H-29). The corner is not the place to punish it a second time by
    // going blank at the reader.
    const h = handlers(makeManifest(() => [SPANNING[0]]));
    assert.equal(h.cornerImageFor({ level: 'verse', bookKey: 'D', meta: {} }), 'torah_scroll');
  });
});

// The renderer half, driven through the real class against a DOM stub. The
// point is not that an href changes — it is that NOTHING ELSE does.
describe('the emblem swaps without disturbing what is in flight', () => {
  const makeLogo = async () => {
    const { VolumeLogo } = await import('../src/view/volume-logo.js');
    const logo = new VolumeLogo(null, { width: 400, height: 800 });
    const attrs = { href: 'assets/torah_scroll.png' };
    logo.logo = {
      setAttributeNS: (_ns, name, value) => { attrs[name] = value; },
      getAttr: name => attrs[name]
    };
    logo._renderConfig = { logo_base_path: './data/x/2026.07.29/assets/', default_image: 'torah_scroll' };
    return { logo, attrs };
  };

  it('rewrites the href and reports that it did', async () => {
    const { logo, attrs } = await makeLogo();
    assert.equal(logo.setImage('crown_of_thorns'), true);
    assert.equal(attrs.href, './data/x/2026.07.29/assets/crown_of_thorns.png');
  });

  it('reports false for the same name, so a frequent caller stays quiet', async () => {
    const { logo } = await makeLogo();
    assert.equal(logo.setImage('torah_scroll'), false, 'already showing it');
    assert.equal(logo.setImage(null), false, 'nothing to show');
    assert.equal(logo.setImage(''), false);
  });

  it('DOES NOT RESET THE ANIMATION STATE — the crossing happens at a leaf', async () => {
    const { logo } = await makeLogo();
    logo._expanded = true;
    logo._animating = true;
    logo.setImage('crown_of_thorns');
    assert.equal(logo._expanded, true, 'an expanded badge stays expanded');
    assert.equal(logo._animating, true, 'and an animation in flight is not cancelled');
    // This is why it is not `render()`: that path sets both to false.
  });

  it('refuses rather than throwing when there is nothing to swap', async () => {
    const { VolumeLogo } = await import('../src/view/volume-logo.js');
    const bare = new VolumeLogo(null, { width: 400, height: 800 });
    assert.equal(bare.setImage('crown_of_thorns'), false, 'no image element yet');
  });
});
