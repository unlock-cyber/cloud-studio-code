/** Longest project name the server accepts (see `validateProjectName` in
 *  convex/projects.ts) — kept here so every name field enforces the same rule. */
export const MAX_PROJECT_NAME = 60;

/**
 * Client-side mirror of the server's project-name rules, so a form can point
 * at the problem before a round-trip. Returns an error message, or null when
 * the name is acceptable. The server still validates: this is a convenience,
 * never the authority.
 */
export function validateProjectNameClient(raw: string): string | null {
  const name = raw.trim().replace(/\s+/g, " ");
  if (!name) return "Enter a project name.";
  if (name.length > MAX_PROJECT_NAME) {
    return `Project names can be at most ${MAX_PROJECT_NAME} characters.`;
  }
  if (/[\\/:*?"<>|]/.test(name)) {
    return 'Project names can\'t contain \\ / : * ? " < > |';
  }
  return null;
}

/** Trim + collapse whitespace exactly like the server does before storing. */
export function normalizeProjectName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

export function formatBytesClient(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Short, human relative time ("just now", "12m ago", "3d ago"), falling
 *  back to an absolute date beyond a week. */
export function formatRelativeTime(ts: number, now = Date.now()): string {
  const diff = now - ts;
  if (diff < 0) return "just now";
  if (diff < 60_000) return "just now";
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(ts);
}

export function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
