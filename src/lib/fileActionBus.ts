// A one-slot request channel between the IDE chrome (the command palette) and
// the file explorer. The explorer is mounted in two different places — the
// desktop panel and the mobile drawer — and only one of them exists at a time,
// so a tiny channel lets a request reach whichever one is mounted without
// threading a new prop through every call site.

export type FileActionKind = "rename" | "move" | "delete";

export type FileActionRequest = {
  kind: FileActionKind;
  path: string;
  /** Unique per request, so a dialog can consume exactly the one it opened. */
  token: number;
};

let pending: FileActionRequest | null = null;
let tokenSeq = 0;
const listeners = new Set<(request: FileActionRequest) => void>();

/** Ask the mounted explorer to open its dialog for `path`. */
export function requestFileDialog(kind: FileActionKind, path: string): void {
  const request: FileActionRequest = { kind, path, token: ++tokenSeq };
  pending = request;
  // Copy first: a listener may unsubscribe while we iterate.
  for (const listener of [...listeners]) listener(request);
}

/** Mark a request handled so it can't reopen a dialog if the explorer remounts. */
export function consumeFileDialog(token: number): void {
  if (pending?.token === token) pending = null;
}

/**
 * Subscribe to requests. A request that arrived just before the explorer
 * mounted (e.g. the mobile drawer opens on demand) is delivered right away.
 */
export function subscribeFileDialogs(
  listener: (request: FileActionRequest) => void,
): () => void {
  listeners.add(listener);
  if (pending) listener(pending);
  return () => {
    listeners.delete(listener);
  };
}
