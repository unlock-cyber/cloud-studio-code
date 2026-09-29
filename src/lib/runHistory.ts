// Lightweight Run History: a short local log of what the user recently ran in
// this project, so the terminal can answer "what did I just run?" without any
// new backend. Kept in localStorage (like the theme and the guest context) and
// capped at a handful of entries — never sent anywhere.

export type RunHistoryState = "success" | "failed" | "stopped";

export type RunHistoryEntry = {
  id: string;
  path: string;
  /** Human label of the runtime, e.g. "Python". */
  lang: string;
  state: RunHistoryState;
  exitCode: number;
  durationMs: number;
  ts: number;
};

export const RUN_HISTORY_MAX = 8;

const key = (projectId: string) => `ccloud-run-history:${projectId}`;

function isEntry(value: unknown): value is RunHistoryEntry {
  if (!value || typeof value !== "object") return false;
  const e = value as Record<string, unknown>;
  return (
    typeof e.id === "string" &&
    typeof e.path === "string" &&
    typeof e.lang === "string" &&
    (e.state === "success" || e.state === "failed" || e.state === "stopped") &&
    typeof e.exitCode === "number" &&
    typeof e.durationMs === "number" &&
    typeof e.ts === "number"
  );
}

/** Newest first, capped. */
export function pushRunHistory(
  prev: RunHistoryEntry[],
  entry: RunHistoryEntry,
): RunHistoryEntry[] {
  return [entry, ...prev].slice(0, RUN_HISTORY_MAX);
}

export function loadRunHistory(projectId: string): RunHistoryEntry[] {
  try {
    const raw = localStorage.getItem(key(projectId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isEntry).slice(0, RUN_HISTORY_MAX);
  } catch {
    return [];
  }
}

export function saveRunHistory(
  projectId: string,
  entries: RunHistoryEntry[],
): void {
  try {
    localStorage.setItem(key(projectId), JSON.stringify(entries.slice(0, RUN_HISTORY_MAX)));
  } catch {
    // localStorage unavailable — history stays in memory for this session.
  }
}

export function formatRunDuration(ms: number): string {
  if (ms < 1000) return `${Math.max(1, Math.round(ms))} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms / 60_000)}m`;
}

export function formatRunTimeAgo(ts: number, now: number = Date.now()): string {
  const secs = Math.max(0, Math.round((now - ts) / 1000));
  if (secs < 10) return "just now";
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
