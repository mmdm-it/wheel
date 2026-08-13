// A BOOT THAT GENUINELY FAILS — the other half of O-48's repairs.
//
// `dark-volume.test.js` covers the RULED empty: a volume with nothing
// servable, which must not look like a crash. This covers the real crash,
// which must not look like nothing — and both repairs live on this path:
//
//   1. `applyTheme` used to run AFTER the chain was built, so a boot ending
//      early never dressed the page. The reader got the browser's default
//      grey with white copyright text on it.
//   2. `showBootError` wrote its message into a panel held at `opacity: 0`
//      until a class nothing ever added. Every boot failure in every volume
//      showed a blank screen — the exact outcome that function exists to
//      prevent, and its own comment says so.
//
// Neither was caught by any test for as long as they existed, because nothing
// ever booted a volume that fails. This does.
import assert from 'node:assert/strict';
import { describe, it, before } from 'node:test';
import { installBrowserGlobals } from './helpers/browser-globals.mjs';

describe('a boot that fails says so, visibly, in the volume\'s own colours', () => {
  let byId;
  let doc;

  before(async () => {
    ({ byId, doc } = installBrowserGlobals('?volume=bible&proofread=true'));
    // The volume's enumeration is unreachable. Not a withheld volume — a
    // broken one, which is a different thing and must read as one.
    globalThis.fetch = async () => ({ ok: false, status: 404, json: async () => ({}), text: async () => '' });
    const realError = console.error;
    console.error = () => {};
    await import('../src/main.js');
    await new Promise(r => setTimeout(r, 150));
    console.error = realError;
  });

  it('DRESSES THE PAGE even though it never reached the chain', () => {
    // This is what the early applyTheme buys, and the only place it can be
    // proven: a failing boot returns before the later call.
    assert.equal(doc.documentElement.getAttribute('data-theme'), 'bible');
    assert.ok(doc.documentElement.style.getPropertyValue('--theme-color-bg'),
      'a failed boot must not leave the reader on the browser default');
  });

  it('MAKES THE MESSAGE VISIBLE — the guard used to be invisible itself', () => {
    const panel = byId.get('detail-panel');
    assert.ok(panel?.classList?.contains('detail-panel--visible'),
      'the panel is opacity:0 until this class is added; without it the message is written where nobody can read it');
    // The message sits in its OWN element now, seated clear of the copyright
    // band — the two used to overlap illegibly, since the panel is
    // full-screen and the notice is fixed at top:0.
    const box = (byId.get('detail-content')?.children || [])
      .find(c => String(c.className || '').includes('boot-error'));
    assert.ok(box, 'the message must have its own seat, not inherit a container sized for something else');
    assert.match(String(box.textContent || ''), /Failed to initialize/);
  });

  it('does NOT mark itself withheld — a broken volume is not an empty one', () => {
    assert.ok(!doc.documentElement.classList.contains('volume-withheld'),
      'dressing a failure as the ruled empty state would hide a defect behind a doctrine');
  });
});
