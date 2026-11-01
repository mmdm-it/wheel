// THE LANDSCAPE PORTAL (O-258, Howell 2026-11-01): a phone turned sideways
// shows the volume's one plain page — its name, the house's addresses, the
// door to the other volume — and the words on it are the volume's, in the
// reading tongue. These tests hold the model and where the door leads.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { portalRecord, renderLandscapePortal, crossLinkHref } from '../src/view/landscape-portal.js';
import { doorHref } from '../src/core/lan-gate.js';
import { volumeConfigs, VENUES } from '../src/volume-configs.js';
import { createMockElement } from './helpers/mock-dom.js';

const BIBLE_ROOT = {
  display_config: {
    splash: { image: 'crown_of_thorns', title: 'Biblia Catholica' },
    detail_sector: { logo_base_path: 'assets/' },
    landscape: {
      greeting: { default: ['Welcome.', 'A short line.'], latin: ['Salvete.'], hebrew: ['ברוכים הבאים.'] },
      corrections: { default: 'A mistake in the text', latin: 'Mendum in textu' },
      info: { default: 'Anything else', latin: 'Cetera' },
      rotate: { default: 'Turn the telephone upright to read', latin: 'Telephonum erige ad legendum' }
    }
  }
};
const CALENDAR_ROOT = {
  display_config: {
    splash: { image: 'mmdm_logo', title: 'MECCANISMI MARITTIMI\ndelle MARCHE', title_font: 'Montserrat', title_color: '#f1b800' }
  }
};
const SQUARE = { hostname: 'bibliacatholica.com', pathname: '/', protocol: 'https:' };
const MMDM_ROOT = { hostname: 'mmdm.it', pathname: '/', protocol: 'https:' };   // the calendar's public address, the day it goes up
const ROOM_BIBLE = { hostname: 'mmdm.it', pathname: '/wheel-v3/bible/', protocol: 'https:' };
const ROOM_CALENDAR = { hostname: 'mmdm.it', pathname: '/wheel-v3/calendar/', protocol: 'https:' };
const LAN = { hostname: '192.168.88.167', pathname: '/', protocol: 'http:' };

describe('landscape portal — the Bible’s page', () => {
  const config = volumeConfigs.bible;

  it('carries the welcome, both addresses with their purposes, and the door back, in the reading tongue', () => {
    const r = portalRecord({ volume: 'bible', config, root: BIBLE_ROOT, lang: 'latin', loc: SQUARE, table: VENUES });
    assert.equal(r.title, 'Biblia Catholica');
    assert.deepEqual(r.greeting, ['Salvete.']);
    assert.deepEqual(r.mails.map(m => [m.purpose, m.address]), [
      ['Mendum in textu', 'corrections@bibliacatholica.com'],
      ['Cetera', 'info@bibliacatholica.com']
    ]);
    assert.equal(r.rotate, 'Telephonum erige ad legendum');
    assert.equal(r.link.href, 'https://mmdm.it/', 'in Leicester Square the door is the other domain');
    assert.equal(r.link.imageUrl, null, 'the door back is a name, not an emblem');
    assert.equal(r.link.label, 'Meccanismi Marittimi delle Marche');
    assert.equal(r.dir, 'ltr');
  });

  it('falls back to the table’s default where the tongue has no words, and reads right to left for Hebrew', () => {
    const r = portalRecord({ volume: 'bible', config, root: BIBLE_ROOT, lang: 'hebrew', loc: SQUARE, table: VENUES });
    assert.deepEqual(r.greeting, ['ברוכים הבאים.']);
    assert.equal(r.mails[0].purpose, 'A mistake in the text');
    assert.equal(r.dir, 'rtl');
    const none = portalRecord({ volume: 'bible', config, root: { display_config: { splash: { title: 'Biblia Catholica' } } }, lang: 'latin', loc: SQUARE, table: VENUES });
    assert.deepEqual(none.greeting, [], 'a volume without words greets with nothing');
    assert.equal(none.mails[0].purpose, null);
    assert.equal(none.rotate, 'Ruota il dispositivo in verticale', 'the sheet’s old line stands');
  });

  it('answers nothing for a volume that declares no landscape page', () => {
    assert.equal(portalRecord({ volume: 'catalog', config: volumeConfigs.catalog, root: {}, loc: SQUARE, table: VENUES }), null);
  });
});

describe('landscape portal — the calendar’s page', () => {
  const config = volumeConfigs.calendar;

  it('shows the company’s name in the card’s face and colour, one address, and the crown as the door to the Bible', () => {
    const r = portalRecord({ volume: 'calendar', config, root: CALENDAR_ROOT, lang: null, loc: MMDM_ROOT, table: VENUES });
    assert.equal(r.title, 'MECCANISMI MARITTIMI\ndelle MARCHE');
    assert.equal(r.titleFont, 'Montserrat');
    assert.equal(r.titleColor, '#f1b800');
    assert.deepEqual(r.greeting, []);
    assert.deepEqual(r.mails, [{ address: 'info@mmdm.it', purpose: null }]);
    assert.equal(r.link.href, 'https://bibliacatholica.com/');
    assert.equal(r.link.imageUrl, './data/calendar/assets/crown_of_thorns.png', 'the crown resolves against the calendar’s own data root (W-114)');
    assert.equal(r.link.label, 'Biblia Catholica');
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

  it('is rebuilt whole from the record, the rotate line last, and the tongue can change', () => {
    const sheet = createMockElement('div');
    sheet.appendChild(createMockElement('svg'));
    const first = portalRecord({ volume: 'bible', config: volumeConfigs.bible, root: BIBLE_ROOT, lang: 'latin', loc: SQUARE, table: VENUES });
    assert.equal(renderLandscapePortal(sheet, first, doc), true);
    assert.equal(sheet.getAttribute('dir'), 'ltr');
    assert.equal(sheet.getAttribute('data-volume'), 'bible');
    assert.ok(sheet.classList.contains('landscape-portal'));
    assert.equal(sheet.children.length, 1, 'the old rotate icon is gone');
    const page = sheet.children[0];
    const words = texts(page);
    assert.equal(words[0], 'Biblia Catholica');
    assert.ok(words.includes('Salvete.'));
    assert.ok(words.includes('corrections@bibliacatholica.com'));
    assert.equal(words[words.length - 1], 'Telephonum erige ad legendum');
    assert.equal(page.children.length, 2, 'the body, then the rotate line pinned to the foot');
    const body = page.children[0];
    assert.equal(body.className, 'portal-body');
    assert.equal(page.children[1].className, 'portal-rotate');
    const mails = body.children.find(c => c.className.startsWith('portal-mails'));
    assert.equal(mails.className, 'portal-mails portal-mails--purposed', 'purposed rows are two aligned columns');
    const mailto = mails.children[0].children.find(c => c.tag === 'a');
    assert.equal(mailto.getAttribute('href'), 'mailto:corrections@bibliacatholica.com');
    const door = body.children.find(c => c.tag === 'a');
    assert.equal(door.getAttribute('href'), 'https://mmdm.it/');
    assert.equal(door.children.some(c => c.tag === 'img'), false);

    const second = portalRecord({ volume: 'bible', config: volumeConfigs.bible, root: BIBLE_ROOT, lang: 'hebrew', loc: SQUARE, table: VENUES });
    renderLandscapePortal(sheet, second, doc);
    assert.equal(sheet.getAttribute('dir'), 'rtl');
    assert.equal(sheet.children.length, 1);
    assert.ok(texts(sheet.children[0]).includes('ברוכים הבאים.'));
  });

  it('draws the calendar’s crown as an image inside the door, with the company’s face on the title', () => {
    const sheet = createMockElement('div');
    const r = portalRecord({ volume: 'calendar', config: volumeConfigs.calendar, root: CALENDAR_ROOT, loc: ROOM_CALENDAR, table: VENUES });
    renderLandscapePortal(sheet, r, doc);
    const body = sheet.children[0].children[0];
    const title = body.children[0];
    assert.equal(title.className, 'portal-title');
    assert.equal(title.style.fontFamily, "'Montserrat', sans-serif");
    assert.equal(title.style.color, '#f1b800');
    assert.equal(title.children.filter(c => c.tag === 'br').length, 1, 'two lines, as the card sets them');
    assert.equal(body.children.find(c => c.className.startsWith('portal-mails')).className, 'portal-mails', 'one address, no purpose: simply centred');
    const door = body.children.find(c => c.tag === 'a');
    assert.equal(door.getAttribute('href'), '/wheel-v3/bible/');
    const img = door.children.find(c => c.tag === 'img');
    assert.equal(img.getAttribute('src'), './data/calendar/assets/crown_of_thorns.png');
    assert.equal(img.getAttribute('alt'), 'Biblia Catholica');
    assert.equal(img.className, 'portal-door-image portal-door-image--light', 'dark line art on the navy is drawn in the negative');
  });

  it('refuses quietly without a sheet or a record', () => {
    assert.equal(renderLandscapePortal(null, {}, doc), false);
    assert.equal(renderLandscapePortal(createMockElement('div'), null, doc), false);
  });
});
