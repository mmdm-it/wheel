// WHERE THE APP STANDS AND WHERE ITS LEAF-AND-SHARD VOLUMES LIVE — the two
// tables a boot needs before it has loaded anything, kept in a file with no
// imports so the early loader (src/early.js, O-317) can read them without
// carrying the app. This is `volume-configs.js` continued: that file
// re-exports VENUES and reads WALL_ROOTS, and with it this is the only place
// that may name a site, a volume or a data root (H1).

// Three addresses, three audiences (O-211, Howell 2026-10-23, amended O-286).
// mmdm.it is the company's site, and its root is THE CALENDAR (went up
// 2026-11-10 on Howell's "I'm ready to go live"; the archival catalog that
// stood there until then lives on in git); the wheel-v3 directory on the same
// server is THE SCREENING ROOM, for friends and family — the LAN bench
// reached over the internet, serving the same tree; and bibliacatholica.com
// is LEICESTER SQUARE, the Bible's public door. THE DOORS: an address that
// boots one volume, standing alone. The longest matching prefix wins, so the
// room's two doors under /wheel-v3/ still win on the company's host.
export const VENUES = {
  screeningRoom: { hosts: ['mmdm.it', 'www.mmdm.it'], pathPrefix: '/wheel-v3/' },
  doors: [
    { hosts: ['mmdm.it', 'www.mmdm.it'], pathPrefix: '/wheel-v3/bible/', volume: 'bible' },
    { hosts: ['mmdm.it', 'www.mmdm.it'], pathPrefix: '/wheel-v3/calendar/', volume: 'calendar' },
    { hosts: ['mmdm.it', 'www.mmdm.it'], pathPrefix: '/', volume: 'calendar' },
    { hosts: ['bibliacatholica.com', 'www.bibliacatholica.com'], pathPrefix: '/', volume: 'bible' }
  ]
};

// The data root and data version of each leaf-and-shard volume. The version
// rides the path (H-11 item 4), so a push changes a path rather than the world.
// EACH ON A LINE OF ITS OWN, IN THIS SHAPE: the deploy filter and the room's
// mirror read the versions out of this file by pattern
// (scripts/deploy-pd-filter.mjs, scripts/mirror-room.sh).
const BIBLE_VOLUME_BASE = './data/gutenberg';
const BIBLE_VOLUME_VERSION = '2026.08.22'; // leaf-and-shard (O-92/W-129)
const CHURCH_VOLUME_BASE = './data/catechism';
const CHURCH_VOLUME_VERSION = '2026.11.13';
export const WALL_ROOTS = {
  bible: { base: BIBLE_VOLUME_BASE, version: BIBLE_VOLUME_VERSION },
  church: { base: CHURCH_VOLUME_BASE, version: CHURCH_VOLUME_VERSION }
};

// THE WORDS OF A LEAF-AND-SHARD VOLUME'S ADDRESS, for the early loader, which
// is engine-general and may not speak them (O-43): the parameters that name a
// place — an address carrying one opens where it says, and the app settles
// that — and the rings above the leaves a reader may have left the volume on,
// where no verse is opened at boot (O-294).
export const WALL_ADDRESS_KEYS = ['book', 'chapter', 'verse', 'utterance', 'item', 'level', 'testament'];
export const WALL_RINGS_ABOVE_THE_LEAF = ['testament', 'book', 'chapter'];
