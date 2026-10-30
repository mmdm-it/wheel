// A TAP DRILLS IN THE VOLUMES THAT ASK FOR IT (O-234, Howell 2026-10-28):
// "the Bible and the Calendar should have different logic for drilling
// between levels." The choice is the volume's, declared as a capability;
// the gesture layer never names a volume.
import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('drilling by tap is a volume\'s declared choice (O-234)', () => {
  it('the calendar drills by tap', async () => {
    const { calendarAdapter } = await import('../src/adapters/calendar-adapter.js');
    assert.strictEqual(calendarAdapter.capabilities.drillByTap, true);
  });
  it('the Bible does not — its drill stays the stroke (O-191)', async () => {
    const mod = await import('../src/adapters/bible-adapter.js');
    const adapter = mod.bibleAdapter || mod.default || Object.values(mod).find(v => v && typeof v === 'object' && 'capabilities' in v);
    assert.ok(adapter, 'found the Bible adapter');
    assert.notStrictEqual(adapter.capabilities?.drillByTap, true);
  });
  it('the gesture layer reads the flag, not a volume', async () => {
    const fs = await import('node:fs');
    const main = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
    assert.match(main, /drillByTap: Boolean\(adapter\?\.capabilities\?\.drillByTap\)/);
    assert.match(main, /app\.drillByTap && liftStroke\?\.fromParent/);
  });
});
