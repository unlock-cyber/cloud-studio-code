import { Link, useLocation, useNavigate } from "react-router";
import { ArrowLeft, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePageMeta } from "@/lib/seo";
import { changelogEntry, changelogPageMeta, formatChangelogDate } from "@/lib/changelog";

export default function ChangelogGuestTransfer() {
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
  const entry = changelogEntry("/changelog/guest-workspace-transfer");
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
              Moving from a guest workspace to an account is now immediate: everything
              you've already built comes with you.
            </p>
          </div>

          {/* Body */}
          <div className="space-y-6 pt-5 text-sm leading-relaxed text-muted-foreground">
            <section>
              <h2 className="font-semibold text-foreground">
                Sign in without starting over
              </h2>
              <p className="mt-1.5">
                If you've been working in a guest workspace, you can create an account
                or sign in at any point. Your guest projects, files and SQL databases
                are moved into your authenticated workspace as part of signing in, so
                there's nothing to recreate, re-import or re-upload.
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-foreground">
                Ready the moment you sign in
              </h2>
              <p className="mt-1.5">
                The transfer now completes as part of signing in, with no manual page
                refresh required. As soon as authentication succeeds, your workspace is
                waiting in your account — the same projects, the same folders and file
                names, the same file contents — and it continues on the registered
                limits: 150 MB and 24 hours of inactivity.
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-foreground">
                Existing work stays where it is
              </h2>
              <p className="mt-1.5">
                If your account already holds projects, your guest projects are added
                alongside them — existing work is never overwritten or discarded.
              </p>
            </section>

            <p>
              This is part of our ongoing work to make moving from a guest workspace to
              an account seamless. If anything looks off, please tell us on the{" "}
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
