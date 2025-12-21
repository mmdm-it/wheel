import test from 'node:test';
import assert from 'node:assert/strict';
import { NavigationState } from '../src/navigation/navigation-state.js';

test('navigation state selects offsets with wrap', () => {
  const nav = new NavigationState(['a', 'b', 'c']);
  nav.selectOffset(1);
  assert.equal(nav.getCurrent(), 'b');
  nav.selectOffset(2);
  assert.equal(nav.getCurrent(), 'a');
});

test('navigation notifies observers', () => {
  const nav = new NavigationState(['a', 'b']);
  let events = 0;
  nav.onChange(() => { events += 1; });
  nav.selectOffset(1);
  assert.equal(events, 1);
});
