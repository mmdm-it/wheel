#!/usr/bin/env node
// THE DOOR'S OWN HEAD (2026-11-10, the day the public doors opened). One
// index.html serves every door, and its static head — the title, the
// description, the link-preview tags, the canonical address — was the
// catalog's, written for the root of mmdm.it. The app retitles the tab once
// it runs, but a crawler, a share card and the tab before the bundle arrives
// read the static head, and Leicester Square must not introduce the Bible
// as a marine exhaust manifold. The room's mirror (scripts/mirror-room.sh)
// runs this for the public door and sends the stamped page in place of the
// tree's. The root of mmdm.it keeps the page's own head: it is that site's.
//
//   node scripts/stamp-door-head.mjs <door> <index.html> <out.html>
//
// The words are the session's draft for Howell's veto, like every other
// line a stranger reads.
import { readFileSync, writeFileSync } from 'node:fs';

export const HEADS = {
  public: {
    lang: 'la',
    title: 'Biblia Catholica',
    description: 'Biblia Catholica — a free reader of the Bible in Hebrew, Greek, Latin and the languages of the world. No advertising.',
    siteName: 'Biblia Catholica',
    url: 'https://bibliacatholica.com/',
    // The body's static words too: what a crawler reads with no script, and
    // the desktop gate — the one page a visitor at a desk sees, which named
    // the catalog, carried its QR and gave its address. The door has a QR
    // of its own (GATE_QR) and says its two lines in the visitor's tongue
    // (GATE_WORDS), O-321.
    noscript: '<h1>Biblia Catholica</h1>\n    <p>A free reader of the Bible in Hebrew, Greek, Latin and the languages of the world. Made for the phone. No advertising.</p>',
    gate: {
      title: 'BIBLIA CATHOLICA',
      // What it is, before what to do (Howell 2026-11-20, asking whether
      // the card was too blunt for a first visitor at a desk; the line is
      // his: "A free reader of the Bible and the Roman Catholic Catechism").
      about: 'A free reader of the Bible and the Roman Catholic Catechism',
      text: 'MADE FOR THE PHONE',
      sub: 'Scan the code with your phone to open it',
      mail: 'info@bibliacatholica.com',
      // The volume's own ground, the page's `wheel:ground` sepia, under the
      // card and under the code alike (Howell 2026-11-20, seeing the first
      // one on the catalog's gray with a white square on it: "The
      // background should be sepia rather than gray, and the QR code should
      // have a matching background").
      ground: '#d4a574'
    }
  }
};

// THE DOOR'S OWN QR (O-321, Howell 2026-11-20, at his laptop before the
// first letter went out: "we don't have a QR code for the desktop greeting
// page"). https://bibliacatholica.com/ at error level M, drawn as one path
// in the page itself: no file to fetch, and square at any size. Made with
// qrcode-generator and read back with jsQR before it was pasted here; a
// change of address means making it again, and the test reads the address
// in its label only, so decode it before trusting it.
export const GATE_QR = '<svg class="desktop-gate-qr" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 37 37" shape-rendering="crispEdges" role="img" aria-label="QR: bibliacatholica.com"><rect width="37" height="37" fill="#fff"/><path d="M4 4h7v1h-7zM12 4h3v1h-3zM19 4h4v1h-4zM26 4h7v1h-7zM4 5h1v1h-1zM10 5h1v1h-1zM12 5h1v1h-1zM16 5h1v1h-1zM20 5h1v1h-1zM22 5h2v1h-2zM26 5h1v1h-1zM32 5h1v1h-1zM4 6h1v1h-1zM6 6h3v1h-3zM10 6h1v1h-1zM12 6h2v1h-2zM16 6h1v1h-1zM19 6h2v1h-2zM26 6h1v1h-1zM28 6h3v1h-3zM32 6h1v1h-1zM4 7h1v1h-1zM6 7h3v1h-3zM10 7h1v1h-1zM16 7h1v1h-1zM20 7h3v1h-3zM24 7h1v1h-1zM26 7h1v1h-1zM28 7h3v1h-3zM32 7h1v1h-1zM4 8h1v1h-1zM6 8h3v1h-3zM10 8h1v1h-1zM12 8h4v1h-4zM18 8h3v1h-3zM22 8h2v1h-2zM26 8h1v1h-1zM28 8h3v1h-3zM32 8h1v1h-1zM4 9h1v1h-1zM10 9h1v1h-1zM15 9h2v1h-2zM19 9h2v1h-2zM24 9h1v1h-1zM26 9h1v1h-1zM32 9h1v1h-1zM4 10h7v1h-7zM12 10h1v1h-1zM14 10h1v1h-1zM16 10h1v1h-1zM18 10h1v1h-1zM20 10h1v1h-1zM22 10h1v1h-1zM24 10h1v1h-1zM26 10h7v1h-7zM13 11h1v1h-1zM17 11h1v1h-1zM19 11h2v1h-2zM22 11h3v1h-3zM4 12h1v1h-1zM7 12h11v1h-11zM21 12h1v1h-1zM25 12h1v1h-1zM28 12h1v1h-1zM30 12h3v1h-3zM6 13h1v1h-1zM14 13h4v1h-4zM20 13h1v1h-1zM22 13h2v1h-2zM27 13h2v1h-2zM30 13h2v1h-2zM4 14h1v1h-1zM8 14h1v1h-1zM10 14h3v1h-3zM15 14h1v1h-1zM17 14h1v1h-1zM19 14h2v1h-2zM22 14h1v1h-1zM24 14h5v1h-5zM30 14h1v1h-1zM4 15h1v1h-1zM6 15h2v1h-2zM9 15h1v1h-1zM13 15h3v1h-3zM17 15h1v1h-1zM20 15h2v1h-2zM24 15h3v1h-3zM29 15h1v1h-1zM32 15h1v1h-1zM5 16h6v1h-6zM12 16h2v1h-2zM15 16h3v1h-3zM19 16h2v1h-2zM24 16h1v1h-1zM26 16h2v1h-2zM32 16h1v1h-1zM4 17h1v1h-1zM11 17h2v1h-2zM14 17h1v1h-1zM17 17h2v1h-2zM20 17h3v1h-3zM26 17h7v1h-7zM4 18h1v1h-1zM6 18h3v1h-3zM10 18h1v1h-1zM12 18h2v1h-2zM15 18h1v1h-1zM17 18h1v1h-1zM20 18h2v1h-2zM23 18h4v1h-4zM30 18h1v1h-1zM32 18h1v1h-1zM5 19h1v1h-1zM12 19h1v1h-1zM14 19h1v1h-1zM16 19h1v1h-1zM19 19h1v1h-1zM23 19h1v1h-1zM25 19h2v1h-2zM28 19h1v1h-1zM30 19h1v1h-1zM32 19h1v1h-1zM7 20h4v1h-4zM12 20h1v1h-1zM14 20h1v1h-1zM18 20h1v1h-1zM20 20h1v1h-1zM23 20h2v1h-2zM27 20h1v1h-1zM29 20h1v1h-1zM4 21h2v1h-2zM8 21h2v1h-2zM13 21h1v1h-1zM17 21h2v1h-2zM20 21h1v1h-1zM22 21h3v1h-3zM28 21h1v1h-1zM30 21h2v1h-2zM4 22h2v1h-2zM7 22h4v1h-4zM13 22h1v1h-1zM16 22h1v1h-1zM19 22h1v1h-1zM21 22h1v1h-1zM23 22h4v1h-4zM28 22h2v1h-2zM32 22h1v1h-1zM4 23h2v1h-2zM11 23h1v1h-1zM13 23h1v1h-1zM16 23h1v1h-1zM18 23h1v1h-1zM23 23h4v1h-4zM29 23h2v1h-2zM4 24h4v1h-4zM9 24h3v1h-3zM13 24h2v1h-2zM16 24h7v1h-7zM24 24h8v1h-8zM12 25h1v1h-1zM18 25h1v1h-1zM21 25h2v1h-2zM24 25h1v1h-1zM28 25h2v1h-2zM4 26h7v1h-7zM12 26h2v1h-2zM15 26h1v1h-1zM18 26h1v1h-1zM23 26h2v1h-2zM26 26h1v1h-1zM28 26h2v1h-2zM4 27h1v1h-1zM10 27h1v1h-1zM12 27h5v1h-5zM18 27h2v1h-2zM21 27h1v1h-1zM23 27h2v1h-2zM28 27h1v1h-1zM32 27h1v1h-1zM4 28h1v1h-1zM6 28h3v1h-3zM10 28h1v1h-1zM12 28h1v1h-1zM16 28h3v1h-3zM21 28h9v1h-9zM4 29h1v1h-1zM6 29h3v1h-3zM10 29h1v1h-1zM12 29h1v1h-1zM14 29h4v1h-4zM21 29h5v1h-5zM31 29h1v1h-1zM4 30h1v1h-1zM6 30h3v1h-3zM10 30h1v1h-1zM13 30h2v1h-2zM16 30h2v1h-2zM19 30h1v1h-1zM21 30h1v1h-1zM25 30h1v1h-1zM27 30h2v1h-2zM30 30h3v1h-3zM4 31h1v1h-1zM10 31h1v1h-1zM14 31h3v1h-3zM20 31h4v1h-4zM26 31h1v1h-1zM29 31h2v1h-2zM32 31h1v1h-1zM4 32h7v1h-7zM12 32h1v1h-1zM14 32h3v1h-3zM18 32h2v1h-2zM21 32h1v1h-1zM23 32h2v1h-2zM27 32h2v1h-2z"/></svg>';

// THE GATE IN THE VISITOR'S TONGUE (O-321: "I also want to confirm that
// that page updates in whatever local language it needs to" — it did not;
// it was English alone). The page's static words stay English, for a
// crawler and a browser with no script; a few lines of script beside the
// gate then say the two lines in the first of the browser's languages
// this table knows. The name is the name in every tongue. [what it is,
// made for the phone, scan to open it, right-to-left]. Drafts for Howell's veto.
export const GATE_WORDS = {
  it: ['Un lettore gratuito della Bibbia e del Catechismo cattolico romano', 'FATTO PER IL TELEFONO', 'Inquadra il codice con il telefono per aprirlo'],
  fr: ['Un lecteur gratuit de la Bible et du Catéchisme catholique romain', 'CONÇU POUR LE TÉLÉPHONE', 'Scannez le code avec votre téléphone pour l’ouvrir'],
  es: ['Un lector gratuito de la Biblia y del Catecismo católico romano', 'HECHO PARA EL TELÉFONO', 'Escanea el código con tu teléfono para abrirlo'],
  pt: ['Um leitor gratuito da Bíblia e do Catecismo católico romano', 'FEITO PARA O TELEFONE', 'Leia o código com o telefone para o abrir'],
  de: ['Ein kostenloses Leseprogramm für die Bibel und den römisch-katholischen Katechismus', 'FÜR DAS HANDY GEMACHT', 'Scannen Sie den Code mit Ihrem Handy, um es zu öffnen'],
  fi: ['Maksuton Raamatun ja roomalaiskatolisen katekismuksen lukusovellus', 'TEHTY PUHELIMELLE', 'Avaa se skannaamalla koodi puhelimellasi'],
  sv: ['En kostnadsfri läsare för Bibeln och den romersk-katolska katekesen', 'GJORD FÖR MOBILEN', 'Skanna koden med mobilen för att öppna den'],
  ru: ['Бесплатное приложение для чтения Библии и римско-католического катехизиса', 'СОЗДАНО ДЛЯ ТЕЛЕФОНА', 'Отсканируйте код телефоном, чтобы открыть его'],
  uk: ['Безкоштовний застосунок для читання Біблії та римо-католицького катехизму', 'СТВОРЕНО ДЛЯ ТЕЛЕФОНУ', 'Відскануйте код телефоном, щоб відкрити його'],
  pl: ['Bezpłatna aplikacja do czytania Biblii i katechizmu rzymskokatolickiego', 'STWORZONA Z MYŚLĄ O TELEFONIE', 'Zeskanuj kod telefonem, aby ją otworzyć'],
  hr: ['Besplatan čitač Biblije i rimokatoličkog katekizma', 'NAPRAVLJEN ZA MOBITEL', 'Skenirajte kôd mobitelom da ga otvorite'],
  hu: ['Ingyenes olvasó a Bibliához és a római katolikus katekizmushoz', 'TELEFONRA KÉSZÜLT', 'A megnyitásához olvassa be a kódot a telefonjával'],
  el: ['Δωρεάν εφαρμογή ανάγνωσης της Βίβλου και της Ρωμαιοκαθολικής Κατήχησης', 'ΦΤΙΑΓΜΕΝΗ ΓΙΑ ΤΟ ΚΙΝΗΤΟ', 'Σαρώστε τον κωδικό με το κινητό σας για να την ανοίξετε'],
  tr: ['Kutsal Kitap ve Roma Katolik İlmihali için ücretsiz bir okuyucu', 'TELEFON İÇİN YAPILDI', 'Açmak için kodu telefonunuzla tarayın'],
  tl: ['Isang libreng pambasa ng Bibliya at ng Katesismong Katoliko Romano', 'GINAWA PARA SA TELEPONO', 'I-scan ang code gamit ang iyong telepono upang buksan ito'],
  ar: ['قارئ مجاني للكتاب المقدس والتعليم المسيحي للكنيسة الرومانية الكاثوليكية', 'مصمَّم للهاتف', 'امسح الرمز بهاتفك لفتحه', 1],
  he: ['קורא חינמי של כתבי הקודש ושל הקטכיזם הרומי-קתולי', 'נבנה לטלפון', 'סרקו את הקוד בטלפון כדי לפתוח אותו', 1]
};
// English is the page's own; a visitor whose first language it is keeps it.
export const gateScript = words => `<script id="wheel:gate-words">(function () {
    try {
      var W = ${JSON.stringify(words)};
      var ls = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ''];
      for (var i = 0; i < ls.length; i++) {
        var k = String(ls[i]).toLowerCase().split('-')[0], w = W[k];
        if (k === 'en') return;
        if (!w) continue;
        var g = document.getElementById('desktop-gate');
        var lines = ['.desktop-gate-about', '.desktop-gate-text', '.desktop-gate-sub'];
        for (var n = 0; n < lines.length; n++) {
          var el = g.querySelector(lines[n]);
          el.textContent = w[n];
          if (w[3]) el.setAttribute('dir', 'rtl');
        }
        g.setAttribute('lang', k);
        return;
      }
    } catch (_) { /* the English stands */ }
  })();</script>`;

// What the stamped page may not still say: the catalog's name, its mark,
// its wares, its mail, or the catalog's address as this page's own.
export const MUST_NOT_SAY = /Meccanismi|MMdM|collettor|info@mmdm\.it|content="https:\/\/mmdm\.it\/"|href="https:\/\/mmdm\.it\/"|alt="[^"]*mmdm\.it/;

export function stampHead(html, door) {
  const h = HEADS[door];
  if (!h) return html;
  const esc = s => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  const out = html
    .replace(/<noscript>[\s\S]*?<\/noscript>/, `<noscript>\n    ${h.noscript}\n  </noscript>`)
    .replace(/(<div id="copyright-notice"[^>]*>)[\s\S]*?(<\/div>)/, '$1$2')
    .replace(/<p class="desktop-gate-title">[^<]*<\/p>/, `<p class="desktop-gate-title">${h.gate.title}</p>\n    <p class="desktop-gate-about">${h.gate.about}</p>`)
    .replace(/<img class="desktop-gate-qr"[^>]*\/>/, () => GATE_QR.replace('fill="#fff"', `fill="${h.gate.ground}"`))
    .replace(/<div id="desktop-gate"/, `<div id="desktop-gate" style="background: ${h.gate.ground}"`)
    .replace(/<p class="desktop-gate-text">[^<]*<\/p>/, `<p class="desktop-gate-text">${h.gate.text}</p>`)
    .replace(/<p class="desktop-gate-sub">[^<]*<\/p>/, `<p class="desktop-gate-sub">${h.gate.sub}</p>`)
    .replace(/<p class="desktop-gate-mail"><a href="mailto:[^"]*">[^<]*<\/a><\/p>/, () => `<p class="desktop-gate-mail"><a href="mailto:${h.gate.mail}">${h.gate.mail}</a></p>`)
    .replace(/(<div id="desktop-gate"[\s\S]*?<\/div>)/, (m) => `${m}\n  ${gateScript(GATE_WORDS)}`)
    .replace(/<html lang="[^"]*"/, `<html lang="${h.lang}"`)
    .replace(/<title>[^<]*<\/title>/, `<title>${h.title}</title>`)
    .replace(/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${esc(h.description)}" />`)
    .replace(/\n\s*<meta name="keywords" content="[^"]*" \/>/, '')
    .replace(/\n\s*<meta name="author" content="[^"]*" \/>/, '')
    .replace(/<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${h.url}" />`)
    .replace(/<meta property="og:site_name" content="[^"]*" \/>/, `<meta property="og:site_name" content="${esc(h.siteName)}" />`)
    .replace(/<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${esc(h.title)}" />`)
    .replace(/<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${esc(h.description)}" />`)
    .replace(/<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${h.url}" />`)
    .replace(/\n\s*<meta property="og:locale(?::alternate)?" content="[^"]*" \/>/g, '');
  const said = MUST_NOT_SAY.exec(out);
  if (said) throw new Error(`stamp-door-head: the ${door} door's page still says "${said[0]}"`);
  return out;
}

if (process.argv[1] && /stamp-door-head\.mjs$/.test(process.argv[1])) {
  const [door, inPath, outPath] = process.argv.slice(2);
  if (!door || !inPath || !outPath) { console.error('usage: node scripts/stamp-door-head.mjs <door> <index.html> <out.html>'); process.exit(1); }
  if (!HEADS[door]) { console.error(`stamp-door-head: no head for the "${door}" door`); process.exit(1); }
  writeFileSync(outPath, stampHead(readFileSync(inPath, 'utf8'), door));
  console.log(`stamp-door-head: ${door} → ${outPath} (${HEADS[door].title})`);
}
