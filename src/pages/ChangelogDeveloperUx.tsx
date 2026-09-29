import { Link, useLocation, useNavigate } from "react-router";
import { ArrowLeft, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { usePageMeta } from "@/lib/seo";
import { changelogEntry, changelogPageMeta, formatChangelogDate } from "@/lib/changelog";

export default function ChangelogDeveloperUx() {
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
  const entry = changelogEntry("/changelog/ide-developer-ux-update");
  usePageMeta(changelogPageMeta(entry));

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center px-4">
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

      <main className="mx-auto max-w-3xl px-4 pb-16">
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
              This update focuses on the everyday rhythm of writing code in Cloud Studio
              Code: your work saves itself, the editor is comfortable on a phone, and the
              actions you reach for most are quicker to get to. Here's what changed.
            </p>
          </div>

          {/* Body */}
          <div className="space-y-6 pt-5 text-sm leading-relaxed text-muted-foreground">
            <section>
              <h2 className="font-semibold text-foreground">Auto-Save</h2>
              <p className="mt-1.5">
                Auto-Save is now on by default, so edits are written to your project
                shortly after you stop typing instead of waiting for a manual save. It
                works alongside the Save button and the{" "}
                <Kbd>Ctrl</Kbd>/<Kbd>Cmd</Kbd>+<Kbd>S</Kbd> shortcut, never overwrites your
                work, and shows a quiet "Auto-saving…" note while it runs.
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Enabled by default for new workspaces.</li>
                <li>
                  If you've already chosen a preference, it stays exactly as you set it.
                </li>
                <li>
                  Auto-Save can be turned on or off from the editor toolbar, the editor
                  menu and the command palette, and your choice is remembered for the
                  workspace.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="font-semibold text-foreground">A better mobile IDE</h2>
              <p className="mt-1.5">
                The editor is now much more usable on a phone. The layout is still the
                same IDE, with the same files and tools — it just adapts to a narrow
                screen instead of squeezing the desktop view.
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Compact, comfortably tappable controls in the editor header.</li>
                <li>
                  A roomier file explorer, and a drawer that keeps every file action
                  within reach.
                </li>
                <li>
                  Tabs, the editor toolbar and the status-bar controls stay within the
                  screen, and nothing pushes the page sideways.
                </li>
                <li>
                  The editor drops the minimap on small screens, so your code gets the
                  space instead.
                </li>
                <li>
                  A terminal layout built for narrow screens, with its controls collapsing
                  to clear icons.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="font-semibold text-foreground">
                A more useful command palette
              </h2>
              <p className="mt-1.5">
                The command palette (or <Kbd>Ctrl</Kbd>/<Kbd>Cmd</Kbd>+<Kbd>Shift</Kbd>+
                <Kbd>P</Kbd>) now covers far more of what you already do in the editor, so
                you can work without leaving the keyboard.
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Saving the current file, or saving everything at once.</li>
                <li>File actions: creating files and folders, and working with the open file.</li>
                <li>Editor settings and toggling Auto-Save.</li>
                <li>Running and stopping, together with the existing navigation and view commands.</li>
              </ul>
            </section>

            <section>
              <h2 className="font-semibold text-foreground">
                A clearer terminal
              </h2>
              <p className="mt-1.5">
                The terminal now always tells you where things stand — whether it's idle,
                starting, running, finished successfully, failed or stopped — and the
                result of your last run is summarised right in its header, including the
                exit code and how long it took. Clearing the output resets the terminal to
                a clean, idle state, and Stop stays visible while a process is running.
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-foreground">Run History</h2>
              <p className="mt-1.5">
                A lightweight run history is now part of the terminal: open it to see what
                you've run most recently and jump straight back to the file. Each entry
                shows the file, its language, how it finished and when it ran, so you can
                retrace your steps without scrolling back through old output.
              </p>
              <p className="mt-1.5">
                Your history stays in your browser alongside the project — it's never
                uploaded, and it isn't synchronised between devices.
              </p>
            </section>

            <p>
              Alongside these, lots of small things got smoother, and we'll keep going:
              the goal is a development experience that stays out of your way, wherever
              you happen to be working. If something looks off, or there's something
              you'd like to see next, please tell us on the{" "}
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
