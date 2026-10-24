import { Link } from "react-router";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { usePageMeta } from "@/lib/seo";

export default function FarewellLetter() {
  usePageMeta({
    title: "A Letter From Developer — Cloud Studio Code",
    description:
      "A personal note from Shaheer about pausing active development of Cloud Studio Code.",
    path: "/letter",
  });

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      {/* Soft red glow behind the letter — the page's only decoration. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px]"
        style={{
          background:
            "radial-gradient(600px 260px at 50% 0%, rgba(239,68,68,0.12), transparent 70%)",
        }}
      />

      <main className="relative mx-auto w-full max-w-2xl px-4 pt-10 pb-16 sm:px-6 sm:pt-16">
        <article className="rounded-2xl border border-red-500/20 bg-card p-6 shadow-[0_0_80px_-40px_rgba(239,68,68,0.55)] ring-1 ring-red-500/10 sm:p-10">
          <p className="text-[11px] font-semibold tracking-[0.16em] text-red-500 uppercase dark:text-red-400">
            A personal note
          </p>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-balance sm:text-3xl">
            A Letter From Developer
          </h1>

          <div className="mt-7 space-y-5 text-[15px] leading-7 text-muted-foreground sm:text-base sm:leading-8">
            <p className="font-medium text-foreground">
              Hi! I am Shaheer, the solo developer behind this whole project.
            </p>
            <p>
              I never thought I would have to write something like this, but
              after thinking about everything, I have decided to stop actively
              developing Cloud Studio Code for now.
            </p>
            <p>
              This was never an easy decision for me. I started this project
              because I wanted to build something of my own, and over time, it
              became much more than just an idea. I spent my time building
              features, fixing bugs, improving the experience, and trying to
              make it better with every update.
            </p>
            <p>
              But right now, I have to be honest with myself. Managing this
              project alongside my studies and exam preparation has become
              really difficult. There is still a lot of work left, and I just do
              not have enough time to give it the care it needs while also
              keeping up with my studies.
            </p>
            <p>
              I never wanted to leave this project behind. I had plans for so
              many more updates, and I always imagined making it better over
              time. But sometimes, even when you really care about something,
              you have to accept that you cannot give it everything you want to
              give it.
            </p>
            <p className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
              Interest never dies.
            </p>
            <p>
              My interest in building things has not gone away. I just cannot
              say what the future of Cloud Studio Code will look like. Maybe I
              will come back to it someday, or maybe life will take me in a
              different direction. Right now, I honestly do not know.
            </p>
            <p>
              To everyone who tried Cloud Studio Code, followed its progress,
              shared feedback, or simply took the time to visit, thank you. It
              means a lot to me.
            </p>
            <p>
              You can still explore the website by clicking the Back to Home
              button below.
            </p>
            <p>Thank you for being here.</p>
            <p className="pt-1 font-semibold text-foreground">Shaheer</p>
          </div>

          <div className="mt-8 border-t border-red-500/15 pt-6">
            <Button asChild size="lg" className="gap-2">
              <Link to="/">
                <ArrowLeft className="size-4" aria-hidden="true" />
                Back to Home
              </Link>
            </Button>
          </div>
        </article>
      </main>
    </div>
  );
}
