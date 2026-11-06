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
// The values are the corpus's real ones as of 2026-08-27, when Howell tied the
// colour to the emblem rather than to the edition: "The Torah and all Old
// Testament books in any language are displayed with tekhelet... The purple is
// tied to the Crown of Thorns for all New Testament editions." A fixture
// carrying different values would still exercise the code and would stop
// documenting the rule.
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

  it('A DIVISION ON THE RING WEARS ITS OWN EMBLEM AND COLOUR (O-149): turning to the New Testament swaps them', () => {
    const h = handlers(makeManifest(() => SPANNING.map(d => ({ ...d }))));
    const [ot, nt] = SPANNING;
    const item = d => ({ level: 'testament', id: 'division-x', meta: { books: [...d.books] } });
    assert.equal(h.cornerImageFor(item(ot)), ot.image);
    assert.equal(h.cornerImageFor(item(nt)), nt.image, 'the New Testament node wears its own emblem, not the first division\'s');
    assert.equal(h.detailSectorColorFor(item(nt)), nt.color ?? null);
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
  });

  it('AN EMPTY NAME CLEARS THE BADGE — it is a measurement, not an absence (2026-08-24)', () => {
    // Rewritten, not patched (W-102): this cell used to assert that '' did
    // NOTHING, which was true while every edition of every volume declared an
    // emblem. It stopped being true when an edition declared none: the host
    // asked, heard "no emblem", and the badge kept the PREVIOUS edition's mark
    // — a reader committing that edition went on seeing the one before it.
    //
    // So the three answers are distinguished here as they are at the adapter:
    // a NAME shows it, NULL means nothing was asked, and '' means asked and
    // there is none. Only the last clears.
    return makeLogo().then(({ logo }) => {
      assert.equal(logo.setImage(''), true, 'clearing is a real change');
      assert.equal(logo.setImage(''), false, 'and idempotent, for a per-frame caller');
      assert.equal(logo.setImage('crown_of_thorns'), true, 'and it comes back');
    });
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
    { label: 'Vetus Testamentum', image: 'torah_scroll', color: '#133490', from: 1, to: 2, books: ['A', 'B'] },
    { label: 'Novum Testamentum', image: 'crown_of_thorns', color: '#362e6a', from: 3, to: 4, books: ['C', 'D'] }
  ];

  it('CHANGES ON THE SAME CROSSING THE EMBLEM DOES, from the same answer', () => {
    const h = handlers(makeManifest(() => COLOURED.map(d => ({ ...d }))));
    const at = id => ({ level: 'book', id });
    assert.equal(h.cornerImageFor(at('B')), 'torah_scroll');
    assert.equal(h.detailSectorColorFor(at('B')), '#133490');
    assert.equal(h.cornerImageFor(at('C')), 'crown_of_thorns');
    assert.equal(h.detailSectorColorFor(at('C')), '#362e6a',
      'the emblem and the ground under it must never disagree');
  });

  it('AT ROOT IT IS THE FIRST DIVISION\'S, exactly as the emblem is', () => {
    const h = handlers(makeManifest(() => COLOURED.map(d => ({ ...d }))));
    assert.equal(h.detailSectorColorFor({ level: 'bibleRoot', id: 'root' }), '#133490');
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
  const makeLogo = async (fill = '#133490') => {
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
    const { logo } = await makeLogo('#133490');
    assert.equal(logo.setColor('#133490'), false, 'already showing it');
    assert.equal(logo.setColor(null), false, 'nothing to show');
    assert.equal(logo.setColor(''), false);
  });

  it('refuses rather than throwing before there is anything to paint', async () => {
    const { VolumeLogo } = await import('../src/view/volume-logo.js');
    const bare = new VolumeLogo(null, { width: 400, height: 800 });
    assert.equal(bare.setColor('#362e6a'), false, 'no config yet');
  });
});

// EACH EMBLEM AT ITS OWN SIZE (O-148, Howell 2026-09-16): the crown of thorns
// is drawn to ring the badge circle and had been shrunk with the Torah scroll.
// The circle's place is one thing, the emblem's size another.
describe('each emblem at its own size, around the same circle (O-148)', () => {
  const badge = async config => {
    const { VolumeLogo } = await import('../src/view/volume-logo.js');
    const logo = new VolumeLogo(null, { width: 720, height: 1600 });
    logo._renderConfig = config;
    return logo;
  };
  it('an undeclared emblem keeps the base size; a declared one takes its own', async () => {
    const scroll = (await badge({ default_image: 'torah_scroll', emblem_scale: { crown_of_thorns: 1.8 } }))._getStartState();
    const crown = (await badge({ default_image: 'crown_of_thorns', emblem_scale: { crown_of_thorns: 1.8 } }))._getStartState();
    assert.ok(Math.abs(scroll.logoWidth - scroll.circleR * 2 * 1.1) < 1e-9, 'the scroll is left exactly as it was');
    assert.ok(Math.abs(crown.logoWidth - crown.circleR * 2 * 1.8) < 1e-9, 'the crown rings the circle again');
  });
  it('ONE CIRCLE FOR EVERY EMBLEM, where the backup stood it, and each emblem centred in it', async () => {
    const scroll = (await badge({ default_image: 'torah_scroll', emblem_scale: { crown_of_thorns: 1.8 } }))._getStartState();
    const crown = (await badge({ default_image: 'crown_of_thorns', emblem_scale: { crown_of_thorns: 1.8 } }))._getStartState();
    // 720x1600: radius 86.4, margin 21.6; placed by the largest box, 311.04.
    assert.equal(scroll.circleCx, crown.circleCx, 'the Old Testament circle aligns with the New');
    assert.equal(scroll.circleCy, crown.circleCy);
    assert.ok(Math.abs(crown.circleCx - (720 - 21.6 - 155.52 + 37.3248)) < 1e-6, 'where the backup stood it');
    for (const s of [scroll, crown]) {
      assert.ok(Math.abs(s.logoX + s.logoWidth / 2 - s.circleCx) < 1e-9, 'centred across');
      assert.ok(Math.abs(s.logoY + s.logoHeight / 2 - s.circleCy) < 1e-9, 'centred down');
    }
  });
});

// EACH EMBLEM'S DISC AT ITS OWN SIZE (O-265, Howell 2026-11-06): "for the
// first time, the colored disc in the upper right corner will be a different
// size for each testament, in addition to each one having its own artwork."
// A ring hides the disc's hard edge only by lying ACROSS it, and two rings of
// different widths cannot both straddle one radius — so the volume declares
// the disc per emblem, and nothing but the drawn disc moves.
describe("each emblem's disc at its own size (O-265)", () => {
  const badge = async config => {
    const { VolumeLogo } = await import('../src/view/volume-logo.js');
    const logo = new VolumeLogo(null, { width: 720, height: 1600 });
    logo._renderConfig = config;
    return logo;
  };
  const scales = { emblem_scale: { crown_of_thorns: 1.8, torah_scroll: 1.8 } };
  it('an emblem that declares none keeps the base disc; one that declares takes its own', async () => {
    const config = { ...scales, disc_scale: { torah_scroll: 1.1 } };
    const scroll = await badge({ default_image: 'torah_scroll', ...config });
    const crown = await badge({ default_image: 'crown_of_thorns', ...config });
    const base = crown.collapsedCentre().radius;
    assert.ok(Math.abs(crown._getStartState().circleR - base) < 1e-9, 'the crown of thorns is untouched');
    assert.ok(Math.abs(scroll._getStartState().circleR - base * 1.1) < 1e-9, 'the scroll takes the disc it declared');
  });
  it('ONLY THE DISC MOVES: the place, the emblem and the base radius are what they were', async () => {
    const plain = await badge({ default_image: 'torah_scroll', ...scales });
    const grown = await badge({ default_image: 'torah_scroll', ...scales, disc_scale: { torah_scroll: 1.1 } });
    const a = plain._getStartState(), b = grown._getStartState();
    for (const k of ['circleCx', 'circleCy', 'logoX', 'logoY', 'logoWidth', 'logoHeight']) assert.equal(a[k], b[k], k);
    assert.equal(plain.collapsedCentre().radius, grown.collapsedCentre().radius, 'what folds back to the badge still aims at the base circle');
    assert.deepEqual(plain.getBounds?.() ?? null, grown.getBounds?.() ?? null, 'and the sky keeps clear of the same box');
  });
  it('a nonsense declaration is the base disc, not a vanished one', async () => {
    for (const bad of [0, -1, 'wide', null]) {
      const logo = await badge({ default_image: 'torah_scroll', ...scales, disc_scale: { torah_scroll: bad } });
      assert.equal(logo._getStartState().circleR, logo.collapsedCentre().radius);
    }
  });
  it('THE SWAP RESIZES THE DISC: crossing a testament at rest redraws the circle at the new emblem\'s size', async () => {
    const logo = await badge({ logo_base_path: 'assets/', default_image: 'crown_of_thorns', ...scales, disc_scale: { torah_scroll: 1.1 } });
    const circle = {}, img = {};
    logo.circle = { setAttribute: (k, v) => { circle[k] = v; } };
    logo.logo = { style: {}, setAttribute: (k, v) => { img[k] = v; }, setAttributeNS: (_n, k, v) => { img[k] = v; } };
    const base = logo.collapsedCentre().radius;
    assert.equal(logo.setImage('torah_scroll'), true);
    assert.ok(Math.abs(circle.r - base * 1.1) < 1e-9, 'grown for the scroll');
    assert.equal(logo.setImage('crown_of_thorns'), true);
    assert.ok(Math.abs(circle.r - base) < 1e-9, 'and back for the thorns');
  });
});

// EACH EMBLEM'S DISC WITH ITS OWN EDGE (O-266, Howell 2026-11-06): "the hard
// edge of the blue circle just feels lazy to me. I would try doing a blurred
// edge... I want the blur to begin where the current hard edge is. In other
// words, I want the circle to get larger overall." The disc stays solid to the
// radius it had and fades across a band beyond it; the leaf's background, which
// is the same circle grown, keeps its hard edge.
describe("each emblem's disc with its own edge (O-266)", () => {
  const badge = async config => {
    const { VolumeLogo } = await import('../src/view/volume-logo.js');
    const logo = new VolumeLogo(null, { width: 720, height: 1600 });
    logo._renderConfig = config;
    return logo;
  };
  const config = { emblem_scale: { crown_of_thorns: 1.8, torah_scroll: 1.8 }, disc_feather: { torah_scroll: 0.12 } };
  const arc = { hubX: 900, hubY: 900, radius: 800 };
  it('THE FADE BEGINS WHERE THE HARD EDGE WAS: the circle grows by the band, the solid part does not move', async () => {
    const scroll = await badge({ default_image: 'torah_scroll', ...config });
    const crown = await badge({ default_image: 'crown_of_thorns', ...config });
    const base = crown.collapsedCentre().radius;
    const s = scroll._getStartState(), c = crown._getStartState();
    assert.equal(c.circleFeather, 0, 'an emblem that declares none keeps its hard edge');
    assert.ok(Math.abs(c.circleR - base) < 1e-9);
    assert.equal(s.circleFeather, 0.12);
    assert.ok(Math.abs(s.circleR - base * 1.12) < 1e-9, 'larger overall, by the band');
    assert.ok(Math.abs(s.circleR / (1 + s.circleFeather) - base) < 1e-9, 'and solid exactly to the old edge');
  });
  it('it compounds with a declared disc size rather than replacing it', async () => {
    const logo = await badge({ default_image: 'torah_scroll', ...config, disc_scale: { torah_scroll: 1.1 } });
    const base = logo.collapsedCentre().radius;
    assert.ok(Math.abs(logo._getStartState().circleR - base * 1.1 * 1.12) < 1e-9);
  });
  it("THE LEAF'S BACKGROUND KEEPS ITS HARD EDGE: the open sector declares no fade", async () => {
    const logo = await badge({ default_image: 'torah_scroll', ...config });
    assert.equal(logo._getEndState(arc, Math.PI)?.circleFeather, 0);
  });
  it('the edge hardens early in an expand and softens late in a collapse, while the disc is small', async () => {
    const logo = await badge({ default_image: 'torah_scroll', ...config });
    const shut = logo._getStartState(), open = logo._getEndState(arc, Math.PI);
    assert.equal(logo._featherAt(shut, open, 0), 0.12);
    assert.ok(logo._featherAt(shut, open, 0.1) > 0 && logo._featherAt(shut, open, 0.1) < 0.12);
    assert.equal(logo._featherAt(shut, open, 0.25), 0, 'hard by a quarter of the way out');
    assert.equal(logo._featherAt(shut, open, 0.6), 0);
    assert.equal(logo._featherAt(open, shut, 0.4), 0, 'hard for most of the way home');
    assert.equal(logo._featherAt(open, shut, 0.75), 0);
    assert.ok(logo._featherAt(open, shut, 0.9) > 0);
    assert.equal(logo._featherAt(open, shut, 1), 0.12);
    const hard = await badge({ default_image: 'crown_of_thorns', ...config });
    assert.equal(hard._featherAt(hard._getStartState(), hard._getEndState(arc, Math.PI), 0), 0, 'and a hard-edged emblem never asks for a gradient');
  });
  it('THE SWAP CHANGES THE EDGE: crossing a testament at rest resizes the circle for the new emblem\'s band', async () => {
    const logo = await badge({ logo_base_path: 'assets/', default_image: 'crown_of_thorns', ...config });
    const circle = {}, img = {};
    logo.circle = { setAttribute: (k, v) => { circle[k] = v; } };
    logo.logo = { style: {}, setAttribute: (k, v) => { img[k] = v; }, setAttributeNS: (_n, k, v) => { img[k] = v; } };
    const base = logo.collapsedCentre().radius;
    logo.setImage('torah_scroll');
    assert.ok(Math.abs(circle.r - base * 1.12) < 1e-9);
    logo.setImage('crown_of_thorns');
    assert.ok(Math.abs(circle.r - base) < 1e-9);
    assert.equal(circle.fill, logo._discColour(), 'and the hard-edged disc is a plain fill again');
  });
  it('a nonsense declaration is a hard edge', async () => {
    for (const bad of [0, -0.2, 'soft', null]) {
      const logo = await badge({ default_image: 'torah_scroll', ...config, disc_feather: { torah_scroll: bad } });
      assert.equal(logo._getStartState().circleFeather, 0);
    }
  });
});

// EACH EMBLEM AT ITS OWN SIZE BEHIND THE TEXT (O-267, Howell 2026-11-06): the
// open sector's watermark is the same picture grown, and how far it grows is
// the emblem's own — far enough, for one drawn inside a ring, that the ring
// leaves the sector and the centrepiece is left alone. Same centre, same tilt.
describe("each emblem at its own size as the leaf's watermark (O-267)", () => {
  const badge = async config => {
    const { VolumeLogo } = await import('../src/view/volume-logo.js');
    const logo = new VolumeLogo(null, { width: 720, height: 1600 });
    logo._renderConfig = config;
    return logo;
  };
  const config = { logo_base_path: 'assets/', emblem_scale: { crown_of_thorns: 1.8, torah_scroll: 1.8 }, watermark_scale: { torah_scroll: 2.25 } };
  const arc = { hubX: 1700, hubY: 0, radius: 1680 }, angle = 2.48;
  it('an emblem that declares none grows to the base; one that declares grows to its own', async () => {
    const crown = (await badge({ default_image: 'crown_of_thorns', ...config }))._getEndState(arc, angle);
    const scroll = (await badge({ default_image: 'torah_scroll', ...config }))._getEndState(arc, angle);
    assert.ok(Math.abs(crown.logoWidth - arc.radius * 0.9) < 1e-9, 'the crown of thorns is untouched');
    assert.ok(Math.abs(scroll.logoWidth - arc.radius * 2.25) < 1e-9);
  });
  it('SAME CENTRE, SAME TILT, SAME DISC: only the size differs', async () => {
    const crown = (await badge({ default_image: 'crown_of_thorns', ...config }))._getEndState(arc, angle);
    const scroll = (await badge({ default_image: 'torah_scroll', ...config }))._getEndState(arc, angle);
    for (const k of ['logoCenterX', 'logoCenterY', 'logoRotation', 'circleCx', 'circleCy', 'circleR', 'logoOpacity']) assert.equal(scroll[k], crown[k], k);
    assert.ok(Math.abs(scroll.logoX + scroll.logoWidth / 2 - scroll.logoCenterX) < 1e-9, 'centred where it always was');
  });
  it('A SWAP IN AN OPEN SECTOR RE-BOXES THE WATERMARK, so the new emblem is not left at the old one\'s zoom', async () => {
    const logo = await badge({ default_image: 'torah_scroll', ...config });
    const img = {};
    logo.circle = { setAttribute() {} };
    logo.logo = { style: {}, setAttribute: (k, v) => { img[k] = v; }, setAttributeNS: (_n, k, v) => { img[k] = v; } };
    logo._expanded = true; logo._animating = false; logo._openAt = { arcParams: arc, magnifierAngle: angle };
    assert.equal(logo.setImage('crown_of_thorns'), true);
    assert.ok(Math.abs(img.width - arc.radius * 0.9) < 1e-9, 'the thorns at the thorns\' size');
    assert.equal(logo.setImage('torah_scroll'), true);
    assert.ok(Math.abs(img.width - arc.radius * 2.25) < 1e-9, 'and the scroll back at its own');
    assert.match(String(img.transform), /^rotate\(/, 'still tilted with the ring');
  });
  it('A SWAP DURING THE OPENING FLIGHT RE-AIMS IT: the boot opens on the default emblem and learns the division a moment later', async () => {
    const logo = await badge({ default_image: 'torah_scroll', ...config });
    const img = {}, disc = {};
    logo.circle = { style: {}, setAttribute: (k, v) => { disc[k] = v; } };
    logo.logo = { style: {}, setAttribute: (k, v) => { img[k] = v; }, setAttributeNS: (_n, k, v) => { img[k] = v; }, removeAttribute: k => { delete img[k]; } };
    const flight = logo.beginExpand(arc, angle);
    flight.frameAt(0.3);
    assert.equal(logo.setImage('crown_of_thorns'), true);
    flight.frameAt(0.6);
    flight.finish();
    assert.ok(Math.abs(img.width - arc.radius * 0.9) < 1e-9, 'it lands at the thorns\' size, not the scroll\'s');
    const back = logo.beginCollapse(arc, angle);
    back.frameAt(0.5);
    logo.setImage('torah_scroll');
    back.finish();
    assert.ok(Math.abs(img.width - logo._getStartState().logoWidth) < 1e-9, 'and a flight home lands on the new emblem\'s badge');
  });
  it('a nonsense declaration is the base size', async () => {
    for (const bad of [0, -2, 'huge', null]) {
      const logo = await badge({ default_image: 'torah_scroll', ...config, watermark_scale: { torah_scroll: bad } });
      assert.ok(Math.abs(logo._getEndState(arc, angle).logoWidth - arc.radius * 0.9) < 1e-9);
    }
  });
});

// AN EMBLEM MAY BE TWO PICTURES THAT PART COMPANY (O-268, Howell 2026-11-06,
// on seeing the scroll grown until its ring left the sector): "I don't want to
// crop the Torah scroll with the focus ring … I want the Torah scroll to stop
// enlarging before it's too big to fit within the details sector. This may
// require some cheating to make the olive wreath go away under the focus
// ring." One zoom cannot do both, so the ring is a second image on the
// emblem's box: one picture in the corner, two speeds on the way in.
describe('an emblem and its surround part company as the sector opens (O-268)', () => {
  const el = () => {
    const a = {}; const o = { style: {}, attrs: a, setAttribute: (k, v) => { a[k] = v; }, setAttributeNS: (_n, k, v) => { a[k] = v; }, removeAttribute: k => { delete a[k]; } };
    return o;
  };
  const badge = async config => {
    const { VolumeLogo } = await import('../src/view/volume-logo.js');
    const logo = new VolumeLogo(null, { width: 720, height: 1600 });
    logo._renderConfig = config;
    return logo;
  };
  const config = {
    logo_base_path: 'assets/', emblem_scale: { crown_of_thorns: 1.8, torah_scroll: 1.8 },
    watermark_scale: { torah_scroll: 1.7 }, emblem_surround: { torah_scroll: 'torah_wreath' }, surround_watermark_scale: { torah_scroll: 2.4 }
  };
  const arc = { hubX: 1700, hubY: 0, radius: 1680 }, angle = 2.48;
  it('ONE PICTURE IN THE CORNER: the surround lies exactly on the emblem\'s box', async () => {
    const s = (await badge({ default_image: 'torah_scroll', ...config }))._getStartState();
    for (const k of ['X', 'Y', 'Width', 'Height']) assert.equal(s[`surround${k}`], s[`logo${k}`], k);
  });
  it('TWO SIZES BEHIND THE TEXT, about one centre: the emblem stops, the surround goes on', async () => {
    const e = (await badge({ default_image: 'torah_scroll', ...config }))._getEndState(arc, angle);
    assert.ok(Math.abs(e.logoWidth - arc.radius * 1.7) < 1e-9, 'the emblem stops where it still fits');
    assert.ok(Math.abs(e.surroundWidth - arc.radius * 2.4) < 1e-9, 'the surround grows past the sector');
    assert.ok(Math.abs(e.surroundX + e.surroundWidth / 2 - e.logoCenterX) < 1e-9);
    assert.ok(Math.abs(e.surroundY + e.surroundHeight / 2 - e.logoCenterY) < 1e-9);
  });
  it('an emblem with no surround is one picture at one size, as it always was', async () => {
    const logo = await badge({ default_image: 'crown_of_thorns', ...config });
    assert.equal(logo._surroundName(), null);
    const e = logo._getEndState(arc, angle);
    assert.equal(e.surroundWidth, e.logoWidth);
    assert.ok(Math.abs(e.logoWidth - arc.radius * 0.9) < 1e-9);
  });
  it('a surround with no size of its own grows with its emblem', async () => {
    const logo = await badge({ default_image: 'torah_scroll', ...config, surround_watermark_scale: {} });
    const e = logo._getEndState(arc, angle);
    assert.equal(e.surroundWidth, e.logoWidth);
  });
  it('THE FLIGHT CARRIES BOTH, and home again they are one picture', async () => {
    const logo = await badge({ default_image: 'torah_scroll', ...config });
    logo.circle = el(); logo.logo = el(); logo.surround = el();
    const out = logo.beginExpand(arc, angle);
    out.frameAt(0.5);
    assert.match(logo.surround.style.transform, /scale\(/, 'the surround is in flight, as a transform');
    assert.notEqual(logo.surround.style.transform, logo.logo.style.transform, 'and already ahead of the emblem');
    out.finish();
    assert.ok(Math.abs(logo.logo.attrs.width - arc.radius * 1.7) < 1e-9);
    assert.ok(Math.abs(logo.surround.attrs.width - arc.radius * 2.4) < 1e-9);
    assert.equal(logo.surround.attrs.transform, logo.logo.attrs.transform, 'tilted together about the one centre');
    const home = logo.beginCollapse(arc, angle);
    home.finish();
    for (const k of ['x', 'y', 'width', 'height']) assert.ok(Math.abs(logo.surround.attrs[k] - logo.logo.attrs[k]) < 1e-9, k);
    assert.equal(logo.surround.attrs.transform, undefined);
  });
  // O-269 (Howell 2026-11-06, with the flight caught half way: the wreath
  // "gets kind of noisy. Perhaps it would be better if the wreath just faded
  // away").
  it('THE SURROUND MAY FADE AWAY, and does it early: gone within a quarter of the way out, back in the last quarter home', async () => {
    const logo = await badge({ default_image: 'torah_scroll', ...config, surround_watermark_opacity: { torah_scroll: 0 } });
    const shut = logo._getStartState(), open = logo._getEndState(arc, angle);
    assert.equal(shut.surroundOpacity, 0.5, 'whole in the corner');
    assert.equal(open.surroundOpacity, 0, 'gone behind the text');
    assert.equal(logo._surroundOpacityAt(shut, open, 0), 0.5);
    assert.ok(logo._surroundOpacityAt(shut, open, 0.1) < 0.5 && logo._surroundOpacityAt(shut, open, 0.1) > 0);
    assert.equal(logo._surroundOpacityAt(shut, open, 0.25), 0, 'gone while it is still small and close');
    assert.equal(logo._surroundOpacityAt(shut, open, 0.6), 0);
    assert.equal(logo._surroundOpacityAt(open, shut, 0.5), 0, 'and not back until the badge is nearly home');
    assert.equal(logo._surroundOpacityAt(open, shut, 0.75), 0);
    assert.ok(logo._surroundOpacityAt(open, shut, 0.9) > 0);
    assert.equal(logo._surroundOpacityAt(open, shut, 1), 0.5);
    logo.circle = el(); logo.logo = el(); logo.surround = el();
    const out = logo.beginExpand(arc, angle);
    out.frameAt(0.8);
    assert.equal(logo.surround.style.opacity, '0');
    assert.notEqual(logo.logo.style.opacity, '0', 'the emblem itself is still on its way to a watermark');
    out.finish();
    assert.equal(logo.surround.attrs.opacity, 0);
    assert.ok(Math.abs(logo.logo.attrs.opacity - 0.1) < 1e-9);
  });
  it('an undeclared or nonsense fade leaves the surround a watermark like its emblem', async () => {
    for (const bad of [undefined, null, '', 'faint', -1, 2]) {
      const logo = await badge({ default_image: 'torah_scroll', ...config, surround_watermark_opacity: { torah_scroll: bad } });
      assert.equal(logo._getEndState(arc, angle).surroundOpacity, 0.10);
    }
  });
  it('a swap INTO an emblem with a faded surround, in an open sector, does not show it', async () => {
    const logo = await badge({ default_image: 'crown_of_thorns', ...config, surround_watermark_opacity: { torah_scroll: 0 } });
    logo.circle = el(); logo.logo = el(); logo.surround = el();
    logo._expanded = true; logo._animating = false; logo._openAt = { arcParams: arc, magnifierAngle: angle };
    assert.equal(logo.setImage('torah_scroll'), true);
    assert.equal(logo.surround.attrs.opacity, 0);
    assert.ok(Math.abs(logo.logo.attrs.opacity - 0.1) < 1e-9);
  });
  it('THE SWAP TAKES THE SURROUND WITH IT: an emblem that has none hides it, one that has one names its file', async () => {
    const logo = await badge({ default_image: 'torah_scroll', ...config });
    logo.circle = el(); logo.logo = el(); logo.surround = el();
    assert.equal(logo.setImage('crown_of_thorns'), true);
    assert.equal(logo.surround.style.display, 'none');
    assert.equal(logo.setImage('torah_scroll'), true);
    assert.equal(logo.surround.style.display, '');
    assert.equal(logo.surround.attrs.href, 'assets/torah_wreath.png');
    assert.equal(logo.setImage(''), true);
    assert.equal(logo.surround.style.display, 'none', 'and no emblem means no surround');
  });
});

// THE FENCE STANDS WHILE THE BADGE FLIES HOME (O-189, Howell's phone
// 2026-10-01: a verse's star seated on top of the crown). The sky asks the
// badge for the box to keep clear of; it used to be told nothing while the
// badge was animating, and the drill-out now lays the sky mid-flight.
describe('the corner box the sky keeps clear of (O-189)', () => {
  const badge = async () => {
    const { VolumeLogo } = await import('../src/view/volume-logo.js');
    const logo = new VolumeLogo(null, { width: 360, height: 800 });
    logo.circle = {};   // a badge exists
    return logo;
  };
  it('at rest in the corner: the box, WHERE THE CIRCLE IS and as wide as the emblem', async () => {
    const logo = await badge();
    logo._renderConfig = { default_image: 'crown_of_thorns', emblem_scale: { crown_of_thorns: 1.8 } };
    const b = logo.getBounds();
    const g = logo._collapsedGeometry();
    assert.ok(b && b.right > b.left && b.bottom > b.top);
    assert.ok(Math.abs((b.left + b.right) / 2 - g.centerX) < 1e-9 && Math.abs((b.top + b.bottom) / 2 - g.centerY) < 1e-9, 'centred on the circle the badge actually draws');
    assert.ok(b.right - b.left >= g.logoWidth - 1e-9, 'as wide as the crown\'s thorns');
    assert.ok(b.left < g.centerX - g.radius && b.bottom > g.centerY + g.radius, 'the circle itself lies inside the fence');
  });
  it('FLYING HOME (collapsing): still the box — the sky laid during the flight must avoid where the badge is going', async () => {
    const logo = await badge();
    logo._animating = true; logo._collapsing = true; logo._expanded = true;
    assert.ok(logo.getBounds(), 'the destination, not the absence of one');
  });
  it('expanded, or flying out to expand: nothing to avoid', async () => {
    const logo = await badge();
    logo._expanded = true;
    assert.equal(logo.getBounds(), null);
    logo._expanded = false; logo._animating = true; logo._collapsing = false;
    assert.equal(logo.getBounds(), null);
  });
});

// NOTHING ABOVE THE TOP (O-190, Howell 2026-10-01): a testaments ring whose
// parent seat read the edition's own title, and a drill out that began
// towards it. Without a gateway above, a testament has no parent to name.
describe('a testament names no parent without a gateway above (O-190)', () => {
  it('the parent label is empty, and would be the volume\'s title only under a gateway boot', () => {
    const h = handlers(makeManifest(() => SPANNING.map(d => ({ ...d }))));
    assert.equal(h.getParentLabel({ level: 'testament', parentName: 'The Holy Bible, translated from the Latin Vulgate' }), '');
    assert.equal(typeof h.getParentActionable, 'function');
    assert.equal(h.getParentActionable(), true, 'actionable at the book ring, where the boot stands');
  });
});
