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
import { doorHref, isOnLan, isScreeningRoom } from '../core/lan-gate.js';
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
 *   phone    { number } — a telephone beside the mail words (the volume's
 *            own number, under display_config.landscape.phone, wins)
 *   titleOneLine  true — the card's name on one line
 *   aboutCorner   true — the about line in the upper left corner, in capitals
 *   a mail's `subject: true` pre-composes its email with `subject` — the
 *            reader's place as main.js names it (Howell 2026-11-01: a
 *            correction is only useful if it says where the mistake is)
 */
export function portalRecord({ volume, config, root, lang = null, loc, table, subject = null, copyright = null } = {}) {
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
  const emblem = emblemName && config?.assetBase ? { imageUrl: `${config.assetBase}${base}${emblemName}.png`, label: decl.emblem?.label || '' } : null;
  // What the business is, in the reader's tongue (the volume's words).
  const about = decl.about ? pick(words?.[decl.about], lang) : null;
  // The telephone sits beside the mail words, written as the volume writes
  // it. The number is the corpus's (display_config.landscape.phone), so it
  // travels only with the private data and reaches the public tree never;
  // nothing is drawn until one is set.
  const phoneRaw = typeof words?.phone?.number === 'string' ? words.phone.number : decl.phone?.number;
  const phoneText = typeof phoneRaw === 'string' ? phoneRaw.trim() : '';
  const phone = phoneText && telHref(phoneText) ? { href: telHref(phoneText), text: phoneText } : null;
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
  return {
    volume,
    emblem,
    // `titleOneLine`: the card's name set on one line (Howell 2026-11-02, the
    // company's page: "all on one line").
    title: decl.titleOneLine === true ? String(splash.title || config?.documentTitle || '').split('\n').map(t => t.trim()).filter(Boolean).join(' ') : (splash.title || config?.documentTitle || ''),
    titleFont: splash.font || null,
    titleColor: splash.color || null,
    // The name's size against the page's standard (Howell 2026-11-01, on the
    // minimum page: "Make the name ... 2.5 times larger").
    titleScale: Number.isFinite(Number(decl.titleScale)) && Number(decl.titleScale) > 0 ? Number(decl.titleScale) : 1,
    mailsAs: asWords ? 'words' : 'addresses',
    mails,
    phone,
    about: typeof about === 'string' && about.trim() ? about.trim() : null,
    // `aboutCorner`: the line sits in the upper left corner, in capitals,
    // instead of under the name (Howell 2026-11-02, drawn on his screenshot).
    aboutCorner: decl.aboutCorner === true,
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
  sheet.setAttribute('dir', record.dir);
  sheet.setAttribute('data-volume', record.volume);
  // The sheet was a picture of a turning phone, hidden from assistive
  // readers; now it carries links, so it is a page like any other.
  sheet.removeAttribute('aria-hidden');
  sheet.classList.add('landscape-portal');

  const page = make(doc, 'div', record.emblem ? 'portal-page portal-page--emblem' : 'portal-page');
  // The body sits centred in the height; the turn-it-upright line alone is
  // pinned to the foot (the first photographs had the body hugging the top
  // with a bare band above the line).
  const body = make(doc, 'div', 'portal-body');
  if (record.lift) body.style.transform = `translateY(-${record.lift}vmin)`;
  page.appendChild(body);
  if (record.emblem) {
    const img = make(doc, 'img', 'portal-emblem');
    img.setAttribute('src', record.emblem.imageUrl);
    img.setAttribute('alt', record.emblem.label || '');
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
  if (record.about) {
    const line = make(doc, 'p', record.aboutCorner ? 'portal-about portal-about--corner' : 'portal-about', record.about);
    (record.aboutCorner ? page : body).appendChild(line);
  }
  if (record.mails.length || record.phone) {
    // Words sit in one row; addresses with purposes are two aligned columns
    // (purpose, address) so the gutter runs straight; bare addresses are
    // simply centred.
    const cls = record.mailsAs === 'words' ? 'portal-mails portal-mails--words'
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
    body.appendChild(list);
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
  if (record.copyright) page.appendChild(make(doc, 'p', 'portal-copyright', record.copyright));
  sheet.appendChild(page);
  return true;
}
