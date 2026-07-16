// Dev-time console tuning knobs for the child pyramid. Imported by the view
// layer (src/index.js) for its side effects; the geometry module stays pure
// and only reads the globalThis.__* overrides these define.
// ── Console tuning knobs ─────────────────────────────────────────────
// In the browser console:
//   spiralOrigin({ x: 0.5, y: 0.5 })   ← normalised 0-1 within CPUA
//   minNodeDist(3)                      ← multiplier of node radius
//   fanAngle(5)                         ← degrees between fan lines
//   arcMargin(0.1)                      ← SSd multiplier for gap inside arc
//   spiralGrowth(0.005)                 ← spiral expansion rate
//   <cmd>()  with no args prints current value; <cmd>(null) resets.
// Click any parent node to re-render after changing.
if (typeof globalThis.window !== 'undefined') {
  globalThis.__spiralOverride = globalThis.__spiralOverride ?? { x: null, y: null };
  globalThis.spiralOrigin = (pos) => {
    if (!pos) {
      console.log('spiralOrigin:', JSON.stringify(globalThis.__spiralOverride));
      return globalThis.__spiralOverride;
    }
    if (typeof pos.x === 'number') globalThis.__spiralOverride.x = pos.x;
    if (typeof pos.y === 'number') globalThis.__spiralOverride.y = pos.y;
    console.log('spiralOrigin set to:', JSON.stringify(globalThis.__spiralOverride));
    console.log('Click a parent node to see the change.');
    return globalThis.__spiralOverride;
  };

  globalThis.__minNodeDistMul = null; // null = use default (4× node radius)
  globalThis.minNodeDist = (mul) => {
    if (mul === undefined) {
      const cur = globalThis.__minNodeDistMul;
      console.log('minNodeDist:', cur != null ? cur + '× nodeRadius' : 'default (4× nodeRadius)');
      return cur;
    }
    globalThis.__minNodeDistMul = (typeof mul === 'number' && mul > 0) ? mul : null;
    console.log('minNodeDist set to:', globalThis.__minNodeDistMul != null ? globalThis.__minNodeDistMul + '× nodeRadius' : 'default (4× nodeRadius)');
    console.log('Click a parent node to see the change.');
    return globalThis.__minNodeDistMul;
  };

  globalThis.__fanAngleDeg = null; // null = use default (3.75°)
  globalThis.fanAngle = (deg) => {
    if (deg === undefined) {
      const cur = globalThis.__fanAngleDeg;
      console.log('fanAngle:', cur != null ? cur + '°' : 'default (3.75°)');
      return cur;
    }
    globalThis.__fanAngleDeg = (typeof deg === 'number' && deg > 0) ? deg : null;
    console.log('fanAngle set to:', globalThis.__fanAngleDeg != null ? globalThis.__fanAngleDeg + '°' : 'default (3.75°)');
    console.log('Click a parent node to see the change.');
    return globalThis.__fanAngleDeg;
  };

  globalThis.__arcMarginMul = null; // null = use default (0.06)
  globalThis.arcMargin = (mul) => {
    if (mul === undefined) {
      const cur = globalThis.__arcMarginMul;
      console.log('arcMargin:', cur != null ? cur + ' × SSd' : 'default (0.06 × SSd)');
      return cur;
    }
    globalThis.__arcMarginMul = (typeof mul === 'number' && mul >= 0) ? mul : null;
    console.log('arcMargin set to:', globalThis.__arcMarginMul != null ? globalThis.__arcMarginMul + ' × SSd' : 'default (0.06 × SSd)');
    console.log('Click a parent node to see the change.');
    return globalThis.__arcMarginMul;
  };

  globalThis.__spiralGrowth = null; // null = use default (0.003)
  globalThis.spiralGrowth = (rate) => {
    if (rate === undefined) {
      const cur = globalThis.__spiralGrowth;
      console.log('spiralGrowth:', cur != null ? cur : 'default (0.003)');
      return cur;
    }
    globalThis.__spiralGrowth = (typeof rate === 'number' && rate > 0) ? rate : null;
    console.log('spiralGrowth set to:', globalThis.__spiralGrowth != null ? globalThis.__spiralGrowth : 'default (0.003)');
    console.log('Click a parent node to see the change.');
    return globalThis.__spiralGrowth;
  };
}
