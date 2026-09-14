// TypeScript transpilation with esbuild compiled to WebAssembly.
// Real transpile; diagnostics are surfaced as compile output.

import type { RunResult } from "./languages";

let esbuildPromise: Promise<typeof import("esbuild-wasm")> | null = null;

export function ensureEsbuild(): Promise<typeof import("esbuild-wasm")> {
  if (!esbuildPromise) {
    esbuildPromise = import("esbuild-wasm").then(async (mod) => {
      await mod.initialize({
        worker: true,
        wasmURL: "https://cdn.jsdelivr.net/npm/esbuild-wasm@0.28.2/esbuild.wasm",
      });
      return mod;
    });
  }
  return esbuildPromise;
}

let warmed = false;

export async function warmEsbuild(): Promise<void> {
  if (warmed) return;
  await ensureEsbuild();
  warmed = true;
}

/** Transpile TS/TSX to JS. Throws with a readable message on syntax errors. */
export async function transpileTypeScript(
  code: string,
  opts: { loader?: "ts" | "tsx" } = {},
): Promise<string> {
  const esbuild = await ensureEsbuild();
  try {
    const result = await esbuild.transform(code, {
      loader: opts.loader ?? "ts",
      target: "es2022",
      format: "iife",
      jsx: "automatic",
    });
    return result.code;
  } catch (e) {
    const err = e as { errors?: Array<{ text: string; location?: { line: number; column: number; lineText: string } }> };
    if (err?.errors?.length) {
      const lines = err.errors
        .map((er) => {
          const loc = er.location
            ? ` (line ${er.location.line}, col ${er.location.column})`
            : "";
          return `TS error${loc}: ${er.text}`;
        })
        .join("\n");
      throw new Error(lines);
    }
    throw e instanceof Error ? e : new Error(String(e));
  }
}

export type { RunResult };
