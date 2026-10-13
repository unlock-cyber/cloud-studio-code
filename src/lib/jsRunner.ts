// JavaScript/TypeScript execution in a dedicated Web Worker (real engine).
// The worker is terminated on timeout/stop, so runaway code can always be killed.

import { JS_WORKER_SOURCE } from "./jsWorkerSource";

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

const WORKER_URL = URL.createObjectURL(
  new Blob([JS_WORKER_SOURCE], { type: "text/javascript" }),
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
