import { useCallback, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Check, Copy, Link2, Loader2 } from "lucide-react";

type Props = {
  projectId: Id<"projects">;
  projectName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Owner-facing sharing controls for one project.
 *
 * The link is a plain read-only URL under /s/<token>; the backend resolves it
 * without authentication and hands back only what a viewer may see. The token
 * is minted server-side, and revoking clears it there — closing this dialog
 * never leaves a link alive on the client's word alone.
 */
export function ShareDialog({ projectId, projectName, open, onOpenChange }: Props) {
  // Share state is only fetched while the dialog is open: the IDE mounts this
  // component for the whole session, and there is no reason to ask the backend
  // about sharing until the owner opens it.
  const share = useQuery(api.projects.getShare, open ? { projectId } : "skip");
  const setSharing = useMutation(api.projects.setSharing);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const enabled = share?.enabled ?? false;
  const token = share?.token ?? null;
  const shareUrl = token ? `${window.location.origin}/s/${token}` : null;

  // One in-flight request at a time: the switch and both buttons share `busy`,
  // so a double click can't fire two share/revoke mutations.
  const handleToggle = useCallback(
    async (next: boolean) => {
      if (busy) return;
      setBusy(true);
      setError(null);
      setCopied(false);
      try {
        await setSharing({ projectId, enabled: next });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not update sharing.");
      } finally {
        setBusy(false);
      }
    },
    [busy, projectId, setSharing],
  );

  const handleCopy = useCallback(async () => {
    if (!shareUrl) return;
    setError(null);
    try {
      if (!navigator.clipboard) throw new Error("unavailable");
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Copying is blocked by your browser — select the link and copy it manually.");
    }
  }, [shareUrl]);

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Link2 className="size-4" /> Share project
          </DialogTitle>
          <DialogDescription className="break-words">
            {projectName ? `“${projectName}” — ` : ""}anyone with the link can view the files and,
            for web projects, the live preview. They can&rsquo;t edit, run or delete anything.
          </DialogDescription>
        </DialogHeader>

        {share === undefined ? (
          <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Checking sharing…
          </div>
        ) : (
          <div className="space-y-4 py-1">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium">Read-only link</p>
                <p className="text-xs text-muted-foreground">
                  {enabled ? "Sharing is on." : "Sharing is off."}
                </p>
              </div>
              <Switch
                checked={enabled}
                disabled={busy}
                onCheckedChange={(next) => void handleToggle(next)}
                aria-label="Toggle project sharing"
              />
            </div>

            {enabled && shareUrl && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={shareUrl}
                    onFocus={(e) => e.currentTarget.select()}
                    className="h-8 min-w-0 flex-1 font-mono text-xs"
                    aria-label="Share link"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 shrink-0 gap-1.5"
                    disabled={busy}
                    onClick={() => void handleCopy()}
                  >
                    {copied ? (
                      <>
                        <Check className="size-3.5" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="size-3.5" /> Copy
                      </>
                    )}
                  </Button>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1.5 px-2 text-xs text-destructive hover:text-destructive"
                  disabled={busy}
                  onClick={() => void handleToggle(false)}
                >
                  {busy ? <Loader2 className="size-3.5 animate-spin" /> : null}
                  Revoke link
                </Button>
              </div>
            )}

            {!enabled && (
              <Button
                size="sm"
                className="h-8 gap-1.5"
                disabled={busy}
                onClick={() => void handleToggle(true)}
              >
                {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Link2 className="size-3.5" />}
                {busy ? "Creating link…" : "Create share link"}
              </Button>
            )}

            {error && (
              <p className="text-xs text-destructive" role="alert">
                {error}
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
