// Lightweight Recent Files: a short, per-project list of the files opened most
// recently, so quick navigation (the command palette) can offer them before a
// full search. Local only — like the run history — capped, and it stores paths
// only: never file contents, and never anything sent anywhere.

export const RECENT_FILES_MAX = 8;

const key = (projectId: string) => `ccloud-recent-files:${projectId}`;

/**
 * Newest first, capped, no duplicates. Returns the *same array reference* when
 * nothing changes (the file is already the most recent one), so callers can
 * skip a redundant state update and localStorage write.
 */
export function pushRecentFile(prev: string[], path: string): string[] {
  if (prev[0] === path) return prev;
  return [path, ...prev.filter((p) => p !== path)].slice(0, RECENT_FILES_MAX);
}

export function loadRecentFiles(projectId: string): string[] {
  try {
    const raw = localStorage.getItem(key(projectId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((p): p is string => typeof p === "string" && p.length > 0).slice(0, RECENT_FILES_MAX);
  } catch {
    return [];
  }
}

export function saveRecentFiles(projectId: string, paths: string[]): void {
  try {
    localStorage.setItem(key(projectId), JSON.stringify(paths.slice(0, RECENT_FILES_MAX)));
  } catch {
    // localStorage unavailable — recents stay in memory for this session.
  }
}
