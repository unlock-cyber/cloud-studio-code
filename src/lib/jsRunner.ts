// JavaScript/TypeScript execution in a dedicated Web Worker (real engine).
// The worker is terminated on timeout/stop, so runaway code can always be killed.

type Sink = (s: string) => void;

export type JsRunResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

export type JsRunHandle = {
  promise: Promise<JsRunResult>;
  stop: () => void;
};

const WORKER_SOURCE = `
self.onmessage = async function (e) {
  const code = e.data.code;
  const LINE_OFFSET = 2;
  const send = function (type, s) { self.postMessage({ type: type, s: String(s) }); };
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
  try {
    var fn = new Function("console", '"use strict";' + code);
    var result = fn(console);
    if (result && typeof result.then === "function") {
      await result;
    }
    self.postMessage({ type: "done", exitCode: 0 });
  } catch (err) {
    var msg = (err && err.stack) ? String(err.stack) : String(err);
    // Rewrite stack lines to point at the user's code
    msg = msg.replace(new RegExp("<anonymous>:(\\\\d+)", "g"), function (m, n) {
      return "<anonymous>:" + (parseInt(n, 10) - LINE_OFFSET);
    });
    send("stderr", msg);
    self.postMessage({ type: "done", exitCode: 1 });
  }
};
`;

const WORKER_URL = URL.createObjectURL(
  new Blob([WORKER_SOURCE], { type: "text/javascript" }),
);

/** Run JS code in a worker. Returns a handle so long-running code can be stopped. */
export function runJs(
  code: string,
  opts: { onStdout: Sink; onStderr: Sink; timeoutMs: number },
): JsRunHandle {
  let worker: Worker | null = new Worker(WORKER_URL);
  let out = "";
  let err = "";
  let settled = false;
  let finishRef: ((result: JsRunResult) => void) | null = null;

  const promise = new Promise<JsRunResult>((resolve) => {
    const finish = (result: JsRunResult) => {
      if (settled) return;
      settled = true;
      if (worker) {
        worker.terminate();
        worker = null;
      }
      resolve(result);
    };
    finishRef = finish;

    const timer = window.setTimeout(() => {
      finish({
        stdout: out,
        stderr:
          err +
          `\n[timeout] execution exceeded ${Math.round(opts.timeoutMs / 1000)}s and was stopped.`,
        exitCode: 1,
      });
    }, opts.timeoutMs);

    if (!worker) return;
    worker.onmessage = (e: MessageEvent) => {
      const d = e.data as { type: string; s?: string; exitCode?: number };
      if (d.type === "stdout" && typeof d.s === "string") {
        out += d.s + "\n";
        opts.onStdout(d.s);
      } else if (d.type === "stderr" && typeof d.s === "string") {
        err += d.s + "\n";
        opts.onStderr(d.s);
      } else if (d.type === "done") {
        window.clearTimeout(timer);
        finish({ stdout: out, stderr: err, exitCode: d.exitCode ?? 0 });
      }
    };
    worker.onerror = (e: ErrorEvent) => {
      window.clearTimeout(timer);
      const msg = e.message || "Worker error";
      err += msg + "\n";
      opts.onStderr(msg);
      finish({ stdout: out, stderr: err, exitCode: 1 });
    };
    worker.postMessage({ code });
  });

  return {
    promise,
    stop: () => {
      if (!settled) {
        if (worker) {
          worker.terminate();
          worker = null;
        }
        opts.onStderr("[stopped] execution was stopped by the user.");
        if (finishRef) finishRef({ stdout: out, stderr: err, exitCode: 137 });
      }
    },
  };
}
