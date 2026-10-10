// RunManager integration test — run with:
//   bun scripts/test-run-manager.mjs
//
// The remote (Judge0) engine is the one path that can be driven end to end
// without a browser, so `fetch` is stubbed and the real RunManager is used.
// Covers Update 8's run/stop behaviour:
//   * a Stop is reported as "stopped" with exit code 130, never as a failure;
//   * the remote job is not claimed to be terminated;
//   * a second run cannot start on top of an active one;
//   * unmount (dispose) tears the run down, drops its late output and releases
//     the single-run lock.
//
// The pure identity/staleness rules are covered in scripts/test-run-session.mjs.

import assert from "node:assert/strict";

// The manager and its engines are browser code; this path only needs the timer
// API, so a minimal `window` shim lets the real implementation run under Bun.
// It must exist before the modules are evaluated, hence the dynamic import.
globalThis.window ??= {};
globalThis.window.setTimeout = globalThis.setTimeout.bind(globalThis);
globalThis.window.clearTimeout = globalThis.clearTimeout.bind(globalThis);
const { runManager } = await import("../src/lib/runOrchestrator.ts");

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

const realFetch = globalThis.fetch;

/** A sandbox that accepts a submission and then stays In Queue forever. */
function stubSandbox() {
  globalThis.fetch = async (_url, init) => {
    if (init && init.method === "POST") {
      return new Response(JSON.stringify({ token: "tok-1" }), { status: 200 });
    }
    return new Response(
      JSON.stringify({
        stdout: null,
        stderr: null,
        compile_output: null,
        message: null,
        time: null,
        status: { id: 1, description: "In Queue" },
      }),
      { status: 200 },
    );
  };
}

function collector() {
  const calls = [];
  return {
    calls,
    cb: {
      onState: (s) => calls.push(["state", s]),
      onStdout: (s) => calls.push(["stdout", s]),
      onStderr: (s) => calls.push(["stderr", s]),
      onInfo: (s) => calls.push(["info", s]),
      onExit: (c) => calls.push(["exit", c]),
      onPreview: () => {},
    },
  };
}

async function waitFor(predicate, timeoutMs = 2000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error("timed out waiting for condition");
}

const target = {
  projectId: "proj-test",
  path: "main.c",
  content: "int main(void) { return 0; }",
  lang: "c",
};

try {
  stubSandbox();

  await checkAsync("a running run blocks a second run", async () => {
    const first = collector();
    const run = runManager.runSingleFile(target, first.cb);
    await waitFor(() =>
      first.calls.some(([k, v]) => k === "info" && String(v).includes("Queued")),
    );
    assert.equal(runManager.isRunning, true, "the run should be active");

    const second = collector();
    await runManager.runSingleFile(target, second.cb);
    assert.ok(
      second.calls.some(([k, v]) => k === "info" && String(v).includes("already running")),
      "the second run must be refused, not started",
    );
    assert.equal(second.calls.some(([k]) => k === "state"), false);

    runManager.stop();
    await run;
  });

  await checkAsync("stopping a remote run reports stopped, not failed", async () => {
    const { calls, cb } = collector();
    const run = runManager.runSingleFile(target, cb);
    await waitFor(() => calls.some(([k, v]) => k === "info" && String(v).includes("Queued")));

    const stop = runManager.stop();
    assert.deepEqual(stop, { active: true, terminated: true });
    await run;

    assert.equal(runManager.isRunning, false, "the lock must be released");
    assert.ok(
      calls.some(([k, v]) => k === "state" && v === "stopped"),
      "an intentional stop must report the stopped state",
    );
    assert.equal(
      calls.some(([k, v]) => k === "state" && v === "failed"),
      false,
      "an intentional stop must never be reported as a failure",
    );
    assert.ok(calls.some(([k, v]) => k === "exit" && v === 130), "exit code 130 (SIGINT)");
    const stopLine = calls.find(([k, v]) => k === "stderr" && String(v).includes("[stopped]"));
    assert.ok(stopLine, "the stop must be explained in the terminal");
    assert.ok(
      /may still finish in the background/.test(stopLine[1]),
      "the remote job must not be claimed as terminated",
    );
  });

  await checkAsync("a run can start again after a stop", async () => {
    const { calls, cb } = collector();
    const run = runManager.runSingleFile(target, cb);
    await waitFor(() => calls.some(([k, v]) => k === "info" && String(v).includes("Queued")));
    assert.equal(runManager.isRunning, true);
    runManager.stop();
    await run;
    assert.equal(runManager.isRunning, false);
  });

  await checkAsync("stop() when idle reports nothing to stop", async () => {
    assert.deepEqual(runManager.stop(), { active: false, terminated: false });
  });

  await checkAsync("dispose() drops the run's late output and releases the lock", async () => {
    const { calls, cb } = collector();
    const run = runManager.runSingleFile(target, cb);
    await waitFor(() => calls.some(([k, v]) => k === "info" && String(v).includes("Queued")));

    runManager.dispose();
    assert.equal(runManager.isRunning, false, "unmount must release the lock");

    const countAtDispose = calls.length;
    await run;
    assert.equal(
      calls.length,
      countAtDispose,
      "a disposed run's completion must not reach the dead view",
    );
    assert.equal(
      calls.some(([k, v]) => k === "state" && (v === "stopped" || v === "failed")),
      false,
    );
  });

  await checkAsync("a new run works after dispose()", async () => {
    const { calls, cb } = collector();
    const run = runManager.runSingleFile(target, cb);
    await waitFor(() => calls.some(([k, v]) => k === "info" && String(v).includes("Queued")));
    assert.equal(runManager.isRunning, true);
    assert.ok(calls.some(([k, v]) => k === "state" && v === "running"));
    runManager.stop();
    await run;
  });

  check("the manager is idle at the end", () => {
    assert.equal(runManager.isRunning, false);
  });
} finally {
  globalThis.fetch = realFetch;
  runManager.dispose();
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failures.length) {
  console.log("\nFailures:");
  for (const f of failures) console.log(`  ✗ ${f.name}: ${f.error}`);
  process.exit(1);
}
