// Real Pyodide (CPython compiled to WebAssembly) runner.
// Loads once, streams stdout/stderr, enforces a timeout, surfaces tracebacks.

const PYODIDE_VERSION = "0.26.4";
const BASE = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

type PyodideApi = {
  runPythonAsync: (code: string) => Promise<unknown>;
  setStdout: (opts: { batched: (s: string) => void }) => void;
  setStderr: (opts: { batched: (s: string) => void }) => void;
};

declare global {
  interface Window {
    loadPyodide?: (opts: { indexURL: string }) => Promise<PyodideApi>;
  }
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const el = document.createElement("script");
    el.src = src;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(el);
  });
}

let pyodidePromise: Promise<PyodideApi> | null = null;

function ensurePyodide(): Promise<PyodideApi> {
  if (pyodidePromise !== null) {
    return pyodidePromise;
  }
  const p = (async () => {
    if (!window.loadPyodide) {
      await loadScript(`${BASE}pyodide.js`);
    }
    if (!window.loadPyodide) {
      throw new Error("Pyodide failed to initialize");
    }
    return await window.loadPyodide({ indexURL: BASE });
  })().catch((e) => {
    pyodidePromise = null;
    throw e;
  });
  pyodidePromise = p;
  return p;
}

export type PyRunResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

export async function runPython(
  code: string,
  opts: {
    onStdout: (s: string) => void;
    onStderr: (s: string) => void;
    timeoutMs: number;
  },
): Promise<PyRunResult> {
  const py = await ensurePyodide();

  let out = "";
  let err = "";
  let done = false;

  return await new Promise<PyRunResult>((resolve) => {
    const finish = (exitCode: number) => {
      if (done) {
        return;
      }
      done = true;
      window.clearTimeout(timer);
      resolve({ stdout: out, stderr: err, exitCode });
    };

    const timer = window.setTimeout(() => {
      const msg = `[timeout] execution exceeded ${Math.round(opts.timeoutMs / 1000)}s and was stopped.`;
      err += "\n" + msg;
      opts.onStderr(msg);
      finish(1);
    }, opts.timeoutMs);

    py.setStdout({
      batched: (s: string) => {
        out += s + "\n";
        opts.onStdout(s);
      },
    });

    py.setStderr({
      batched: (s: string) => {
        err += s + "\n";
        opts.onStderr(s);
      },
    });

    (async () => {
      try {
        await py.runPythonAsync(code);
        finish(0);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const line = msg.endsWith("\n") ? msg : msg + "\n";
        err += line;
        opts.onStderr(line.trimEnd());
        finish(1);
      }
    })();
  });
}

let warmupState: "idle" | "loading" | "ready" | "error" = "idle";
const warmupListeners = new Set<(s: "idle" | "loading" | "ready" | "error") => void>();

function setWarmup(s: "idle" | "loading" | "ready" | "error") {
  warmupState = s;
  warmupListeners.forEach((fn) => fn(s));
}

export function startPyodideWarmup() {
  if (warmupState === "idle") {
    setWarmup("loading");
    ensurePyodide()
      .then(() => setWarmup("ready"))
      .catch(() => setWarmup("error"));
  }
}

export function getPyodideWarmup() {
  return warmupState;
}

export function subscribePyodideWarmup(fn: (s: "idle" | "loading" | "ready" | "error") => void) {
  warmupListeners.add(fn);
  return () => warmupListeners.delete(fn);
}
