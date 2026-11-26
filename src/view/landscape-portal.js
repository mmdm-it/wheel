// THE LANDSCAPE PORTAL (O-258, Howell 2026-11-01).
//
// The wheel's geometry works in portrait only, so a touch device held
// sideways has always been covered by a sheet that said "turn it back".
// Howell's ruling makes that sheet the volume's one plain page — the place
// the reader finds the house's addresses and the door to the other volume,
// hidden from the reader in the instrument itself (O-211: "I suppose we can
// hide these links in the landscape mode"):
//
//   the company's volume — its mark centred and large, its full name
//     beneath, one line saying what the business is, the word info (its
//     one address) and the telephone, with the other volume's emblem in the
//     lower right corner as the door to it (Howell 2026-11-02);
//   the scripture volume — its name and two link WORDS (corrections, info),
//     each opening the mail client on its address, with the company's mark
//     in the lower right corner as the door back. His notes on the first
//     draft: "much, much too wordy … Let's take it down to the minimum, and
//     then we'll see how barren it looks."
//
// WHOSE WORDS. The engine holds no human words (O-43): the link words and
// the turn-it-upright line are the VOLUME's, declared per tongue in
// display_config.landscape and picked by the reading language as the
// review mark's are (O-226). The volume's name on the page is the splash
// card's title in the card's own face and colour, so the page wears the
// brand the boot showed. The addresses and the public door are the venue
// table's business (H1: volume-configs.js is the one file that may name a
// site); a door's picture resolves against the volume's own data root like
// every other emblem (W-114).
//
// WHERE THE DOOR LEADS. In Leicester Square each volume has a domain, so the
// door is the other domain. In the screening room the volumes are two doors
// on one host, so the link stays on the host and crosses to the other door.
// On the LAN there are no doors: the same address with the other volume's
// word. The venue table decides, never the page.
import { doorAt, doorHref, isOnLan, isScreeningRoom } from '../core/lan-gate.js';
import { splashRecord } from './boot-overture.js';

const RTL = new Set(['hebrew', 'arabic', 'syriac']);

// What the engine says when a volume declares nothing: the line the sheet
// carried since the portrait gate was built (shipped text, Italian).
const FALLBACK_ROTATE = 'Ruota il dispositivo in verticale';

/**
 * The tongues the volume's landscape words are declared in. A volume with no
 * language ring of its own (the company's) reads its page in the phone's
 * tongue, picked from these (O-176's bridge).
 */
export function landscapeTongues(root) {
  const words = root?.display_config?.landscape;
  const out = new Set();
  if (!words || typeof words !== 'object') return [];
  for (const [key, table] of Object.entries(words)) {
    // The pictures' tables name images, not tongues.
    if (key === 'door' || key === 'emblem' || key === 'phone') continue;
    if (!table || typeof table !== 'object' || Array.isArray(table)) continue;
    for (const k of Object.keys(table)) if (k !== 'default' && typeof table[k] === 'string') out.add(k);
  }
  return [...out];
}

/** A tel: link from a written number: the digits and a leading plus only. */
export function telHref(number) {
  const s = String(number || '').trim();
  const digits = s.replace(/[^0-9]/g, '');
  return digits ? `tel:${s.startsWith('+') ? '+' : ''}${digits}` : null;
}
/**
 * An sms: link from a written number (Howell 2026-11-10: the scripture volume's number
 * is for text messages, "not dial a phone number, but rather send an SMS"),
 * with the message begun when there is a `body` — the reader's place, as the
 * correction email's subject is. `?body=` is what both phones' messaging
 * apps read.
 */
export function smsHref(number, body = null) {
  const tel = telHref(number);
  if (!tel) return null;
  const b = typeof body === 'string' && body.trim() ? body.trimStart() : '';
  return b ? `sms:${tel.slice(4)}?body=${encodeURIComponent(b)}` : `sms:${tel.slice(4)}`;
}
/**
 * A WhatsApp chat link for a written number: wa.me takes the number in
 * international form without the plus, and `text` begins the message.
 */
export function whatsappHref(number, text = null) {
  const digits = String(number || '').replace(/[^0-9]/g, '');
  if (!digits) return null;
  const t = typeof text === 'string' && text.trim() ? text.trimStart() : '';
  return t ? `https://wa.me/${digits}?text=${encodeURIComponent(t)}` : `https://wa.me/${digits}`;
}

function pick(table, lang) {
  if (!table) return null;
  if (typeof table === 'string' || Array.isArray(table)) return table;
  return table[lang] ?? table.default ?? null;
}

/**
 * Where a link to `volume` should lead from `loc`: inside the screening room,
 * the room's own door to that volume (friends and family stay in the room);
 * on the LAN, the same address with the volume's word; anywhere else the
 * public address the volume's own config names — never the room from a
 * public page (O-211: the company's volume links to the other's public gate,
 * "not the screening room").
 */
export function crossLinkHref(volume, publicHref, loc = (typeof window !== 'undefined' ? window.location : null), table) {
  const door = isScreeningRoom(loc, table) ? doorHref(volume, loc, table) : null;
  if (door) return door;
  if (isOnLan(loc) && loc && typeof loc.pathname === 'string') return `${loc.pathname}?volume=${encodeURIComponent(volume)}`;
  return typeof publicHref === 'string' && publicHref ? publicHref : null;
}

/**
 * The page's model — pure, so a test can hold it.
 * @param volume   the volume id on the glass
 * @param config   its entry in volume-configs (landscape, assetBase)
 * @param root     the volume's root (display_config.splash, display_config.landscape)
 * @param lang     the reading language, or null
 * @param loc      the address, for the cross-link
 *
 * config.landscape:
 *   mails    [{ address, purpose? }] — `purpose` names the volume's word table
 *   mailsAs  'words' — each address is shown as its word alone (the word is
 *            the link; the address is only where it leads), else the address
 *            is shown, with its purpose beside it if it has one
 *   link     { volume, href, image?, tone?, corner?, label } — the door;
 *            `corner` seats it in the lower right instead of in the flow
 *   hint     false — no turn-it-upright line
 *   emblem   { image } — the volume's mark, centred and large, above the name
 *   about    the name of the volume's word table saying what it is
 *   phone    { number, link?, subject?, whatsapp? } — a telephone beside the
 *            mail words (the volume's own entry, under
 *            display_config.landscape.phone, wins whole); `link: 'sms'`
 *            opens a text message instead of a call, `subject: true` begins
 *            it with the reader's place, `whatsapp: true` adds the word
 *            WhatsApp as a chat link on the same number
 *   titleOneLine  true — the card's name on one line
 *   aboutCorner   true — the about line in the upper left corner, in capitals
 *   place    the name of the volume's word table saying where the house is,
 *            set under the about line after a blank line, in capitals
 *   a mail's `subject: true` pre-composes its email with `subject` — the
 *            reader's place as main.js names it (Howell 2026-11-01: a
 *            correction is only useful if it says where the mistake is)
 */
/**
 * THE STUDIO (O-342, Howell 2026-11-25: "a separate screening room ... a
 * mock-up that shows ... other volumes, even though they're empty"). The word
 * `studio` on the address draws the sideways page in the grammar being worked
 * out — the volume on the glass large at the head, the others small in a row
 * beneath — from the list the corpus keeps (display_config.landscape.studio).
 * Heard in the screening room and on the LAN only: a public page never
 * shows a volume that does not exist.
 */
export function studioWord(loc = (typeof window !== 'undefined' ? window.location : null), table) {
  if (!loc || !(isOnLan(loc) || isScreeningRoom(loc, table))) return null;
  // The studio's own address needs no word: it opens on the first volume listed.
  const standing = doorAt(loc, table)?.studio === true ? '1' : null;
  try { return new URLSearchParams(loc.search || '').get('studio') || standing; } catch (_) { return standing; }
}

export function portalRecord({ volume, config, root, lang = null, loc, table, subject = null, copyright = null, studio = null } = {}) {
  const decl = config?.landscape;
  if (!decl) return null;
  const words = root?.display_config?.landscape || null;
  const splash = splashRecord(root, config?.assetBase) || {};
  const asWords = decl.mailsAs === 'words';
  const mails = (Array.isArray(decl.mails) ? decl.mails : [])
    .filter(m => m && typeof m.address === 'string' && m.address.includes('@'))
    .map(m => {
      const purpose = m.purpose ? pick(words?.[m.purpose], lang) : null;
      const word = typeof purpose === 'string' && purpose ? purpose : m.address.split('@')[0];
      const href = mailtoHref(m.address, m.subject === true ? subject : null);
      return asWords
        ? { address: m.address, href, text: word, purpose: null }
        : { address: m.address, href, text: m.address, purpose: typeof purpose === 'string' && purpose ? purpose : null };
    });
  const base = root?.display_config?.detail_sector?.logo_base_path || 'assets/';
  // The volume's mark at the head of the page, the volume naming its picture
  // before the engine's config does (W-114).
  const emblemName = typeof words?.emblem?.image === 'string' && words.emblem.image ? words.emblem.image
    : (typeof decl.emblem?.image === 'string' && decl.emblem.image ? decl.emblem.image : null);
  // `crest: true` — a small mark over the name, not the page's large head:
  // the page keeps its centred body (Howell 2026-11-25, a circle drawn over
  // the name: "add our crown of thorns art above the ... banner").
  const emblem = emblemName && config?.assetBase ? { imageUrl: `${config.assetBase}${base}${emblemName}.png`, label: decl.emblem?.label || '', crest: decl.emblem?.crest === true,
    // `tone: 'light'` draws dark line art inverted, for a dark ground;
    // `size` is the crest's height in vmin where the standard is not wanted.
    tone: decl.emblem?.tone === 'light' ? 'light' : null,
    size: Number.isFinite(Number(decl.emblem?.size)) && Number(decl.emblem?.size) > 0 ? Number(decl.emblem.size) : null } : null;
  // What the business is, in the reader's tongue (the volume's words).
  const about = decl.about ? pick(words?.[decl.about], lang) : null;
  // Where the house is, under the about line after a blank line (Howell
  // 2026-11-02: first in the upper right, then "Move it over to the left
  // under the company description ... a blank line in between").
  const place = decl.place ? pick(words?.[decl.place], lang) : null;
  // The telephone sits beside the mail words, written as the volume writes
  // it. The number is the corpus's (display_config.landscape.phone), so it
  // travels only with the private data and reaches the public tree never;
  // nothing is drawn until one is set. The volume's entry wins whole — the
  // number and how its link behaves.
  const ph = words?.phone && typeof words.phone === 'object' ? words.phone
    : (decl.phone && typeof decl.phone === 'object' ? decl.phone : null);
  const phoneText = typeof ph?.number === 'string' ? ph.number.trim() : '';
  // `link: 'sms'` — the number opens a text message, not a call (Howell
  // 2026-11-10, moving the number from the company's page to the scripture volume's:
  // "the link to not dial a phone number, but rather send an SMS"); with
  // `subject: true` the message opens with the reader's place written in,
  // as the correction email does.
  const sms = ph?.link === 'sms';
  // A message has no subject line, so the place stands on a line of its own
  // and the reader begins beneath it (O-319).
  const phoneBody = ph?.subject === true && subject ? `${subject}\n` : null;
  const phoneHref = phoneText ? (sms ? smsHref(phoneText, phoneBody) : telHref(phoneText)) : null;
  const phone = phoneHref ? { href: phoneHref, text: phoneText, kind: sms ? 'sms' : 'tel' } : null;
  // `whatsapp: true` — the same number answers on WhatsApp (Howell
  // 2026-11-10: "More people communicate with WhatsApp than by email"),
  // drawn as the word WhatsApp under the number, a link that opens a chat
  // with the house. Nothing is drawn until the volume says the account
  // exists.
  const whatsappUrl = phoneText && ph?.whatsapp === true ? whatsappHref(phoneText, phoneBody) : null;
  const whatsapp = whatsappUrl ? { href: whatsappUrl, text: 'WhatsApp' } : null;
  let link = null;
  if (decl.link && decl.link.volume) {
    const href = crossLinkHref(decl.link.volume, decl.link.href, loc, table);
    // The door's picture is the volume's to name (display_config.landscape
    // .door.image — the picture is the corpus's, W-114); the engine's config
    // names one only for a volume that has not.
    const image = typeof words?.door?.image === 'string' && words.door.image ? words.door.image : decl.link.image;
    const imageUrl = image && config?.assetBase ? `${config.assetBase}${base}${image}.png` : null;
    // `tone: 'light'` — the emblem is dark line art and the ground is dark, so
    // it is drawn inverted (the crown on the company's navy).
    if (href) {
      link = {
        href,
        imageUrl,
        tone: decl.link.tone === 'light' ? 'light' : null,
        corner: decl.link.corner === true,
        label: typeof decl.link.label === 'string' ? decl.link.label : ''
      };
    }
  }
  // THE DOORS ABOVE THE NAME (O-341, Howell 2026-11-25, drawn on his
  // screenshot as three circles over the name: "positions for icons that will
  // take the user to the other volumes"). One door per volume that EXISTS —
  // an unbuilt volume gets no position. Each is its picture, which the
  // volume names (display_config.landscape.doors.<volume>.image — the art is
  // the corpus's, W-114), and leads where the single door does.
  const doorImage = d => {
    const named = words?.doors?.[d.volume]?.image;
    return typeof named === 'string' && named ? named : (typeof d.image === 'string' ? d.image : null);
  };
  const doors = (Array.isArray(decl.doors) ? decl.doors : []).map(d => {
    const href = d && d.volume ? crossLinkHref(d.volume, d.href, loc, table) : null;
    if (!href) return null;
    return {
      href,
      imageUrl: doorImage(d) && config?.assetBase ? `${config.assetBase}${base}${doorImage(d)}.png` : null,
      label: typeof d.label === 'string' ? d.label : '',
      tone: d.tone === 'light' ? 'light' : null,
      // The word under the picture, in the reader's tongue: the volume's
      // (display_config.landscape.doors.<volume>.label). None, no word.
      caption: (c => (typeof c === 'string' && c.trim() ? c.trim() : null))(pick(words?.doors?.[d.volume]?.label, lang))
    };
  }).filter(Boolean);
  const record = {
    volume,
    doors,
    // `doorsBelow`: the row of doors sits under the name, not over it.
    // `mailsCorners`: the mail words leave the centre for the two lower
    // corners, the first read at the start of the line (Howell 2026-11-25,
    // arrows drawn on his screenshot: the icon and the name swap places,
    // "and move the info and corrections links to the lower left and right
    // corners").
    doorsBelow: decl.doorsBelow === true,
    mailsCorners: decl.mailsCorners === true,
    emblem,
    // `titleOneLine`: the card's name set on one line (Howell 2026-11-02, the
    // company's page: "all on one line").
    // `titleFrom` names the volume's word table for a name said in the
    // reader's tongue (Howell 2026-11-25: "Make the banner simply the word
    // ... in the phone's own language"); the card's name otherwise.
    title: (said => (typeof said === 'string' && said.trim() ? said.trim() : null))(decl.titleFrom ? pick(words?.[decl.titleFrom], lang) : null)
      || (decl.titleOneLine === true ? String(splash.title || config?.documentTitle || '').split('\n').map(t => t.trim()).filter(Boolean).join(' ') : (splash.title || config?.documentTitle || '')),
    titleFont: splash.font || null,
    titleColor: splash.color || null,
    // The name's size against the page's standard (Howell 2026-11-01, on the
    // minimum page: "Make the name ... 2.5 times larger").
    titleScale: Number.isFinite(Number(decl.titleScale)) && Number(decl.titleScale) > 0 ? Number(decl.titleScale) : 1,
    mailsAs: asWords ? 'words' : 'addresses',
    mails,
    phone,
    whatsapp,
    about: typeof about === 'string' && about.trim() ? about.trim() : null,
    // `aboutCorner`: the line sits in the upper left corner, in capitals,
    // instead of under the name (Howell 2026-11-02, drawn on his screenshot).
    aboutCorner: decl.aboutCorner === true,
    place: typeof place === 'string' && place.trim() ? place.trim() : null,
    link,
    rotate: decl.hint === false ? null : (pick(words?.rotate, lang) || FALLBACK_ROTATE),
    // THE COPYRIGHT LINE LIVES HERE NOW (Howell 2026-11-01: "move the
    // copyright disclaimer from the portrait mode to the landscape mode").
    // Its words are the volume's, in the reading tongue, handed in by main.js.
    copyright: typeof copyright === 'string' && copyright.trim() ? copyright.trim() : null,
    // How far the body is raised above centre, in vmin (Howell: the name
    // "looks a little awkward centered vertically, so shift it up").
    lift: Number.isFinite(Number(decl.lift)) && Number(decl.lift) > 0 ? Number(decl.lift) : 0,
    dir: RTL.has(lang) ? 'rtl' : 'ltr'
  };
  // The studio's page: the same record with its head and its row replaced.
  const bench = studio && Array.isArray(words?.studio?.volumes) && words.studio.volumes.length && config?.assetBase ? words.studio : null;
  if (!bench) return record;
  const art = n => (typeof n === 'string' && n ? `${config.assetBase}${base}${/\.[a-z]+$/.test(n) ? n : `${n}.png`}` : null);
  const said = v => (c => (typeof c === 'string' && c.trim() ? c.trim() : v.id))(pick(v.label, lang));
  const here = bench.volumes.find(v => v.id === studio) || bench.volumes[0];
  const path = loc && typeof loc.pathname === 'string' ? loc.pathname : './';
  return {
    ...record,
    studio: here.id,
    emblem: { imageUrl: art(here.image), label: said(here), crest: true, tone: record.emblem?.tone || null, size: null },
    title: said(here),
    titleScale: 2,
    doorsBelow: true,
    mailsCorners: true,
    link: null,
    // THE VOLUMES ARE A WHEEL (Howell 2026-11-26: "The whole row should turn
    // like a wheel"): the row is the list read on from the head and round
    // again, so the order of the volumes never changes, only which of them
    // stands at the head. One turn brings the row's last picture up.
    doors: bench.volumes.map((_, i, all) => all[(all.indexOf(here) + 1 + i) % all.length]).filter(v => v !== here).map(v => ({
      id: v.id,
      href: `${path}?volume=${encodeURIComponent(volume)}&studio=${encodeURIComponent(v.id)}`,
      imageUrl: art(v.image), label: said(v), tone: record.emblem?.tone || null, caption: said(v)
    })),
    // The site's own mark, faint behind the whole page, and its name at the
    // foot beside the copyright: the site, not any one volume.
    watermarkUrl: art(bench.watermark),
    site: typeof bench.site === 'string' && bench.site.trim() ? bench.site.trim() : null
  };
}

/** A mailto, with the subject pre-composed when there is one. */
export function mailtoHref(address, subject) {
  const s = typeof subject === 'string' ? subject.trim() : '';
  return s ? `mailto:${address}?subject=${encodeURIComponent(s)}` : `mailto:${address}`;
}

function make(doc, tag, className, text) {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

/**
 * Fill the sheet (#portrait-gate) from the record. The sheet's visibility is
 * CSS's alone (landscape and a coarse pointer): this only decides what is on
 * it. Idempotent — the sheet is rebuilt whole, so the tongue can change.
 */
export function renderLandscapePortal(sheet, record, doc = (typeof document !== 'undefined' ? document : null)) {
  if (!sheet || !record || !doc) return false;
  while (sheet.firstChild) sheet.removeChild(sheet.firstChild);
  // THE SHEET'S VISIBILITY GOES BACK TO CSS (Howell 2026-11-10, a photograph
  // of the company's page booted sideways: the town cut off at the top, the
  // crown enormous and dark, nothing in capitals — the sheet shown by an
  // inline `display` the reboot's cover had set, so the media query's dress
  // never reached the page that was then drawn into it). A page drawn here
  // is shown by the query alone, in the query's dress.
  if (sheet.style && typeof sheet.style === 'object') sheet.style.display = '';
  sheet.setAttribute('dir', record.dir);
  sheet.setAttribute('data-volume', record.volume);
  // The sheet was a picture of a turning phone, hidden from assistive
  // readers; now it carries links, so it is a page like any other.
  sheet.removeAttribute('aria-hidden');
  sheet.classList.add('landscape-portal');

  const page = make(doc, 'div', record.emblem && !record.emblem.crest ? 'portal-page portal-page--emblem' : (record.studio ? 'portal-page portal-page--studio' : 'portal-page'));
  if (record.watermarkUrl) {
    const mark = make(doc, 'img', 'portal-watermark');
    mark.setAttribute('src', record.watermarkUrl);
    mark.setAttribute('alt', '');
    mark.setAttribute('aria-hidden', 'true');
    page.appendChild(mark);
  }
  // The body sits centred in the height; the turn-it-upright line alone is
  // pinned to the foot (the first photographs had the body hugging the top
  // with a bare band above the line).
  const body = make(doc, 'div', 'portal-body');
  if (record.lift) body.style.transform = `translateY(-${record.lift}vmin)`;
  page.appendChild(body);
  const drawDoors = () => {
    if (!record.doors || !record.doors.length) return;
    const row = make(doc, 'div', record.doorsBelow ? 'portal-doors portal-doors--below' : 'portal-doors');
    record.doors.forEach(d => {
      const a = make(doc, 'a', 'portal-doors-door');
      a.setAttribute('href', d.href);
      if (record.studio && d.id) a.setAttribute('data-studio-door', d.id);
      if (d.label) a.setAttribute('aria-label', d.label);
      if (d.imageUrl) {
        const img = make(doc, 'img', d.tone === 'light' ? 'portal-doors-image portal-door-image--light' : 'portal-doors-image');
        img.setAttribute('src', d.imageUrl);
        img.setAttribute('alt', d.label || '');
        a.appendChild(img);
      } else {
        a.appendChild(make(doc, 'span', 'portal-door-label', d.label));
      }
      if (d.caption) a.appendChild(make(doc, 'span', 'portal-doors-caption', d.caption));
      row.appendChild(a);
    });
    body.appendChild(row);
  };
  if (!record.doorsBelow) drawDoors();
  if (record.emblem) {
    const img = make(doc, 'img', `${record.emblem.crest ? 'portal-emblem portal-emblem--crest' : 'portal-emblem'}${record.emblem.tone === 'light' ? ' portal-door-image--light' : ''}`);
    if (record.emblem.size && img.style) img.style.height = `${record.emblem.size}vmin`;
    img.setAttribute('src', record.emblem.imageUrl);
    img.setAttribute('alt', record.emblem.label || '');
    if (record.studio) img.setAttribute('data-studio-head', record.studio);
    body.appendChild(img);
  }
  if (record.title) {
    const title = make(doc, 'p', 'portal-title');
    record.title.split('\n').forEach((line, i) => {
      if (i) title.appendChild(doc.createElement('br'));
      title.appendChild(make(doc, 'span', null, line));
    });
    if (record.titleFont) title.style.fontFamily = `'${record.titleFont.replace(/'/g, '')}', sans-serif`;
    if (record.titleColor) title.style.color = record.titleColor;
    if (record.titleScale && record.titleScale !== 1) title.style.fontSize = `calc(var(--portal-title-size) * ${record.titleScale})`;
    body.appendChild(title);
  }
  if (record.doorsBelow) drawDoors();
  // The about line and the town: one block in the upper left corner, or
  // under the name.
  const corner = record.aboutCorner ? make(doc, 'div', 'portal-corner') : null;
  if (record.about) (corner || body).appendChild(make(doc, 'p', record.aboutCorner ? 'portal-about portal-about--corner' : 'portal-about', record.about));
  if (record.place) (corner || body).appendChild(make(doc, 'p', 'portal-place', record.place));
  if (corner && corner.children.length) page.appendChild(corner);
  if (record.mails.length || record.phone || record.whatsapp) {
    // Words sit in one row; addresses with purposes are two aligned columns
    // (purpose, address) so the gutter runs straight; bare addresses are
    // simply centred.
    const cls = record.mailsAs === 'words' ? (record.mailsCorners ? 'portal-mails portal-mails--words portal-mails--corners' : 'portal-mails portal-mails--words')
      : record.mails.some(m => m.purpose) ? 'portal-mails portal-mails--purposed' : 'portal-mails';
    const list = make(doc, 'div', cls);
    record.mails.forEach(m => {
      const row = make(doc, 'p', 'portal-mail');
      if (m.purpose) row.appendChild(make(doc, 'span', 'portal-mail-purpose', m.purpose));
      const a = make(doc, 'a', 'portal-mail-address', m.text);
      a.setAttribute('href', m.href || `mailto:${m.address}`);
      row.appendChild(a);
      list.appendChild(row);
    });
    if (record.phone) {
      const row = make(doc, 'p', 'portal-mail portal-phone');
      const a = make(doc, 'a', 'portal-mail-address', record.phone.text);
      a.setAttribute('href', record.phone.href);
      // A number reads left to right in every tongue.
      a.setAttribute('dir', 'ltr');
      row.appendChild(a);
      list.appendChild(row);
    }
    if (record.whatsapp) {
      const row = make(doc, 'p', 'portal-mail portal-whatsapp');
      const a = make(doc, 'a', 'portal-mail-address', record.whatsapp.text);
      a.setAttribute('href', record.whatsapp.href);
      a.setAttribute('dir', 'ltr');
      row.appendChild(a);
      list.appendChild(row);
    }
    (record.mailsCorners ? page : body).appendChild(list);
  }
  if (record.link) {
    const kind = record.link.corner ? 'portal-door portal-door--corner' : record.link.imageUrl ? 'portal-door portal-door--emblem' : 'portal-door portal-door--name';
    const a = make(doc, 'a', kind);
    a.setAttribute('href', record.link.href);
    if (record.link.imageUrl) {
      const img = make(doc, 'img', record.link.tone === 'light' ? 'portal-door-image portal-door-image--light' : 'portal-door-image');
      img.setAttribute('src', record.link.imageUrl);
      img.setAttribute('alt', record.link.label || '');
      a.appendChild(img);
    }
    // A corner door is its picture alone; the label is its alt.
    if (record.link.label && !record.link.corner) a.appendChild(make(doc, 'span', 'portal-door-label', record.link.label));
    (record.link.corner ? page : body).appendChild(a);
  }
  if (record.rotate) page.appendChild(make(doc, 'p', 'portal-rotate', record.rotate));
  if (record.copyright || record.site) page.appendChild(make(doc, 'p', 'portal-copyright', [record.site, record.copyright].filter(Boolean).join(' · ')));
  sheet.appendChild(page);
  return true;
}

// THE STUDIO'S SWITCH IS SEEN (Howell 2026-11-26, arrows drawn on his
// screenshot: "I would prefer the switch be animated, so the user can clearly
// see the loading of a new volume"; then, of the row: "should turn like a
// wheel"). One turn: the row's last picture rises to the head, the head's
// drops to the left end of the row, and every picture between slides one
// place right; each carries its word with it, the word growing into the name
// or shrinking into a caption. A picture further back is reached by as many
// turns as it stands from the row's end. The page is redrawn at once in its
// new order and every piece is then played from where it stood to where it
// now stands, so the motion ends exactly on the page as drawn.
//
// `studioPlaces` reads where each volume's picture and word stand;
// `playStudioSwitch` takes the places read BEFORE the redraw.
export function studioPlaces(sheet) {
  const places = new Map();
  if (!sheet || typeof sheet.querySelector !== 'function') return places;
  const box = el => (el && typeof el.getBoundingClientRect === 'function' ? el.getBoundingClientRect() : null);
  const head = sheet.querySelector('[data-studio-head]');
  if (head) places.set(head.getAttribute('data-studio-head'), { image: head, word: sheet.querySelector('.portal-title') });
  sheet.querySelectorAll('[data-studio-door]').forEach(a => {
    places.set(a.getAttribute('data-studio-door'), { image: a.querySelector('.portal-doors-image'), word: a.querySelector('.portal-doors-caption') });
  });
  for (const place of places.values()) { place.imageBox = box(place.image); place.wordBox = box(place.word); }
  return places;
}
export const STUDIO_SWITCH_MS = 520;
export function playStudioSwitch(sheet, before, ms = STUDIO_SWITCH_MS) {
  const after = studioPlaces(sheet);
  const moved = [];
  const from = (el, was, now) => {
    if (!el || !el.style || !was || !now || !now.width || !now.height) return;
    const dx = (was.left + was.width / 2) - (now.left + now.width / 2);
    const dy = (was.top + was.height / 2) - (now.top + now.height / 2);
    const scale = was.height / now.height;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && Math.abs(scale - 1) < 0.01) return;
    el.style.transition = 'none';
    el.style.transformOrigin = '50% 50%';
    el.style.transform = `translate(${dx}px, ${dy}px) scale(${scale})`;
    moved.push(el);
  };
  for (const [id, now] of after) {
    const was = before && before.get(id);
    if (!was) continue;
    from(now.image, was.imageBox, now.imageBox);
    from(now.word, was.wordBox, now.wordBox);
  }
  if (!moved.length) return 0;
  // The starting places are painted, then let go.
  void sheet.offsetWidth;
  const go = () => moved.forEach(el => { el.style.transition = `transform ${ms}ms cubic-bezier(0.3, 0, 0.2, 1)`; el.style.transform = ''; });
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => requestAnimationFrame(go)); else setTimeout(go, 0);
  setTimeout(() => moved.forEach(el => { el.style.transition = ''; el.style.transformOrigin = ''; }), ms + 120);
  return moved.length;
}

// A turn of several places in ONE motion (Howell 2026-11-26: "the
// intermediate icons should rotate around without stopping"). `stages` are the
// places read at each step of the turn, the first before anything moved; the
// sheet stands at the last. Each piece travels through every stage's place as
// one keyframed run, so it rounds the wheel rather than cutting across it.
export function playStudioTurn(sheet, stages, ms = STUDIO_SWITCH_MS) {
  const path = (stages || []).filter(Boolean);
  if (!path.length) return 0;
  const after = studioPlaces(sheet);
  let moved = 0;
  const run = (el, boxes, now) => {
    if (!el || !now || !now.width || !now.height) return;
    if (typeof el.animate !== 'function') return;
    let last = 'translate(0px, 0px) scale(1)';
    const frames = boxes.map(was => {
      if (was && was.height) {
        const dx = (was.left + was.width / 2) - (now.left + now.width / 2);
        const dy = (was.top + was.height / 2) - (now.top + now.height / 2);
        last = `translate(${dx}px, ${dy}px) scale(${was.height / now.height})`;
      }
      return { transform: last, transformOrigin: '50% 50%' };
    });
    frames.push({ transform: 'translate(0px, 0px) scale(1)', transformOrigin: '50% 50%' });
    if (frames.every(f => f.transform === frames[frames.length - 1].transform)) return;
    el.animate(frames, { duration: ms, easing: 'cubic-bezier(0.3, 0, 0.2, 1)' });
    moved += 1;
  };
  for (const [id, now] of after) {
    const seen = path.map(stage => stage.get(id) || null);
    if (!seen[0]) continue;
    run(now.image, seen.map(s => s && s.imageBox), now.imageBox);
    run(now.word, seen.map(s => s && s.wordBox), now.wordBox);
  }
  return moved;
}
