import { useCallback, useEffect, useState, type ReactNode } from "react";
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
import {
  Check,
  Copy,
  Eye,
  FileCode2,
  Link2,
  Loader2,
  Lock,
  ShieldCheck,
  X,
} from "lucide-react";

type Props = {
  projectId: Id<"projects">;
  projectName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** One line of "what a visitor gets" — a check for live, a cross for absent. */
function VisitorFact({
  ok,
  children,
}: {
  ok: boolean;
  children: ReactNode;
}) {
  return (
    <li className="flex items-start gap-2">
      {ok ? (
        <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
      ) : (
        <X className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/70" />
      )}
      <span className="min-w-0 text-muted-foreground">{children}</span>
    </li>
  );
}

/**
 * Owner-facing sharing controls for one project.
 *
 * The link is a plain read-only URL under /s/<token>; the backend resolves it
 * without authentication and hands back only what a viewer may see. The token
 * is minted server-side, and revoking clears it there — closing this dialog
 * never leaves a link alive on the client's word alone.
 *
 * The dialog has one job: make the owner certain about what they are handing
 * out. So it states the current status, lists exactly what a visitor can and
 * cannot do, shows whether a live preview exists, and links straight to the
 * real shared view (the same page a recipient opens) instead of faking one.
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
  const [confirmingRevoke, setConfirmingRevoke] = useState(false);
  // Remembers that a link existed earlier in this dialog session, so the
  // "sharing is off" state can say plainly that the old link stopped working
  // instead of pretending the project was never shared.
  const [wasShared, setWasShared] = useState(false);

  const enabled = share?.enabled ?? false;
  const token = share?.token ?? null;
  const shareUrl = token ? `${window.location.origin}/s/${token}` : null;
  const previewAvailable = share?.previewAvailable ?? false;
  const fileCount = share?.fileCount ?? 0;

  useEffect(() => {
    if (enabled) setWasShared(true);
  }, [enabled]);

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
        setConfirmingRevoke(false);
        if (next) setWasShared(true);
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
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        setConfirmingRevoke(false);
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Link2 className="size-4" /> Share project
          </DialogTitle>
          <DialogDescription className="break-words">
            {projectName ? `“${projectName}” — ` : ""}a read-only link anyone can open without an
            account. They can browse the files and, for web projects, run the live preview. They
            can&rsquo;t edit, save, run, download or delete anything.
          </DialogDescription>
        </DialogHeader>

        {share === undefined ? (
          <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Checking sharing…
          </div>
        ) : (
          <div className="space-y-4 py-1">
            {/* Current state */}
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-sm font-medium">
                  {enabled ? (
                    <ShieldCheck className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Lock className="size-3.5 shrink-0 text-muted-foreground" />
                  )}
                  {enabled ? "Sharing is on" : "Sharing is off"}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {enabled
                    ? "The link below is live — anyone who has it can open the project."
                    : wasShared
                      ? "The previous link no longer works. Create a new one to share again."
                      : "Only you can see this project right now."}
                </p>
              </div>
              <Switch
                checked={enabled}
                disabled={busy}
                onCheckedChange={(next) => void handleToggle(next)}
                aria-label="Turn project sharing on or off"
              />
            </div>

            {/* What a visitor actually gets */}
            <ul className="space-y-1.5 text-xs">
              <VisitorFact ok>
                Browse the file tree{fileCount > 0 ? ` (${fileCount} file${fileCount === 1 ? "" : "s"})` : ""}{" "}
                and read source code
              </VisitorFact>
              <VisitorFact ok={previewAvailable}>
                {previewAvailable
                  ? "Open the live web preview in the browser"
                  : "Live preview — unavailable, because this project has no HTML entry file"}
              </VisitorFact>
              <VisitorFact ok={false}>Editing, saving, running, the terminal and downloads</VisitorFact>
            </ul>

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
                  <span aria-live="polite" className="sr-only">
                    {copied ? "Share link copied to the clipboard" : ""}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <Button asChild size="sm" variant="secondary" className="h-8 gap-1.5">
                    <a href={shareUrl} target="_blank" rel="noopener noreferrer">
                      <Eye className="size-3.5" /> Preview what visitors see
                    </a>
                  </Button>
                  {confirmingRevoke ? (
                    <>
                      <span className="text-xs text-muted-foreground">Revoke this link?</span>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-8"
                        disabled={busy}
                        onClick={() => void handleToggle(false)}
                      >
                        {busy ? <Loader2 className="size-3.5 animate-spin" /> : null}
                        Yes, revoke
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8"
                        disabled={busy}
                        onClick={() => setConfirmingRevoke(false)}
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 gap-1.5 px-2 text-xs text-destructive hover:text-destructive"
                      disabled={busy}
                      onClick={() => setConfirmingRevoke(true)}
                    >
                      <X className="size-3.5" /> Revoke link
                    </Button>
                  )}
                </div>
              </div>
            )}

            {!enabled && (
              <div className="space-y-2">
                <Button
                  size="sm"
                  className="h-8 w-full gap-1.5"
                  disabled={busy}
                  onClick={() => void handleToggle(true)}
                >
                  {busy ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Link2 className="size-3.5" />
                  )}
                  {busy ? "Creating link…" : wasShared ? "Create a new link" : "Create share link"}
                </Button>
                <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
                  <FileCode2 className="mt-0.5 size-3 shrink-0" />
                  A fresh, unguessable link is generated server-side each time. Revoking it
                  immediately closes access for everyone.
                </p>
              </div>
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
