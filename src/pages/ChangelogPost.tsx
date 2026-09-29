import { Link, useLocation, useNavigate } from "react-router";
import { ArrowLeft, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePageMeta } from "@/lib/seo";
import { changelogEntry, changelogPageMeta, formatChangelogDate } from "@/lib/changelog";

export default function ChangelogPost() {
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
  const entry = changelogEntry("/changelog/introducing-cloud-studio-code");
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
              Today we're launching Cloud Studio Code — a complete development
              environment that runs entirely in your browser. No installation, no
              setup, no local toolchain. Open the site, create a project, and start
              writing and running real code.
            </p>
          </div>

          {/* Body */}
          <div className="space-y-6 pt-5 text-sm leading-relaxed text-muted-foreground">
            <section>
              <h2 className="font-semibold text-foreground">A real IDE in the browser</h2>
              <p className="mt-1.5">
                Cloud Studio Code gives you a full cloud IDE: a browser-based code editor
                powered by Monaco with syntax highlighting, autocompletion, search and
                replace, multi-cursor editing, and code folding. Work across multiple
                editor tabs with unsaved-change indicators, navigate quickly with the
                command palette, and use keyboard shortcuts for the things you do most.
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-foreground">
                Files, projects and persistence
              </h2>
              <p className="mt-1.5">
                A built-in file explorer lets you create, rename, move and delete files
                and folders in a real project filesystem. Projects and files persist in
                your workspace, so you can close the tab and pick up exactly where you
                left off. You can start instantly as a guest, or sign in to keep your
                workspaces across sessions — and import or export complete projects as
                ZIP archives.
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-foreground">
                Languages and runtimes
              </h2>
              <p className="mt-1.5">
                Write and run code in Python, C, C++, Java, JavaScript and TypeScript,
                with real stdout/stderr output and exit codes. Shell scripts and Bash are
                supported too. HTML, CSS and JavaScript web projects — including React —
                render in a live preview pane, so you can see your work as you build it.
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-foreground">
                Data, formats and SQL
              </h2>
              <p className="mt-1.5">
                Run real SQL against SQLite databases, and edit first-class support for
                JSON, YAML, XML and Markdown with proper syntax highlighting throughout
                the editor.
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-foreground">
                Sandboxed and isolated
              </h2>
              <p className="mt-1.5">
                All code execution and previewing happens in a sandboxed environment,
                isolated per workspace, with resource limits in place. Your code runs in
                your workspace, not on your machine.
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-foreground">Responsive by design</h2>
              <p className="mt-1.5">
                The interface adapts to your screen — resizable panels on desktop, a
                layout that works on smaller devices, and dark and light themes.
              </p>
            </section>

            <section className="rounded-lg border border-border/60 bg-background/60 p-4">
              <h2 className="font-semibold text-foreground">Current limitations</h2>
              <ul className="mt-2 list-disc space-y-1.5 pl-5">
                <li>
                  Sandboxed runtimes have resource limits, so very long-running or
                  resource-heavy programs may be stopped early.
                </li>
                <li>
                  The live web preview is designed for front-end (HTML/CSS/JS/React)
                  projects; server-side applications can't expose a public URL.
                </li>
                <li>
                  Guest workspaces are temporary — sign in to make sure your projects are
                  kept.
                </li>
                <li>
                  Package installation isn't available in the sandbox; execution is
                  limited to the built-in languages and runtimes.
                </li>
              </ul>
            </section>

            <p>
              Cloud Studio Code is still under active development, and this changelog
              will be updated as things improve. If you hit a bug or have an idea you'd
              like to see, we'd love to hear from you — please use the{" "}
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
