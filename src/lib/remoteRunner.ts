// Remote compile/run for C, C++, Java, Bash (and as a fallback for Python/JS/TS/SQL)
// via the public Judge0 CE API. Real compilers, real stdout/stderr/exit codes.
// Note: public Judge0 CE is rate-limited; errors surface honestly in the UI.

import {
  ExecutionStoppedError,
  judge0LangFor,
  type LangId,
  type RunResult,
} from "./languages";
import { compileDiagnosticNotes } from "./remoteDiagnostics";

const JUDGE0_ENDPOINT = "https://ce.judge0.com/submissions";
const POLL_INTERVAL_MS = 800;
const MAX_POLL_MS = 45_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type Judge0Status = {
  id: number;
  description: string;
};

type Judge0Result = {
  stdout: string | null;
  stderr: string | null;
  compile_output: string | null;
  message: string | null;
  time: string | null;
  status: Judge0Status;
};

// Judge0 status ids
const STATUS = {
  IN_QUEUE: 1,
  PROCESSING: 2,
  ACCEPTED: 3, // exit code 0
  WRONG_ANSWER: 4,
  TIME_LIMIT_EXCEEDED: 5,
  COMPILATION_ERROR: 6,
  RUNTIME_ERROR_SIGSEGV: 11,
  RUNTIME_ERROR_SIGXFSZ: 12,
  RUNTIME_ERROR_SIGFPE: 13,
  RUNTIME_ERROR_SIGABRT: 14,
  RUNTIME_ERROR_NZEC: 15, // non-zero exit
  RUNTIME_ERROR_OTHER: 16,
  INTERNAL_ERROR: 17,
  EXEC_FORMAT_ERROR: 18,
} as const;

export type RemoteRunHandle = {
  promise: Promise<RunResult>;
  stop: () => void;
};

export function runRemote(
  lang: LangId,
  source: string,
  opts: {
    onStdout: (s: string) => void;
    onStderr: (s: string) => void;
    onInfo: (s: string) => void;
    timeoutMs: number;
  },
): RemoteRunHandle {
  const languageId = judge0LangFor(lang);
  let aborted = false;
  // Aborting the controller also resolves any in-flight sleep/fetch, so a Stop
  // settles the run promptly instead of waiting out the poll interval.
  const controller = new AbortController();
  const abortedPromise = new Promise<void>((resolve) => {
    if (controller.signal.aborted) return resolve();
    controller.signal.addEventListener("abort", () => resolve(), { once: true });
  });

  const promise = (async (): Promise<RunResult> => {
    const start = Date.now();
    if (languageId === null) {
      throw new Error(`No remote runtime configured for ${lang}`);
    }

    opts.onInfo(`Submitting to remote sandbox (${lang})...`);

    const submitRes = await fetch(
      `${JUDGE0_ENDPOINT}?base64_encoded=false`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language_id: languageId,
          source_code: source,
          cpu_time_limit: Math.max(1, Math.min(10, Math.round(opts.timeoutMs / 1000))),
        }),
        signal: controller.signal,
      },
    );

    if (!submitRes.ok) {
      const text = await submitRes.text();
      throw new Error(
        `Remote sandbox rejected the submission (HTTP ${submitRes.status}). ${text.slice(0, 200)}`,
      );
    }

    const { token } = (await submitRes.json()) as { token: string };
    opts.onInfo("Queued — waiting for the sandbox...");

    const deadline = Date.now() + MAX_POLL_MS;
    let result: Judge0Result | null = null;

    while (Date.now() < deadline) {
      if (aborted) {
        throw new ExecutionStoppedError();
      }
      await Promise.race([sleep(POLL_INTERVAL_MS), abortedPromise]);
      if (aborted) {
        throw new ExecutionStoppedError();
      }
      const res = await fetch(
        `${JUDGE0_ENDPOINT}/${token}?base64_encoded=false`,
        { signal: controller.signal },
      );
      if (res.status === 429) {
        opts.onInfo("Rate limited by the free sandbox — retrying...");
        await Promise.race([sleep(2000), abortedPromise]);
        continue;
      }
      if (!res.ok) {
        throw new Error(`Sandbox polling failed (HTTP ${res.status})`);
      }
      const data = (await res.json()) as Judge0Result;
      if (
        data.status.id !== STATUS.IN_QUEUE &&
        data.status.id !== STATUS.PROCESSING
      ) {
        result = data;
        break;
      }
    }

    if (!result) {
      throw new Error("Remote sandbox did not finish in time. Try again.");
    }

    const durationMs = Date.now() - start;
    const stdout = result.stdout ?? "";
    const compileOutput = result.compile_output ?? "";
    const stderr = result.stderr ?? "";

    if (stdout) opts.onStdout(stdout.replace(/\n$/, ""));
    if (compileOutput) opts.onStderr(compileOutput.replace(/\n$/, ""));

    const sid = result.status.id;
    let exitCode = 0;
    let stderrNote = "";

    if (sid === STATUS.ACCEPTED) {
      exitCode = 0;
    } else if (sid === STATUS.COMPILATION_ERROR) {
      exitCode = 1;
      stderrNote = "Compilation failed.";
    } else if (
      sid === STATUS.RUNTIME_ERROR_NZEC ||
      sid === STATUS.RUNTIME_ERROR_SIGSEGV ||
      sid === STATUS.RUNTIME_ERROR_SIGFPE ||
      sid === STATUS.RUNTIME_ERROR_SIGABRT ||
      sid === STATUS.RUNTIME_ERROR_SIGXFSZ ||
      sid === STATUS.RUNTIME_ERROR_OTHER
    ) {
      exitCode = 1;
      stderrNote = `Runtime error: ${result.status.description}`;
    } else if (sid === STATUS.TIME_LIMIT_EXCEEDED) {
      exitCode = 124;
      stderrNote = "Time limit exceeded in the remote sandbox.";
    } else {
      exitCode = 1;
      stderrNote = `Sandbox status: ${result.status.description}`;
    }

    const fullStderr = [stderr, stderrNote].filter(Boolean).join("\n");
    if (fullStderr) opts.onStderr(fullStderr.replace(/\n$/, ""));

    // Context for a known, confusing compile failure. Emitted last, after the
    // compiler's own text and the summary line, as an informational line — the
    // diagnostics are never hidden, reworded or replaced.
    for (const note of compileDiagnosticNotes(lang, compileOutput)) {
      opts.onInfo(note);
    }

    return {
      stdout,
      stderr: fullStderr,
      exitCode,
      compileOutput: compileOutput || undefined,
      engine: "judge0",
      durationMs,
    };
  })().catch((e: unknown) => {
    // Aborting an in-flight fetch rejects with an AbortError; report it as an
    // intentional stop so a user Stop is never displayed as a generic failure.
    if (aborted && !(e instanceof ExecutionStoppedError)) {
      throw new ExecutionStoppedError();
    }
    throw e;
  });

  return {
    promise,
    stop: () => {
      aborted = true;
      // Stops the local tracking (polling and in-flight requests). The remote
      // job is not ours to kill, so this is a request, not a confirmed
      // termination of the sandboxed process.
      controller.abort();
    },
  };
}
