// THE WITHHELD VOLUME (O-48, H-14) — the state Howell ruled from the phone
// and confirmed on the instrument: "the visual statement of an empty canvas
// waiting to be filled."
//
// It needs its own FILE because it needs its own PROCESS. `main.js`
// self-executes at import and exports nothing, so a second boot cannot happen
// beside the first one, and boot-smoke boots the reader's happy path. That is
// the whole reason this behaviour went unpinned while it was being ruled on.
//
// WHAT IS ASSERTED HERE IS THE ABSENCE, mostly, and that is deliberate: the
// ruling is that a withheld volume shows the instrument holding nothing, and
// the failure mode it replaced was a crash report painted at the reader.
import assert from 'node:assert/strict';
import { describe, it, before } from 'node:test';
import { installBrowserGlobals } from './helpers/browser-globals.mjs';

describe('a withheld volume goes dark, and dark is not failed', () => {
  let errors = [];
  let byId;
  let doc;

  before(async () => {
    // NO `?proofread=true`. The corpus carries `proofread: false` for the one
    // offered edition, so without the override there is nothing servable —
    // which is H-14's ruled state, reached the way a reader reaches it.
    ({ byId, doc } = installBrowserGlobals('?volume=bible'));
    const realError = console.error;
    console.error = (...args) => { errors.push(args.join(' ')); };
    await import('../src/main.js');
    await new Promise(r => setTimeout(r, 150));
    console.error = realError;
  });

  it('does not report a failure — withheld is a ruled state, not a crash', () => {
    const fatal = errors.filter(e => /Failed to initialize|volume validation failed/.test(e));
    assert.deepEqual(fatal, [], `boot reported: ${fatal.join(' | ')}`);
  });

  it('paints NO message at the reader', () => {
    // The defect this replaced: "Failed to initialize app: no items found for
    // volume 'bible'" — a ruled condition stated as a crash, leaking an
    // internal volume id at the reader.
    const text = String(byId.get('detail-content')?.textContent || '');
    assert.equal(text, '', `detail sector shows: ${text}`);
  });

  it('WEARS THE VOLUME\'S OWN COLOURS', () => {
    // Howell's first report was a very light grey screen with white copyright
    // text on it, barely legible.
    //
    // NOT the guard for the early dressing, and I nearly labelled it as one:
    // removing the early applyTheme leaves this GREEN, because a withheld
    // volume no longer throws and so reaches the later call anyway. Found by
    // breaking the code and watching nothing fail.
    //
    // The early call earns its keep on a boot that ends EARLY — a genuine
    // failure — and that is pinned in boot-failure.test.js, which needs a
    // failing boot and therefore its own process.
    const root = doc.documentElement;
    assert.equal(root.getAttribute('data-theme'), 'bible');
    assert.ok(root.style.getPropertyValue('--theme-color-bg'),
      'the background token is set even though the volume has nothing to show');
  });

  it('marks itself withheld, so the nodes lose their fill', () => {
    // The stylesheet strips fills for this class; the magnifier and the
    // parent button are left as strokes. Asserting the CLASS rather than the
    // paint is the honest boundary of what a DOM stub can know.
    assert.ok(doc.documentElement.classList.contains('volume-withheld'),
      'without this the sky and the vessels keep their colour and the volume looks full');
  });
});
