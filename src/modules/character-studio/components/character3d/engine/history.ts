import type {ZoneParams} from './rig';

// Undo/redo history for the editor's parameter state.
//
// Continuous interactions (slider scrubbing, drags on the model) emit dozens
// of changes per second; recording each one would make Ctrl+Z step through
// micro-movements. Instead `record` coalesces: the first change of a burst
// snapshots the pre-burst state, and follow-ups inside `coalesceMs` are
// folded into the same entry.
export class ParamHistory {
  private past: ZoneParams[] = [];
  private future: ZoneParams[] = [];
  private lastRecordAt = -Infinity;

  constructor(private limit = 60, private coalesceMs = 600) {}

  /** Call BEFORE applying a change, with the state being replaced. */
  record(previous: ZoneParams, now: number): void {
    this.future = [];
    if (now - this.lastRecordAt < this.coalesceMs) {
      this.lastRecordAt = now;
      return;
    }
    this.lastRecordAt = now;
    this.past.push(previous);
    if (this.past.length > this.limit) this.past.shift();
  }

  undo(current: ZoneParams): ZoneParams | null {
    const previous = this.past.pop();
    if (!previous) return null;
    this.future.push(current);
    // The next change after an undo must always create a fresh entry.
    this.lastRecordAt = -Infinity;
    return previous;
  }

  redo(current: ZoneParams): ZoneParams | null {
    const next = this.future.pop();
    if (!next) return null;
    this.past.push(current);
    this.lastRecordAt = -Infinity;
    return next;
  }

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }

  reset(): void {
    this.past = [];
    this.future = [];
    this.lastRecordAt = -Infinity;
  }
}
