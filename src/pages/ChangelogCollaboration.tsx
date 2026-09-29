import { Link, useLocation, useNavigate } from "react-router";
import { ArrowLeft, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePageMeta } from "@/lib/seo";
import { changelogEntry, changelogPageMeta, formatChangelogDate } from "@/lib/changelog";

export default function ChangelogCollaboration() {
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
  const entry = changelogEntry("/changelog/collaboration-update");
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
              Until now, a project in Cloud Studio Code was yours alone. This update adds
              sharing: create a link, send it to anyone, and they can read the project —
              its files, its code and, for web projects, its live preview — without being
              able to change anything. It's meant for showing work, giving a demo, or
              getting feedback on something you're building.
            </p>
          </div>

          {/* Body */}
          <div className="space-y-6 pt-5 text-sm leading-relaxed text-muted-foreground">
            <section>
              <h2 className="font-semibold text-foreground">Share projects</h2>
              <p className="mt-1.5">
                Every project now has a Share option, available from the editor and from
                your project list. Opening it creates a share link for that one project
                and shows it to you ready to copy — no setup, and nothing else to
                configure. Sharing stays off until you turn it on.
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-foreground">
                Read-only project access
              </h2>
              <p className="mt-1.5">
                Anyone who opens a shared link gets a clean, read-only view of the project:
                they can browse the file tree, move between files, read the full source,
                and see which files are open — all in the same editor you use. What they
                can't do is change anything. There is no save, no run, no renaming, moving,
                duplicating or deleting files, and no way to touch your project settings.
                The view says clearly that it's read-only, so there's no confusion about
                what a visitor can do.
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-foreground">Shareable previews</h2>
              <p className="mt-1.5">
                For web projects — the ones with an HTML entry file — a shared project can
                also be previewed. Visitors can open the live preview right in the shared
                view and see what the project actually produces, without any access to your
                workspace. Other project types are shared as source only: they have no live
                preview, and running them stays with you.
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-foreground">Manage sharing</h2>
              <p className="mt-1.5">
                Sharing is always in your hands. Turning it off revokes the link
                immediately — anyone who still has it will no longer be able to open the
                project. If you decide to share again later, the project gets a brand new
                link, so the revoked one can never come back to life.
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-foreground">
                No account required to view
              </h2>
              <p className="mt-1.5">
                People you share with don't need to sign up or sign in to Cloud Studio
                Code — a valid link is all it takes. A link grants access to that single
                shared project and nothing else: not your workspace, not your other
                projects, and no ability to edit or continue the work.
              </p>
            </section>

            <p>
              Sharing is a first step for this area of the product — it's here to make it
              easy to show a project, walk someone through a demo, or collect feedback
              while you build. If you'd like to see something more in this space, tell us
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
