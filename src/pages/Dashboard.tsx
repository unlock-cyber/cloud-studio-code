import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useMutation, useQuery, useAction, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { BetaBadge } from "@/components/BetaBadge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  FolderOpen,
  Trash2,
  Pencil,
  Copy,
  Upload,
  Download,
  Clock,
  HardDrive,
  LogIn,
  Loader2,
  MoreVertical,
  TerminalSquare,
  AlertTriangle,
  Share2,
  ArrowUpDown,
  Check,
  Search,
  X,
} from "lucide-react";
import { ShareDialog } from "@/components/ide/ShareDialog";
import { useAuth } from "@/hooks/use-auth";
import {
  formatBytesClient,
  formatRelativeTime,
  normalizeProjectName,
  validateProjectNameClient,
} from "@/lib/clientHelpers";
import { usePageMeta } from "@/lib/seo";
import { TEMPLATE_PICKER } from "@/lib/projectTemplates";
import { ThemeToggle } from "@/components/ThemeToggle";
import { storeGuestContext, sessionIdFromAuthToken } from "@/lib/guestContext";
import { useAuthToken } from "@convex-dev/auth/react";

/** A project counts as "recent" while it was opened within this window. */
const RECENT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const RECENT_LIMIT = 3;
/**
 * How the project list is ordered. Every option reads information the
 * workspace already keeps — nothing is invented to look like activity.
 */
type SortKey = "recent" | "edited" | "created" | "name";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "recent", label: "Recently opened" },
  { key: "edited", label: "Last modified" },
  { key: "created", label: "Date created" },
  { key: "name", label: "Name (A–Z)" },
];

const TEMPLATE_META_LABEL: Record<string, string> = {
  blank: "Blank",
  web: "HTML/CSS/JS",
  react: "React",
  ts: "TypeScript",
  python: "Python",
  c: "C",
  cpp: "C++",
  java: "Java",
  node: "Node.js",
  sql: "SQL",
  imported: "Imported",
};

export default function Dashboard() {
  // Signed-in project management: no search presence, and no canonical of its
  // own. A guest session on this page is still not a public page.
  usePageMeta({
    title: "Your projects — Cloud Studio Code",
    description: "Your Cloud Studio Code projects, workspace storage and account.",
    noindex: true,
  });
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated } = useConvexAuth();

  const projects = useQuery(api.projects.list, {});
  const workspace = useQuery(api.workspaces.status, {});

  const createProject = useMutation(api.projects.create);
  const renameProject = useMutation(api.projects.rename);
  const deleteProject = useMutation(api.projects.remove);
  const duplicateProject = useMutation(api.projects.duplicate);
  const exportZip = useAction(api.importExport.exportProjectZip);
  const generateUploadUrl = useMutation(api.importExport.generateUploadUrl);
  const importZip = useAction(api.importExport.importZipAction);
  const touchWs = useMutation(api.workspaces.touch);
  const ensureWorkspace = useMutation(api.workspaces.getOrCreateWorkspace);

  const [showNewDialog, setShowNewDialog] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState("web");
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: Id<"projects">; name: string } | null>(null);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [renameBusy, setRenameBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: Id<"projects">; name: string } | null>(null);
  const [shareTarget, setShareTarget] = useState<{ id: Id<"projects">; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");
  const [createError, setCreateError] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<Id<"projects"> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Remember the guest workspace/session while the user is in the guest
  // workspace so the OTP handler can migrate it after sign-up.
  // NOTE: must live above any early returns — conditional hooks are illegal.
  const providerToken = useAuthToken();
  const isGuest = workspace?.kind === "guest";
  useEffect(() => {
    if (isGuest && providerToken && workspace) {
      // The session id is only an *extra* ownership proof server-side, so an
      // unreadable token must not stop the workspace id — the thing the
      // hand-off actually needs — from being recorded. Recording nothing at
      // all would silently skip the guest transfer.
      storeGuestContext({
        workspaceId: workspace._id,
        sessionId: sessionIdFromAuthToken(providerToken),
      });
    }
  }, [isGuest, providerToken, workspace]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3600);
  }, []);

  // ---- Workspace provisioning gate ----
  // Queries can't create workspaces, so a brand-new guest would see
  // "workspace not found" until the next mutation ran. Instead, when status
  // resolves to null (or expired) we create/recreate the workspace from a
  // mutation. The reactive status query then picks up the new doc.
  // undefined = still loading (don't provision yet); null or expired = act.
  const workspaceMissing =
    workspace !== undefined && (workspace === null || workspace.expiredNow);
  const workspaceExpired = workspace?.expiredNow ?? false;
  const [provisioning, setProvisioning] = useState(false);
  const [guestUpgradeOpen, setGuestUpgradeOpen] = useState(false);
  const provisionedRef = useRef(false);
  useEffect(() => {
    if (!isAuthenticated || !workspaceMissing || provisioning || provisionedRef.current) return;
    provisionedRef.current = true;
    setProvisioning(true);
    ensureWorkspace()
      .catch(() => {
        // Transient failure (network/auth race): allow a retry shortly.
        window.setTimeout(() => {
          provisionedRef.current = false;
        }, 2500);
      })
      .finally(() => setProvisioning(false));
  }, [isAuthenticated, workspaceMissing, provisioning, ensureWorkspace]);

  // Expired workspace: it gets recreated by the gate above (data was already
  // deleted server-side); surface that honestly instead of showing stale UI.
  useEffect(() => {
    if (workspaceExpired && !searchParams.get("expired")) {
      navigate("/dashboard?expired=1", { replace: true });
    }
  }, [workspaceExpired, navigate, searchParams]);

  useEffect(() => {
    if (searchParams.get("expired") === "1") {
      showToast(
        "Your previous workspace expired after inactivity, so its contents were removed. You're starting with a fresh workspace.",
      );
    }
  }, [searchParams, showToast]);

  // Activity heartbeat resets the server-side inactivity window.
  useEffect(() => {
    if (!isAuthenticated) return;
    const interval = window.setInterval(() => {
      touchWs().catch(() => undefined);
    }, 60_000);
    return () => window.clearInterval(interval);
  }, [isAuthenticated, touchWs]);

  const handleCreate = useCallback(async () => {
    if (busy === "create") return;
    // Same rules the server enforces, checked before the round-trip so the
    // dialog can point at the problem instead of the request failing later.
    const invalid = validateProjectNameClient(newName);
    if (invalid) {
      setCreateError(invalid);
      return;
    }
    setCreateError(null);
    setBusy("create");
    try {
      const tpl = TEMPLATE_PICKER.find((t) => t.key === selectedTemplate) ?? TEMPLATE_PICKER[TEMPLATE_PICKER.length - 1];
      const id = await createProject({
        name: normalizeProjectName(newName),
        template: selectedTemplate,
        language: tpl.language,
        files: tpl.files,
        entryFile: tpl.entryFile,
      });
      setShowNewDialog(false);
      setNewName("");
      navigate(`/ide/${id}`);
    } catch (e) {
      // The dialog stays open with the reason (storage limits, quota…) so
      // nothing typed is lost and the failure isn't swallowed.
      setCreateError(e instanceof Error ? e.message : "Failed to create the project. Please try again.");
    } finally {
      setBusy(null);
    }
  }, [busy, newName, selectedTemplate, createProject, navigate]);

  const handleRename = useCallback(async () => {
    if (!renaming) return;
    const invalid = validateProjectNameClient(renaming.name);
    if (invalid) {
      setRenameError(invalid);
      return;
    }
    const name = normalizeProjectName(renaming.name);
    const clash = (projects ?? []).some(
      (p) => p._id !== renaming.id && p.name.trim().toLowerCase() === name.toLowerCase(),
    );
    if (clash) {
      setRenameError(`A project named "${name}" already exists — choose another name.`);
      return;
    }
    setRenameBusy(true);
    setRenameError(null);
    try {
      await renameProject({ projectId: renaming.id, name });
      setRenaming(null);
      showToast("Project renamed");
    } catch (e) {
      // The dialog stays open with the message so the name can be fixed.
      setRenameError(e instanceof Error ? e.message : "Rename failed. Please try again.");
    } finally {
      setRenameBusy(false);
    }
  }, [renaming, projects, renameProject, showToast]);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await deleteProject({ projectId: deleteTarget.id });
      setDeleteTarget(null);
      showToast("Project deleted");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to delete");
    } finally {
      // Always clears, so a failure can't leave the dialog stuck on
      // "Deleting…" — the dialog stays open and the error is shown as a toast.
      setDeleting(false);
    }
  }, [deleteTarget, deleting, deleteProject, showToast]);

  const handleDuplicate = useCallback(
    async (projectId: Id<"projects">) => {
      if (busy === `duplicate:${projectId}`) return;
      setBusy(`duplicate:${projectId}`);
      try {
        await duplicateProject({ projectId });
        showToast("Project duplicated");
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Failed to duplicate");
      } finally {
        setBusy(null);
      }
    },
    [busy, duplicateProject, showToast],
  );

  const handleExport = useCallback(
    async (projectId: Id<"projects">) => {
      setBusy(`export:${projectId}`);
      try {
        const result = (await exportZip({ projectId })) as { blobId: string; name: string };
        const { ConvexHttpClient } = await import("convex/browser");
        const client = new ConvexHttpClient(import.meta.env.VITE_CONVEX_URL);
        const url = (await client.query(api.importExport.getDownloadUrl, {
          blobId: result.blobId as never,
        })) as string | null;
        if (url) {
          const a = document.createElement("a");
          a.href = url;
          a.download = result.name;
          a.click();
          showToast(`Exported ${result.name}`);
        } else {
          showToast("Could not fetch the download URL");
        }
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Export download failed");
      } finally {
        setBusy(null);
      }
    },
    [exportZip, showToast],
  );

  const handleImport = useCallback(
    async (file: File) => {
      setBusy("import");
      try {
        const uploadUrl = await generateUploadUrl();
        const res = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": file.type || "application/zip" },
          body: file,
        });
        if (!res.ok) throw new Error(`Upload failed (HTTP ${res.status})`);
        const { storageId } = (await res.json()) as { storageId: string };
        const result = (await importZip({ storageId: storageId as never })) as {
          projectId: Id<"projects">;
        };
        showToast("Project imported");
        navigate(`/ide/${result.projectId}`);
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Import failed");
      } finally {
        setBusy(null);
      }
    },
    [generateUploadUrl, importZip, navigate, showToast],
  );

  // ---- Search + ordering (all local) ----
  // The project list already arrives in one reactive query, so filtering and
  // ordering happen in the browser: immediate results, no backend search index,
  // and clearing the search re-derives the normal order from the full list
  // rather than having to restore anything.
  const isSearching = query.trim().length > 0;
  const { visibleProjects, recentProjects } = useMemo(() => {
    const all = projects ?? [];
    const needle = query.trim().toLowerCase();
    const matched = needle
      ? all.filter((p) => p.name.toLowerCase().includes(needle))
      : [...all];

    const sorted = matched.sort((a, b) => {
      // Each mode falls back to the name, so equal timestamps can never
      // reshuffle the list between renders.
      switch (sort) {
        case "edited":
          return b.lastModifiedAt - a.lastModifiedAt || a.name.localeCompare(b.name);
        case "created":
          return b.createdAt - a.createdAt || a.name.localeCompare(b.name);
        case "name":
          return a.name.localeCompare(b.name);
        default:
          return b.lastOpenedAt - a.lastOpenedAt || a.name.localeCompare(b.name);
      }
    });

    // Recent projects always mean most-recently-opened, whatever order the main
    // list is showing. Derived from each project's own `lastOpenedAt` stamp
    // (refreshed whenever a project is opened in the IDE) — no second history.
    const recentCutoff = Date.now() - RECENT_WINDOW_MS;
    const recent = [...matched]
      .sort((a, b) => b.lastOpenedAt - a.lastOpenedAt)
      .filter((p) => p.lastOpenedAt >= recentCutoff)
      .slice(0, RECENT_LIMIT);

    return { visibleProjects: sorted, recentProjects: recent };
  }, [projects, query, sort]);

  /** Opening a project is the action users repeat most, so the clicked card
   *  reports that it is the one being opened and a second click can't queue a
   *  second navigation. */
  const openProject = useCallback(
    (id: Id<"projects">) => () => {
      if (openingId) return;
      setOpeningId(id);
      navigate(`/ide/${id}`);
    },
    [openingId, navigate],
  );

  // ---- Loading / no workspace ----
  if (projects === undefined || workspace === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
          <span className="text-sm">Loading your projects…</span>
        </div>
      </div>
    );
  }

  if (workspace === null || workspace.expiredNow) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background text-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Preparing your workspace…</p>
      </div>
    );
  }

  const usedPct = Math.min(100, (workspace.usedBytes / workspace.storageLimitBytes) * 100);
  const timeLeftMs = workspace.expiresAt - Date.now();
  const hoursLeft = Math.max(0, timeLeftMs / 3_600_000);
  const expiringSoon = hoursLeft < 1;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border/60">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-3 sm:gap-3 sm:px-4">
          <div className="flex min-w-0 items-center gap-2">
            <TerminalSquare className="size-5 shrink-0 text-primary" />
            <span className="inline-flex min-w-0 items-start gap-1">
              <span className="truncate font-semibold">Cloud Studio Code</span>
              <BetaBadge className="-translate-y-1 shrink-0" />
            </span>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
            <Badge variant={isGuest ? "secondary" : "default"} className="hidden text-[11px] sm:inline-flex">
              {isGuest ? "Guest workspace" : "Registered workspace"}
            </Badge>
            {user?.email && <span className="hidden text-xs text-muted-foreground sm:inline">{user.email}</span>}
            <ThemeToggle />
            {!isGuest && (
              <Button variant="ghost" size="sm" className="h-8 gap-1.5" onClick={() => signOut()}>
                Sign out
              </Button>
            )}
            {isGuest && (
              <Button size="sm" className="h-8 gap-1.5" onClick={() => setGuestUpgradeOpen(true)}>
                <LogIn className="size-3.5" /> Create account
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-3 py-8 sm:px-4">
        {/* Recent projects — continue where you left off. Hidden while
            searching so the page shows one unambiguous set of results. */}
        <section className={isSearching ? "hidden" : "mb-6"}>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <Clock className="size-3.5" /> Recent projects
          </h2>
          {recentProjects.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/60 px-4 py-4 text-xs leading-relaxed text-muted-foreground">
              {projects.length === 0
                ? "Projects you open show up here, newest first."
                : "Nothing opened in the last week — pick one below to jump back in."}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {recentProjects.map((p) => (
                <button
                  key={p._id}
                  type="button"
                  onClick={openProject(p._id)}
                  aria-label={`Open ${p.name}`}
                  className="group rounded-lg border border-border/60 bg-card p-3 text-left transition-colors hover:border-emerald-500/50"
                >
                  <p className="truncate text-sm font-medium group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                    {p.name}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {TEMPLATE_META_LABEL[p.template] ?? p.template} · opened {formatRelativeTime(p.lastOpenedAt)}
                  </p>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Workspace status */}
        <div className="mb-8 flex flex-col gap-4 rounded-xl border border-border/60 bg-card p-5 sm:flex-row sm:items-center">
          <div className="flex-1">
            <div className="mb-1 flex items-center gap-2">
              <HardDrive className="size-4 text-muted-foreground" />
              <span className="text-sm font-medium">
                Storage · {formatBytesClient(workspace.usedBytes)} / {formatBytesClient(workspace.storageLimitBytes)}
              </span>
            </div>
            <Progress value={usedPct} className="h-2" />
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="size-4" />
            <span className={expiringSoon ? "text-amber-500" : ""}>
              {timeLeftMs <= 0
                ? "Expired"
                : hoursLeft >= 1
                  ? `${Math.floor(hoursLeft)}h ${Math.floor((hoursLeft % 1) * 60)}m of inactivity left`
                  : `${Math.floor(timeLeftMs / 60000)}m of inactivity left`}
            </span>
          </div>
        </div>

        {/* Actions row */}
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <Button className="gap-2" onClick={() => setShowNewDialog(true)}>
            <Plus className="size-4" /> New Project
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => fileInputRef.current?.click()} disabled={busy === "import"}>
            {busy === "import" ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} Import ZIP
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleImport(f);
              e.target.value = "";
            }}
          />
          {projects.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="ml-auto gap-2"
                  aria-label={`Sort projects — currently ${SORT_OPTIONS.find((o) => o.key === sort)?.label}`}
                >
                  <ArrowUpDown className="size-4 shrink-0" />
                  <span className="truncate">{SORT_OPTIONS.find((o) => o.key === sort)?.label}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {SORT_OPTIONS.map((option) => (
                  <DropdownMenuItem key={option.key} onSelect={() => setSort(option.key)}>
                    <Check
                      className={`mr-2 size-3.5 shrink-0 ${sort === option.key ? "opacity-100" : "opacity-0"}`}
                    />
                    {option.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Project search — names only, filtered locally as you type */}
        {projects.length > 0 && (
          <div className="relative mb-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search projects…"
              aria-label="Search projects by name"
              className="pl-9 pr-9"
            />
            {isSearching && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear project search"
                className="absolute right-1.5 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        )}

        {/* All projects */}
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {isSearching
            ? `Results (${visibleProjects.length} of ${projects.length})`
            : `All projects (${projects.length})`}
        </h2>
        {projects.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <TerminalSquare className="size-10 text-muted-foreground/40" />
              <p className="font-medium">No projects yet</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Create your first project from a template — Python, C++, web preview, SQL and more. Or import an existing ZIP.
              </p>
              <Button className="mt-2 gap-2" onClick={() => setShowNewDialog(true)}>
                <Plus className="size-4" /> Create project
              </Button>
            </CardContent>
          </Card>
        ) : visibleProjects.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-3 px-4 py-10 text-center">
              <Search className="size-8 text-muted-foreground/40" />
              <p className="font-medium">No projects match “{query.trim()}”</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Nothing here is named that — try another name, or clear the search to see all {projects.length} projects again.
              </p>
              <Button variant="outline" className="mt-2 gap-2" onClick={() => setQuery("")}>
                <X className="size-4" /> Clear search
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visibleProjects.map((p) => (
              <Card
                key={p._id}
                aria-busy={openingId === p._id}
                className="group transition-colors hover:border-primary/40"
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <button
                      className="min-w-0 flex-1 text-left disabled:opacity-70"
                      aria-label={`Open ${p.name}`}
                      disabled={openingId !== null}
                      onClick={openProject(p._id)}
                    >
                      <p className="truncate font-medium group-hover:text-primary">{p.name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {TEMPLATE_META_LABEL[p.template] ?? p.template} · {p.language}
                       </p>
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="size-7 shrink-0 p-0"
                          aria-label={`Project actions for ${p.name}`}
                        >
                          <MoreVertical className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem onClick={openProject(p._id)}>
                          <FolderOpen className="mr-2 size-3.5" /> Open
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setRenaming({ id: p._id, name: p.name })}>
                          <Pencil className="mr-2 size-3.5" /> Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDuplicate(p._id)}
                          disabled={busy === `duplicate:${p._id}`}
                        >
                          {busy === `duplicate:${p._id}` ? (
                            <Loader2 className="mr-2 size-3.5 animate-spin" />
                          ) : (
                            <Copy className="mr-2 size-3.5" />
                          )}
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleExport(p._id)}>
                          {busy === `export:${p._id}` ? (
                            <Loader2 className="mr-2 size-3.5 animate-spin" />
                          ) : (
                            <Download className="mr-2 size-3.5" />
                          )}
                          Export ZIP
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setShareTarget({ id: p._id, name: p.name })}>
                          <Share2 className="mr-2 size-3.5" /> Share
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteTarget({ id: p._id, name: p.name })}>
                          <Trash2 className="mr-2 size-3.5" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <p className="mt-3 flex items-center gap-1 text-[11px] text-muted-foreground">
                    {openingId === p._id ? (
                      <>
                        <Loader2 className="size-3 shrink-0 animate-spin" />
                        <span>Opening…</span>
                      </>
                    ) : (
                      <>
                        <span className="truncate">Opened {formatRelativeTime(p.lastOpenedAt)}</span>
                        <span aria-hidden="true" className="shrink-0">·</span>
                        <span className="truncate">Edited {formatRelativeTime(p.lastModifiedAt)}</span>
                      </>
                    )}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* New project dialog */}
      <Dialog
        open={showNewDialog}
        onOpenChange={(open) => {
          setShowNewDialog(open);
          if (!open) setCreateError(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New project</DialogTitle>
            <DialogDescription>Pick a template — each generates a real, runnable starter.</DialogDescription>
          </DialogHeader>
          <div className="grid max-h-[320px] grid-cols-2 gap-2 overflow-auto py-1 sm:grid-cols-3">
            {TEMPLATE_PICKER.map((t) => (
              <button
                key={t.key}
                className={`rounded-lg border p-3 text-left transition-colors ${
                  selectedTemplate === t.key
                    ? "border-primary bg-primary/5"
                    : "border-border/60 hover:border-primary/40"
                }`}
                onClick={() => setSelectedTemplate(t.key)}
              >
                <p className="text-sm font-medium">{t.label}</p>
                <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">entry: {t.entryFile}</p>
              </button>
            ))}
            {selectedTemplate === "__hint" && <span />}
          </div>          <Input
            autoFocus
            placeholder="Project name"
            aria-label="Project name"
            value={newName}
            disabled={busy === "create"}
            onChange={(e) => {
              setCreateError(null);
              setNewName(e.target.value);
            }}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
          {createError && (
            <p className="text-xs text-destructive" role="alert">
              {createError}
            </p>
          )}
          <DialogFooter>
            <Button
              variant="ghost"
              disabled={busy === "create"}
              onClick={() => {
                setShowNewDialog(false);
                setCreateError(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!newName.trim() || busy === "create"}>
              {busy === "create" ? <Loader2 className="size-4 animate-spin" /> : "Create project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename dialog */}
      <Dialog
        open={renaming !== null}
        onOpenChange={(open) => {
          if (open || renameBusy) return;
          setRenaming(null);
          setRenameError(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename project</DialogTitle>
            <DialogDescription>
              Only the project's name changes — its files, folders and settings stay as they are.
            </DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            value={renaming?.name ?? ""}
            disabled={renameBusy}
            onChange={(e) => {
              setRenameError(null);
              setRenaming((r) => (r ? { ...r, name: e.target.value } : r));
            }}
            onKeyDown={(e) => e.key === "Enter" && handleRename()}
          />
          {renameError && (
            <p className="text-xs text-destructive" role="alert">
              {renameError}
            </p>
          )}
          <DialogFooter>
            <Button
              variant="ghost"
              disabled={renameBusy}
              onClick={() => {
                setRenaming(null);
                setRenameError(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleRename} disabled={renameBusy}>
              {renameBusy ? "Renaming…" : "Rename"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && !deleting && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-destructive" /> Delete project
            </DialogTitle>
            <DialogDescription>
              "{deleteTarget?.name}" and all of its files will be permanently deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" disabled={deleting} onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" disabled={deleting} onClick={handleDelete}>
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Read-only sharing for one project */}
      {shareTarget && (
        <ShareDialog
          projectId={shareTarget.id}
          projectName={shareTarget.name}
          open
          onOpenChange={() => setShareTarget(null)}
        />
      )}

      {/* Guest → account upgrade confirmation */}
      <AlertDialog open={guestUpgradeOpen} onOpenChange={setGuestUpgradeOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <LogIn className="size-4 text-emerald-600 dark:text-emerald-400" /> Switch to a registered account?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-left leading-relaxed">
              <span className="block">
                You are currently in a <strong>guest workspace</strong>. Creating an account will
                sign you in and transfer your guest projects and files into your new account
                automatically.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-emerald-600 text-white hover:bg-emerald-500"
              onClick={() => {
                // Re-stamp the guest context at the moment of confirmation —
                // guarantees a fresh capture (id + session + timestamp) even
                // if the background effect missed it or the entry went stale.
                if (isGuest && providerToken && workspace) {
                  storeGuestContext({
                    workspaceId: workspace._id,
                    sessionId: sessionIdFromAuthToken(providerToken),
                  });
                }
                navigate("/auth");
              }}
            >
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-md border border-border bg-popover px-4 py-2 text-sm text-popover-foreground shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
