import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useAuth } from "@/hooks/use-auth";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BrandMark } from "@/components/BrandMark";
import { TerminalSquare, Check } from "lucide-react";
import { Suspense, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { captureGuestContext, clearGuestContext } from "@/lib/guestContext";

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
      // BEFORE entering the dashboard — so the authenticated workspace shows
      // up immediately, with no refresh. Atomic server-side: on failure the
      // guest data is untouched and we stay here with a clear error.
      //
      // The redirect effect is suppressed while this runs (migrationPendingRef),
      // because `isAuthenticated` has already flipped true by the time signIn
      // resolves — navigating now would provision an empty workspace first.
      const guest = captureGuestContext();
      if (guest) {
        migrationPendingRef.current = true;
        try {
          const result = await migrate({
            guestWorkspaceId: guest.workspaceId as never,
            guestSessionId: guest.sessionId,
          });
          // Only clear after a successful move — on failure the context stays
          // so the user can retry without losing the transfer.
          clearGuestContext();
          migrationPendingRef.current = false;
          if (result?.reason === "workspace-not-found") {
            // The guest workspace no longer exists (expired mid-flight); the
            // guest data is already gone server-side — nothing was lost, so
            // enter the app normally.
            navigate("/dashboard");
            return;
          }
        } catch (e) {
          migrationPendingRef.current = false;
          throw e;
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
          Cloud Studio Code
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
                  <Button
                    type="submit"
                    className="mt-5 w-full bg-emerald-600 text-white hover:bg-emerald-500"
                    disabled={isLoading || otp.length !== 6}
                  >
                    {isLoading ? "Verifying…" : "Verify and continue"}
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
