import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, ExternalLink, Globe, X, AlertTriangle, Loader2 } from "lucide-react";

export type PreviewMessage =
  | { type: "error"; message: string; line?: number; source?: string }
  | { type: "console"; level: "log" | "warn" | "error"; text: string }
  | { type: "ready" }
  | { type: "asset-error"; src: string };

type Props = {
  html: string;
  onMessage: (msg: PreviewMessage) => void;
  onClose: () => void;
};

/**
 * Keep the same sandbox the in-app preview uses. The preview runs with an
 * opaque origin, so user-authored code cannot reach this app's storage or
 * session.
 */
const SANDBOX = "allow-scripts allow-forms allow-popups allow-modals";

function escapeAttr(s: string): string {
  // Only " and & can terminate/alter the srcdoc attribute we build below; the
  // document itself is then parsed normally by the iframe.
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

/**
 * A tab opened from a blob: URL would inherit this app's origin and could read
 * its storage (including the session token). Wrapping the preview in a static
 * page whose only content is a sandboxed iframe keeps user code in an opaque
 * origin — the same boundary the in-app preview already has.
 */
function isolatedDocument(html: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Live preview</title>
  <style>
    html, body { margin: 0; height: 100%; background: #fff; }
    iframe { display: block; width: 100%; height: 100%; border: 0; }
  </style>
</head>
<body>
  <iframe title="Live preview" sandbox="${SANDBOX}" srcdoc="${escapeAttr(html)}"></iframe>
</body>
</html>`;
}

export function PreviewPanel({ html, onMessage, onClose }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [reloadKey, setReloadKey] = useState(0);
  // In-panel readiness/error state. The terminal still receives every message
  // (onMessage), so nothing is duplicated — this only makes the feedback
  // visible where the preview actually is, which matters on mobile where the
  // terminal is a separate panel.
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const data = event.data as (PreviewMessage & { __preview?: boolean }) | null;
      if (!data || !data.__preview) return;
      if (data.type === "ready") {
        // Every document (including a rebuilt preview) starts by signalling
        // ready, so this is also where the previous document's error is
        // cleared — the state never needs a separate reset effect.
        setReady(true);
        setError(null);
      } else if (data.type === "error") {
        setError(`${data.message}${data.line ? ` (line ${data.line})` : ""}`);
      } else if (data.type === "asset-error") {
        setError(`Missing asset: ${data.src}`);
      }
      onMessage(data as PreviewMessage);
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [onMessage]);

  const openExternal = () => {
    if (!html) return;
    const blob = new Blob([isolatedDocument(html)], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  if (!html) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-background p-6 text-center">
        <Globe className="size-8 text-muted-foreground/50" />
        <p className="text-sm text-foreground/80">No web preview</p>
        <p className="max-w-xs text-xs text-muted-foreground">
          Add an <code className="text-foreground/80">index.html</code> (or any .html file) and run the project to see a live preview here.
        </p>
        <Button variant="ghost" size="sm" className="h-7 text-muted-foreground" onClick={onClose}>
          <X className="size-3.5" /> Close
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border/60 px-3">
        <Globe className="size-3.5 text-muted-foreground" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Live Preview</span>
        {!ready && !error && (
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Loader2 className="size-3 animate-spin" />
            Loading…
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground" onClick={() => setReloadKey((k) => k + 1)} title="Reload preview">
            <RefreshCw className="size-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground" onClick={openExternal} title="Open preview in a new tab">
            <ExternalLink className="size-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground" onClick={onClose} title="Close preview">
            <X className="size-3.5" />
          </Button>
        </div>
      </div>
      {error && (
        <div className="flex shrink-0 items-start gap-2 border-b border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive" role="alert">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          <span className="min-w-0 break-words font-mono">{error}</span>
        </div>
      )}
      <div className="min-h-0 flex-1 bg-white">
        <iframe
          key={reloadKey}
          ref={iframeRef}
          title="Live preview"
          className="size-full border-0"
          sandbox={SANDBOX}
          srcDoc={html}
        />
      </div>
    </div>
  );
}
