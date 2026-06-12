import {ParamHistory} from './history';
import type {ZoneParams} from './rig';

const state = (v: number): ZoneParams => ({torso: {chestWidth: v}});

describe('ParamHistory', () => {
  it('undoes and redoes through recorded states', () => {
    const h = new ParamHistory();
    h.record(state(0), 0);
    h.record(state(1), 1000);
    expect(h.canUndo).toBe(true);

    const afterUndo = h.undo(state(2));
    expect(afterUndo).toEqual(state(1));
    expect(h.canRedo).toBe(true);

    const afterRedo = h.redo(afterUndo as ZoneParams);
    expect(afterRedo).toEqual(state(2));
    expect(h.canRedo).toBe(false);
  });

  it('coalesces rapid bursts into a single entry', () => {
    const h = new ParamHistory(60, 600);
    h.record(state(0), 0); // burst start — snapshots pre-burst state
    h.record(state(0.1), 100);
    h.record(state(0.2), 200);
    expect(h.undo(state(0.3))).toEqual(state(0));
    expect(h.canUndo).toBe(false);
  });

  it('starts a fresh entry after the coalescing window passes', () => {
    const h = new ParamHistory(60, 600);
    h.record(state(0), 0);
    h.record(state(1), 1000);
    expect(h.undo(state(2))).toEqual(state(1));
    expect(h.undo(state(1))).toEqual(state(0));
  });

  it('drops redo states when a new change is recorded', () => {
    const h = new ParamHistory();
    h.record(state(0), 0);
    h.undo(state(1));
    h.record(state(0), 5000);
    expect(h.canRedo).toBe(false);
  });

  it('caps the history length', () => {
    const h = new ParamHistory(3, 0);
    for (let i = 0; i < 10; i++) h.record(state(i), i * 1000);
    let undos = 0;
    let cursor: ZoneParams | null = state(99);
    while ((cursor = h.undo(cursor as ZoneParams))) undos++;
    expect(undos).toBe(3);
  });

  it('always records the first change after an undo', () => {
    const h = new ParamHistory(60, 600);
    h.record(state(0), 0);
    h.undo(state(1)); // back to state(0)
    // Within the coalescing window, but must still create a new entry.
    h.record(state(0), 100);
    expect(h.undo(state(5))).toEqual(state(0));
  });
});
