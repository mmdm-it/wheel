// C.2: the feel HUD — the instruments Phase C tunes against. Mounted only
// with ?debug=1 (or localStorage wheel-debug=1). Shows, live:
//   fps        rolling frames-per-second (1s window)
//   worst      slowest frame in the window, ms (the jank number)
//   drop       frames over 34ms in the window (missed-vsync count)
//   in→fr      input-to-frame latency: pointerdown/-move to the next rAF, ms
//   boot       the recorded boot-phase decomposition (from recordBootPhases)
// Reads window.__wheelBootPhases; owns one absolutely-positioned div; costs
// one rAF loop — dev-only by construction.

let mounted = false;

export function mountFeelHud() {
  if (mounted || typeof document === 'undefined') return;
  mounted = true;

  const el = document.createElement('div');
  el.id = 'feel-hud';
  el.setAttribute('aria-hidden', 'true');
  el.style.cssText = [
    'position:fixed', 'top:4px', 'left:4px', 'z-index:9999',
    'font:25px/1.5 monospace', 'color:#0f0', 'background:rgba(0,0,0,0.65)',
    'padding:10px 14px', 'border-radius:8px', 'pointer-events:none',
    'white-space:pre', 'text-align:left'
  ].join(';');
  document.body.appendChild(el);

  const frames = [];        // timestamps of recent frames
  const durations = [];     // frame-to-frame deltas
  let lastT = performance.now();
  let inputAt = 0;
  let inputLatency = null;

  const onInput = e => { inputAt = e.timeStamp || performance.now(); };
  window.addEventListener('pointerdown', onInput, { passive: true });
  window.addEventListener('pointermove', onInput, { passive: true });

  function loop(t) {
    const dt = t - lastT;
    lastT = t;
    frames.push(t);
    durations.push(dt);
    while (frames.length && t - frames[0] > 1000) { frames.shift(); durations.shift(); }
    if (inputAt) { inputLatency = Math.max(0, t - inputAt); inputAt = 0; }

    const fps = frames.length;
    const worst = Math.round(Math.max(...durations, 0));
    const drops = durations.filter(d => d > 34).length;
    const b = window.__wheelBootPhases;
    const bootLine = b
      ? `boot ${b.total}ms  html→js ${b.htmlToBoot}\nman ${b.manifest}  chain ${b.chainBuild}  rend ${b.renderWire}`
      : 'boot —';
    el.textContent =
      `fps ${String(fps).padStart(3)}  worst ${String(worst).padStart(3)}ms  drop ${drops}\n` +
      `in→fr ${inputLatency == null ? ' —' : Math.round(inputLatency) + 'ms'}\n` +
      bootLine;
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}
