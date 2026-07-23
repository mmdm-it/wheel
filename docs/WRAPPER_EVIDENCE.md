# Native vs Wrapper — the Phase C evidence file

Phase F will decide how the apps ship: PWA, store wrappers (Capacitor/TWA)
of the same web bundle, or a native rebuild. Phase C was told to collect
evidence as it went (the calendar's 5,000-node rig doubling as the
native-vs-wrapper test). This memo is that evidence, recorded at C close
(2026-07-20) so F argues from data, not vibes. Howell's standing gut
preference for a native app is noted up front; the evidence below is
what the web stack actually did under Phase C's load.

## Evidence FOR the wrapper (the web stack held)

1. **Chain length is free.** The sprocket architecture renders O(visible):
   the 86,000-link months timeline measures 0.04 ms/frame for node
   positions; chain build is 5–16 ms on both field phones for every
   volume. The 6,000-year calendar scrubs at speed on a 2017 iPhone X and
   a budget Moto G. "Five thousand nodes" (C.6) passed on phones that are
   below any store-app baseline we would target.
2. **The floor is deep.** After the C.1b/C.2 work, gateway transits are
   ~instant on iOS 16.7 / 2017 hardware, and boot is ~1.1 s on both
   reference phones over the LAN. The Chrome-80 compatibility fix
   (v3.8.32) even brought a 2019-era Android 10 dumb-phone along.
3. **Every perf cliff so far was OURS, not the platform's.** The three
   big Phase C lags — uncompressed JSON on cellular, O(chain)
   selectNearest, per-frame pyramid geometry recompute — were application
   bugs, found by the field probe and fixed in the same week. The one
   true platform cost (SVG Gaussian blur at dpr:3, ~150 ms/frame) had a
   one-line remedy: don't use SVG blur during rotation.
4. **The instrumentation exists and travels.** ?probe=1 field
   diagnostics, feel HUD, boot-phase marks, perf CI budgets — all of it
   works identically in a wrapper, none of it exists on day one of a
   native rebuild.
5. **One bundle, four deployments, both engines.** The same 406 KB
   (85 KB wire) bundle serves catalog/bible/calendar/places on WebKit and
   Blink, gated by one test matrix. A native track doubles the matrix.

## Evidence AGAINST the wrapper (costs paid to the web platform)

1. **iOS WebKit animation is a minefield we cross by hand.** The v3.8.33/34
   series (double-rAF afterPaint, ≥34 ms paint-cycle guards), the C.4
   splash needing Web Animations API because CSS transitions popped, the
   gateway wipe needing hard clipPath + snapshot tricks for field phones —
   each solved, each a tax native UIKit/Compose animation would not levy.
2. **The browser chrome fights the instrument.** Visual-viewport crop
   (DDG toolbar), tap-highlight suppression, translate-prompt suppression,
   pointer-event races (pointerup vs click, duplicate touch activation),
   text-selection and scroll-locking — the C-phase gesture work spent
   real days neutralizing browser behaviors a native surface simply
   doesn't have. The ladder works, but it is defended, not owned.
3. **Compositor costs are opaque and device-tiered.** dpr:3 paint on the
   iPhone X pinned frames at ~150 ms with zero JS on the profile; we
   diagnosed by inference (render self-time probe). Native profilers
   would have named the cost in minutes.
4. **Media/offline are still unproven here.** Phase F needs offline
   volume caches (service worker) and possibly video; both are
   solved-but-fiddly on the web stack and trivial in stores' native
   packaging.

## Reading at C close

The wrapper case is currently WINNING on evidence: the app's hardest
structural bets (chain scale, migration choreography, gateway reboots,
6,000-year scrubbing) all cleared on weak hardware, and every remaining
platform pain has a shipped workaround with a regression watchpoint. The
native case rests on (a) the recurring WebKit animation tax, (b) polish
ceilings we haven't hit yet (120 Hz, haptics — the sprocket wants a
detent click someday), and (c) Howell's gut. Decision deliberately
deferred to F, after D's strata put the heaviest remaining animation load
(blur + mirrored secondary ring) on this same stack — THAT is the last
datapoint worth waiting for, and it makes D the true final trial.

Keep feeding this file: any new platform fight or platform win between
now and F gets a line here, at the moment it happens.
