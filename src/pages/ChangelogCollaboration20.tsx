import { Link, useLocation, useNavigate } from "react-router";
import { ArrowLeft, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePageMeta } from "@/lib/seo";

export default function ChangelogCollaboration20() {
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
  usePageMeta({
    title: "Collaboration 2.0 — Changelog",
    description:
      "Collaboration 2.0 refines project sharing in Cloud Studio Code: see exactly what a shared link allows, preview the visitor's view, and get a clearer read-only experience for anyone you share with.",
    path: "/changelog/collaboration-2-0",
  });

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
              <span className="uppercase">Enhancement</span> · 29 September 2026
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
              Collaboration 2.0
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Sharing a project is one of the most useful things Cloud Studio Code does, so
              this release is all about making it feel complete: clearer about what a link
              allows, easier to review before you send it, and more comfortable for the
              person on the other end. Nothing about how sharing works changes — it simply
              gets a lot more polished.
            </p>
          </div>

          {/* Body */}
          <div className="space-y-6 pt-5 text-sm leading-relaxed text-muted-foreground">
            <section>
              <h2 className="font-semibold text-foreground">Sharing, explained up front</h2>
              <p className="mt-1.5">
                The Share panel now spells out what a link does while you look at it. You can
                see at a glance whether sharing is on or off, how many files the project
                has, and whether a live preview will be available to visitors. Shared
                visitors can browse the project's files, read the source, and open supported
                live previews. They can't edit files, save changes, run the project, use the
                terminal, or download the project from the shared view. That's the whole
                promise, stated plainly in the place where you decide to share.
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-foreground">Preview what visitors see</h2>
              <p className="mt-1.5">
                You no longer have to guess. From the Share panel you can open the shared
                view yourself and see the project exactly as a visitor would — the same
                files, the same read-only editor, the same preview when one is available.
                It's the real shared experience rather than a mock-up, so what you check is
                what people get.
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-foreground">Clearer sharing controls</h2>
              <p className="mt-1.5">
                Sharing status is now unmistakable, and the everyday actions are simpler:
                copy the link and you get immediate confirmation, revoking asks you to
                confirm first so a stray click can't take a project offline, and once
                sharing is off the panel says so directly — the old link no longer works.
                Turning sharing back on creates a fresh link, so a revoked one never comes
                back to life.
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-foreground">A better shared project view</h2>
              <p className="mt-1.5">
                The page visitors land on has been cleaned up throughout. Read-only is stated
                clearly rather than implied, the project's name, language, file count and
                last update are visible at a glance, and loading a link now says what's
                happening instead of showing a blank screen. Projects with no files yet get a
                proper empty state, links that are no longer valid explain themselves without
                technical jargon, and when a preview can't be offered — or something goes
                wrong while it runs — the reason is clear and the source is still there to
                read.
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-foreground">Comfortable on mobile</h2>
              <p className="mt-1.5">
                The shared view was tightened up for smaller screens, so browsing files,
                reading code and getting to the preview all work properly on a phone. Long
                file names stay readable without breaking the layout, the read-only
                indicator stays visible, and the controls are sized for touch.
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-foreground">Read-only by design</h2>
              <p className="mt-1.5">
                Nothing here loosens how shared links work. Opening a shared project is still
                protected read-only access to that single project, sharing stays off until
                you enable it, and revoking it ends access right away. Private workspace
                information — your other projects, your settings, your account details — is
                not part of what a shared view shows or what a visitor can reach.
              </p>
            </section>

            <p>
              If there's something you'd like to see next in sharing and reviewing projects,
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
