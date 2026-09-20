import { useNavigate } from "react-router";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Changelog() {
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
            Changelog
          </h1>
          <p className="mt-3 text-muted-foreground">
            What's new in Cloud Studio Code.
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate("/changelog/introducing-cloud-studio-code")}
          className="group block w-full rounded-xl border border-border/60 bg-card p-5 text-left transition-colors hover:border-emerald-500/50 sm:p-6"
        >
          <div className="flex items-center gap-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <Sparkles className="size-3.5" />
            Initial release
          </div>
          <h2 className="mt-2 text-xl font-bold tracking-tight text-foreground transition-colors group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
            Introducing Cloud Studio Code
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">20 September 2026</p>
          <div className="mt-4 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors group-hover:text-foreground">
            Read the announcement
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </div>
        </button>
      </main>
    </div>
  );
}
