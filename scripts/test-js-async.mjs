// JavaScript async-completion regression test — run with:
//   bun scripts/test-js-async.mjs
//
// Update 8 fixed a runner that ended a run as soon as the user's top-level code
// returned, so promise continuations and setTimeout callbacks never got to
// report their output. The worker source is pure JS over `self` + the timer
// globals, so it can be evaluated here with a fake `self` and driven exactly
// like the real Web Worker does.
//
// Covers: synchronous output, promise microtasks, async/await, setTimeout,
// self-clearing setInterval, and that runtime errors (sync and async) stay
// visible with a non-zero exit code.

import { JS_WORKER_SOURCE } from "../src/lib/jsWorkerSource.ts";
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

async function checkAsync(name, fn) {
  try {
    await fn();
    passed++;
  } catch (e) {
    failed++;
    failures.push({ name, error: e.message });
  }
}

/** Evaluate the worker source with a fake `self` and run one program. */
function run(code, timeoutMs = 3000) {
  const messages = [];
  const self = { postMessage: (m) => messages.push(m) };
  new Function("self", JS_WORKER_SOURCE)(self);

  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("worker never posted done")),
      timeoutMs,
    );
    const post = self.postMessage;
    self.postMessage = (m) => {
      post(m);
      if (m.type === "done") {
        clearTimeout(timer);
        resolve(messages);
      }
    };
    self.onmessage({ data: { code } });
  });
}

const stdoutOf = (msgs) =>
  msgs.filter((m) => m.type === "stdout").map((m) => m.s);
const stderrOf = (msgs) =>
  msgs.filter((m) => m.type === "stderr").map((m) => m.s);
const doneOf = (msgs) => msgs.find((m) => m.type === "done");

try {
  await checkAsync("synchronous output still works", async () => {
    const msgs = await run('console.log("hi")');
    assert.deepEqual(stdoutOf(msgs), ["hi"]);
    assert.equal(doneOf(msgs).exitCode, 0);
  });

  await checkAsync("promise microtasks are captured", async () => {
    const msgs = await run(
      'console.log("A"); Promise.resolve().then(() => console.log("B")); console.log("C");',
    );
    assert.deepEqual(stdoutOf(msgs), ["A", "C", "B"]);
    assert.equal(doneOf(msgs).exitCode, 0);
  });

  await checkAsync("async/await is captured", async () => {
    const msgs = await run(
      [
        "async function test() {",
        '  console.log("A");',
        "  await Promise.resolve();",
        '  console.log("B");',
        "}",
        "test();",
      ].join("\n"),
    );
    assert.deepEqual(stdoutOf(msgs), ["A", "B"]);
    assert.equal(doneOf(msgs).exitCode, 0);
  });

  await checkAsync("setTimeout output is captured and delays completion", async () => {
    const promise = run(
      'console.log("START"); setTimeout(() => console.log("CALLBACK"), 30);',
    );
    // While the timeout is outstanding the run must not be finished.
    await new Promise((r) => setTimeout(r, 10));
    const msgs = await promise;
    assert.deepEqual(stdoutOf(msgs), ["START", "CALLBACK"]);
    assert.equal(doneOf(msgs).exitCode, 0);
    assert.equal(msgs[msgs.length - 1].type, "done", "done must come last");
  });

  await checkAsync("a cleared timeout is cancelled and the run finishes", async () => {
    const msgs = await run(
      'var t = setTimeout(() => console.log("NEVER"), 20); clearTimeout(t); console.log("now");',
    );
    assert.deepEqual(stdoutOf(msgs), ["now"]);
    assert.equal(doneOf(msgs).exitCode, 0);
  });

  await checkAsync("setInterval ticks run until it is cleared, then the run ends", async () => {
    const msgs = await run(
      [
        "var n = 0;",
        "var id = setInterval(function () {",
        '  n++; console.log("tick " + n);',
        "  if (n >= 3) clearInterval(id);",
        "}, 5);",
      ].join("\n"),
    );
    assert.deepEqual(stdoutOf(msgs), ["tick 1", "tick 2", "tick 3"]);
    assert.equal(doneOf(msgs).exitCode, 0);
    assert.equal(msgs[msgs.length - 1].type, "done", "the interval must finish first");
  });

  await checkAsync("a thrown runtime error stays visible with exit 1", async () => {
    const msgs = await run('throw new Error("boom");');
    assert.ok(stderrOf(msgs).some((s) => s.includes("boom")));
    assert.equal(doneOf(msgs).exitCode, 1);
  });

  await checkAsync("an error thrown inside a timer stays visible", async () => {
    const msgs = await run('setTimeout(() => { throw new Error("late boom"); }, 5);');
    assert.ok(stderrOf(msgs).some((s) => s.includes("late boom")));
    assert.equal(doneOf(msgs).exitCode, 1);
  });

  check("the worker source declares no template-literal interpolation", () => {
    assert.equal(
      JS_WORKER_SOURCE.includes("${"),
      false,
      "the worker source is embedded in a template literal and must not interpolate",
    );
  });
} catch (e) {
  failed++;
  failures.push({ name: "suite", error: e.message });
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failures.length) {
  console.log("\nFailures:");
  for (const f of failures) console.log(`  ✗ ${f.name}: ${f.error}`);
  process.exit(1);
}
