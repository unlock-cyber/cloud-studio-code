// Guest → registered account workspace hand-off.
//
// WHY THIS RUNS HERE (and no longer inside the OTP handler on /auth):
// `@convex-dev/auth` swaps the provider token in memory + storage as soon as
// the OTP is accepted, but the live Convex websocket keeps authenticating its
// requests with the PREVIOUS (guest) token until its scheduled token refresh,
// and the client never re-runs `setAuth` on a guest → registered switch. Any
// mutation issued in that window is therefore executed server-side as the
// anonymous guest: `migrateFromGuest` rejects non-registered callers, so the
// transfer failed, and every dashboard query issued in the same window still
// answered for the guest workspace — which is why "Continue to dashboard"
// kept showing the guest workspace while a refresh (which reads the stored
// registered token) showed an empty account.
//
// The fix is to perform the hand-off only once the socket is authenticated
// with the new session, which happens after a full page load. /auth issues
// that load once the OTP is accepted; this gate then owns the transfer, the
// progress UI, the failure UI and the retry, and it hands the dashboard
// through only when the transfer is resolved.
//
// The hand-off itself is a single atomic mutation: the guest context is
// cleared only after the server confirms the move, so a failure leaves the
// guest workspace, all of its projects and files, and the ability to retry
// completely intact.

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useMutation } from "convex/react";
import { AlertTriangle, Check, LogIn, Loader2 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { captureGuestContext, clearGuestContext } from "@/lib/guestContext";

/**
 * Convex document ids are 32-character lowercase base32 strings. Anything
 * else would be rejected by the mutation's `v.id()` argument validator before
 * the handler runs, which would turn an old or corrupted stored context into
 * a failure the user could never resolve. Such a context still migrates: the
 * mutation falls back to resolving the workspace from the guest session id.
 */
function isDocumentId(value: string): boolean {
  return /^[a-z0-9]{32}$/.test(value);
}

type Phase = "idle" | "transferring" | "failed" | "empty";

export function GuestTransferGate({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const migrate = useMutation(api.migrateWorkspace.migrateFromGuest);
  const [phase, setPhase] = useState<Phase>("idle");
  const [failureDetail, setFailureDetail] = useState<string | null>(null);
  // One automatic attempt per page load. The stored guest context is the
  // record of an un-finished hand-off, so a reload retries it (bounded by the
  // context's 1-hour TTL, which matches the guest workspace lifetime).
  const attemptedRef = useRef(false);

  const runTransfer = useCallback(async () => {
    const guest = captureGuestContext();
    if (!guest) {
      setPhase("idle");
      return;
    }
    setFailureDetail(null);
    setPhase("transferring");
    try {
      const result = (await migrate({
        guestWorkspaceId: isDocumentId(guest.workspaceId)
          ? (guest.workspaceId as never)
          : undefined,
        guestSessionId: guest.sessionId || undefined,
      })) as { migrated: boolean; reason?: string } | undefined;

      if (result?.migrated) {
        // Server-confirmed move: the workspace and everything hanging off it
        // (projects, files, SQL databases) now belong to this account. Only
        // now is the client-side bookkeeping dropped — the dashboard's live
        // queries show the transferred data without a refresh.
        clearGuestContext();
        setPhase("idle");
        return;
      }

      if (
        result?.reason === "workspace-not-found" ||
        result?.reason === "owner-not-found"
      ) {
        // Nothing left to hand over: the guest workspace no longer exists
        // (guest workspaces expire after an hour of inactivity). This is not
        // a data-loss failure, so stop offering a retry for it.
        clearGuestContext();
        setPhase("empty");
        return;
      }

      // Explicit non-success: nothing was moved.
      setFailureDetail(`server response: ${result?.reason ?? "unknown"}`);
      setPhase("failed");
    } catch (e) {
      // Atomic mutation: nothing was written, so the guest workspace and all
      // of its data are untouched and the transfer can be retried safely.
      console.error("Guest workspace transfer failed:", e);
      setFailureDetail(e instanceof Error ? e.message : String(e));
      setPhase("failed");
    }
  }, [migrate]);

  // Attempt the hand-off automatically — but only once the server has
  // resolved THIS session and reports it as a registered (non-anonymous)
  // account. `currentUser` is answered using the caller's identity, so a
  // non-anonymous user here is proof that the socket is authenticated with
  // the new session; attempting earlier would run the migration as the guest
  // and be rejected.
  useEffect(() => {
    if (attemptedRef.current || user === undefined) return;
    if (user === null || user.isAnonymous) return;
    if (!captureGuestContext()) return;
    attemptedRef.current = true;
    void runTransfer();
  }, [user, runTransfer]);

  if (phase === "transferring") {
    return (
      <TransferScreen>
        <ul className="space-y-1.5 text-xs">
          <StageRow label="Signed in successfully" state="done" />
          <StageRow
            label="Transferring your projects and files..."
            state="active"
          />
        </ul>
        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
          Your guest projects, files and SQL databases are being moved into this
          account. Keep this tab open — nothing is deleted before the move is
          confirmed, so reloading the page is always safe.
        </p>
      </TransferScreen>
    );
  }

  if (phase === "failed") {
    return (
      <TransferScreen>
        <div
          className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-3 text-left"
          role="alert"
        >
          <p className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-300">
            <AlertTriangle className="size-4 shrink-0" />
            Transfer could not be completed
          </p>
          <p className="mt-2 text-xs leading-relaxed text-amber-700/90 dark:text-amber-200/90">
            Your guest workspace and every project and file in it were left
            untouched — nothing was moved, overwritten or deleted. Retry to
            bring them into this account; guest workspaces expire after 1 hour
            of inactivity, so retry before then.
          </p>
          {failureDetail && (
            <p className="mt-2 break-words text-[11px] text-muted-foreground">
              Reference: {failureDetail}
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button size="sm" className="h-8" onClick={() => void runTransfer()}>
              Retry transfer
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8"
              onClick={() => setPhase("idle")}
            >
              Continue to dashboard
            </Button>
          </div>
        </div>
      </TransferScreen>
    );
  }

  if (phase === "empty") {
    return (
      <TransferScreen>
        <div className="rounded-lg border border-border/70 bg-muted/40 px-3 py-3 text-left">
          <p className="flex items-center gap-2 text-sm font-medium">
            <AlertTriangle className="size-4 shrink-0" />
            Nothing left to transfer
          </p>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            The guest workspace this account came from is no longer on the
            server, so there was nothing to move. Guest workspaces expire after
            1 hour of inactivity.
          </p>
          <div className="mt-4">
            <Button size="sm" className="h-8" onClick={() => setPhase("idle")}>
              Continue to dashboard
            </Button>
          </div>
        </div>
      </TransferScreen>
    );
  }

  return <>{children}</>;
}

function TransferScreen({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
      <div className="w-full max-w-md rounded-xl border border-border/80 bg-card p-6 shadow-xl shadow-black/5">
        <div className="flex items-center gap-2">
          <LogIn className="size-4 text-emerald-600 dark:text-emerald-400" />
          <p className="text-sm font-semibold">Setting up your account</p>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </main>
  );
}

function StageRow({
  label,
  state,
}: {
  label: string;
  state: "active" | "done";
}) {
  return (
    <li
      className={
        "flex items-center gap-2 text-emerald-700 dark:text-emerald-300"
      }
    >
      {state === "done" ? (
        <Check className="size-3.5 shrink-0" />
      ) : (
        <Loader2 className="size-3.5 shrink-0 animate-spin" />
      )}
      {label}
    </li>
  );
}
