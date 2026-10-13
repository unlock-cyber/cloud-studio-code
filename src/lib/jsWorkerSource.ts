// Source of the JavaScript execution worker.
//
// Kept in its own module (rather than inline in jsRunner) so the completion
// rules can be unit tested without a browser: the code below only needs a
// `self`-like object exposing `postMessage`, plus the timer globals.
//
// A run is NOT finished when the user's top-level code returns. Promise
// continuations (`Promise.then`, `async`/`await`) and callbacks scheduled with
// `setTimeout` still have to run and report their output. The worker therefore
// tracks outstanding timers and only posts `done` once the microtask queue has
// been flushed and no timer is left pending:
//
//   * the microtask queue is flushed by crossing one real task boundary
//     (a 0ms timeout), which runs every queued microtask — including chained
//     ones — before we decide anything;
//   * `setTimeout`/`setInterval` are wrapped so outstanding timeouts are
//     counted; a `setInterval` that is never cleared keeps the run open, which
//     is the same lifecycle as any long-running program: it ends when the user
//     stops it or the run times out.
//
// The main thread still enforces its own timeout and terminates the worker on
// stop, so a run can never hang forever.

export const JS_WORKER_SOURCE = `
self.onmessage = function (e) {
  var code = e.data.code;
  var LINE_OFFSET = 2;
  var send = function (type, s) { self.postMessage({ type: type, s: String(s) }); };
  function fmt(v, depth) {
    depth = depth || 0;
    try {
      if (v === null) return "null";
      if (v === undefined) return "undefined";
      var t = typeof v;
      if (t === "string") return depth === 0 ? v : JSON.stringify(v);
      if (t === "number" || t === "boolean" || t === "bigint") return String(v);
      if (t === "function") return "[Function: " + (v.name || "anonymous") + "]";
      if (t === "symbol") return v.toString();
      if (v instanceof Error) return (v.stack || (v.name + ": " + v.message));
      if (depth > 3) return Array.isArray(v) ? "[Array]" : "[Object]";
      if (Array.isArray(v)) {
        if (v.length > 100) return "[Array(" + v.length + ")]";
        return "[ " + v.map(function (x) { return fmt(x, depth + 1); }).join(", ") + " ]";
      }
      var keys = Object.keys(v);
      var parts = keys.slice(0, 50).map(function (k) { return k + ": " + fmt(v[k], depth + 1); });
      if (keys.length > 50) parts.push("...");
      return "{ " + parts.join(", ") + " }";
    } catch (e2) { return String(v); }
  }
  var console = {
    log: function () { send("stdout", Array.prototype.map.call(arguments, function (a) { return fmt(a, 0); }).join(" ")); },
    info: function () { send("stdout", Array.prototype.map.call(arguments, function (a) { return fmt(a, 0); }).join(" ")); },
    warn: function () { send("stderr", Array.prototype.map.call(arguments, function (a) { return fmt(a, 0); }).join(" ")); },
    error: function () { send("stderr", Array.prototype.map.call(arguments, function (a) { return fmt(a, 0); }).join(" ")); },
    debug: function () {},
    table: function () {},
    dir: function () {},
    time: function () {}, timeEnd: function () {}, timeLog: function () {},
    group: function () {}, groupEnd: function () {}, count: function () {}, assert: function () {}, trace: function () {}
  };

  var origSetTimeout = setTimeout;
  var origClearTimeout = clearTimeout;
  var origSetInterval = setInterval;
  var origClearInterval = clearInterval;

  var finished = false;
  var nextTimerId = 1;
  var pendingTimeouts = {};
  var liveIntervals = {};
  var topLevelSettled = false;
  var resolveDrained = null;
  var drained = new Promise(function (resolve) { resolveDrained = resolve; });

  function finish(exitCode) {
    if (finished) return;
    finished = true;
    self.postMessage({ type: "done", exitCode: exitCode });
  }

  function fail(err) {
    if (finished) return;
    var msg = (err && err.stack) ? String(err.stack) : String(err);
    // Rewrite stack lines to point at the user's code
    msg = msg.replace(new RegExp("<anonymous>:(\\\\\\\\d+)", "g"), function (m, n) {
      return "<anonymous>:" + (parseInt(n, 10) - LINE_OFFSET);
    });
    send("stderr", msg);
    finish(1);
  }

  function maybeSettled() {
    if (
      topLevelSettled &&
      Object.keys(pendingTimeouts).length === 0 &&
      Object.keys(liveIntervals).length === 0
    ) {
      var resolve = resolveDrained;
      resolveDrained = null;
      if (resolve) resolve();
    }
  }

  function trackedSetTimeout(fn, ms) {
    var args = Array.prototype.slice.call(arguments, 2);
    var id = nextTimerId++;
    var handle = origSetTimeout(function () {
      delete pendingTimeouts[id];
      try {
        fn.apply(null, args);
      } catch (err) {
        fail(err);
        return;
      }
      maybeSettled();
    }, ms);
    pendingTimeouts[id] = handle;
    return id;
  }

  function trackedClearTimeout(id) {
    if (Object.prototype.hasOwnProperty.call(pendingTimeouts, id)) {
      var handle = pendingTimeouts[id];
      delete pendingTimeouts[id];
      origClearTimeout(handle);
      maybeSettled();
    }
  }

  function trackedSetInterval(fn, ms) {
    var args = Array.prototype.slice.call(arguments, 2);
    var id = nextTimerId++;
    liveIntervals[id] = origSetInterval(function () {
      try {
        fn.apply(null, args);
      } catch (err) {
        fail(err);
      }
    }, ms);
    return id;
  }

  function trackedClearInterval(id) {
    if (Object.prototype.hasOwnProperty.call(liveIntervals, id)) {
      var handle = liveIntervals[id];
      delete liveIntervals[id];
      origClearInterval(handle);
      maybeSettled();
    }
  }

  self.onunhandledrejection = function (event) {
    fail(event ? event.reason : "Unhandled promise rejection");
  };

  (async function () {
    try {
      var fn = new Function(
        "console", "setTimeout", "setInterval", "clearTimeout", "clearInterval",
        '"use strict";' + code
      );
      var result = fn(
        console, trackedSetTimeout, trackedSetInterval,
        trackedClearTimeout, trackedClearInterval
      );
      if (result && typeof result.then === "function") {
        await result;
      }
      topLevelSettled = true;
      // One task boundary flushes every queued microtask, so Promise.then and
      // async/await continuations have already run their console output.
      await new Promise(function (resolve) { origSetTimeout(resolve, 0); });
      maybeSettled();
      await drained;
      finish(0);
    } catch (err) {
      fail(err);
    }
  })();
};
`;
