# Wheel v3  [![CI](https://github.com/mmdm-it/wheel/actions/workflows/ci.yml/badge.svg?branch=master)](https://github.com/mmdm-it/wheel/actions/workflows/ci.yml)

> v3.8.32 Designed

Minimal scaffold, data-agnostic: interaction → navigation → view → geometry → data, with the Magnifier as lodestar. v3.8.29 Designed to handle deep, wide, varied hierarchies (e.g., calendar, catalog, Gutenberg, places) without dataset-specific assumptions.

## Current Version
- v3.8.21 (2026-02-16)

## Notable Changes in 3.7.3
- Child Pyramid nodes now support a spiral layout mode, placing nodes equidistantly along an Archimedean spiral using true arc-length spacing. This ensures visually uniform node distribution for all child counts. (Cartesian grid mode is also available.)

## Release Train
- v3.8.15 Baseline data + UI lift — done
- v3.8.15 Adapter + state-store foundation — done
- v3.8.15 Volume-safe interaction loop — done
- v3.8.15 Detail/pyramid rebuild on adapters — done
- v3.8.15 Theming + accessibility hardening — done (theming tokens, a11y pass, perf budgets, theme swap smoke)
- v3.8.15 Dimension System (lens: language/time) — shipped: language + edition portals, schema/adapter hydration, UI cycling with aria/keyboard, perf budgets
- v3.8.15 Migration Animation (Child Pyramid ↔ Focus Ring) — shipped: `animateIn`/`animateOut` with LIFO stack, 600ms CSS transform, `isAnimating` guard, `prefers-reduced-motion` support
- v3.8.19 Parent Button Labelling — shipped: adapter-driven `getParentLabel`, progressive depth labels (country → manufacturer → compound), uppercase suffix

- `main` carries the active v3.x line; releases are tagged `v3.*` (current `v3.7.14`).
- Historical majors live on archive branches (e.g., `archive/v0`, `archive/v1`, `archive/v2`).
- Future v4 will branch from the final v3 tag and tag releases as `v4.*` (no versioned folders).

## Scripts
- `npm test` — run Node built-in tests (no external deps)
- `npm run build` — esbuild bundle (`src/main.js` → `dist/app.js`, target Chrome 74, IIFE)
- `npm run lint:forbidden` — guard for forbidden volume-specific literals in shared code (runs `test/forbidden-volume-literals.test.js`)
- `npm run bump-version -- 3.7.0` — bump package/changelog version for release (or run `./bump-version.sh 3.7.0`)
- `bash sync-to-server.sh` — build + deploy all volumes to howellgibbens.com

## Mobile Device Diagnostics

When debugging issues that only appear on phones (iOS, Android), use the
**in-memory log → downloadable text file** pattern.  This avoids visible
overlays that obscure UI elements and produces a file the tester can email
from the device.

### How to add diagnostics

1. **Add the logger scaffold to `index.html`** (ES5 only — no `const`,
   no arrow functions, no template literals):

```html
<script>
  (function() {
    var lines = [];
    // Capture environment info at load time
    var mql = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
    lines.push('reduced-motion: ' + (mql ? mql.matches : 'N/A'));
    lines.push('UA: ' + navigator.userAgent);
    lines.push('screen: ' + screen.width + 'x' + screen.height);
    lines.push('window: ' + window.innerWidth + 'x' + window.innerHeight);
    lines.push('dpr: ' + window.devicePixelRatio);
    lines.push('time: ' + new Date().toISOString());
    lines.push('---');

    // Global log function — call from any module via window._animLog(msg)
    window._animLog = function(msg) { lines.push(msg); };

    // Download function — creates a timestamped .txt file
    window._animDownload = function() {
      var text = lines.join('\n');
      var blob = new Blob([text], { type: 'text/plain' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      var ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      a.download = 'diag-' + ts + '.txt';
      a.click();
      URL.revokeObjectURL(url);
    };

    // Render a small download button (top-right corner)
    document.addEventListener('DOMContentLoaded', function() {
      var btn = document.createElement('button');
      btn.textContent = '\uD83D\uDCCB Log';
      btn.style.cssText = 'position:fixed;top:8px;right:8px;z-index:9999;' +
        'background:#222;color:#0f0;border:2px solid #0f0;border-radius:8px;' +
        'font:bold 14px monospace;padding:6px 12px;pointer-events:auto;opacity:0.7;';
      btn.addEventListener('click', function() { window._animDownload(); });
      document.body.appendChild(btn);
    });
  })();
</script>
```

2. **Add log calls in source modules** (these compile into the esbuild bundle):

```js
const _log = window._animLog || (() => {});
const _t0 = performance.now();
_log(`[functionName] starting, entries=${n}`);
// ... later ...
_log(`  checkpoint t+${(performance.now()-_t0).toFixed(1)}`);
```

3. **Build and deploy** — `npm run build && bash sync-to-server.sh`

### Tester workflow (on phone)

1. Load the app and reproduce the issue several times
2. Tap the **📋 Log** button (top-right corner)
3. iOS Safari: share sheet → email the `.txt` file to yourself
   iOS Chrome: downloads to Files app → share → email
   Android: downloads directly → share → email
4. Send the text file to the developer for analysis

### Key diagnostic patterns used (v3.8.34)

- **`performance.now()` timestamps** at each stage to measure actual elapsed
  time between reflow, `afterPaint`, and transition application
- **`getComputedStyle()` snapshots** at +50ms and +200ms to see whether CSS
  transitions are interpolating or have jumped to the end state
- **`matchMedia('(prefers-reduced-motion: reduce)')` check** both at load
  (in the ES5 scaffold) and at animation time (in the module)
- **Environment capture**: UA string, screen/window dimensions, device pixel
  ratio — essential for diagnosing iframe zoom issues

### Cleanup

Remove the `<script>` block from `index.html` and all `_animLog` / `_t0`
references from source modules when diagnostics are no longer needed.  The
`window._animLog` calls are guarded (`window._animLog || (() => {})`) so
forgetting to remove one won't break production.

## Structure
- `src/geometry` — pure math helpers (hub/radius, arc window, positions)
- `src/navigation` — navigation state and events
- `src/interaction` — rotation choreographer (momentum + snapping)
- `src/view` — rendering (SVG hooks), DOM bindings, and migration animation (`migration-animation.js`)
- `data` — sample volume/schema/manifest
- `styles` — CSS variables and base styles
- `test` — node test files for geometry/state

## Goals
Keep modules small (<200 lines), zero inline styles/`!important`, pure functions where possible, and validate volumes at load to stay data-agnostic.
