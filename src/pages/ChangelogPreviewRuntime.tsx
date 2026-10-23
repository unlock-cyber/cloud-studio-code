import { Link, useLocation, useNavigate } from "react-router";
import { ArrowLeft, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePageMeta } from "@/lib/seo";
import { changelogEntry, changelogPageMeta, formatChangelogDate } from "@/lib/changelog";

/** Inline code in the prose: monospaced and readable, without shouting. */
const CODE = "rounded bg-muted px-1 py-0.5 font-mono text-[0.85em] text-foreground";

export default function ChangelogPreviewRuntime() {
  const navigate = useNavigate();
  const location = useLocation();
  // Leaving a post must never leave it sitting directly behind the changelog
  // index: the index's own Back button steps through history, so an extra
  // index entry would bounce the user straight back into this post. Opened
  // from the index → step back exactly like the browser's Back button; opened
  // directly (bookmark, shared link) → replace this entry with the index.
  const fromChangelog =
    (location.state as { fromChangelog?: boolean } | null)?.fromChangelog === true;
  const backToChangelog = () => {
    if (fromChangelog) navigate(-1);
    else navigate("/changelog", { replace: true });
  };
  // Title, description, canonical and structured data all come from the changelog
  // entry, so the document metadata can never disagree with this article.
  const entry = changelogEntry("/changelog/preview-runtime-update");
  usePageMeta(changelogPageMeta(entry));

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur">
        <div className="csc-shell flex h-14 items-center">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-2 text-muted-foreground hover:text-foreground"
            onClick={backToChangelog}
          >
            <ArrowLeft className="size-4" /> Back to Changelog
          </Button>
        </div>
      </header>

      <main className="csc-shell pb-16">
        <article className="mt-10 rounded-xl border border-border/60 bg-card p-5 sm:p-8">
          {/* Post header */}
          <div className="border-b border-border/60 pb-5">
            <div className="flex items-center gap-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <Sparkles className="size-3.5" />
              <span className="uppercase">{entry.badge}</span> · {formatChangelogDate(entry.date)}
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
              {entry.title}
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              This release is about everything that happens around a run: code that finishes on
              its own schedule, databases that are still there when you come back, a dashboard
              that opens without a detour through sign-in, and terminal output that explains what
              actually happened.
            </p>
          </div>

          {/* Body */}
          <div className="space-y-6 pt-5 text-sm leading-relaxed text-muted-foreground">
            <section>
              <h2 className="font-semibold text-foreground">
                JavaScript that finishes what it started
              </h2>
              <p className="mt-1.5">
                Asynchronous JavaScript now runs to completion instead of ending when the first
                line of output appeared. Callbacks scheduled with <code className={CODE}>setTimeout</code> fire and
                their output lands in the terminal, promise callbacks and <code className={CODE}>await</code>{" "}
                continuations print in the order you'd expect, and a repeating{" "}
                <code className={CODE}>setInterval</code> keeps ticking the way a running process does — until you
                stop it or the run reaches its time limit. An error thrown inside a callback is
                reported as well, with a non-zero exit code, rather than being lost when the run
                ends.
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-foreground">
                A SQL database that survives the refresh
              </h2>
              <p className="mt-1.5">
                SQLite starts reliably again, so a SQL file runs, creates its tables, inserts rows
                and queries them without an initialization error in the way. The database belongs
                to the project: it is saved in your workspace and loaded again the next time you
                run SQL there, so closing the tab or refreshing the page no longer starts you
                over. Each project keeps its own database, and running SQL in one project never
                touches another's.
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-foreground">
                Sign-in that doesn't flicker on the way to your projects
              </h2>
              <p className="mt-1.5">
                Restoring a session in a reopened browser used to bounce a signed-in visitor
                through the sign-in page before landing back on the dashboard. The dashboard now
                stays in its "checking your session" state until the session is resolved, then
                opens straight onto your projects. A visitor who is genuinely signed out is still
                sent to sign in, and guest entry, normal sign-in and code verification behave
                exactly as they did before.
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-foreground">
                Project cards you can click anywhere
              </h2>
              <p className="mt-1.5">
                The whole card opens its project now — the title, the details line and the empty
                space around them. The actions menu stays its own control, so Rename, Duplicate,
                Export, Share and Delete never open the project by accident, and the card is still
                fully usable from the keyboard, with the same focus and navigation behaviour as
                before.
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-foreground">
                Compiler messages that explain themselves
              </h2>
              <p className="mt-1.5">
                C and C++ compile with a real GCC/G++ toolchain on Linux, and its diagnostics are
                shown exactly as the compiler produced them. When the failure is a header that
                toolchain simply does not have — <code className={CODE}>conio.h</code>, the DOS/Windows console
                header from Turbo C and MSVC — the terminal now adds a note after the compiler's
                own message: what that header is, why it isn't available here, and the portable
                alternatives that do work, such as ANSI escape codes for clearing the screen and
                positioning the cursor, and <code className={CODE}>std::cin</code>, <code className={CODE}>getline</code> or{" "}
                <code className={CODE}>scanf</code> for input. Calls with no standard equivalent, like{" "}
                <code className={CODE}>getch()</code> and <code className={CODE}>kbhit()</code>, are named as such rather than
                quietly replaced, and your code is never rewritten for you.
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-foreground">
                A dashboard that stays inside the screen
              </h2>
              <p className="mt-1.5">
                On a phone the dashboard no longer scrolls sideways: its content is contained to
                the width of the screen, in the empty state and with projects listed alike. The
                project grid, the cards and the actions themselves are unchanged, and on a larger
                screen the layout is exactly what it was before.
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-foreground">Stop, described honestly</h2>
              <p className="mt-1.5">
                When a runtime can be interrupted, Stop ends the run and it is reported as stopped
                — not as a failure — with the output and exit code that belong to it. When it
                can't be interrupted mid-execution, the terminal says so instead of pretending the
                process ended. For a program running in the remote sandbox, Stop stops tracking
                the job and states plainly that the service does not offer a way to cancel it, so
                that job may finish in the background. Either way, the output, exit code and
                status you see belong to the run you started: a late result from an earlier run
                can no longer replace them.
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-foreground">
                Run and Preview, predictable as before
              </h2>
              <p className="mt-1.5">
                Preview still rebuilds as you edit a web project — the live preview is unchanged,
                including preview console output appearing in the terminal. Run still starts
                exactly one execution per press, Stop followed by a new Run works without
                refreshing the page, and every run continues to report its real exit code. Nothing
                about editing, saving or moving between the editor, terminal and preview has
                changed.
              </p>
            </section>

            <p>
              If anything looks off, or there's something you'd like to see next, please tell us
              on the{" "}
              <Link
                to="/contributions"
                className="font-medium text-foreground underline underline-offset-2 transition-colors hover:text-emerald-600 dark:hover:text-emerald-400"
              >
                Bugs &amp; Contributions
              </Link>{" "}
              page.
            </p>
          </div>
        </article>
      </main>
    </div>
  );
}
