import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, ExternalLink, Globe, X } from "lucide-react";

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

export function PreviewPanel({ html, onMessage, onClose }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [lastBuild, setLastBuild] = useState<string | null>(null);

  const srcDoc = useMemo(() => html, [html, reloadKey]);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const data = event.data as (PreviewMessage & { __preview?: boolean }) | null;
      if (data && data.__preview) {
        onMessage(data as PreviewMessage);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [onMessage]);

  const openExternal = () => {
    if (!html) return;
    const blob = new Blob([html], { type: "text/html" });
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
      <div className="min-h-0 flex-1 bg-white">
        <iframe
          key={reloadKey}
          ref={iframeRef}
          title="Live preview"
          className="size-full border-0"
          sandbox="allow-scripts allow-forms allow-popups allow-modals"
          srcDoc={srcDoc}
        />
      </div>
    </div>
  );
}
