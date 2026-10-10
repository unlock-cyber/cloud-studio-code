// Standalone unit test for src/lib/runSession.ts — run with:
//   node --experimental-strip-types scripts/test-run-session.mjs
// (Node >= 22.6) or bun scripts/test-run-session.mjs
//
// Covers the RunManager lifecycle rules that Update 8 fixed: run identity,
// stale completions, the stop-request vs. confirmed-termination distinction,
// and unmount invalidation. The session is pure, so it is tested directly —
// nothing here needs a browser, a Worker or Convex.

import { RunSession } from "../src/lib/runSession.ts";
import assert from "node:assert/strict";

let passed = 0;
let failed = 0;
const failures = [];

function check(name, fn) {
  try {
    fn();
    passed++;
  } catch (e) {
    failed++;
    failures.push({ name, error: e.message });
  }
}

// --- identity -------------------------------------------------------------

check("a new session is idle", () => {
  const s = new RunSession();
  assert.equal(s.isActive, false);
  assert.equal(s.currentId, 0);
  assert.equal(s.isCurrent(0), false);
});

check("begin() activates the session with a fresh, monotonic id", () => {
  const s = new RunSession();
  const a = s.begin();
  assert.ok(a > 0);
  assert.equal(s.isActive, true);
  assert.equal(s.currentId, a);
  assert.equal(s.isCurrent(a), true);
  s.finish(a);
  const b = s.begin();
  assert.ok(b > a, "ids must increase so a stale one can never collide");
  assert.equal(s.isCurrent(a), false);
  assert.equal(s.isCurrent(b), true);
});

check("finish() clears the session for the current run", () => {
  const s = new RunSession();
  const id = s.begin();
  assert.equal(s.finish(id), true);
  assert.equal(s.isActive, false);
  assert.equal(s.isCurrent(id), false);
});

// --- stale completion -----------------------------------------------------

check("a superseded run's completion is ignored, not applied", () => {
  const s = new RunSession();
  const older = s.begin();
  const newer = s.begin();
  assert.equal(s.finish(older), false, "older completion must be dropped");
  assert.equal(s.isActive, true, "the newer run is still running");
  assert.equal(s.currentId, newer);
});

check("an older run's completion cannot clear a newer run's stop hook", () => {
  const s = new RunSession();
  const older = s.begin();
  let olderStopped = 0;
  s.addStop(older, () => olderStopped++);

  const newer = s.begin();
  let newerStopped = 0;
  s.addStop(newer, () => newerStopped++);

  s.finish(older); // stale: must not touch the session
  const result = s.stop();

  assert.equal(result.active, true);
  assert.equal(result.terminated, true);
  assert.equal(newerStopped, 1, "the newer run's hook must still be registered");
  assert.equal(olderStopped, 0, "the older run's hook must not run");
});

check("guarded callbacks from a superseded run are dropped", () => {
  const s = new RunSession();
  const older = s.begin();
  const seen = [];
  const guarded = s.guard(older, (v) => seen.push(v));

  guarded("before");
  s.begin(); // a newer run supersedes it
  guarded("after");

  assert.deepEqual(seen, ["before"]);
});

check("guards fire while the run is current", () => {
  const s = new RunSession();
  const id = s.begin();
  const seen = [];
  const guarded = s.guard(id, (v) => seen.push(v));
  guarded(1);
  guarded(2);
  assert.deepEqual(seen, [1, 2]);
});

check("addStop on a superseded run is ignored", () => {
  const s = new RunSession();
  const older = s.begin();
  s.begin();
  let called = 0;
  s.addStop(older, () => called++);
  const result = s.stop();
  assert.equal(called, 0);
  assert.equal(result.terminated, false);
});

// --- stop -----------------------------------------------------------------

check("stop() when idle reports nothing to stop", () => {
  const s = new RunSession();
  assert.deepEqual(s.stop(), { active: false, terminated: false });
});

check("a request-only stop keeps the run active (it is still executing)", () => {
  const s = new RunSession();
  const id = s.begin();
  const result = s.stop();
  assert.deepEqual(result, { active: true, terminated: false });
  assert.equal(s.isActive, true, "no hook means the run cannot be terminated");
  assert.equal(s.isCurrent(id), true, "so a new run must not start on top of it");
});

check("a stopped run still reports its own completion", () => {
  const s = new RunSession();
  const id = s.begin();
  s.addStop(id, () => {});
  const result = s.stop();
  assert.equal(result.terminated, true);
  assert.equal(
    s.finish(id),
    true,
    "the engine's completion after a hook-based stop must still be applied",
  );
  assert.equal(s.isActive, false);
});

check("cancellation hooks run once and a failing hook doesn't block others", () => {
  const s = new RunSession();
  const id = s.begin();
  const order = [];
  s.addStop(id, () => order.push("a"));
  s.addStop(id, () => {
    throw new Error("boom");
  });
  s.addStop(id, () => order.push("b"));

  const first = s.stop();
  const second = s.stop();
  assert.deepEqual(order, ["a", "b"]);
  assert.equal(first.terminated, true);
  assert.equal(second.terminated, false, "hooks are cleared after the first stop");
});

// --- unmount / reset ------------------------------------------------------

check("reset() invalidates an in-flight run and tears down its work", () => {
  const s = new RunSession();
  const id = s.begin();
  let stopped = 0;
  s.addStop(id, () => stopped++);

  const seen = [];
  const guarded = s.guard(id, (v) => seen.push(v));

  s.reset();

  assert.equal(stopped, 1, "the cancellable run is torn down on unmount");
  assert.equal(s.isActive, false);
  assert.equal(s.isCurrent(id), false);
  assert.equal(s.finish(id), false, "a late completion cannot revive the session");

  guarded("late");
  assert.deepEqual(seen, [], "late output from a dead session is dropped");
});

check("the session is reusable after reset()", () => {
  const s = new RunSession();
  const dead = s.begin();
  s.reset();
  const next = s.begin();
  assert.notEqual(next, dead);
  assert.equal(s.isCurrent(next), true);
  assert.equal(s.isActive, true);
});

// --- run -----------------------------------------------------------------

console.log(`\n${passed} passed, ${failed} failed`);
if (failures.length) {
  console.log("\nFailures:");
  for (const f of failures) console.log(`  ✗ ${f.name}: ${f.error}`);
  process.exit(1);
}
