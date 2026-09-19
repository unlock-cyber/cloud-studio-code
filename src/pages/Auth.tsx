import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useAuth } from "@/hooks/use-auth";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BetaBadge } from "@/components/BetaBadge";
import { BrandMark } from "@/components/BrandMark";
import { TerminalSquare, Check, AlertTriangle } from "lucide-react";
import { Suspense, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useNavigate, useSearchParams } from "react-router";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  captureGuestContext,
  clearGuestContext,
  storeGuestContext,
} from "@/lib/guestContext";

interface AuthProps {
  redirectAfterAuth?: string;
}

function resolveRedirectAfterAuth(returnTo: string | null, fallback = "/dashboard") {
  if (returnTo?.startsWith("/") && !returnTo.startsWith("//")) {
    return returnTo;
  }
  return fallback;
}

// Copy for the "real IDE" feature column.
const PROOF_POINTS = [
  "Python, C++, Java & TypeScript really compile and run",
  "Live web preview for HTML/CSS/JS projects",
  "Real SQLite — your tables persist per project",
  "Sandboxed, isolated and quota-enforced server-side",
];

function CloudLines() {
  // Decorative cloud silhouettes echoing the favicon tile, drawn with CSS.
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute -top-24 -left-16 size-[420px] rounded-full bg-emerald-500/[0.07] blur-3xl" />
      <div className="absolute top-1/3 -right-24 size-[380px] rounded-full bg-sky-500/[0.06] blur-3xl" />
      <div className="absolute -bottom-32 left-1/4 size-[460px] rounded-full bg-emerald-400/[0.05] blur-3xl" />
    </div>
  );
}

function Auth({ redirectAfterAuth }: AuthProps = {}) {
  const { isLoading: authLoading, isAuthenticated, user, signIn } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = resolveRedirectAfterAuth(searchParams.get("returnTo"), redirectAfterAuth);
  const [step, setStep] = useState<"signIn" | { email: string }>("signIn");
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Real staged status during the guest → account transition. Each stage is
  // only shown AFTER the corresponding operation has actually completed.
  const [upgradeStage, setUpgradeStage] = useState<
    | null
    | "signed-in"
    | "transferring"
    | "transferred"
    | "redirecting"
    | "transfer-failed"
  >(null);
  // Why the transfer failed, when the server could say so precisely. Drives
  // an honest failure message (e.g. "nothing left to transfer" vs "data
  // preserved — retry").
  const [transferFailureReason, setTransferFailureReason] = useState<string | null>(null);
  const migrate = useMutation(api.migrateWorkspace.migrateFromGuest);

  // Guest-upgrade bookkeeping: while the guest workspace migration is in
  // flight, the auth state has ALREADY flipped to the new registered user —
  // the redirect effect below must hold off until the migration finishes,
  // otherwise the dashboard provisions a fresh empty workspace first and the
  // guest data never gets moved.
  const migrationPendingRef = useRef(false);

  useEffect(() => {
    // Registered users visiting /auth while signed in are bounced to the app,
    // but guests must NOT be redirected — they come here to upgrade to a
    // registered account ("Create account" button on the dashboard).
    // Wait for the user doc to resolve before acting: right after an OTP
    // sign-in the session switches, and acting on a stale/undefined user
    // could send the fresh registered user back to a guest-era path.
    if (authLoading || user === undefined) return;
    if (migrationPendingRef.current) return;
    if (!isAuthenticated || !!user && user.isAnonymous) return;
    // Enter the authenticated app at the dashboard. Never honor a `returnTo`
    // captured under a previous session (e.g. a guest workspace path — its
    // data is not accessible to the newly authenticated account).
    navigate("/dashboard");
  }, [authLoading, isAuthenticated, user, navigate]);

  const handleEmailSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    // A guest is about to authenticate: from this moment the redirect effect
    // below is suppressed. `signIn` flips auth state reactively, and letting
    // the effect fire in that window would send the app to /dashboard and
    // provision a fresh empty authenticated workspace BEFORE the guest
    // migration has run — stranding the guest data. The suppression lasts
    // until the migration finishes (success or failure).
    const pendingGuest = captureGuestContext();
    if (pendingGuest) {
      migrationPendingRef.current = true;
      // Refresh the capture timestamp. The workspace/session ids are still
      // valid (the dashboard's heartbeat keeps the workspace alive), but the
      // context carries a 1h TTL measured from capture time — a guest who has
      // been working for a while would otherwise have the context discarded
      // right before the OTP handler runs, silently skipping the migration.
      storeGuestContext({
        workspaceId: pendingGuest.workspaceId,
        sessionId: pendingGuest.sessionId,
      });
    }
    try {
      const formData = new FormData(event.currentTarget);
      await signIn("email-otp", formData);
      setStep({ email: formData.get("email") as string });
      setIsLoading(false);
    } catch (error) {
      console.error("Email sign-in error:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Failed to send verification code. Please try again.",
      );
      setIsLoading(false);
    }
  };

  const handleOtpSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      await signIn("email-otp", formData);

      // Guest upgrade: the OTP sign-in created a fresh registered user, so
      // move the guest workspace (all projects/files/databases) into it now —
      // BEFORE entering the dashboard. The migration is atomic server-side:
      // on failure the guest data is untouched and we stay here with a clear
      // error.
      //
      // The redirect effect is suppressed while this runs (migrationPendingRef),
      // because `isAuthenticated` has already flipped true by the time signIn
      // resolves — navigating now would provision an empty workspace first.
      const guest = captureGuestContext();
      // Attempt the migration whenever the guest context exists. When it is
      // missing (e.g. storage was unavailable, or the entry expired), the
      // previous anonymous session token still held by this client may allow
      // the server to resolve the guest workspace — but only if the user was
      // actually a guest before this sign-in, which we cannot know reliably
      // here, so we only migrate when we have positive context.
      if (guest) {
        migrationPendingRef.current = true;
        try {
          // Step 1 done: the session is authenticated.
          setUpgradeStage("signed-in");
          // Step 2: transferring the workspace (mutation in flight).
          setUpgradeStage("transferring");
          let result: { migrated: boolean; reason?: string } | undefined = undefined;
          try {
            result = await migrate({
              guestWorkspaceId: (guest.workspaceId || undefined) as never,
              guestSessionId: guest.sessionId || undefined,
            });
          } catch (e) {
            // The mutation is atomic: nothing was written server-side, so the
            // guest workspace/projects/files are fully preserved and the user
            // can retry. Show the failure state — never a false success.
            //
            // Keep migrationPendingRef TRUE: the auth-redirect effect must
            // stay suppressed so it cannot yank this failure UI away with an
            // SPA navigation to /dashboard (which would also provision an
            // empty workspace ahead of a retry).
            console.error("Guest workspace migration failed:", e);
            setTransferFailureReason(null);
            setUpgradeStage("transfer-failed");
            setIsLoading(false);
            return;
          }
          if (!result || !result.migrated) {
            // Explicit non-success from the mutation. Either way the guest
            // data was NOT moved — report failure and keep the guest context
            // so it can be retried. As above, the redirect suppression stays
            // ON so the failure status remains visible.
            console.error("Guest workspace migration did not complete:", result?.reason);
            setTransferFailureReason(result?.reason ?? null);
            setUpgradeStage("transfer-failed");
            setIsLoading(false);
            return;
          }
          // Step 3 done: the move completed inside the mutation. Clear the
          // guest context only now that the transfer is confirmed.
          clearGuestContext();
          setUpgradeStage("transferred");
          // Step 4: the mutation's atomic cleanup (guest sessions, account,
          // user record) committed together with the move, so cleanup is
          // confirmed complete only now. Render the redirecting status
          // SYNCHRONOUSLY (React state updates are otherwise async and the
          // navigation below would beat the re-render, hiding the message).
          flushSync(() => {
            setUpgradeStage("redirecting");
          });
          // Full page reload directly to /dashboard. `replace` prevents the
          // dead guest session from lingering in history. NOTE: do NOT reset
          // migrationPendingRef here — keeping the auth-redirect effect
          // suppressed guarantees no SPA navigation can race the unload and
          // leave the user on stale guest UI.
          window.location.replace("/dashboard");
          return;
        } catch (e) {
          // Unexpected client-side error between stages. The migration may or
          // may not have committed — the guest context is deliberately NOT
          // cleared (the server-side move is atomic/idempotent-safe: either it
          // committed or the guest data is untouched), and the redirect
          // suppression stays on so no navigation can race this failure UI.
          console.error("Guest upgrade transition failed:", e);
          setTransferFailureReason(null);
          setUpgradeStage("transfer-failed");
          setIsLoading(false);
          return;
        }
      }

      // OTP verification creates a fresh registered user/session — it does
      // not link to the previous anonymous session. Always enter the
      // authenticated home instead of honoring a `returnTo` captured while
      // the user was a guest (that path points into the abandoned guest
      // workspace and would be inaccessible).
      navigate("/dashboard");
    } catch (error) {
      console.error("OTP verification error:", error);
      setError(
        error instanceof Error && /transferred|migrat/i.test(error.message)
          ? error.message
          : "The verification code you entered is incorrect.",
      );
      setIsLoading(false);
      setOtp("");
    }
  };

  const handleGuestLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (isAuthenticated) {
        // A session already exists (e.g. the user returned to /auth while
        // signed in, or double-clicked). Signing in again with the Anonymous
        // provider would fail/duplicate — just proceed to the app.
        navigate(redirect);
        return;
      }
      await signIn("anonymous");
      // Navigate the moment the session exists. Workspace provisioning is
      // handled by the dashboard's own gate — awaiting it here only delays
      // the transition (and the dashboard covers transient failures).
      navigate(redirect);
    } catch (error) {
      console.error("Guest login error:", error);
      setError(
        `Failed to sign in as guest: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      setIsLoading(false);
    }
  };

  const navigateHome = () => navigate("/");

  return (
    <div className="relative flex min-h-screen flex-col bg-background text-foreground">
      <CloudLines />

      {/* Top bar */}
      <header className="relative z-10 flex h-14 items-center justify-between px-4 sm:px-6">
        <button
          type="button"
          onClick={navigateHome}
          className="flex items-center gap-2 rounded-md py-1 pr-2 text-sm font-semibold transition-colors hover:text-emerald-600 dark:hover:text-emerald-400"
        >
          <TerminalSquare className="size-5 text-emerald-500 dark:text-emerald-400" />
          <span className="inline-flex items-start gap-1">
            Cloud Studio Code
            <BetaBadge className="-translate-y-1" />
          </span>
        </button>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-muted-foreground hover:text-foreground"
            onClick={navigateHome}
          >
            Back to home
          </Button>
        </div>
      </header>

      {/* Main split layout */}
      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-10">
        <div className="grid w-full max-w-4xl items-center gap-10 lg:grid-cols-2">
          {/* Brand / proof column */}
          <div className="hidden lg:block">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-300">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
              </span>
              Run code in the cloud — no setup
            </div>
            <h1 className="mt-4 text-3xl font-bold leading-tight tracking-tight">
              Your workspaces, ready
              <span className="text-emerald-600 dark:text-emerald-400"> where you left them.</span>
            </h1>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
              Sign in to keep projects for 24 hours of inactivity — or jump straight in as a guest
              with a 1-hour scratch workspace.
            </p>
            <ul className="mt-6 space-y-3">
              {PROOF_POINTS.map((point) => (
                <li key={point} className="flex items-start gap-2.5 text-sm text-foreground/90">
                  <Check className="mt-0.5 size-4 shrink-0 text-emerald-500 dark:text-emerald-400" />
                  {point}
                </li>
              ))}
            </ul>
          </div>

          {/* Form column */}
          <div className="mx-auto w-full max-w-sm">
            {/* Sign in: email */}
            {step === "signIn" ? (
              <div className="rounded-xl border border-border/80 bg-card p-6 shadow-xl shadow-black/5">
                <div className="flex flex-col items-center text-center">
                  <BrandMark size={56} className="mb-4 cursor-pointer rounded-xl" onClick={navigateHome} />
                  <h2 className="text-lg font-semibold">Sign in to Cloud Studio Code</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    We&apos;ll email you a one-time code — no password needed.
                  </p>
                </div>
                <form onSubmit={handleEmailSubmit} className="mt-6">
                  <label htmlFor="email" className="mb-1.5 block text-xs font-medium text-muted-foreground">
                    Email address
                  </label>
                  <Input
                    id="email"
                    name="email"
                    placeholder="name@example.com"
                    type="email"
                    autoComplete="email"
                    disabled={isLoading}
                    required
                  />
                  {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
                  <Button
                    type="submit"
                    className="mt-4 w-full gap-2 bg-emerald-600 text-white hover:bg-emerald-500"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                        Sending code…
                      </>
                    ) : (
                      "Continue with email"
                    )}
                  </Button>
                </form>
                <div className="my-5 flex items-center gap-3">
                  <span className="h-px flex-1 bg-border" />
                  <span className="text-[11px] uppercase tracking-wide text-muted-foreground">or</span>
                  <span className="h-px flex-1 bg-border" />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={handleGuestLogin}
                  disabled={isLoading}
                >
                  Continue as guest
                </Button>
                <p className="mt-4 text-center text-[11px] leading-relaxed text-muted-foreground">
                  Guest workspaces hold 50 MB and expire after 1 hour of inactivity. Registered
                  workspaces hold 150 MB and last 24 hours.
                </p>
              </div>
            ) : (
              /* Verify OTP */
              <div className="rounded-xl border border-border/80 bg-card p-6 shadow-xl shadow-black/5">
                <div className="flex flex-col items-center text-center">
                  <div className="mb-4 flex size-14 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <MailIcon />
                  </div>
                  <h2 className="text-lg font-semibold">Check your email</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    We sent a 6-digit code to{" "}
                    <span className="font-medium text-foreground">{step.email}</span>
                  </p>
                </div>
                <form onSubmit={handleOtpSubmit} className="mt-6">
                  <input type="hidden" name="email" value={step.email} />
                  <input type="hidden" name="code" value={otp} />
                  <div className="flex justify-center">
                    <InputOTP
                      value={otp}
                      onChange={setOtp}
                      maxLength={6}
                      disabled={isLoading}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && otp.length === 6 && !isLoading) {
                          const form = (e.target as HTMLElement).closest("form");
                          if (form) form.requestSubmit();
                        }
                      }}
                    >
                      <InputOTPGroup>
                        {Array.from({ length: 6 }).map((_, index) => (
                          <InputOTPSlot key={index} index={index} />
                        ))}
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                  {error && <p className="mt-3 text-center text-sm text-red-500">{error}</p>}
                  {upgradeStage === "transfer-failed" ? (
                    <div
                      className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5"
                      role="alert"
                    >
                      <p className="flex items-center gap-2 text-xs font-medium text-amber-700 dark:text-amber-300">
                        <AlertTriangle className="size-3.5 shrink-0" />
                        Transfer could not be completed
                      </p>
                      <p className="mt-1.5 text-xs leading-relaxed text-amber-700/90 dark:text-amber-200/90">
                        {transferFailureReason === "workspace-not-found"
                          ? "The guest workspace could no longer be found on the server, so nothing was transferred. Your guest workspace has not been changed and nothing was lost — you can retry from the dashboard."
                          : transferFailureReason === "target-already-exists"
                            ? "The new account already contains projects, so the transfer was stopped to avoid overwriting anything. Your guest workspace has been preserved untouched — you can safely retry."
                            : "Your guest workspace and all of its projects and files have been preserved. You can safely retry — nothing was lost."}
                      </p>
                    </div>
                  ) : (
                    upgradeStage && (
                      <div
                        className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5"
                        role="status"
                        aria-live="polite"
                      >
                        <ul className="space-y-1.5 text-xs">
                          <UpgradeStageRow
                            label="Signed in successfully"
                            state={stageAtLeast(upgradeStage, "signed-in") ? "done" : "pending"}
                          />
                          <UpgradeStageRow
                            label="Transferring your projects and files..."
                            state={
                              stageAtLeast(upgradeStage, "transferred")
                                ? "done"
                                : upgradeStage === "transferring"
                                  ? "active"
                                  : "pending"
                            }
                          />
                          <UpgradeStageRow
                            label="Transfer successful"
                            state={stageAtLeast(upgradeStage, "transferred") ? "done" : "pending"}
                          />
                          <UpgradeStageRow
                            label="Redirecting to /dashboard..."
                            state={upgradeStage === "redirecting" ? "active" : "pending"}
                          />
                        </ul>
                      </div>
                    )
                  )}
                  <Button
                    type="submit"
                    className="mt-5 w-full bg-emerald-600 text-white hover:bg-emerald-500"
                    disabled={isLoading || otp.length !== 6 || !!upgradeStage && upgradeStage !== "transfer-failed"}
                  >
                    {upgradeStage && upgradeStage !== "transfer-failed"
                      ? "Upgrading your workspace…"
                      : isLoading
                        ? "Verifying…"
                        : "Verify and continue"}
                  </Button>
                  <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                    <button
                      type="button"
                      className="hover:text-foreground"
                      onClick={() => setStep("signIn")}
                    >
                      Use a different email
                    </button>
                    <button
                      type="button"
                      className="hover:text-foreground"
                      onClick={() => setStep("signIn")}
                    >
                      Resend code
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

// Ordered stages of the guest → account upgrade, used to derive per-row state.
const UPGRADE_STAGE_ORDER = ["signed-in", "transferring", "transferred", "redirecting"] as const;

type UpgradeStage =
  | (typeof UPGRADE_STAGE_ORDER)[number]
  | "transfer-failed";

function stageAtLeast(
  current: Exclude<UpgradeStage, "transfer-failed">,
  stage: Exclude<UpgradeStage, "transfer-failed">,
): boolean {
  return UPGRADE_STAGE_ORDER.indexOf(current) >= UPGRADE_STAGE_ORDER.indexOf(stage);
}

function UpgradeStageRow({ label, state }: { label: string; state: "pending" | "active" | "done" }) {
  return (
    <li
      className={
        "flex items-center gap-2 " +
        (state === "pending" ? "text-muted-foreground" : "text-emerald-700 dark:text-emerald-300")
      }
    >
      {state === "done" ? (
        <Check className="size-3.5 shrink-0" />
      ) : state === "active" ? (
        <span className="size-3.5 shrink-0 animate-spin rounded-full border-2 border-emerald-500/30 border-t-emerald-500" />
      ) : (
        <span className="size-3.5 shrink-0 rounded-full border border-border" />
      )}
      {label}
    </li>
  );
}

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function AuthPage(props: AuthProps) {
  return (
    <Suspense>
      <Auth {...props} />
    </Suspense>
  );
}
