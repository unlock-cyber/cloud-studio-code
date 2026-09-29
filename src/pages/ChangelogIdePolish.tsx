import { Link, useLocation, useNavigate } from "react-router";
import { ArrowLeft, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePageMeta } from "@/lib/seo";
import { changelogEntry, changelogPageMeta, formatChangelogDate } from "@/lib/changelog";

export default function ChangelogIdePolish() {
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
  const entry = changelogEntry("/changelog/ide-polish-update");
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
              This update is all about making everyday work in the editor smoother and
              safer: getting back to recent projects faster, managing your files and
              folders with confidence, and never losing work by accident.
            </p>
          </div>

          {/* Body */}
          <div className="space-y-6 pt-5 text-sm leading-relaxed text-muted-foreground">
            <section>
              <h2 className="font-semibold text-foreground">
                Recent projects, one click away
              </h2>
              <p className="mt-1.5">
                Your dashboard now surfaces the projects you've worked on most recently,
                with a short note on when you last had them open, so you can pick up
                where you left off without hunting through your full list. Projects also
                sort themselves by recency as you use them, keeping the ones that matter
                at the top.
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-foreground">
                Rename and duplicate projects
              </h2>
              <p className="mt-1.5">
                Give a project a clearer name, or make a copy to experiment with
                something new, without starting from scratch. Duplicating a project
                brings across its files and folder structure, and the copy is given a
                distinct name so it never clashes with the original.
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-foreground">
                A more capable file explorer
              </h2>
              <p className="mt-1.5">
                Files and folders can be renamed, duplicated, moved into another folder,
                or deleted — all from the explorer, for both files and whole folders.
                Deleting asks you to confirm first and warns you if the item has unsaved
                changes, and if a name or move isn't possible the explorer tells you why
                and keeps what you typed, so you can correct it and try again.
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-foreground">
                Unsaved work is safer
              </h2>
              <p className="mt-1.5">
                Closing a tab with unsaved changes, leaving a project, or closing the
                browser tab now checks with you first. You can save your work and carry
                on, close without saving, or cancel and go back to what you were doing —
                so an edit is never lost to a stray click.
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-foreground">
                Clearer when a workspace can't be opened
              </h2>
              <p className="mt-1.5">
                If a workspace can't be restored — for example once it has expired —
                the editor now explains what happened in plain language instead of
                showing a blank screen or a raw error message, and offers a way to try
                again or head back to your projects.
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-foreground">
                Loading, empty and error states
              </h2>
              <p className="mt-1.5">
                Throughout the IDE, the moments where there's nothing to show are now
                handled deliberately: loading a project, opening a project that isn't
                there, or starting from a completely empty workspace each get a clear
                message and, where it helps, a next step to take.
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-foreground">Polish throughout</h2>
              <p className="mt-1.5">
                Alongside the larger changes, we've been tidying the everyday
                experience: the interface now stays consistent between light and dark
                themes, file icons stay compact and readable at any screen size, and
                labels, spacing and empty states have been made clearer in a range of
                places across the editor.
              </p>
            </section>

            <p>
              This is the first of a series of updates as we keep improving the editor.
              If anything looks off, or there's something you'd like to see next, please
              tell us on the{" "}
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
