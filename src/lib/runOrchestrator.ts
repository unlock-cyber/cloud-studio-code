// Orchestrates a "Run": decides the engine from project/file type, saves the
// active file first, streams real output into the terminal, enforces single
// process, and produces real exit codes.

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  langFromPath,
  LANGUAGES,
  type LangId,
  type RunResult,
} from "./languages";
import { runPython } from "./pyodideRunner";
import { runJs } from "./jsRunner";
import { transpileTypeScript } from "./tsRunner";
import { runRemote } from "./remoteRunner";
import { runSql } from "./sqlRunner";

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

export class RunManager {
  private active = false;
  private stopFns: Array<() => void> = [];
  private client = null as unknown as ConvexClientLike;

  setClient(client: ConvexClientLike) {
    this.client = client;
  }

  get isRunning() {
    return this.active;
  }

  stop() {
    for (const fn of this.stopFns) {
      try {
        fn();
      } catch {
        /* ignore */
      }
    }
    this.stopFns = [];
    if (this.active) {
      this.active = false;
    }
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
    if (this.active) {
      cb.onInfo("[warn] A process is already running — stop it first.");
      return;
    }
    this.active = true;
    cb.onState("starting");

    const finish = (result: RunResult) => {
      cb.onExit(result.exitCode);
      cb.onState(
        result.exitCode === 0
          ? "success"
          : result.exitCode === 137
            ? "stopped"
            : "failed",
      );
      this.active = false;
      this.stopFns = [];
    };

    const info = LANGUAGES[args.lang];
    const started = performance.now();

    try {
      if (!info.runnable) {
        cb.onInfo(
          `${args.path} is not an executable file type. Executable: .py .js .mjs .ts .tsx .c .cpp .java .sh .sql — or run a web project (index.html) for live preview.`,
        );
        cb.onState("idle");
        this.active = false;
        return;
      }

      cb.onInfo(`— run ${args.path} · ${info.how} —`);

      if (info.engine === "pyodide") {
        cb.onState("running");
        const result = await runPython(args.content, {
          onStdout: cb.onStdout,
          onStderr: cb.onStderr,
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
        cb.onState("running");
        const handle = runJs(args.content, {
          onStdout: cb.onStdout,
          onStderr: cb.onStderr,
          timeoutMs: 30_000,
        });
        this.stopFns.push(handle.stop);
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
        cb.onInfo("Transpiling TypeScript with esbuild (WASM)...");
        let js: string;
        try {
          js = await transpileTypeScript(args.content, {
            loader: args.path.endsWith(".tsx") ? "tsx" : "ts",
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          cb.onStderr(msg);
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
        cb.onInfo("Transpile OK — executing as JavaScript...");
        cb.onState("running");
        const handle = runJs(js, {
          onStdout: cb.onStdout,
          onStderr: cb.onStderr,
          timeoutMs: 30_000,
        });
        this.stopFns.push(handle.stop);
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
        cb.onState("running");
        const handle = runRemote(args.lang, args.content, {
          onStdout: cb.onStdout,
          onStderr: cb.onStderr,
          onInfo: cb.onInfo,
          timeoutMs: 15_000,
        });
        this.stopFns.push(handle.stop);
        try {
          const result = await handle.promise;
          finish(result);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          cb.onStderr(msg);
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
        cb.onState("running");
        let dbBytes: Uint8Array | null = null;
        try {
          const stored = await this.client.action<{ dataBase64: string | null }>(
            "load",
            { projectId: args.projectId },
          );
          if (stored?.dataBase64) {
            const binary = atob(stored.dataBase64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            dbBytes = bytes;
            cb.onInfo("Loaded persisted SQLite database for this project.");
          }
        } catch {
          cb.onInfo("No persisted database found — starting a fresh in-memory database.");
        }

        const result = await runSql(args.content, {
          dbBytes,
          onStdout: cb.onStdout,
          onStderr: cb.onStderr,
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
            cb.onInfo(`Database persisted (${(result.dbBytes.length / 1024).toFixed(1)} KB).`);
          } catch (e) {
            cb.onInfo(
              `Note: could not persist the database (${e instanceof Error ? e.message : String(e)}). Query results are still real.`,
            );
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

      cb.onInfo(`Engine "${info.engine}" is not available for this file type.`);
      cb.onState("idle");
      this.active = false;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      cb.onStderr(msg);
      finish({
        stdout: "",
        stderr: msg,
        exitCode: 1,
        engine: info.engine,
        durationMs: performance.now() - started,
      });
    }
  }
}

export type ConvexClientLike = {
  action: <R>(name: "load" | "save", args: Record<string, unknown>) => Promise<R>;
};

export const runManager = new RunManager();
