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

// AND THE CIRCLE UNDER IT (O-79).
//
// Howell, 2026-08-20: *"the color of the circle under the image file (which
// becomes the Detail Sector background) should change between testaments. The
// current OT blue is fine, but we need to restore the previous NT purple."*
//
// These cells live beside H-31's rather than in a file of their own, because
// it is ONE BADGE: the emblem sits on this circle and expands with it into the
// leaf's background. The failure mode worth guarding is precisely that they
// come apart — the crown of thorns arriving over the Old Testament's blue —
// so testing them apart would test past the defect.
//
// The COLOUR ITSELF is not here and must not be. It is declared beside the
// image in the cargo, for the reason that file gives about the image: it is
// ours to choose, the source cannot tell us, and an indigo meaning New
// Testament asserts something about THIS corpus exactly as a crown of thorns
// does (W-114). The engine carries it; it does not know it.
describe('which colour is under the emblem (O-79)', () => {
  const COLOURED = [
    { label: 'Vetus Testamentum', image: 'torah_scroll', color: '#16337a', from: 1, to: 2, books: ['A', 'B'] },
    { label: 'Novum Testamentum', image: 'crown_of_thorns', color: '#362e6a', from: 3, to: 4, books: ['C', 'D'] }
  ];

  it('CHANGES ON THE SAME CROSSING THE EMBLEM DOES, from the same answer', () => {
    const h = handlers(makeManifest(() => COLOURED.map(d => ({ ...d }))));
    const at = id => ({ level: 'book', id });
    assert.equal(h.cornerImageFor(at('B')), 'torah_scroll');
    assert.equal(h.detailSectorColorFor(at('B')), '#16337a');
    assert.equal(h.cornerImageFor(at('C')), 'crown_of_thorns');
    assert.equal(h.detailSectorColorFor(at('C')), '#362e6a',
      'the emblem and the ground under it must never disagree');
  });

  it('AT ROOT IT IS THE FIRST DIVISION\'S, exactly as the emblem is', () => {
    const h = handlers(makeManifest(() => COLOURED.map(d => ({ ...d }))));
    assert.equal(h.detailSectorColorFor({ level: 'bibleRoot', id: 'root' }), '#16337a');
  });

  it('NULL RATHER THAN A GUESS when the cargo declares none', () => {
    // Which is the state on the day this shipped: the engine half lands
    // first, and every volume — including this one until its cargo carries a
    // colour — keeps the one `color_scheme.detail_sector` it always had.
    const h = handlers(makeManifest(() => [
      { label: 'Whole', image: 'torah_scroll', color: null, from: 1, to: 4, books: ['A', 'B', 'C', 'D'] }
    ]));
    assert.equal(h.detailSectorColorFor({ level: 'book', id: 'A' }), null,
      'null leaves the volume\'s own colour in place rather than blanking the badge');
  });

  it('a volume that cannot answer at all is not asked twice', () => {
    const m = { Gutenberg_Bible: { testaments: {} } };
    Object.defineProperty(m, '__wallVolume', {
      value: { units: [{ id: 'A' }], editions: [{ code: 'LAT' }] }, enumerable: false
    });
    const h = handlers(m);
    assert.equal(h.detailSectorColorFor({ level: 'book', id: 'A' }), null,
      'no divisionsFor, no colour, no throw');
  });
});

describe('the circle repaints without disturbing what is in flight (O-79)', () => {
  const makeLogo = async (fill = '#16337a') => {
    const { VolumeLogo } = await import('../src/view/volume-logo.js');
    const logo = new VolumeLogo(null, { width: 400, height: 800 });
    const attrs = { fill };
    logo.circle = { setAttribute: (name, value) => { attrs[name] = value; }, getAttr: n => attrs[n] };
    logo._renderConfig = { color_scheme: { detail_sector: fill, detail_sector_opacity: '0.5' } };
    return { logo, attrs };
  };

  it('repaints the badge AND the value the expand reads', async () => {
    const { logo, attrs } = await makeLogo();
    assert.equal(logo.setColor('#362e6a'), true);
    assert.equal(attrs.fill, '#362e6a', 'the collapsed badge');
    assert.equal(logo._renderConfig.color_scheme.detail_sector, '#362e6a',
      'and the one value the expand and the collapse-reset both read — three '
      + 'places, one source, or the leaf background disagrees with the badge');
  });

  it('REPAINTS WHILE EXPANDED, which is where the crossing actually happens', async () => {
    const { logo, attrs } = await makeLogo();
    logo._expanded = true;
    logo._animating = true;
    assert.equal(logo.setColor('#362e6a'), true);
    assert.equal(attrs.fill, '#362e6a',
      'waiting for the next collapse leaves the new emblem on the old ground');
    assert.equal(logo._expanded, true, 'an expanded badge stays expanded');
    assert.equal(logo._animating, true, 'and an animation in flight is not cancelled');
  });

  it('reports false for the same colour, so a frequent caller stays quiet', async () => {
    const { logo } = await makeLogo('#16337a');
    assert.equal(logo.setColor('#16337a'), false, 'already showing it');
    assert.equal(logo.setColor(null), false, 'nothing to show');
    assert.equal(logo.setColor(''), false);
  });

  it('refuses rather than throwing before there is anything to paint', async () => {
    const { VolumeLogo } = await import('../src/view/volume-logo.js');
    const bare = new VolumeLogo(null, { width: 400, height: 800 });
    assert.equal(bare.setColor('#362e6a'), false, 'no config yet');
  });
});
