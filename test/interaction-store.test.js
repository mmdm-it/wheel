import assert from 'assert/strict';
import { describe, it } from 'node:test';
import { createInteractionStore, interactionEvents, getDefaultInteractionState } from '../src/core/interaction-store.js';

const getStateShape = state => ({
  dimension: state.dimension,
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

  it('handles dimension and rotation updates', () => {
    const store = createInteractionStore();
    store.dispatch({ type: interactionEvents.SET_DIMENSION, dimension: 'catalog' });
    store.dispatch({ type: interactionEvents.SET_ROTATION, rotation: Math.PI / 4 });
    const state = store.getState();
    assert.equal(state.dimension, 'catalog');
    assert.equal(state.rotation, Math.PI / 4);
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
    const store = createInteractionStore({ initialState: { dimension: 'places' } });
    const before = store.getState();
    store.dispatch({ type: 'UNKNOWN_ACTION' });
    const after = store.getState();
    assert.deepEqual(getStateShape(after), getStateShape(before));
  });
});
