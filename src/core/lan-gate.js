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

// IS THE PROOFREAD FLAG LIFTED? ONE implementation, here beside the LAN test
// it depends on (H-25 point 4's carry-out, 2026-08-15).
//
// This lived inline in dimension-bridge, whose own comment warns that "two
// implementations of one question is how they drift apart" — about the LAN
// test, which had already drifted once and shipped a prefix match that
// `127.evil.com` satisfied. The flag now has a second consumer, because it
// decides which UNITS exist and not merely whether a banner shows, so it gets
// the same treatment before there are two of it rather than after.
//
// WHAT THE FLAG IS (Howell, 2026-08-15): a development instrument, used on the
// LAN while an edition is being proofread. Without it the reader sees only
// what has been confirmed. With it, everything KNOWN appears, and the NOT
// PROOFREAD mark says which parts are not confirmed. It is not expected to do
// anything on the web at all — only complete, fully-proofread editions are
// uploaded, so on a public host there is nothing for it to lift.
// THE PARAMETER IS MISNAMED, AND KNOWINGLY SO (Howell, 2026-08-15: "something
// of a misnomer... but I can live with it"). `?proofread=true` READS as "show
// me only what is proofread" and MEANS the opposite — "show me the material
// that is not proofread yet". The honest spelling would be
// `not_proofread_visible=true`.
//
// It is not renamed because one person types it, on a LAN, and it appears in
// no link anyone else follows: the cost of changing it exceeds the cost of
// knowing. But it is recorded HERE, at the one place the parameter is read,
// because a name that asserts the opposite of its effect is exactly how a
// later reader reasons confidently to the wrong conclusion — which is the
// failure this codebase spent two days cataloguing. Everything downstream is
// named for what it does: `proofreadOverrideActive`, `includeUnconfirmed`.
export function proofreadOverrideActive(loc = (typeof window !== 'undefined' ? window.location : null)) {
  try {
    if (!loc || typeof loc.search !== 'string') return false;
    if (!isOnLan(loc)) return false;
    return new URLSearchParams(loc.search).get('proofread') === 'true';
  } catch (_) { return false; }
}

/**
 * IS THIS A PROOFREADER ASKING FOR ONE EXACT POSITION? (O-122, Howell
 * 2026-08-31: "38 seconds is far too much time to waste loading a page. We
 * must find a way to bypass the Tertiary and Secondary Strata while
 * proofreading, and instead go directly to a verse in the Primary Stratum.")
 *
 * True only when the LAN override is on AND the address carries every
 * parameter the CALLER names — a shape no reader's URL ever has and only the
 * proofreading driver produces. The boot funnel is skipped for it, and the
 * edition may be named outright, so a driven pass lands on the text instead
 * of walking three planes to reach it.
 *
 * THE KEYS COME FROM THE CALLER, and that is not fastidiousness: this file is
 * engine core, and O-43 forbids core from speaking any volume's level names.
 * A gate that knew what a volume calls its divisions would be a gate with an
 * opinion about one volume, which is the thing the wall exists to prevent.
 *
 * It rides the same gate as the override, deliberately: off the LAN, or
 * without the flag, this is false however the address is shaped. The funnel
 * is a stranger's introduction (Howell's ruling of 2026-07-30, "two quick
 * taps") and that ruling is untouched — this is scaffolding for the bench,
 * and a reader never meets it.
 */
export function proofreadDeepLink(loc = (typeof window !== 'undefined' ? window.location : null), keys = null) {
  try {
    if (!proofreadOverrideActive(loc)) return false;
    if (!Array.isArray(keys) || !keys.length) return false;
    const p = new URLSearchParams(loc.search);
    return keys.every(k => Boolean(p.get(k)));
  } catch (_) { return false; }
}
