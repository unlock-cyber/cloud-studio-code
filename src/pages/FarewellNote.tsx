import { Link } from "react-router";
import { ArrowRight } from "lucide-react";
import { usePageMeta } from "@/lib/seo";

export default function FarewellNote() {
  usePageMeta({
    title: "A Little Note From the Developer — Cloud Studio Code",
    description:
      "A short, human farewell note from the developer of Cloud Studio Code.",
    path: "/letter",
  });

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-4 py-12 text-center sm:py-20">
        <p className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
          Cloud Studio Code is taking a pause.
        </p>
        <p className="mt-3 text-center text-muted-foreground/80">
          Every project has a story. Here&apos;s a little note from the developer behind this one.
        </p>
        <Link
          to="/letter"
          className="mt-6 inline-flex items-center gap-2 rounded-md border border-border/60 bg-background/70 px-4 py-2 text-sm font-medium text-muted-foreground/90 transition-colors hover:bg-accent/50 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none dark:border-border/80"
        >
          Read the letter
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
