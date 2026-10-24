import { useEffect, useState } from "react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

// The homepage renders first and the letter follows shortly after, so the
// announcement never blocks the page from becoming visible.
const ANNOUNCEMENT_DELAY_MS = 700;

// Landing unmounts whenever the visitor leaves the homepage, which resets any
// component state and used to replay the letter on the next internal visit.
// This flag lives at module scope instead: it survives client-side route
// changes for the current page load and is re-evaluated on a full reload. It
// is set only when the letter is actually presented, so StrictMode's
// mount/unmount/mount cycle cannot suppress it.
let shownThisPageLoad = false;

export function FarewellLetter() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (shownThisPageLoad) return;
    const timer = window.setTimeout(() => {
      shownThisPageLoad = true;
      setOpen(true);
    }, ANNOUNCEMENT_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        showCloseButton={false}
        // The letter is an announcement, not a form: a stray backdrop click
        // must not dismiss it. X, Continue and Escape are the exits.
        onPointerDownOutside={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
        overlayClassName="bg-background/50 backdrop-blur-sm motion-reduce:animate-none!"
        className="w-[calc(100vw-1.5rem)] max-w-xl gap-0 overflow-y-auto overscroll-contain rounded-2xl border-red-500/25 bg-card p-0 text-card-foreground ring-1 ring-red-500/15 shadow-[0_0_80px_-28px_rgba(239,68,68,0.65)] sm:w-full sm:max-w-xl motion-reduce:animate-none!"
      >
        <div className="sticky top-0 z-10 flex items-start gap-3 rounded-t-2xl border-b border-red-500/15 bg-card/95 px-5 pt-5 pb-4 backdrop-blur sm:px-7 sm:pt-6">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-red-500 dark:text-red-400">
              A personal note
            </p>
            <DialogTitle className="mt-2 text-xl font-bold tracking-tight sm:text-2xl">
              A Letter From Developer
            </DialogTitle>
          </div>
          <DialogClose asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="-mr-1 shrink-0 text-muted-foreground hover:text-foreground"
              aria-label="Close letter"
            >
              <X />
            </Button>
          </DialogClose>
        </div>

        <div className="px-5 py-5 sm:px-7 sm:py-6">
          <DialogDescription className="sr-only">
            A personal announcement from Shaheer about pausing active
            development of Cloud Studio Code.
          </DialogDescription>
          <div className="space-y-4 text-[15px] leading-relaxed text-muted-foreground">
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
            <p className="text-base font-semibold tracking-tight text-foreground">
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
              You can still explore the website by clicking the Continue button
              below.
            </p>
            <p>Thank you for being here.</p>
            <p className="pt-1 text-[15px] font-semibold text-foreground">
              Shaheer
            </p>
          </div>
        </div>

        <div className="sticky bottom-0 z-10 rounded-b-2xl border-t border-red-500/15 bg-card/95 px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur sm:px-7">
          <Button
            size="lg"
            className="w-full bg-emerald-600 text-white hover:bg-emerald-500"
            onClick={() => setOpen(false)}
          >
            Continue
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
