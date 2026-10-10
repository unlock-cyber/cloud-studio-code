// Orchestrates a "Run": decides the engine from project/file type, saves the
// active file first, streams real output into the terminal, enforces single
// process, and produces real exit codes.
//
// Exactly one execution runs at a time. Run identity, stale-completion
// protection and the stop/termination distinction live in RunSession; this
// module wires the engines to it and never lets a superseded run's output,
// exit code or cancellation hook touch the current one.

import type { Id } from "@/convex/_generated/dataModel";
import {
  ExecutionStoppedError,
  LANGUAGES,
  type LangId,
  type RunResult,
} from "./languages";
import { runPython } from "./pyodideRunner";
import { runJs } from "./jsRunner";
import { transpileTypeScript } from "./tsRunner";
import { runRemote } from "./remoteRunner";
import { runSql } from "./sqlRunner";
import { RunSession, type StopResult } from "./runSession";

export type RunState =
  | "idle"
  | "starting"
  | "running"
  | "success"
  | "failed"
  | "stopped";

export type RunTarget =
  | { kind: "single"; path: string }
  | { kind: "web"; entry: string | null };

export type RunCallbacks = {
  onState: (state: RunState) => void;
  onStdout: (s: string) => void;
  onStderr: (s: string) => void;
  onInfo: (s: string) => void;
  onExit: (code: number) => void;
  onPreview: (html: string) => void;
};

/**
 * Absolute ceiling for a single run — a last resort, not a duration policy.
 * Each engine enforces its own timeout once it is executing (30s, or 45s of
 * remote polling); this only covers a runtime load that hangs before its own
 * timeout ever starts, so a stuck run can never hold the single-run lock
 * forever. It is deliberately far longer than any normal run (including a
 * first-time Pyodide/esbuild download) so it never cuts off real work.
 */
const RUN_WATCHDOG_MS = 300_000;

export class RunManager {
  private session = new RunSession();
  private client = null as unknown as ConvexClientLike;

  setClient(client: ConvexClientLike) {
    this.client = client;
  }

  get isRunning() {
    return this.session.isActive;
  }

  /**
   * Request a stop. Returns whether a run was active and whether an engine
   * cancellation hook actually ran; a request-only stop (Pyodide on the main
   * thread, SQLite) leaves the session active because the execution has not
   * been terminated.
   */
  stop(): StopResult {
    return this.session.stop();
  }

  /**
   * IDE unmount / navigation. Tears down cancellable work and invalidates
   * anything still in flight so late output cannot revive a dead session.
   */
  dispose() {
    this.session.reset();
  }

  async runSingleFile(
    args: {
      projectId: Id<"projects">;
      path: string;
      content: string;
      lang: LangId;
    },
    cb: RunCallbacks,
  ): Promise<void> {
    if (this.session.isActive) {
      cb.onInfo("[warn] A process is already running — stop it first.");
      return;
    }

    const session = this.session;
    const runId = session.begin();
    // Every callback the engine can reach is filtered by run identity, so a
    // superseded run's output never lands in the live terminal.
    const cbs: RunCallbacks = {
      onState: session.guard(runId, cb.onState),
      onStdout: session.guard(runId, cb.onStdout),
      onStderr: session.guard(runId, cb.onStderr),
      onInfo: session.guard(runId, cb.onInfo),
      onExit: session.guard(runId, cb.onExit),
      onPreview: session.guard(runId, cb.onPreview),
    };

    // Resolved before the try so a failure anywhere in the run still has an
    // engine name to report.
    const engine = LANGUAGES[args.lang]?.engine ?? "unknown";
    const started = performance.now();
    let watchdog = 0;

    /**
     * Report the end of the current run. A completion from a superseded run is
     * dropped entirely, and the session is only cleared *after* the callbacks
     * have run — so the current run's final state is still delivered.
     */
    const finish = (result: RunResult) => {
      // Cleared first, and for superseded runs too: the timer belongs to this
      // call, so it must never outlive it (a disposed run still settles).
      if (watchdog) window.clearTimeout(watchdog);
      if (!session.isCurrent(runId)) return;
      cbs.onExit(result.exitCode);
      cbs.onState(
        result.stopped
          ? "stopped"
          : result.exitCode === 0
            ? "success"
            : result.exitCode === 137 || result.exitCode === 130
              ? "stopped"
              : "failed",
      );
      session.finish(runId);
    };

    try {
      // Everything from here on is inside the try: a failure before an engine
      // is even chosen must release the single-run lock, never leave it held.
      watchdog = window.setTimeout(() => {
        if (!session.isCurrent(runId)) return;
        const msg =
          "[timeout] this run exceeded the maximum duration and was abandoned.";
        cbs.onStderr(msg);
        finish({
          stdout: "",
          stderr: msg,
          exitCode: 124,
          engine,
          durationMs: performance.now() - started,
        });
      }, RUN_WATCHDOG_MS);

      const info = LANGUAGES[args.lang];
      if (!info) throw new Error(`Unknown file type: ${args.path}`);

      if (!info.runnable) {
        cbs.onInfo(
          `${args.path} is not an executable file type. Executable: .py .js .mjs .ts .tsx .c .cpp .java .sh .sql — or run a web project (index.html) for live preview.`,
        );
        cbs.onState("idle");
        window.clearTimeout(watchdog);
        session.finish(runId);
        return;
      }

      cbs.onInfo(`— run ${args.path} · ${info.how} —`);

      if (info.engine === "pyodide") {
        cbs.onState("running");
        // Pyodide executes synchronously on the main thread and registers no
        // stop hook, so Stop can only be *requested* here — see the limitation
        // noted on `stop()` above. The run stays current until it settles.
        const result = await runPython(args.content, {
          onStdout: cbs.onStdout,
          onStderr: cbs.onStderr,
          timeoutMs: 30_000,
        });
        finish({
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode,
          engine: "pyodide",
          durationMs: performance.now() - started,
        });
        return;
      }

      if (info.engine === "js-vm") {
        cbs.onState("running");
        const handle = runJs(args.content, {
          onStdout: cbs.onStdout,
          onStderr: cbs.onStderr,
          timeoutMs: 30_000,
        });
        session.addStop(runId, handle.stop);
        const result = await handle.promise;
        finish({
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode,
          engine: "js-vm",
          durationMs: performance.now() - started,
        });
        return;
      }

      if (info.engine === "esbuild") {
        cbs.onInfo("Transpiling TypeScript with esbuild (WASM)...");
        let js: string;
        try {
          js = await transpileTypeScript(args.content, {
            loader: args.path.endsWith(".tsx") ? "tsx" : "ts",
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          cbs.onStderr(msg);
          finish({
            stdout: "",
            stderr: msg,
            exitCode: 1,
            compileOutput: msg,
            engine: "esbuild",
            durationMs: performance.now() - started,
          });
          return;
        }
        if (!session.isCurrent(runId)) return;
        cbs.onInfo("Transpile OK — executing as JavaScript...");
        cbs.onState("running");
        const handle = runJs(js, {
          onStdout: cbs.onStdout,
          onStderr: cbs.onStderr,
          timeoutMs: 30_000,
        });
        session.addStop(runId, handle.stop);
        const result = await handle.promise;
        finish({
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode,
          engine: "esbuild",
          durationMs: performance.now() - started,
        });
        return;
      }

      if (info.engine === "judge0") {
        cbs.onState("running");
        const handle = runRemote(args.lang, args.content, {
          onStdout: cbs.onStdout,
          onStderr: cbs.onStderr,
          onInfo: cbs.onInfo,
          timeoutMs: 15_000,
        });
        session.addStop(runId, handle.stop);
        try {
          finish(await handle.promise);
        } catch (e) {
          if (e instanceof ExecutionStoppedError) {
            // An intentional Stop is not a failure. The submission is no
            // longer tracked; the remote sandbox may still finish its own job,
            // and we do not claim otherwise.
            const msg =
              "[stopped] execution was stopped by the user. The remote sandbox job is no longer tracked and may still finish in the background.";
            cbs.onStderr(msg);
            finish({
              stdout: "",
              stderr: msg,
              exitCode: 130,
              stopped: true,
              engine: "judge0",
              durationMs: performance.now() - started,
            });
            return;
          }
          const msg = e instanceof Error ? e.message : String(e);
          cbs.onStderr(msg);
          finish({
            stdout: "",
            stderr: msg,
            exitCode: 1,
            engine: "judge0",
            durationMs: performance.now() - started,
          });
        }
        return;
      }

      if (info.engine === "sqlite") {
        cbs.onState("running");
        let dbBytes: Uint8Array | null = null;
        try {
          const stored = await this.client.action<{ dataBase64: string | null }>(
            "load",
            { projectId: args.projectId },
          );
          if (!session.isCurrent(runId)) return;
          if (stored?.dataBase64) {
            const binary = atob(stored.dataBase64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            dbBytes = bytes;
            cbs.onInfo("Loaded persisted SQLite database for this project.");
          }
        } catch (e) {
          if (!session.isCurrent(runId)) return;
          // The action only returns null when there is genuinely no database;
          // a throw means loading failed (missing/unexpired auth, network).
          // Say so instead of pretending the project simply has no data.
          const msg = e instanceof Error ? e.message : String(e);
          cbs.onInfo(
            `[db] Could not load the saved database (${msg}). Starting a fresh database — changes will not be saved until this is fixed.`,
          );
        }

        const result = await runSql(args.content, {
          dbBytes,
          onStdout: cbs.onStdout,
          onStderr: cbs.onStderr,
          timeoutMs: 30_000,
        });

        // Persist resulting DB (best effort; a failure here is shown honestly)
        if (result.dbBytes && result.dbBytes.length > 0) {
          try {
            let binary = "";
            const chunk = 0x8000;
            for (let i = 0; i < result.dbBytes.length; i += chunk) {
              binary += String.fromCharCode(...result.dbBytes.subarray(i, i + chunk));
            }
            await this.client.action<{ ok: boolean }>("save", {
              projectId: args.projectId,
              dataBase64: btoa(binary),
              size: result.dbBytes.length,
            });
            if (session.isCurrent(runId)) {
              cbs.onInfo(`Database persisted (${(result.dbBytes.length / 1024).toFixed(1)} KB).`);
            }
          } catch (e) {
            if (session.isCurrent(runId)) {
              cbs.onStderr(
                `[db] Failed to persist the database (${e instanceof Error ? e.message : String(e)}). The query results above are real, but this project's database was not saved.`,
              );
            }
          }
        }

        finish({
          stdout: "",
          stderr: result.stderr,
          exitCode: result.exitCode,
          engine: "sqlite",
          durationMs: performance.now() - started,
        });
        return;
      }

      cbs.onInfo(`Engine "${info.engine}" is not available for this file type.`);
      cbs.onState("idle");
      window.clearTimeout(watchdog);
      session.finish(runId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      cbs.onStderr(msg);
      finish({
        stdout: "",
        stderr: msg,
        exitCode: 1,
        engine,
        durationMs: performance.now() - started,
      });
    }
  }
}

export type ConvexClientLike = {
  action: <R>(name: "load" | "save", args: Record<string, unknown>) => Promise<R>;
};

export const runManager = new RunManager();
