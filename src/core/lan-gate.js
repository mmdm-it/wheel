// THE LAN GATE (phase 1a, Howell 2026-08-11) — one job, and it fails CLOSED.
//
// Phase 1a's fixture is scaffolding: it proves the migration renders before a
// single real unit has been re-cut. It must be reachable from Howell's phone
// on the house network and reachable from nowhere else, so a dev route that
// leaks onto the public deployment is not a smaller problem than no route.
//
// FAILS CLOSED, and that is the whole design. Anything this cannot positively
// recognise as a private address is treated as public: an unknown hostname, a
// missing location, a shape it has never seen. The failure it must never have
// is a false YES, because a false NO merely means Howell's phone shows nothing
// and he says so within a minute, while a false YES is scaffolding served to
// the internet and nobody finds out.
//
// It answers exactly one question and holds no policy about what the caller
// then does. A gate that also decided what to serve would be two things, and
// the second would be the one nobody tested.

// RFC 1918 private ranges, plus loopback and the .local mDNS suffix. Deliberately
// NOT a general "is this a private network" library: this is the house, its
// phones, and a laptop, and a narrow list is auditable at a glance where a
// clever one is not.
const PRIVATE_V4 = [
  /^10\./,                       // 10.0.0.0/8
  /^192\.168\./,                 // 192.168.0.0/16
  /^172\.(1[6-9]|2\d|3[01])\./   // 172.16.0.0/12 — the range people get wrong
];

export function isPrivateHost(hostname) {
  if (typeof hostname !== 'string' || !hostname) return false;
  const host = hostname.trim().toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return true;
  if (host.endsWith('.local')) return true;             // mDNS, the house's own names
  if (PRIVATE_V4.some(re => re.test(host))) {
    // Only if it is actually a dotted quad: "10.example.com" starts with "10."
    // and is a public host. The prefix test alone would have said yes.
    return /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
  }
  return false;
}

export function isOnLan(loc = (typeof window !== 'undefined' ? window.location : null)) {
  if (!loc || typeof loc.hostname !== 'string') return false;   // no location: assume public
  return isPrivateHost(loc.hostname);
}
