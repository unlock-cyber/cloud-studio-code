import { useCallback, useEffect, useRef, useState } from "react";
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
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { formatBytesClient, formatDate } from "@/lib/clientHelpers";
import { TEMPLATE_PICKER } from "@/lib/projectTemplates";
import { ThemeToggle } from "@/components/ThemeToggle";
import { storeGuestContext, sessionIdFromAuthToken } from "@/lib/guestContext";
import { useAuthToken } from "@convex-dev/auth/react";

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
  const [deleteTarget, setDeleteTarget] = useState<{ id: Id<"projects">; name: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
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
      showToast("Your previous workspace expired and its data was deleted server-side.");
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
    if (!newName.trim()) return;
    setBusy("create");
    try {
      const tpl = TEMPLATE_PICKER.find((t) => t.key === selectedTemplate) ?? TEMPLATE_PICKER[TEMPLATE_PICKER.length - 1];
      const id = await createProject({
        name: newName.trim(),
        template: selectedTemplate,
        language: tpl.language,
        files: tpl.files,
        entryFile: tpl.entryFile,
      });
      setShowNewDialog(false);
      setNewName("");
      navigate(`/ide/${id}`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to create project");
    } finally {
      setBusy(null);
    }
  }, [newName, selectedTemplate, createProject, navigate, showToast]);

  const handleRename = useCallback(async () => {
    if (!renaming) return;
    try {
      await renameProject({ projectId: renaming.id, name: renaming.name });
      setRenaming(null);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to rename");
    }
  }, [renaming, renameProject, showToast]);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await deleteProject({ projectId: deleteTarget.id });
      setDeleteTarget(null);
      showToast("Project deleted");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to delete");
    }
  }, [deleteTarget, deleteProject, showToast]);

  const handleDuplicate = useCallback(
    async (projectId: Id<"projects">) => {
      try {
        await duplicateProject({ projectId });
        showToast("Project duplicated");
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Failed to duplicate");
      }
    },
    [duplicateProject, showToast],
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

  // ---- Loading / no workspace ----
  if (projects === undefined || workspace === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
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
          <Button variant="outline" className="gap-2" onClick={() => fileInputRef.current?.click()}>
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
        </div>

        {/* Projects */}
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Your projects ({projects.length})
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
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <Card key={p._id} className="group transition-colors hover:border-primary/40">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <button
                      className="min-w-0 flex-1 text-left"
                      onClick={() => navigate(`/ide/${p._id}`)}
                    >
                      <p className="truncate font-medium group-hover:text-primary">{p.name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {TEMPLATE_META_LABEL[p.template] ?? p.template} · {p.language}
                       </p>
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="size-7 shrink-0 p-0">
                          <MoreVertical className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem onClick={() => navigate(`/ide/${p._id}`)}>
                          <FolderOpen className="mr-2 size-3.5" /> Open
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setRenaming({ id: p._id, name: p.name })}>
                          <Pencil className="mr-2 size-3.5" /> Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDuplicate(p._id)}>
                          <Copy className="mr-2 size-3.5" /> Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleExport(p._id)}>
                          {busy === `export:${p._id}` ? (
                            <Loader2 className="mr-2 size-3.5 animate-spin" />
                          ) : (
                            <Download className="mr-2 size-3.5" />
                          )}
                          Export ZIP
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteTarget({ id: p._id, name: p.name })}>
                          <Trash2 className="mr-2 size-3.5" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <p className="mt-3 text-[11px] text-muted-foreground">
                    Last opened {formatDate(p.lastOpenedAt)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* New project dialog */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
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
            placeholder="Project name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowNewDialog(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!newName.trim() || busy === "create"}>
              {busy === "create" ? <Loader2 className="size-4 animate-spin" /> : "Create project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename dialog */}
      <Dialog open={renaming !== null} onOpenChange={(open) => !open && setRenaming(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename project</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            value={renaming?.name ?? ""}
            onChange={(e) => setRenaming((r) => (r ? { ...r, name: e.target.value } : r))}
            onKeyDown={(e) => e.key === "Enter" && handleRename()}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenaming(null)}>Cancel</Button>
            <Button onClick={handleRename}>Rename</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
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
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
