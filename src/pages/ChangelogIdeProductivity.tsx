import { Link, useLocation, useNavigate } from "react-router";
import { ArrowLeft, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePageMeta } from "@/lib/seo";
import { changelogEntry, changelogPageMeta, formatChangelogDate } from "@/lib/changelog";

export default function ChangelogIdeProductivity() {
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
  const entry = changelogEntry("/changelog/ide-productivity-update");
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
              This release is about the everyday rhythm of editing: getting back to the file
              you were just in, moving between files from the keyboard, and closing tabs
              without ever putting work at risk.
            </p>
          </div>

          {/* Body */}
          <div className="space-y-6 pt-5 text-sm leading-relaxed text-muted-foreground">
            <section>
              <h2 className="font-semibold text-foreground">Recent files, right where you are</h2>
              <p className="mt-1.5">
                The files you've opened most recently are now remembered per project and shown
                at the top of the command palette. Open the palette and the first entry is the
                file you were just working in, so picking up where you left off takes a single
                keystroke. The list is kept in your browser alongside your other editor state —
                it holds file names only, scoped to the project, and never leaves your machine.
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-foreground">Save all with one shortcut</h2>
              <p className="mt-1.5">
                Save every file you have open at once with Ctrl+Shift+S (Cmd+Shift+S on a Mac).
                Saving the file you're in stays exactly as it was with Ctrl+S, and both go
                through the same save your editor already used — so Auto-Save, the dirty
                indicators and the unsaved-changes prompts all still agree.
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-foreground">Predictable tabs</h2>
              <p className="mt-1.5">
                Closing the tab you're in now moves you to the tab beside it instead of jumping
                to the end of the strip, and deleting the file you're viewing behaves the same
                way. Closing a tab with unsaved changes still asks before anything is thrown
                away.
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-foreground">A sharper command palette</h2>
              <p className="mt-1.5">
                The palette is grouped so the things you reach for most come first — recent
                files, then every file, then actions, view and project commands. It gained
                next and previous tab commands, shows the shortcut for saving everything, and
                each row is matched independently, so a file listed under both{" "}
                <span className="font-medium text-foreground">Recent</span> and{" "}
                <span className="font-medium text-foreground">Files</span> behaves predictably.
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-foreground">The editor is ready when you are</h2>
              <p className="mt-1.5">
                On desktop, opening a file — from the explorer, a tab, or the palette — puts the
                cursor in the editor, so you can start typing straight away. One shortcut
                listener now covers the whole editor, which also means a key the editor itself
                has already handled can no longer trigger a second save or a second run.
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
