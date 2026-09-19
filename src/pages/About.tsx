import { useNavigate } from "react-router";
import { ArrowLeft, Cloud, Lightbulb, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BetaBadge } from "@/components/BetaBadge";

export default function About() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center px-4">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-2 text-muted-foreground hover:text-foreground"
            onClick={() => {
              if (window.history.length > 1) navigate(-1);
              else navigate("/");
            }}
          >
            <ArrowLeft className="size-4" /> Back
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-16">
        <div className="pt-10 pb-8">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            About{" "}
            <span className="inline-flex items-start gap-1">
              <span>Cloud Studio Code</span>
              <BetaBadge className="-translate-y-1" />
            </span>
          </h1>
          <p className="mt-3 text-muted-foreground">
            A browser-based development environment, built for real work.
          </p>
        </div>

        <div className="space-y-6">
          <section className="rounded-xl border border-border/60 bg-card p-5 sm:p-6">
            <div className="flex items-center gap-2">
              <Cloud className="size-4 text-emerald-500 dark:text-emerald-400" />
              <h2 className="font-semibold">What is Cloud Studio Code?</h2>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Cloud Studio Code is a development environment that lives entirely in your
              browser. You open it, create a project, write code, run it, and see the
              result — without installing anything on your computer. Your projects and
              files live in the cloud, so you can pick up right where you left off.
            </p>
          </section>

          <section className="rounded-xl border border-border/60 bg-card p-5 sm:p-6">
            <div className="flex items-center gap-2">
              <Lightbulb className="size-4 text-emerald-500 dark:text-emerald-400" />
              <h2 className="font-semibold">Why it exists</h2>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Setting up a development environment has always been a barrier — installing
              compilers and runtimes, configuring tools, managing versions. Cloud Studio
              Code exists to remove that barrier. If you have a browser, you have a
              workspace. Development should be accessible to anyone, anywhere, on any
              device.
            </p>
          </section>

          <section className="rounded-xl border border-border/60 bg-card p-5 sm:p-6">
            <div className="flex items-center gap-2">
              <Rocket className="size-4 text-emerald-500 dark:text-emerald-400" />
              <h2 className="font-semibold">The idea behind the project</h2>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              The vision is simple: the tools for building software should be as easy to
              reach as the web itself. Cloud Studio Code aims to be a place where ideas
              turn into working code with almost no friction — a real editor, real
              execution, real output, all hosted for you so the focus stays on what
              you're building, not on what you need to install.
            </p>
          </section>

          <section className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.04] p-5 sm:p-6">
            <div className="flex items-center gap-2">
              <span className="inline-block rounded-full border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                In development
              </span>
              <h2 className="font-semibold">Currently in development</h2>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Cloud Studio Code is actively being developed and improved. That means some
              things may still change, and you may run into rough edges or limitations.
              We're building it in the open, and every improvement is shaped by how
              people actually use it.
            </p>
          </section>
        </div>

        <p className="mt-10 text-center text-sm text-muted-foreground">
          Thanks for exploring Cloud Studio Code. If you find something that doesn't work
          right — or have an idea that would make it better — we'd genuinely like to hear
          about it.
        </p>
      </main>
    </div>
  );
}
