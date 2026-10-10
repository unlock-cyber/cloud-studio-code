// Single-slot execution bookkeeping shared by the RunManager.
//
// There is exactly one run at a time, but an execution can outlive the call
// that started it (a worker, a polling loop, a main-thread Python call). This
// module owns the rules that keep that safe, and is deliberately free of
// browser, Worker and Convex imports so those rules can be unit tested on
// their own:
//
//   * every run gets a monotonically increasing id;
//   * a completion belonging to a superseded run is ignored, so an older run
//     can never overwrite a newer run's state or drop its cancellation hook;
//   * a stop is only "terminated" when the engine registered a cancellation
//     hook — otherwise it is a request, and the run stays the current one
//     until it settles on its own (see the Pyodide note in runOrchestrator);
//   * `reset()` invalidates anything still in flight (used on IDE unmount).

export type StopResult = {
  /** A run was in progress when stop() was called. */
  active: boolean;
  /**
   * The engine had a cancellation hook and it was invoked. The run will still
   * report its own completion through the normal path; `false` means the stop
   * could only be *requested* — nothing can force the execution to end.
   */
  terminated: boolean;
};

export class RunSession {
  private seq = 0;
  private current = 0;
  private stopFns: Array<() => void> = [];

  /** Whether a run is in flight (or, after a request-only stop, still running). */
  get isActive(): boolean {
    return this.current !== 0;
  }

  /** Identity of the current run, or 0 when idle. */
  get currentId(): number {
    return this.current;
  }

  /** Register a new run and return its identity. */
  begin(): number {
    const id = ++this.seq;
    this.current = id;
    this.stopFns = [];
    return id;
  }

  /** Whether `id` is still the run the manager should report for. */
  isCurrent(id: number): boolean {
    return id !== 0 && id === this.current;
  }

  /**
   * Wrap an engine callback so output from a run that is no longer current
   * (after unmount, or after a request-only stop followed by a reset) cannot
   * touch the live UI.
   */
  guard<A extends unknown[]>(id: number, fn: (...args: A) => void): (...args: A) => void {
    return (...args: A) => {
      if (this.isCurrent(id)) fn(...args);
    };
  }

  /** Register a cancellation hook for the current run (ignored if superseded). */
  addStop(id: number, fn: () => void): void {
    if (!this.isCurrent(id)) return;
    this.stopFns.push(fn);
  }

  /**
   * End a run. Returns false when the completion belongs to a superseded run
   * and must be ignored — only the current run may clear the session.
   */
  finish(id: number): boolean {
    if (!this.isCurrent(id)) return false;
    this.current = 0;
    this.stopFns = [];
    return true;
  }

  /**
   * Request a stop for the current run. Cancellation hooks are invoked once.
   * With no hook the session intentionally stays active: the execution really
   * is still running, so a second run must not start on top of it.
   */
  stop(): StopResult {
    if (this.current === 0) return { active: false, terminated: false };
    const fns = this.stopFns;
    this.stopFns = [];
    for (const fn of fns) {
      try {
        fn();
      } catch {
        /* a failing hook must not block the others */
      }
    }
    return { active: true, terminated: fns.length > 0 };
  }

  /**
   * Invalidate whatever is in flight and go idle. Cancellation hooks are
   * invoked so real work is torn down where possible, and the sequence is
   * bumped so a surviving execution's id can never match again — its late
   * output and completion are dropped instead of reviving a dead session.
   */
  reset(): void {
    const fns = this.stopFns;
    this.stopFns = [];
    for (const fn of fns) {
      try {
        fn();
      } catch {
        /* ignore */
      }
    }
    this.seq += 1;
    this.current = 0;
  }
}
