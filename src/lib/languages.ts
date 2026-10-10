// Central registry of execution engines and language metadata.
// Every "run" goes through one of these engines. No fake outputs anywhere.

export type RunResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
  compileOutput?: string;
  engine: string;
  durationMs: number;
  /**
   * Set when the user explicitly stopped the execution. This is separate from
   * the exit code: a stopped run is reported as "stopped" by the RunManager
   * rather than being mistaken for a failure.
   */
  stopped?: boolean;
};

/**
 * Raised by runners when an execution is aborted by the user's Stop. Kept
 * distinct from real errors so an intentional stop is never displayed as a
 * generic execution failure.
 */
export class ExecutionStoppedError extends Error {
  constructor(message = "execution was stopped by the user.") {
    super(message);
    this.name = "ExecutionStoppedError";
  }
}

export type EngineId =
  | "pyodide"
  | "judge0"
  | "js-vm"
  | "esbuild"
  | "sqlite"
  | "web-preview"
  | "unsupported";

export type LangId =
  | "python"
  | "javascript"
  | "typescript"
  | "c"
  | "cpp"
  | "java"
  | "bash"
  | "sql"
  | "html"
  | "css"
  | "json"
  | "markdown"
  | "yaml"
  | "xml"
  | "plaintext";

const EXT_LANG: Record<string, LangId> = {
  py: "python",
  pyw: "python",
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  jsx: "javascript",
  ts: "typescript",
  tsx: "typescript",
  c: "c",
  h: "c",
  cpp: "cpp",
  cc: "cpp",
  cxx: "cpp",
  hpp: "cpp",
  hh: "cpp",
  java: "java",
  sh: "bash",
  bash: "bash",
  sql: "sql",
  html: "html",
  htm: "html",
  css: "css",
  scss: "css",
  json: "json",
  jsonc: "json",
  md: "markdown",
  markdown: "markdown",
  yml: "yaml",
  yaml: "yaml",
  xml: "xml",
  svg: "xml",
  txt: "plaintext",
};

export function extOf(path: string): string {
  const name = path.split("/").pop() ?? path;
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}

export function langFromPath(path: string): LangId {
  const name = path.split("/").pop() ?? path;
  if (name.toLowerCase() === "dockerfile") return "plaintext";
  if (name.toLowerCase().startsWith("makefile")) return "plaintext";
  return EXT_LANG[extOf(path)] ?? "plaintext";
}

// Monaco language ids
export function monacoLang(lang: LangId): string {
  switch (lang) {
    case "python": return "python";
    case "javascript": return "javascript";
    case "typescript": return "typescript";
    case "c": case "cpp": return "cpp";
    case "java": return "java";
    case "bash": return "shell";
    case "sql": return "sql";
    case "html": return "html";
    case "css": return "css";
    case "json": return "json";
    case "markdown": return "markdown";
    case "yaml": return "yaml";
    case "xml": return "xml";
    default: return "plaintext";
  }
}

export type ExecMode = "browser" | "remote" | "preview" | "none";

export type LangInfo = {
  id: LangId;
  label: string;
  engine: EngineId;
  mode: ExecMode;
  /** short description shown in the UI */
  how: string;
  runnable: boolean;
};

export const LANGUAGES: Record<LangId, LangInfo> = {
  python: {
    id: "python", label: "Python", engine: "pyodide", mode: "browser", runnable: true,
    how: "Runs on real CPython 3.12 (Pyodide/WebAssembly) in your browser.",
  },
  javascript: {
    id: "javascript", label: "JavaScript", engine: "js-vm", mode: "browser", runnable: true,
    how: "Runs in a sandboxed iframe VM (real JS engine).",
  },
  typescript: {
    id: "typescript", label: "TypeScript", engine: "esbuild", mode: "browser", runnable: true,
    how: "Transpiled with esbuild (WebAssembly), then executed as JavaScript.",
  },
  c: {
    id: "c", label: "C", engine: "judge0", mode: "remote", runnable: true,
    how: "Compiled and run remotely on GCC (Judge0 sandbox).",
  },
  cpp: {
    id: "cpp", label: "C++", engine: "judge0", mode: "remote", runnable: true,
    how: "Compiled and run remotely on G++ (Judge0 sandbox).",
  },
  java: {
    id: "java", label: "Java", engine: "judge0", mode: "remote", runnable: true,
    how: "Compiled and run remotely on OpenJDK (Judge0 sandbox).",
  },
  bash: {
    id: "bash", label: "Bash", engine: "judge0", mode: "remote", runnable: true,
    how: "Executed remotely in a Bash 5 sandbox (Judge0).",
  },
  sql: {
    id: "sql", label: "SQL", engine: "sqlite", mode: "browser", runnable: true,
    how: "Executed on real SQLite compiled to WebAssembly (sql.js).",
  },
  html: {
    id: "html", label: "HTML", engine: "web-preview", mode: "preview", runnable: true,
    how: "Rendered live in a sandboxed preview iframe.",
  },
  css: { id: "css", label: "CSS", engine: "unsupported", mode: "none", runnable: false, how: "Previewed as part of the web project." },
  json: { id: "json", label: "JSON", engine: "unsupported", mode: "none", runnable: false, how: "Structured preview available." },
  markdown: { id: "markdown", label: "Markdown", engine: "unsupported", mode: "none", runnable: false, how: "Rendered Markdown preview available." },
  yaml: { id: "yaml", label: "YAML", engine: "unsupported", mode: "none", runnable: false, how: "Structured preview available." },
  xml: { id: "xml", label: "XML", engine: "unsupported", mode: "none", runnable: false, how: "Structured preview available." },
  plaintext: { id: "plaintext", label: "Plain text", engine: "unsupported", mode: "none", runnable: false, how: "No execution for this file type." },
};

export type ProjectKind = "html" | "python" | "c" | "cpp" | "java" | "ts" | "node" | "sql" | "blank" | "imported";

export function projectRunKind(kind: ProjectKind): "web" | "single" {
  return kind === "html" ? "web" : "single";
}

// ---------------------------------------------------------------------------
// Judge0 language ids (ce.judge0.com)
// ---------------------------------------------------------------------------

export const JUDGE0_LANGS = {
  c_gcc14: 103,        // C (GCC 14.1.0)
  cpp_gcc14: 105,      // C++ (GCC 14.1.0)
  java_jdk17: 91,      // Java (JDK 17.0.6)
  python_313: 109,     // Python (3.13.2)
  node_22: 102,        // JavaScript (Node.js 22.08.0)
  ts_56: 101,          // TypeScript (5.6.2)
  bash_5: 46,          // Bash (5.0.0)
  sqlite: 82,          // SQL (SQLite 3.27.2)
} as const;

export function judge0LangFor(lang: LangId): number | null {
  switch (lang) {
    case "c": return JUDGE0_LANGS.c_gcc14;
    case "cpp": return JUDGE0_LANGS.cpp_gcc14;
    case "java": return JUDGE0_LANGS.java_jdk17;
    case "python": return JUDGE0_LANGS.python_313;
    case "javascript": return JUDGE0_LANGS.node_22;
    case "typescript": return JUDGE0_LANGS.ts_56;
    case "bash": return JUDGE0_LANGS.bash_5;
    case "sql": return JUDGE0_LANGS.sqlite;
    default: return null;
  }
}

export function engineLabel(engine: EngineId): string {
  switch (engine) {
    case "pyodide": return "Pyodide (CPython WASM)";
    case "judge0": return "Judge0 sandbox";
    case "js-vm": return "Browser JS VM";
    case "esbuild": return "esbuild + JS VM";
    case "sqlite": return "SQLite WASM";
    case "web-preview": return "Live preview";
    default: return "Not executable";
  }
}
