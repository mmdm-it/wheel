// The LAN gate. Every cell that matters is about a FALSE YES, because that is
// the failure with no natural discoverer: a false NO means Howell's phone shows
// nothing and he says so within a minute.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isPrivateHost, isOnLan, proofreadDeepLink } from '../src/core/lan-gate.js';

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
