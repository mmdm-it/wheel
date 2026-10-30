// The LAN gate. Every cell that matters is about a FALSE YES, because that is
// the failure with no natural discoverer: a false NO means Howell's phone shows
// nothing and he says so within a minute.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { unclearedActive, isPrivateHost, isOnLan, proofreadDeepLink, proofreadOverrideActive } from '../src/core/lan-gate.js';

describe('lan-gate — the house', () => {
  it('recognises the private ranges and loopback', () => {
    for (const h of ['192.168.88.167', '10.0.0.4', '172.16.5.9', '172.31.255.255',
                     'localhost', '127.0.0.1', '::1', 'wheel.local']) {
      assert.equal(isPrivateHost(h), true, `${h} should be private`);
    }
  });

  it('handles the 172 range people get wrong at BOTH edges', () => {
    assert.equal(isPrivateHost('172.16.0.1'), true, '172.16 is the first private block');
    assert.equal(isPrivateHost('172.31.0.1'), true, '172.31 is the last');
    assert.equal(isPrivateHost('172.15.0.1'), false, '172.15 is PUBLIC');
    assert.equal(isPrivateHost('172.32.0.1'), false, '172.32 is PUBLIC');
  });
});

describe('lan-gate — it fails CLOSED, which is the whole design', () => {
  it('a public host that STARTS like a private one is public', () => {
    // The bug a bare prefix test would have: these are real public hostnames.
    assert.equal(isPrivateHost('10.example.com'), false);
    assert.equal(isPrivateHost('192.168.evil.tld'), false);
    assert.equal(isPrivateHost('mmdm.it'), false);
    assert.equal(isPrivateHost('bibliacatholica.com'), false);
  });

  it('anything it cannot recognise is treated as public', () => {
    for (const h of ['', null, undefined, 0, {}, 'localhost.evil.tld', '127.0.0.1.evil.tld']) {
      assert.equal(isPrivateHost(h), false, `${JSON.stringify(h)} must not pass`);
    }
  });

  it('NO LOCATION AT ALL is public, not private', () => {
    // The tempting default is "we are probably in a test, so allow it". That
    // is a false yes with no discoverer.
    assert.equal(isOnLan(null), false);
    assert.equal(isOnLan(undefined), false);
    assert.equal(isOnLan({}), false);
  });

  it('reads the hostname it is given, and nothing ambient', () => {
    assert.equal(isOnLan({ hostname: '192.168.88.167' }), true);
    assert.equal(isOnLan({ hostname: 'mmdm.it' }), false);
  });
});

describe('the proofread deep link, and the null that defeated it (O-122)', () => {
  const LOC = { hostname: '192.168.88.167', search: '?proofread=true&book=b1&chapter=50&verse=26' };
  const KEYS = ['book', 'chapter', 'verse'];

  it('is true for a fully named address under the override', () => {
    assert.equal(proofreadDeepLink(KEYS, LOC), true);
  });

  it('is false off the LAN however the address is shaped', () => {
    assert.equal(proofreadDeepLink(KEYS, { ...LOC, hostname: 'bibliacatholica.com' }), false);
  });

  it('is false without every key the caller names', () => {
    assert.equal(proofreadDeepLink(KEYS, { ...LOC, search: '?proofread=true&book=b1' }), false);
  });

  it('is false when the caller names no keys — the engine has no volume vocabulary of its own', () => {
    assert.equal(proofreadDeepLink(undefined, LOC), false);
    assert.equal(proofreadDeepLink([], LOC), false);
  });

  it('takes its keys FIRST, which is the whole of the bug this cell remembers', () => {
    // The keys used to come second, after an optional location, and the caller
    // passed `null` for the location meaning "use the default". A default
    // parameter applies to `undefined` ALONE, so the gate read a null location,
    // answered false, and the bypass never fired — invisibly, because the
    // caller walked the funnel as a fallback and the drive still worked.
    // Calling with one argument must therefore work, and mean the keys.
    assert.equal(typeof proofreadDeepLink(KEYS), 'boolean');
  });
});

// THE SCREENING ROOM IS THE LAN (O-137): under wheel-v3 on mmdm.it the gate
// answers as it does in the house; the root of the same server (the archival
// backup) and Leicester Square stay public. Every cell that matters is again
// a FALSE YES.
import { declareVenues, doorVolume, isScreeningRoom } from '../src/core/lan-gate.js';
import { VENUES } from '../src/volume-configs.js';
const at = (hostname, pathname, search = '') => ({ hostname, pathname, search });
describe('lan-gate — the screening room (O-137)', () => {
  it('is the wheel-v3 directory on mmdm.it, and nothing else on that server', () => {
    declareVenues(VENUES);
    assert.equal(isScreeningRoom(at('mmdm.it', '/wheel-v3/bible/')), true);
    assert.equal(isScreeningRoom(at('www.mmdm.it', '/wheel-v3/calendar/')), true);
    assert.equal(isScreeningRoom(at('MMDM.IT', '/Wheel-V3/bible/')), true, 'case is not a distinction');
    assert.equal(isScreeningRoom(at('mmdm.it', '/')), false, 'the root is the archival backup');
    assert.equal(isScreeningRoom(at('mmdm.it', '/wheel-v3')), false, 'the directory, not a name that starts like it');
  });
  it('Leicester Square and look-alikes are not the room', () => {
    declareVenues(VENUES);
    assert.equal(isScreeningRoom(at('bibliacatholica.com', '/wheel-v3/bible/')), false);
    assert.equal(isScreeningRoom(at('mmdm.it.evil.com', '/wheel-v3/bible/')), false);
    assert.equal(isScreeningRoom(at('notmmdm.it', '/wheel-v3/bible/')), false);
    assert.equal(isScreeningRoom(null), false);
    assert.equal(isScreeningRoom({ hostname: 'mmdm.it' }), false, 'no path, no room');
    assert.equal(isScreeningRoom(at('mmdm.it', '/wheel-v3/bible/'), null), false, 'no venue table, no room');
  });
  it('the room IS the LAN for the bench; the ?proofread flag is retired (O-229); ?uncleared answers on a private address only (O-231)', () => {
    declareVenues(VENUES);
    assert.equal(isOnLan(at('mmdm.it', '/wheel-v3/bible/')), true);
    assert.equal(proofreadOverrideActive(at('mmdm.it', '/wheel-v3/bible/', '?proofread=true')), false, 'O-229: the CHECKED gate is open; the flag lifts nothing');
    assert.equal(unclearedActive(at('192.168.88.167', '/', '?uncleared=true')), true, 'the LAN, with the flag');
    assert.equal(unclearedActive(at('192.168.88.167', '/')), false, 'the LAN, without it');
    assert.equal(unclearedActive(at('mmdm.it', '/wheel-v3/bible/', '?uncleared=true')), false, '"No uncleared edition should ever leave the LAN" — not even the room');
    assert.equal(unclearedActive(at('bibliacatholica.com', '/', '?uncleared=true')), false, 'and never Leicester Square');
    declareVenues(null);
    assert.equal(isOnLan(at('mmdm.it', '/wheel-v3/bible/')), false, 'with no venue declared the room is public — it fails closed');
    declareVenues(VENUES);
  });
});

// THE DOORS (O-211): an address boots one volume, standing alone. The room
// has two; Leicester Square's Bible answers at its own domain, where the
// path is a bare slash and only the address can choose.
describe('lan-gate — the doors (O-211)', () => {
  it('each door names its volume, the longest prefix winning', () => {
    declareVenues(VENUES);
    assert.equal(doorVolume(at('mmdm.it', '/wheel-v3/bible/')), 'bible');
    assert.equal(doorVolume(at('www.mmdm.it', '/wheel-v3/calendar/')), 'calendar');
    assert.equal(doorVolume(at('MMDM.IT', '/Wheel-V3/Calendar/index.html')), 'calendar', 'case and the page name are no distinction');
    assert.equal(doorVolume(at('bibliacatholica.com', '/')), 'bible', 'Leicester Square: the address alone chooses');
    assert.equal(doorVolume(at('www.bibliacatholica.com', '/index.html?level=book')), 'bible');
  });
  it('no door, no answer: the root of mmdm.it, the bench, look-alikes, no table', () => {
    declareVenues(VENUES);
    assert.equal(doorVolume(at('mmdm.it', '/')), null, 'the root is the archival backup until the calendar goes up');
    assert.equal(doorVolume(at('mmdm.it', '/wheel-v3/')), null, 'the directory above the doors is not a door');
    assert.equal(doorVolume(at('mmdm.it', '/wheel-v3/places/')), null);
    assert.equal(doorVolume(at('127.0.0.1', '/index.html')), null, 'the bench chooses by parameter or path');
    assert.equal(doorVolume(at('bibliacatholica.com.evil.com', '/')), null);
    assert.equal(doorVolume(null), null);
    assert.equal(doorVolume(at('mmdm.it', '/wheel-v3/bible/'), null), null, 'no venue table, no door');
    assert.equal(doorVolume(at('mmdm.it', '/wheel-v3/bible/'), { doors: [{ hosts: ['mmdm.it'], pathPrefix: '/wheel-v3/bible/' }] }), null, 'a door with no volume is no door');
  });
  it('a door with the longer prefix beats a domain-wide one', () => {
    const table = { doors: [
      { hosts: ['x.it'], pathPrefix: '/', volume: 'calendar' },
      { hosts: ['x.it'], pathPrefix: '/bible/', volume: 'bible' }
    ] };
    assert.equal(doorVolume(at('x.it', '/bible/'), table), 'bible');
    assert.equal(doorVolume(at('x.it', '/'), table), 'calendar');
    assert.equal(doorVolume(at('x.it', '/calendar/'), table), 'calendar');
  });
});
