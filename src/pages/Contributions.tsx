import { useState } from "react";
import { useNavigate } from "react-router";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { ArrowLeft, Bug, CheckCircle2 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { usePageMeta } from "@/lib/seo";

const emptyForm = {
  title: "",
  description: "",
  stepsToReproduce: "",
  expectedBehavior: "",
  actualBehavior: "",
  browserInfo: "",
  reporterName: "",
  reporterEmail: "",
};

export default function Contributions() {
  usePageMeta({
    title: "Bugs & Contributions — Cloud Studio Code",
    description:
      "Found a bug in Cloud Studio Code, or have an idea that would make the browser-based IDE better? Report it here — reports are reviewed directly by the team.",
    path: "/contributions",
  });
  const navigate = useNavigate();
  const submit = useMutation(api.bugReports.submitReport);
  const [form, setForm] = useState(emptyForm);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  const set = (key: keyof typeof emptyForm) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim() || !form.stepsToReproduce.trim()) {
      toast.error("Please fill in the title, description and steps to reproduce.");
      return;
    }
    setSending(true);
    try {
      await submit({
        title: form.title,
        description: form.description,
        stepsToReproduce: form.stepsToReproduce,
        expectedBehavior: form.expectedBehavior,
        actualBehavior: form.actualBehavior,
        browserInfo: form.browserInfo || navigator.userAgent,
        reporterName: form.reporterName || undefined,
        reporterEmail: form.reporterEmail || undefined,
      });
      setDone(true);
      setForm(emptyForm);
      toast.success("Thanks — your bug report was submitted.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center px-4">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-2 text-muted-foreground hover:text-foreground"
            onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/"))}
          >
            <ArrowLeft className="size-4" /> Back
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-16">
        <div className="pt-10 pb-8">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            <span>Bugs &amp; Contributions</span>
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Cloud Studio Code is still under active development, and things may change
            or have limitations. If something doesn't work the way you'd expect, please
            tell us about it — bug reports help us improve. Ideas and useful
            contributions are welcome too.
          </p>
        </div>

        {done ? (
          <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] p-8 text-center">
            <CheckCircle2 className="mx-auto size-8 text-emerald-500 dark:text-emerald-400" />
            <h2 className="mt-3 text-lg font-semibold">Report submitted</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Thanks for taking the time to report this. Your report has been received
              and will be reviewed.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Button size="sm" variant="outline" onClick={() => setDone(false)}>
                Report another bug
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-muted-foreground"
                onClick={() => navigate("/")}
              >
                Back to home
              </Button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={onSubmit}
            className="space-y-5 rounded-xl border border-border/60 bg-card p-5 sm:p-6"
          >
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Bug className="size-4 text-emerald-500 dark:text-emerald-400" />
              Report a Bug
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bug-title">Bug title *</Label>
              <Input
                id="bug-title"
                value={form.title}
                onChange={set("title")}
                placeholder="A short summary of the problem"
                maxLength={200}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bug-desc">Description *</Label>
              <Textarea
                id="bug-desc"
                value={form.description}
                onChange={set("description")}
                placeholder="What happened? What were you trying to do?"
                rows={4}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bug-steps">Steps to reproduce *</Label>
              <Textarea
                id="bug-steps"
                value={form.stepsToReproduce}
                onChange={set("stepsToReproduce")}
                placeholder={"1. Go to…\n2. Click…\n3. …"}
                rows={4}
                required
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="bug-expected">Expected behavior</Label>
                <Textarea
                  id="bug-expected"
                  value={form.expectedBehavior}
                  onChange={set("expectedBehavior")}
                  placeholder="What you expected to happen"
                  rows={3}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bug-actual">Actual behavior</Label>
                <Textarea
                  id="bug-actual"
                  value={form.actualBehavior}
                  onChange={set("actualBehavior")}
                  placeholder="What actually happened"
                  rows={3}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bug-browser">Browser / device information</Label>
              <Input
                id="bug-browser"
                value={form.browserInfo}
                onChange={set("browserInfo")}
                placeholder={`Optional — defaults to your browser's user agent`}
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="bug-name">Your name</Label>
                <Input
                  id="bug-name"
                  value={form.reporterName}
                  onChange={set("reporterName")}
                  placeholder="Optional"
                  maxLength={120}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bug-email">Email</Label>
                <Input
                  id="bug-email"
                  type="email"
                  value={form.reporterEmail}
                  onChange={set("reporterEmail")}
                  placeholder="Optional — in case we need to follow up"
                  maxLength={200}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button type="button" variant="ghost" className="text-muted-foreground" onClick={() => navigate("/")}>
                Cancel
              </Button>
              <Button type="submit" disabled={sending} className="bg-emerald-600 text-white hover:bg-emerald-500">
                {sending ? "Submitting…" : "Submit report"}
              </Button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
