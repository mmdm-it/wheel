import assert from 'assert/strict';
import { describe, it } from 'node:test';
import { createInteractionStore, interactionEvents, getDefaultInteractionState } from '../src/core/interaction-store.js';

const getStateShape = state => ({
  volume: state.volume,
  rotation: state.rotation,
  focusId: state.focusId,
  hoverId: state.hoverId,
  animation: state.animation,
  modal: state.modal,
  error: state.error
});

describe('interaction-store', () => {
  it('provides default state shape', () => {
    const store = createInteractionStore();
    assert.deepEqual(getStateShape(store.getState()), getStateShape(getDefaultInteractionState()));
  });

  it('handles volume and rotation updates', () => {
    const store = createInteractionStore();
    store.dispatch({ type: interactionEvents.SET_VOLUME, volume: 'catalog' });
    store.dispatch({ type: interactionEvents.SET_ROTATION, rotation: Math.PI / 4 });
    const state = store.getState();
    assert.equal(state.volume, 'catalog');
    assert.equal(state.rotation, Math.PI / 4);
  });

  it('clears hover when volume changes', () => {
    const store = createInteractionStore();
    store.dispatch({ type: interactionEvents.HOVER, hoverId: 'foo' });
    store.dispatch({ type: interactionEvents.SET_VOLUME, volume: 'next' });
    assert.equal(store.getState().hoverId, null);
  });

  it('queues rotation while animating and applies on animation end', () => {
    const store = createInteractionStore();
    store.dispatch({ type: interactionEvents.ANIMATION_START, animation: 'transitioning' });
    store.dispatch({ type: interactionEvents.SET_ROTATION, rotation: Math.PI / 2 });
    assert.notEqual(store.getState().rotation, Math.PI / 2);
    store.dispatch({ type: interactionEvents.ANIMATION_END });
    assert.equal(store.getState().rotation, Math.PI / 2);
    assert.equal(store.getState().animation, 'idle');
  });

  it('notifies subscribers on dispatch', () => {
    const store = createInteractionStore();
    let notified = 0;
    const unsubscribe = store.subscribe(() => {
      notified += 1;
    });
    store.dispatch({ type: interactionEvents.FOCUS, focusId: 'foo' });
    unsubscribe();
    store.dispatch({ type: interactionEvents.HOVER, hoverId: 'bar' });
    assert.equal(notified, 1);
  });

  it('returns state unchanged for unknown actions', () => {
    const store = createInteractionStore({ initialState: { volume: 'places' } });
    const before = store.getState();
    store.dispatch({ type: 'UNKNOWN_ACTION' });
    const after = store.getState();
    assert.deepEqual(getStateShape(after), getStateShape(before));
  });
});
