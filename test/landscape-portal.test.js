// THE LANDSCAPE PORTAL (O-258, Howell 2026-11-01): a phone turned sideways
// shows the volume's one plain page — its name, the house's addresses, the
// door to the other volume — and the words on it are the volume's, in the
// reading tongue. These tests hold the model and where the door leads.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { portalRecord, renderLandscapePortal, crossLinkHref, mailtoHref, landscapeTongues, telHref } from '../src/view/landscape-portal.js';
import { firstOfferedLanguage } from '../src/core/tongue.js';
import { doorHref } from '../src/core/lan-gate.js';
import { volumeConfigs, VENUES } from '../src/volume-configs.js';
import { createMockElement } from './helpers/mock-dom.js';

const BIBLE_ROOT = {
  display_config: {
    splash: { image: 'crown_of_thorns', title: 'Biblia Catholica' },
    detail_sector: { logo_base_path: 'assets/' },
    landscape: {
      corrections: { default: 'corrections', latin: 'correctiones', hebrew: 'תיקונים' },
      info: { default: 'info', latin: 'info' },
      rotate: { default: 'Turn the telephone upright to read', latin: 'Telephonum erige ad legendum' }
    }
  }
};
const CALENDAR_ROOT = {
  display_config: {
    splash: { image: 'mmdm_logo', title: 'MECCANISMI MARITTIMI\ndelle MARCHE', title_font: 'Montserrat', title_color: '#f1b800' },
    landscape: {
      emblem: { image: 'mmdm_logo' },
      info: { default: 'info', italian: 'info' },
      trade: { default: 'Exhaust manifolds for all types of marine engines', english: 'Exhaust manifolds for all types of marine engines', italian: 'Collettori di scarico per motori marini di ogni tipo' }
    }
  }
};
const SQUARE = { hostname: 'bibliacatholica.com', pathname: '/', protocol: 'https:' };
const MMDM_ROOT = { hostname: 'mmdm.it', pathname: '/', protocol: 'https:' };   // the calendar's public address, the day it goes up
const ROOM_BIBLE = { hostname: 'mmdm.it', pathname: '/wheel-v3/bible/', protocol: 'https:' };
const ROOM_CALENDAR = { hostname: 'mmdm.it', pathname: '/wheel-v3/calendar/', protocol: 'https:' };
const LAN = { hostname: '192.168.88.167', pathname: '/', protocol: 'http:' };

describe('landscape portal — the Bible’s page (the minimum, Howell’s notes)', () => {
  const config = volumeConfigs.bible;

  it('is the name, two link words in the reading tongue, and the company’s mark in the corner — no line of its own', () => {
    const r = portalRecord({ volume: 'bible', config, root: BIBLE_ROOT, lang: 'latin', loc: SQUARE, table: VENUES });
    assert.equal(r.title, 'Biblia Catholica');
    assert.equal(r.titleScale, 2.5, 'the name two and a half times the standard');
    assert.equal(r.mailsAs, 'words');
    assert.deepEqual(r.mails, [
      { address: 'info@bibliacatholica.com', href: 'mailto:info@bibliacatholica.com', text: 'info', purpose: null },
      { address: 'corrections@bibliacatholica.com', href: 'mailto:corrections@bibliacatholica.com', text: 'correctiones', purpose: null }
    ]);
    assert.equal(r.rotate, null, 'no turn-it-upright line');
    assert.equal(r.link.href, 'https://mmdm.it/', 'in Leicester Square the door is the other domain');
    assert.equal(r.link.corner, true);
    assert.equal(r.link.imageUrl, `${config.assetBase}assets/mmdm_logo.png`, 'the mark travels with the Bible’s own art (W-114)');
    assert.equal(r.link.label, 'Meccanismi Marittimi delle Marche');
    assert.equal(r.dir, 'ltr');
  });

  it('falls back to the table’s default where the tongue has no word, to the address’s own word where there is no table, and reads right to left for Hebrew', () => {
    const r = portalRecord({ volume: 'bible', config, root: BIBLE_ROOT, lang: 'hebrew', loc: SQUARE, table: VENUES });
    assert.equal(r.mails[1].text, 'תיקונים');
    assert.equal(r.mails[0].text, 'info', 'the default');
    assert.equal(r.dir, 'rtl');
    const none = portalRecord({ volume: 'bible', config, root: { display_config: { splash: { title: 'Biblia Catholica' } } }, lang: 'latin', loc: SQUARE, table: VENUES });
    assert.deepEqual(none.mails.map(m => m.text), ['info', 'corrections'], 'the word before the @, info first');
  });

  it('answers nothing for a volume that declares no landscape page', () => {
    assert.equal(portalRecord({ volume: 'catalog', config: volumeConfigs.catalog, root: {}, loc: SQUARE, table: VENUES }), null);
  });
});

describe('landscape portal — the calendar’s page', () => {
  const config = volumeConfigs.calendar;

  it('is the company’s mark, its name in the card’s face and colour, the trade line, the word info, and the crown in the corner as the door to the Bible', () => {
    const r = portalRecord({ volume: 'calendar', config, root: CALENDAR_ROOT, lang: 'italian', loc: MMDM_ROOT, table: VENUES });
    assert.equal(r.emblem.imageUrl, './data/calendar/assets/mmdm_logo.png', 'the mark resolves against the calendar’s own data root (W-114)');
    assert.equal(r.title, 'MECCANISMI MARITTIMI delle MARCHE', 'the card’s name on one line here');
    assert.equal(r.titleFont, 'Montserrat');
    assert.equal(r.titleColor, '#f1b800');
    assert.equal(r.about, 'Collettori di scarico per motori marini di ogni tipo');
    assert.equal(r.mailsAs, 'words');
    assert.deepEqual(r.mails, [{ address: 'info@mmdm.it', href: 'mailto:info@mmdm.it', text: 'info', purpose: null }]);
    assert.equal(r.phone, null, 'no telephone is drawn until the number is set');
    assert.equal(r.link.href, 'https://bibliacatholica.com/');
    assert.equal(r.link.imageUrl, './data/calendar/assets/crown_of_thorns.png');
    assert.equal(r.link.corner, true);
    assert.equal(r.rotate, null, 'no turn-it-upright line on either page any more');
  });

  it('reads in the phone’s tongue where the volume has no language ring, from the tongues its words are declared in', () => {
    assert.deepEqual(landscapeTongues(CALENDAR_ROOT).sort(), ['english', 'italian']);
    assert.deepEqual(landscapeTongues(null), []);
    assert.equal(firstOfferedLanguage(['de-DE', 'it-IT'], landscapeTongues(CALENDAR_ROOT)), 'italian');
    const r = portalRecord({ volume: 'calendar', config, root: CALENDAR_ROOT, lang: null, loc: MMDM_ROOT, table: VENUES });
    assert.equal(r.about, 'Exhaust manifolds for all types of marine engines', 'a tongue not declared reads the default');
  });

  it('takes the telephone from the volume’s own words before the engine’s config', () => {
    const root = { display_config: { ...CALENDAR_ROOT.display_config, landscape: { ...CALENDAR_ROOT.display_config.landscape, phone: { number: '+39 071 111 222' } } } };
    const r = portalRecord({ volume: 'calendar', config, root, lang: 'italian', loc: MMDM_ROOT, table: VENUES });
    assert.deepEqual(r.phone, { href: 'tel:+39071111222', text: '+39 071 111 222' });
    assert.deepEqual(landscapeTongues(root).sort(), ['english', 'italian'], 'the number is not a tongue');
  });

  it('writes a tel: link from the number as written', () => {
    assert.equal(telHref('+39 071 123 4567'), 'tel:+390711234567');
    assert.equal(telHref('071-123'), 'tel:071123');
    assert.equal(telHref(''), null);
  });
});

describe('landscape portal — where the door leads', () => {
  it('in the screening room the door stays on the host and crosses to the other door', () => {
    assert.equal(doorHref('bible', ROOM_CALENDAR, VENUES), '/wheel-v3/bible/');
    assert.equal(doorHref('calendar', ROOM_BIBLE, VENUES), '/wheel-v3/calendar/');
    assert.equal(crossLinkHref('bible', 'https://bibliacatholica.com/', ROOM_CALENDAR, VENUES), '/wheel-v3/bible/');
  });

  it('on the LAN it is the same address with the other volume’s word', () => {
    assert.equal(doorHref('bible', LAN, VENUES), null);
    assert.equal(crossLinkHref('bible', 'https://bibliacatholica.com/', LAN, VENUES), '/?volume=bible');
    assert.equal(crossLinkHref('calendar', 'https://mmdm.it/', { ...LAN, pathname: '/index.html' }, VENUES), '/index.html?volume=calendar');
  });

  it('in Leicester Square it is the other domain — never the room from a public page; with no public address there is no door at all', () => {
    assert.equal(crossLinkHref('calendar', 'https://mmdm.it/', SQUARE, VENUES), 'https://mmdm.it/');
    assert.equal(crossLinkHref('bible', 'https://bibliacatholica.com/', MMDM_ROOT, VENUES), 'https://bibliacatholica.com/', 'the root of mmdm.it shares a host with the room’s doors and must not send a stranger into the room');
    assert.equal(crossLinkHref('calendar', null, SQUARE, VENUES), null);
    const r = portalRecord({ volume: 'bible', config: { ...volumeConfigs.bible, landscape: { mails: [], link: { volume: 'calendar' } } }, root: BIBLE_ROOT, loc: SQUARE, table: VENUES });
    assert.equal(r.link, null);
  });
});

describe('landscape portal — the sheet', () => {
  const doc = { createElement: tag => createMockElement(tag) };
  const texts = node => (node.children.length ? node.children.flatMap(texts) : [node.textContent]).filter(Boolean);

  it('is rebuilt whole from the record — the body, then the corner door; the tongue can change', () => {
    const sheet = createMockElement('div');
    sheet.appendChild(createMockElement('svg'));
    const first = portalRecord({ volume: 'bible', config: volumeConfigs.bible, root: BIBLE_ROOT, lang: 'latin', loc: SQUARE, table: VENUES });
    assert.equal(renderLandscapePortal(sheet, first, doc), true);
    assert.equal(sheet.getAttribute('dir'), 'ltr');
    assert.equal(sheet.getAttribute('data-volume'), 'bible');
    assert.ok(sheet.classList.contains('landscape-portal'));
    assert.equal(sheet.children.length, 1, 'the old rotate icon is gone');
    const page = sheet.children[0];
    assert.deepEqual(texts(page), ['Biblia Catholica', 'info', 'correctiones'], 'nothing else on the page, info read first');
    assert.equal(page.children.length, 2, 'the body, then the corner door; no rotate line');
    const body = page.children[0];
    assert.equal(body.className, 'portal-body');
    const mails = body.children.find(c => c.className.startsWith('portal-mails'));
    assert.equal(mails.className, 'portal-mails portal-mails--words');
    const links = mails.children.map(row => row.children.find(c => c.tag === 'a'));
    assert.deepEqual(links.map(a => [a.textContent, a.getAttribute('href')]), [
      ['info', 'mailto:info@bibliacatholica.com'],
      ['correctiones', 'mailto:corrections@bibliacatholica.com']
    ]);
    const door = page.children[1];
    assert.equal(door.className, 'portal-door portal-door--corner');
    assert.equal(door.getAttribute('href'), 'https://mmdm.it/');
    const img = door.children.find(c => c.tag === 'img');
    assert.equal(img.getAttribute('src'), `${volumeConfigs.bible.assetBase}assets/mmdm_logo.png`);
    assert.equal(img.getAttribute('alt'), 'Meccanismi Marittimi delle Marche');
    assert.equal(door.children.some(c => c.tag === 'span'), false, 'the mark alone, no caption');

    const second = portalRecord({ volume: 'bible', config: volumeConfigs.bible, root: BIBLE_ROOT, lang: 'hebrew', loc: SQUARE, table: VENUES });
    renderLandscapePortal(sheet, second, doc);
    assert.equal(sheet.getAttribute('dir'), 'rtl');
    assert.equal(sheet.children.length, 1);
    assert.ok(texts(sheet.children[0]).includes('תיקונים'));
  });

  it('draws the company’s mark above the name, the trade line, info and the telephone in one row, and the crown alone in the corner', () => {
    const sheet = createMockElement('div');
    const config = { ...volumeConfigs.calendar, landscape: { ...volumeConfigs.calendar.landscape, phone: { number: '+39 071 000 000' } } };
    const r = portalRecord({ volume: 'calendar', config, root: CALENDAR_ROOT, lang: 'english', loc: ROOM_CALENDAR, table: VENUES });
    renderLandscapePortal(sheet, r, doc);
    const page = sheet.children[0];
    assert.equal(page.className, 'portal-page portal-page--emblem', 'a page headed by an emblem spreads down the height');
    const body = page.children[0];
    assert.deepEqual(body.children.map(c => c.className.split(' ')[0]), ['portal-emblem', 'portal-title', 'portal-mails']);
    assert.equal(body.children[0].getAttribute('src'), './data/calendar/assets/mmdm_logo.png');
    const title = body.children[1];
    assert.equal(title.style.fontFamily, "'Montserrat', sans-serif");
    assert.equal(title.style.color, '#f1b800');
    assert.equal(title.children.filter(c => c.tag === 'br').length, 0, 'one line, though the card sets two');
    const about = page.children.find(c => c.className === 'portal-about portal-about--corner');
    assert.equal(about.textContent, 'Exhaust manifolds for all types of marine engines', 'in the upper left corner, the capitals are CSS’s');
    const list = body.children[2];
    assert.equal(list.className, 'portal-mails portal-mails--words');
    const links = list.children.map(row => row.children.find(c => c.tag === 'a'));
    assert.deepEqual(links.map(a => [a.textContent, a.getAttribute('href')]), [['info', 'mailto:info@mmdm.it'], ['+39 071 000 000', 'tel:+39071000000']]);
    assert.equal(links[1].getAttribute('dir'), 'ltr', 'a number reads left to right in every tongue');
    const door = page.children.find(c => c.tag === 'a');
    assert.equal(door.className, 'portal-door portal-door--corner');
    assert.equal(door.getAttribute('href'), '/wheel-v3/bible/');
    const img = door.children.find(c => c.tag === 'img');
    assert.equal(img.getAttribute('src'), './data/calendar/assets/crown_of_thorns.png');
    assert.equal(img.className, 'portal-door-image portal-door-image--light', 'dark line art on the navy is drawn in the negative');
    assert.equal(door.children.some(c => c.tag === 'span'), false, 'the crown or the name, not both: the crown alone');
    assert.equal(page.children.some(c => c.className === 'portal-rotate'), false);
  });

  it('refuses quietly without a sheet or a record', () => {
    assert.equal(renderLandscapePortal(null, {}, doc), false);
    assert.equal(renderLandscapePortal(createMockElement('div'), null, doc), false);
  });
});

describe('landscape portal — the pre-composed correction', () => {
  it('the corrections email carries the reader’s place as its subject; info carries none', () => {
    const r = portalRecord({ volume: 'bible', config: volumeConfigs.bible, root: BIBLE_ROOT, lang: 'english', loc: SQUARE, table: VENUES, subject: '1769eng MATTHEW 16:18' });
    assert.equal(r.mails[1].href, 'mailto:corrections@bibliacatholica.com?subject=1769eng%20MATTHEW%2016%3A18');
    assert.equal(r.mails[0].href, 'mailto:info@bibliacatholica.com');
    const sheet = createMockElement('div');
    renderLandscapePortal(sheet, r, { createElement: tag => createMockElement(tag) });
    const words = sheet.children[0].children[0].children.find(c => c.className.startsWith('portal-mails'));
    assert.equal(words.children[1].children[0].getAttribute('href'), r.mails[1].href);
  });

  it('without a place the address stands bare, and the subject is escaped', () => {
    assert.equal(mailtoHref('a@b.c', null), 'mailto:a@b.c');
    assert.equal(mailtoHref('a@b.c', '   '), 'mailto:a@b.c');
    assert.equal(mailtoHref('a@b.c', 'ΓΕΝΕΣΙΣ α\':12 & more'), 'mailto:a@b.c?subject=' + encodeURIComponent("ΓΕΝΕΣΙΣ α':12 & more"));
    const r = portalRecord({ volume: 'bible', config: volumeConfigs.bible, root: BIBLE_ROOT, loc: SQUARE, table: VENUES });
    assert.equal(r.mails[1].href, 'mailto:corrections@bibliacatholica.com');
  });
});

describe('landscape portal — the copyright line and the lift', () => {
  const doc = { createElement: tag => createMockElement(tag) };
  it('carries the copyright at the foot, in the words handed in, and raises the Bible’s body off centre', () => {
    const line = '© 2026 Meccanismi Marittimi delle Marche. Omnia iura reservata.';
    const r = portalRecord({ volume: 'bible', config: volumeConfigs.bible, root: BIBLE_ROOT, lang: 'latin', loc: SQUARE, table: VENUES, copyright: line });
    assert.equal(r.copyright, line);
    assert.equal(r.lift, 7);
    const sheet = createMockElement('div');
    renderLandscapePortal(sheet, r, doc);
    const page = sheet.children[0];
    const last = page.children[page.children.length - 1];
    assert.equal(last.className, 'portal-copyright');
    assert.equal(last.textContent, line);
    assert.equal(page.children[0].style.transform, 'translateY(-7vmin)');
  });
  it('no line without words, and the calendar is not lifted', () => {
    const r = portalRecord({ volume: 'calendar', config: volumeConfigs.calendar, root: CALENDAR_ROOT, loc: MMDM_ROOT, table: VENUES, copyright: '  ' });
    assert.equal(r.copyright, null);
    assert.equal(r.lift, 0);
  });
});
