import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Archive,
  ArchiveRestore,
  Check,
  ChevronLeft,
  Lock,
  Star,
  Trash2,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Report = {
  _id: string;
  title: string;
  description: string;
  stepsToReproduce: string;
  expectedBehavior: string;
  actualBehavior: string;
  browserInfo?: string;
  reporterName?: string;
  reporterEmail?: string;
  status: "new" | "in_progress" | "resolved" | "closed";
  notes?: string;
  important: boolean;
  archived: boolean;
  submittedAt: number;
};

const STATUS_LABELS: Record<Report["status"], string> = {
  new: "New",
  in_progress: "In Progress",
  resolved: "Resolved",
  closed: "Closed",
};

const SESSION_KEY = "csc.backstage.token";
const SESSION_EXP_KEY = "csc.backstage.expiresAt";

export default function Backstage() {
  const navigate = useNavigate();
  const [stage, setStage] = useState<"gate" | "password" | "in">("gate");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lockUntil, setLockUntil] = useState<number | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const signIn = useMutation(api.bugReports.signIn);
  const validateSession = useMutation(api.bugReports.validateSession);
  const signOutFn = useMutation(api.bugReports.signOut);
  const listReports = useMutation(api.bugReports.listReports);
  const updateReport = useMutation(api.bugReports.updateReport);
  const deleteReportFn = useMutation(api.bugReports.deleteReport);

  // Reports are fetched via mutations (token-based), never via reactive queries,
  // so they can never leak to unauthenticated clients.
  const [reports, setReports] = useState<Report[] | null>(null);

  const refresh = useCallback(
    async (tok: string) => {
      const res = await listReports({ token: tok });
      setReports(res.reports as Report[]);
    },
    [listReports],
  );

  // On mount, restore an existing protected session if present and still valid.
  useEffect(() => {
    const saved = sessionStorage.getItem(SESSION_KEY);
    const exp = Number(sessionStorage.getItem(SESSION_EXP_KEY) || 0);
    if (saved && exp > Date.now()) {
      validateSession({ token: saved })
        .then((r) => {
          if (r.valid) {
            setToken(saved);
            setStage("in");
            refresh(saved).catch(() => {
              sessionStorage.removeItem(SESSION_KEY);
              setStage("password");
            });
          } else {
            sessionStorage.removeItem(SESSION_KEY);
            setStage("password");
          }
        })
        .catch(() => {
          sessionStorage.removeItem(SESSION_KEY);
          setStage("password");
        });
    }
  }, [validateSession, refresh]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setBusy(true);
    setError(null);
    try {
      const res = await signIn({ password });
      sessionStorage.setItem(SESSION_KEY, res.token);
      sessionStorage.setItem(SESSION_EXP_KEY, String(res.expiresAt));
      setToken(res.token);
      setPassword("");
      setStage("in");
      await refresh(res.token);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sign-in failed.";
      setError(msg);
      const m = msg.match(/Locked for (\d+)/);
      if (m) setLockUntil(Date.now() + Number(m[1]) * 60_000);
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = async () => {
    if (token) await signOutFn({ token }).catch(() => undefined);
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_EXP_KEY);
    setToken(null);
    setReports(null);
    setStage("password");
  };

  const patch = async (reportId: string, changes: Partial<Report>) => {
    if (!token) return;
    await updateReport({ token, reportId: reportId as Id<"bugReports">, ...changes });
    await refresh(token);
  };

  const remove = async (reportId: string) => {
    if (!token) return;
    if (!window.confirm("Permanently delete this report?")) return;
    await deleteReportFn({ token, reportId: reportId as Id<"bugReports"> });
    await refresh(token);
    toast.success("Report deleted.");
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
        {/* Gate */}
        {stage !== "in" && (
          <div className="pt-16 text-center sm:pt-24">
            <h1 className="text-2xl font-bold tracking-widest text-muted-foreground">
              PRIVATE PAGE
            </h1>
            <p className="mx-auto mt-4 max-w-md text-sm text-muted-foreground">
              This area is restricted. If you reached this page accidentally, you can
              leave.
            </p>

            {stage === "gate" ? (
              <Button
                variant="ghost"
                size="sm"
                className="mt-10 h-8 text-xs text-muted-foreground/70 hover:text-muted-foreground"
                onClick={() => setStage("password")}
              >
                Enter private area
              </Button>
            ) : (
              <form onSubmit={handleSignIn} className="mx-auto mt-8 max-w-xs space-y-4 text-left">
                <div className="flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground">
                  <Lock className="size-4" /> Password required
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bp">Password</Label>
                  <Input
                    id="bp"
                    type="password"
                    autoFocus
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={busy || (!!lockUntil && lockUntil > Date.now())}
                  />
                </div>
                {error && <p className="text-xs text-destructive">{error}</p>}
                {lockUntil && lockUntil > Date.now() && (
                  <p className="text-xs text-destructive">
                    Locked. Try again in {Math.ceil((lockUntil - Date.now()) / 60000)} min.
                  </p>
                )}
                <Button
                  type="submit"
                  className="w-full bg-emerald-600 text-white hover:bg-emerald-500"
                  disabled={busy || (!!lockUntil && lockUntil > Date.now())}
                >
                  {busy ? "Checking…" : "Unlock"}
                </Button>
              </form>
            )}
          </div>
        )}

        {/* Management */}
        {stage === "in" && reports && (
          <div className="pt-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h1 className="text-2xl font-bold tracking-tight">Bug reports</h1>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => token && refresh(token)}>
                  Refresh
                </Button>
                <Button size="sm" variant="ghost" onClick={handleSignOut}>
                  Lock again
                </Button>
              </div>
            </div>

            <ReportManager reports={reports} onPatch={patch} onDelete={remove} />
          </div>
        )}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------

function ReportManager({
  reports,
  onPatch,
  onDelete,
}: {
  reports: Report[];
  onPatch: (id: string, changes: Partial<Report>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [archivedView, setArchivedView] = useState(false);
  const [sort, setSort] = useState<"newest" | "oldest">("newest");

  const visible = useMemo(() => {
    let list = reports.filter((r) => r.archived === archivedView);
    if (statusFilter !== "all") list = list.filter((r) => r.status === statusFilter);
    const needle = q.trim().toLowerCase();
    if (needle) {
      list = list.filter((r) =>
        [r.title, r.description, r.stepsToReproduce, r.notes ?? "", r.reporterEmail ?? "", r.reporterName ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(needle),
      );
    }
    list = [...list].sort((a, b) =>
      sort === "newest" ? b.submittedAt - a.submittedAt : a.submittedAt - b.submittedAt,
    );
    // Important reports float to the top.
    return [...list.filter((r) => r.important), ...list.filter((r) => !r.important)];
  }, [reports, q, statusFilter, sort, archivedView]);

  return (
    <div className="mt-5 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search reports…"
          className="h-9 w-full sm:max-w-56 sm:w-auto"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-full sm:w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {(Object.keys(STATUS_LABELS) as Report["status"][]).map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => setSort(v as "newest" | "oldest")}>
          <SelectTrigger className="h-9 w-full sm:w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest first</SelectItem>
            <SelectItem value="oldest">Oldest first</SelectItem>
          </SelectContent>
        </Select>
        <Button
          size="sm"
          variant={archivedView ? "secondary" : "ghost"}
          className="h-9 gap-2"
          onClick={() => setArchivedView((v) => !v)}
        >
          <Archive className="size-3.5" />
          {archivedView ? "Viewing archived" : "Archived"}
        </Button>
        <span className="ml-auto text-xs text-muted-foreground">
          {visible.length} report{visible.length === 1 ? "" : "s"}
        </span>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-xl border border-border/60 bg-card p-8 text-center text-sm text-muted-foreground">
          No reports here.
        </p>
      ) : (
        <div className="space-y-3">
          {visible.map((r) => (
            <ReportCard key={r._id} report={r} onPatch={onPatch} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

function ReportCard({
  report,
  onPatch,
  onDelete,
}: {
  report: Report;
  onPatch: (id: string, changes: Partial<Report>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState(report.notes ?? "");
  const [notesDirty, setNotesDirty] = useState(false);
  const r = report;

  const statusStyle: Record<Report["status"], string> = {
    new: "border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-300",
    in_progress: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-300",
    resolved: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
    closed: "border-border bg-muted text-muted-foreground",
  };

  return (
    <div
      className={`rounded-xl border bg-card ${r.archived ? "border-border/40 opacity-70" : "border-border/60"}`}
    >
      <div
        className="flex cursor-pointer flex-wrap items-center gap-2 p-4"
        onClick={() => setOpen((o) => !o)}
      >
        <ChevronLeft
          className={`size-4 shrink-0 text-muted-foreground transition-transform ${open ? "-rotate-90" : ""}`}
        />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{r.title}</span>
        {r.important && <Star className="size-3.5 fill-amber-400 text-amber-400" />}
        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusStyle[r.status]}`}>
          {STATUS_LABELS[r.status]}
        </span>
        <span className="text-[11px] text-muted-foreground">
          {new Date(r.submittedAt).toLocaleString()}
        </span>
      </div>

      {open && (
        <div className="space-y-4 border-t border-border/60 p-4">
          <Section label="Description">{r.description}</Section>
          <Section label="Steps to reproduce">{r.stepsToReproduce}</Section>
          <div className="grid gap-4 sm:grid-cols-2">
            <Section label="Expected behavior">{r.expectedBehavior || "—"}</Section>
            <Section label="Actual behavior">{r.actualBehavior || "—"}</Section>
          </div>
          <div className="grid gap-4 text-xs text-muted-foreground sm:grid-cols-2">
            <div>
              <span className="font-medium text-foreground">Reporter: </span>
              {[r.reporterName, r.reporterEmail].filter(Boolean).join(" · ") || "not provided"}
            </div>
            <div className="min-w-0">
              <span className="font-medium text-foreground">Browser: </span>
              <span className="break-all">{r.browserInfo || "not provided"}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select value={r.status} onValueChange={(v) => onPatch(r._id, { status: v as Report["status"] })}>
              <SelectTrigger className="h-8 w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(STATUS_LABELS) as Report["status"][]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5"
              onClick={() => onPatch(r._id, { important: !r.important })}
            >
              <Star className={`size-3.5 ${r.important ? "fill-amber-400 text-amber-400" : ""}`} />
              {r.important ? "Unmark" : "Important"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5"
              onClick={() => onPatch(r._id, { archived: !r.archived })}
            >
              {r.archived ? (
                <>
                  <ArchiveRestore className="size-3.5" /> Restore
                </>
              ) : (
                <>
                  <Archive className="size-3.5" /> Archive
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto h-8 gap-1.5 text-destructive hover:text-destructive"
              onClick={() => onDelete(r._id)}
            >
              <Trash2 className="size-3.5" /> Delete
            </Button>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`notes-${r._id}`}>Private notes</Label>
            <Textarea
              id={`notes-${r._id}`}
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                setNotesDirty(true);
              }}
              rows={3}
              placeholder="Internal notes (only visible here)"
            />
            {notesDirty && (
              <div className="flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setNotes(r.notes ?? "");
                    setNotesDirty(false);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="h-8 gap-1.5 bg-emerald-600 text-white hover:bg-emerald-500"
                  onClick={async () => {
                    await onPatch(r._id, { notes });
                    setNotesDirty(false);
                    toast.success("Notes saved.");
                  }}
                >
                  <Check className="size-3.5" /> Save notes
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
        {children}
      </p>
    </div>
  );
}
