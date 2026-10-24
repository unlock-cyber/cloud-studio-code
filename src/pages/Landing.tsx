import { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  TerminalSquare,
  Play,
  Globe,
  FileCode2,
  Database,
  Shield,
  Zap,
  Cpu,
  Languages,
  Clock,
  HardDrive,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BetaBadge } from "@/components/BetaBadge";
import { useNavigate } from "react-router";
import {
  FileText,
} from "lucide-react";
import { Link } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { toast } from "sonner";
import { usePageMeta, webSiteSchema } from "@/lib/seo";
import { formatChangelogDate, latestChangelogEntry } from "@/lib/changelog";

const FEATURES = [
  {
    icon: Cpu,
    title: "Real execution",
    desc: "Python on actual CPython (WebAssembly), C/C++ on GCC, Java on OpenJDK — compiled and run in isolated sandboxes with real stdout, stderr and exit codes.",
  },
  {
    icon: Globe,
    title: "Live web preview",
    desc: "HTML/CSS/JS and React projects render in a sandboxed preview. Edit, hit Run, see it instantly — runtime errors surface in the terminal.",
  },
  {
    icon: FileCode2,
    title: "Pro editor",
    desc: "Monaco with syntax highlighting for 15+ languages, multi-cursor, search & replace, folding, and per-workspace font/wrap settings.",
  },
  {
    icon: Database,
    title: "Real SQLite",
    desc: "Run SQL on an actual SQLite engine. Schemas persist per project — your tables survive between sessions.",
  },
  {
    icon: Shield,
    title: "Sandboxed & isolated",
    desc: "Your code runs in Web Workers, sandboxed iframes, or remote compiler sandboxes. Workspaces are private and quota-enforced server-side.",
  },
  {
    icon: Zap,
    title: "Zero setup",
    desc: "No Docker, no installs, no API keys. Open a browser, create a project, run code — from a Chromebook or a locked-down work laptop.",
  },
];

// Badge styling mirrors the editor's file-type badges (src/lib/fileTree.ts).
const LANGS: Array<{ name: string; mode: string; badge: string; color: string }> = [
  { name: "Python", mode: "CPython WASM", badge: "PY", color: "#4B8BBE" },
  { name: "JavaScript", mode: "Browser VM", badge: "JS", color: "#F7DF1E" },
  { name: "TypeScript", mode: "esbuild → JS", badge: "TS", color: "#3178C6" },
  { name: "C", mode: "GCC sandbox", badge: "C", color: "#5C6BC0" },
  { name: "C++", mode: "G++ sandbox", badge: "C++", color: "#E76F51" },
  { name: "Java", mode: "OpenJDK sandbox", badge: "JAVA", color: "#E76F00" },
  { name: "Bash", mode: "Shell sandbox", badge: "SH", color: "#89E051" },
  { name: "SQL", mode: "SQLite WASM", badge: "SQL", color: "#F29111" },
  { name: "HTML/CSS", mode: "Live preview", badge: "</>", color: "#E34C26" },
  { name: "React", mode: "Live preview", badge: "JSX", color: "#61DAFB" },
  { name: "JSON/YAML/XML", mode: "Inspector", badge: "{}", color: "#CBCB41" },
  { name: "Markdown", mode: "Rendered view", badge: "MD", color: "#8DBCDF" },
];

export default function Landing() {
  const navigate = useNavigate();
  usePageMeta({
    title: "Cloud Studio Code — Browser-Based Cloud IDE",
    description:
      "Cloud Studio Code is a browser-based cloud IDE: write and edit code in an online code editor, run Python, C++, Java, TypeScript and more in sandboxed runtimes, preview web projects live, and keep projects and files in your cloud workspace.",
    path: "/",
    structuredData: webSiteSchema(),
  });
  const { isAuthenticated } = useConvexAuth();
  const user = useQuery(api.users.currentUser);
  const { signIn } = useAuthActions();
  const [guestBusy, setGuestBusy] = useState(false);

  // Latest published changelog entry, straight from the changelog's own data
  // source — nothing about the current update is hardcoded here.
  const latestUpdate = latestChangelogEntry();

  // Auth-aware CTAs (BUG 4): a signed-in registered user or an existing guest
  // session gets a direct "Go to dashboard" action instead of Sign in.
  // undefined user = still loading; null = signed out; doc = signed in.
  const userLoaded = user !== undefined;
  const isGuest = userLoaded && user !== null && !!user.isAnonymous;
  const isRegistered = userLoaded && user !== null && !user.isAnonymous;
  const showDashAction = userLoaded && isAuthenticated && (isGuest || isRegistered);

  // BUG 1: "Continue as guest" signs in anonymously from here and navigates
  // straight to the dashboard — no /auth round-trip.
  const handleGuest = async () => {
    if (guestBusy) return;
    setGuestBusy(true);
    try {
      if (isAuthenticated) {
        navigate("/dashboard");
        return;
      }
      await signIn("anonymous");
      navigate("/dashboard");
    } catch (err) {
      console.error("Guest sign-in failed:", err);
      toast.error("Could not start a guest session. Please try again.");
      setGuestBusy(false);
    }
  };

  const guestButton = (
    <Button
      size="lg"
      variant="outline"
      className="gap-2 border-border bg-foreground/5 hover:bg-foreground/10"
      onClick={handleGuest}
      disabled={guestBusy}
    >
      {guestBusy ? (
        <>
          <Loader2 className="size-4 animate-spin" /> Starting…
        </>
      ) : (
        "Continue as guest"
      )}
    </Button>
  );

  const dashButton = (
    <Button
      size="lg"
      className="gap-2 bg-emerald-600 text-white hover:bg-emerald-500"
      onClick={() => navigate("/dashboard")}
    >
      Go to dashboard <ArrowRight className="size-4" />
    </Button>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center px-4">
          <div className="flex min-w-0 items-center gap-2">
            <TerminalSquare className="size-5 shrink-0 text-emerald-500 dark:text-emerald-400" />
            <span className="inline-flex min-w-0 items-start gap-1">
              {/* The brand block is a shrinkable flex item sharing the row with
                  the sign-in / dashboard actions, and the full product name
                  wrapped across lines on a phone, making the header grow.
                  One line, always: full name from `sm`, a short form from
                  375px, and the mark alone below that. Desktop is unchanged. */}
              <span className="min-w-0 truncate font-semibold">
                <span className="hidden sm:inline">Cloud Studio Code</span>
                <span className="inline max-[374px]:hidden sm:hidden">CS Code</span>
              </span>
              <BetaBadge className="-translate-y-1 shrink-0" />
            </span>
          </div>
          <nav className="ml-auto flex items-center gap-1">
            {showDashAction ? (
              <>
                <Badge variant={isGuest ? "secondary" : "default"} className="mr-1 text-[11px]">
                  {isGuest ? "Guest session" : "Signed in"}
                </Badge>
                <Button size="sm" className="h-8 bg-emerald-600 text-white hover:bg-emerald-500" onClick={() => navigate("/dashboard")}>
                  Go to dashboard
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" className="h-8 text-muted-foreground hover:text-foreground" onClick={() => navigate("/auth?returnTo=/dashboard")}>
                  Sign in
                </Button>
                <ThemeToggle />
                <Button size="sm" className="h-8 bg-emerald-600 text-white hover:bg-emerald-500" onClick={() => navigate("/auth?returnTo=/dashboard")}>
                  Start coding
                </Button>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* A FOUNDATION */}
      <section aria-labelledby="farewell-heading" className="mx-auto max-w-6xl px-4 sm:px-0">
        <div className="py-7 sm:py-9">
          <div className="mx-auto max-w-6xl">
            <div className="grid gap-4 sm:grid-cols-2 sm:gap-8">
              <div className="sm:pr-8">
                <div className="mx-auto max-w-2xl">
                  <span className="text-[10px] font-semibold tracking-widest uppercase text-[#F2A65A]">
                    <FileText className="inline h-3 w-3 mr-1.5 -translate-y-0.5" style={{ "fill": "currentColor" }} aria-hidden="true" />
                    A NOTE FROM&#xA0;THE DEVELOPER
                  </span>
                  <div className="mt-2 border-t border-transparent sm:border-t-0" />
                  <h2
                    id="farewell-heading"
                    className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl leading-tight"
                  >
                    Cloud Studio Code is<span className="text-[#E18B7A] dark:text-[#EAAA9E]"> taking a pause.</span>
                  </h2>
                </div>
              </div>
              <div className="sm:pt-1">
                <span className="hidden sm:block border-l border-border/60 pl-3 pr-3 text-base leading-relaxed text-muted-foreground">
                  Every project has a story. Before moving on, I wanted to leave a little note for everyone who visited, explored, or tried building something here.
                </span>
                <div className="mt-3 sm:mt-0">
                  <Link
                    to="/letter"
                    className="group inline-flex items-center gap-1.5 rounded-md border border-red-900/20 bg-red-950/5 px-4 py-2 text-sm font-medium text-[#E28B7A] transition-all hover:border-red-500/40 hover:bg-red-950/10 hover:text-[#F2A65A] focus-visible:ring-2 focus-visible:ring-red-500/40 focus-visible:outline-none dark:border-red-300/20 dark:bg-red-300/5 dark:text-[#D9A8A0] dark:hover:border-red-300/35 dark:hover:bg-red-300/10 dark:hover:text-[#EAAA9E]"
                  >
                    Read the letter
                    <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0" aria-hidden="true" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(600px 300px at 20% 0%, rgba(16,185,129,0.12), transparent), radial-gradient(600px 300px at 80% 10%, rgba(56,189,248,0.10), transparent)",
          }}
        />
        <div className="relative mx-auto grid max-w-6xl gap-10 px-4 pb-16 pt-16 lg:grid-cols-2 lg:items-center lg:pt-24">
          <div>
            <Badge className="mb-5 border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
              A real IDE in your browser
            </Badge>
            <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-5xl">
              Write, run and ship code
              <span className="text-emerald-600 dark:text-emerald-400"> without leaving the tab</span>
            </h1>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-muted-foreground">
              Cloud Studio Code compiles and executes your code for real — Python, C++, Java, TypeScript, SQL and live web previews — in sandboxed runtimes. Projects, files and sessions persist in the cloud.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              {showDashAction ? (
                <>
                  {dashButton}
                  <span className="text-sm text-muted-foreground">
                    You&apos;re signed in — your workspace is ready.
                  </span>
                </>
              ) : (
                <>
                  <Button size="lg" className="gap-2 bg-emerald-600 text-white hover:bg-emerald-500" onClick={() => navigate("/auth?returnTo=/dashboard")}>
                    Start coding free <ArrowRight className="size-4" />
                  </Button>
                  {guestButton}
                  <p className="mt-3 w-full text-xs text-muted-foreground/80">
                    By continuing, you agree to our{" "}
                    <Link to="/privacy" className="underline-offset-2 transition-colors hover:text-foreground hover:underline">
                      Privacy Policy
                    </Link>{" "}
                    and{" "}
                    <Link to="/terms" className="underline-offset-2 transition-colors hover:text-foreground hover:underline">
                      Terms of Service
                    </Link>
                    .
                  </p>
                </>
              )}
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><HardDrive className="size-3.5" /> 50 MB guest · 150 MB registered</span>
              <span className="flex items-center gap-1.5"><Clock className="size-3.5" /> Server-side workspace expiry</span>
              <span className="flex items-center gap-1.5"><Languages className="size-3.5" /> 12+ languages</span>
            </div>
          </div>

          {/* Terminal mock */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="rounded-xl border border-border bg-card shadow-2xl"
          >
            <div className="flex h-8 items-center gap-1.5 border-b border-border/60 px-3">
              <span className="size-2.5 rounded-full bg-red-500/70" />
              <span className="size-2.5 rounded-full bg-amber-500/70" />
              <span className="size-2.5 rounded-full bg-emerald-500/70" />
              <span className="ml-2 text-[11px] text-muted-foreground">main.py — Cloud Studio Code</span>
            </div>
            <div className="p-3 font-mono text-[11px] leading-relaxed sm:p-4 sm:text-[12.5px]">
              <p><span className="text-muted-foreground">$</span> <span className="text-emerald-600 dark:text-emerald-400">run main.py</span></p>
              <p className="mt-2 text-foreground/90">Python 3.12.0</p>
              <p className="text-foreground/90">fib(0) = 0</p>
              <p className="text-foreground/90">fib(1) = 1</p>
              <p className="text-foreground/90">fib(2) = 1</p>
              <p className="text-foreground/90">fib(3) = 2</p>
              <p className="text-foreground/90">fib(4) = 3</p>
              <p className="text-foreground/90">fib(5) = 5</p>
              <p className="mt-2 text-muted-foreground">Process finished with exit code 0</p>
              <p className="mt-3"><span className="text-muted-foreground">$</span> <span className="inline-block h-4 w-2 translate-y-0.5 animate-pulse bg-emerald-500 dark:bg-emerald-400" /></p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-border/60 py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-2xl font-bold">Everything a real IDE does</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Not a toy. Files, builds, runs, previews and persistence — actually working end to end.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-xl border border-border/60 bg-card p-5 transition-colors hover:border-emerald-500/30">
                <f.icon className="size-5 text-emerald-500 dark:text-emerald-400" />
                <h3 className="mt-3 font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Languages */}
      <section className="border-t border-border/60 py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-2xl font-bold">Languages that actually run</h2>
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {LANGS.map((l) => (
              <div key={l.name} className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-card px-4 py-3">
                <span
                  className="inline-flex h-5 shrink-0 items-center rounded-sm px-1 text-[9px] font-bold leading-none"
                  style={{ color: l.color, border: `1px solid ${l.color}55`, background: `${l.color}14` }}
                >
                  {l.badge}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium leading-tight">{l.name}</span>
                  <span className="block truncate text-[11px] leading-tight text-muted-foreground">{l.mode}</span>
                </span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Compiled languages run on a remote GCC/OpenJDK sandbox; browser runtimes execute locally in your tab via WebAssembly.
          </p>
        </div>
      </section>

      {/* What's New — latest changelog entry */}
      {latestUpdate && (
        <section className="border-t border-border/60 py-16">
          <div className="mx-auto max-w-6xl px-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
              <h2 className="text-2xl font-bold">What&rsquo;s New</h2>
              {/* Secondary, always-available route to the full changelog — the
                  index itself stays the source of truth for the entries. */}
              <Link
                to="/changelog"
                className="inline-flex items-center gap-1 rounded-sm text-sm font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                See all updates
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            </div>
            <Link
              to={latestUpdate.path}
              className="group mt-6 flex cursor-pointer flex-col gap-4 rounded-xl border border-border/60 bg-card p-5 text-left transition-colors hover:border-emerald-500/30 hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:p-6"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <h3 className="text-lg font-semibold sm:text-xl">{latestUpdate.title}</h3>
                  <span className="inline-flex shrink-0 items-center rounded-full border border-emerald-500/25 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase leading-none tracking-wide text-emerald-600 dark:text-emerald-400">
                    Latest
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{formatChangelogDate(latestUpdate.date)}</p>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-emerald-600 underline-offset-4 transition-colors group-hover:text-emerald-500 group-hover:underline dark:text-emerald-400 dark:group-hover:text-emerald-300">
                Read update
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="border-t border-border/60 py-20">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <h2 className="text-3xl font-bold">Ready to write some code?</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Start instantly as a guest — no signup wall. Create an account to keep your workspace for 24 hours of inactivity.
          </p>
          {showDashAction ? (
            <Button size="lg" className="mt-6 gap-2 bg-emerald-600 text-white hover:bg-emerald-500" onClick={() => navigate("/dashboard")}>
              <Play className="size-4 fill-current" /> Open your workspace
            </Button>
          ) : (
            <Button size="lg" className="mt-6 gap-2 bg-emerald-600 text-white hover:bg-emerald-500" onClick={() => navigate("/auth?returnTo=/dashboard")}>
              <Play className="size-4 fill-current" /> Launch the IDE
            </Button>
          )}
        </div>
      </section>

      <footer className="border-t border-border/60 py-10">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4">
          <div className="inline-flex items-start gap-1 text-sm font-semibold text-foreground">
            Cloud Studio Code
            <BetaBadge className="-translate-y-0.5" />
          </div>
          <nav
            aria-label="Footer"
            className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground"
          >
            <button
              type="button"
              className="transition-colors hover:text-foreground"
              onClick={() => navigate("/about")}
            >
              About
            </button>
            <Link
              to="/letter"
              className="transition-colors hover:text-foreground"
            >
              A Letter From the Developer
            </Link>
            <button
              type="button"
              className="transition-colors hover:text-foreground"
              onClick={() => navigate("/changelog")}
            >
              Changelog
            </button>
            <button
              type="button"
              className="transition-colors hover:text-foreground"
              onClick={() => navigate("/contributions")}
            >
              Bugs &amp; Contributions
            </button>
            <button
              type="button"
              className="transition-colors hover:text-foreground"
              onClick={() => navigate("/privacy")}
            >
              Privacy Policy
            </button>
            <button
              type="button"
              className="transition-colors hover:text-foreground"
              onClick={() => navigate("/terms")}
            >
              Terms of Service
            </button>
          </nav>
          <div className="flex flex-col gap-1 border-t border-border/40 pt-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>© 2026 Cloud Studio Code. All rights reserved.</span>
            <span>Python · C++ · Java · TypeScript · SQL · Web</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
