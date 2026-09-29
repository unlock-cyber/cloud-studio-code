import { Link, useLocation, useNavigate } from "react-router";
import { ArrowLeft, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePageMeta } from "@/lib/seo";
import { changelogEntry, changelogPageMeta, formatChangelogDate } from "@/lib/changelog";

export default function ChangelogWorkspaceProjectManagement() {
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
  const entry = changelogEntry("/changelog/workspace-project-management");
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
              Managing projects is the part of Cloud Studio Code you touch most often, so this
              release is about making it quick and predictable: finding a project without
              scrolling, choosing the order that matches how you work, seeing at a glance which
              projects you touched recently, and renaming a project without leaving the editor.
              Nothing about how your workspace stores projects changes — the same projects, the
              same files, just easier to work with.
            </p>
          </div>

          {/* Body */}
          <div className="space-y-6 pt-5 text-sm leading-relaxed text-muted-foreground">
            <section>
              <h2 className="font-semibold text-foreground">Find a project instantly</h2>
              <p className="mt-1.5">
                The dashboard now has a search field above your project list. Type part of a
                project name and the list narrows as you type — no waiting, no page reload. When
                nothing matches, the results area says so plainly and offers to clear the search
                rather than leaving you staring at an empty page. Clearing the field puts your
                projects back in their normal order, exactly as they were.
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-foreground">Order projects the way you think</h2>
              <p className="mt-1.5">
                A single control next to the project actions chooses how the list is ordered: by
                recently opened, by last modified, by the date each project was created, or
                alphabetically by name. Recently opened stays the default, so the dashboard still
                opens on what you were just working on. Whichever order you pick applies
                immediately and is used consistently for every project in the list.
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-foreground">See what you touched recently</h2>
              <p className="mt-1.5">
                Each project card now shows both when you last opened it and when it was last
                edited, using the timestamps your workspace already keeps — opening a project in
                the editor updates its position, and a saved change shows up as a recent edit. The
                Recent projects section at the top of the dashboard keeps working the same way:
                your most recently opened projects, ready to jump back into.
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-foreground">Rename without leaving the editor</h2>
              <p className="mt-1.5">
                You can now rename the project you have open straight from the editor's menu.
                It's the same rename the dashboard offers — only the project's name changes, and
                your files, folders and settings are left untouched. The new name appears in the
                editor title bar and on the dashboard immediately, and it's still there the next
                time you sign in.
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-foreground">Clearer, safer actions</h2>
              <p className="mt-1.5">
                Creating a project now checks the name before sending it, so a name that's empty,
                too long, or contains characters that aren't allowed is explained right next to
                the field instead of failing after the fact — and the same rules apply wherever
                you rename a project, so dashboard and editor always agree. Opening a project
                shows which one is being opened, and a second click can't start a second copy of
                the same action. Deleting a project still asks for confirmation that names the
                project, shows that it's working while it runs, and only removes it from the
                dashboard once the deletion has actually succeeded. If something fails, the
                reason is shown and nothing is changed behind your back.
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-foreground">Sharing and duplicates stay honest</h2>
              <p className="mt-1.5">
                Project management and sharing are kept strictly separate. Renaming or duplicating
                a project never creates or carries over a public link: a copy starts as a private
                project of its own, with its own files and its own identity, and any share link you
                created belongs to the project you created it for. Revoking a link still ends
                access immediately, and a copy can be shared only if you decide to share it.
              </p>
            </section>

            <p>
              If there's something you'd like to see next in project management, tell us on the{" "}
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
