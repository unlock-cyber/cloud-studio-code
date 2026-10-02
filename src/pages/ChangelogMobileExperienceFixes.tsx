import { Link, useLocation, useNavigate } from "react-router";
import { ArrowLeft, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePageMeta } from "@/lib/seo";
import { changelogEntry, changelogPageMeta, formatChangelogDate } from "@/lib/changelog";

export default function ChangelogMobileExperienceFixes() {
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
  const entry = changelogEntry("/changelog/mobile-experience-fixes");
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
              Two small things were getting in the way on a phone: the header was taller than it
              needed to be, and the editor could push its own controls below the fold. Both are
              fixed. This is a targeted correction to the mobile layout — no features are added or
              removed, and nothing about how your projects, files or code run has changed.
            </p>
          </div>

          {/* Body */}
          <div className="space-y-6 pt-5 text-sm leading-relaxed text-muted-foreground">
            <section>
              <h2 className="font-semibold text-foreground">
                The header no longer wraps the product name
              </h2>
              <p className="mt-1.5">
                On a narrow phone the header could break the full Cloud Studio Code name across
                several lines, which made the header unnecessarily tall and squeezed the controls
                beside it. The branding now responds to the width of the screen instead: desktop
                keeps the full Cloud Studio Code name exactly as before, narrower screens use the
                compact CS Code branding, and on the narrowest screens it falls back to the logo
                mark on its own. In every case the name stays on one line, so the header keeps a
                consistent height and the guest badge, the dashboard action and the theme control
                all stay comfortably reachable.
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-foreground">
                The IDE now fits the mobile viewport
              </h2>
              <p className="mt-1.5">
                On a phone the editor could end up taller than the part of the screen you can
                actually see, because the page was sized against a viewport that measures the
                screen with the browser's address bar out of the way. The result was extra
                page-level scrolling that wasn't doing anything useful, and the IDE's Files,
                Editor, Terminal and Preview navigation could fall below the visible area. The
                editor now sizes itself against the real mobile viewport, so the whole IDE behaves
                like a fixed-height application shell: the header stays at the top, the panel you
                are working in sits in the middle, and the Files / Editor / Terminal / Preview
                switcher stays anchored at the bottom without you having to scroll to reach it.
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-foreground">
                Scrolling still happens where it should
              </h2>
              <p className="mt-1.5">
                Fixing the page-level scroll didn't mean turning scrolling off. The editor, the
                terminal, the file explorer and the preview each keep scrolling their own content
                as they always did — only the outer page stopped scrolling. So a long file still
                scrolls inside the editor, a long terminal session still scrolls inside the
                terminal, and a wide preview still scrolls within its own pane. Saving, running
                and stopping a project, and moving between the editor, terminal and preview, all
                behave exactly as before.
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-foreground">Desktop is unchanged</h2>
              <p className="mt-1.5">
                Both fixes were made so that they only apply where they were needed. The desktop
                header still shows the full Cloud Studio Code name, and on a desktop browser the
                corrected viewport height is identical to what it was before, so the IDE window,
                its panels and the layout around them are untouched. If the mobile layout was the
                only thing you noticed, this is what changed; if you only ever use Cloud Studio
                Code on a larger screen, you should notice nothing at all.
              </p>
            </section>

            <p>
              Found something else that doesn't behave on your screen? Tell us on the{" "}
              <Link
                to="/contributions"
                className="font-medium text-foreground underline underline-offset-2 transition-colors hover:text-emerald-600 dark:hover:text-emerald-400"
              >
                Bugs &amp; Contributions
              </Link>{" "}
              page — reports that name the screen size and browser you saw it on are the most
              useful.
            </p>
          </div>
        </article>
      </main>
    </div>
  );
}