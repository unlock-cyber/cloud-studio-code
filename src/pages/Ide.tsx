import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { useQuery, useMutation, useConvexAuth, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  ResizablePanelGroup as PanelGroup,
  ResizablePanel as Panel,
  ResizableHandle as PanelResizeHandle,
} from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Play,
  Square,
  Save,
  FilePlus2,
  FolderPlus,
  Upload,
  Download,
  Palette,
  Sun,
  Moon,
  Loader2,
  ArrowLeft,
  Command,
  PanelLeftClose,
  PanelLeftOpen,
  LayoutPanelLeft,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FileExplorer } from "@/components/ide/FileExplorer";
import { CodeEditor, type EditorTab } from "@/components/ide/CodeEditor";
import { TerminalPanel, type TerminalLine } from "@/components/ide/TerminalPanel";
import { PreviewPanel, type PreviewMessage } from "@/components/ide/PreviewPanel";
import {
  langFromPath,
  LANGUAGES,
  engineLabel,
  type LangId,
} from "@/lib/languages";
import { runManager, type RunState } from "@/lib/runOrchestrator";
import { buildPreviewHtml, type PreviewFiles } from "@/lib/previewBuilder";
import { fileIconMeta } from "@/lib/fileTree";
import { startPyodideWarmup, subscribePyodideWarmup } from "@/lib/pyodideRunner";
import { warmEsbuild } from "@/lib/tsRunner";
import { formatBytesClient } from "@/lib/clientHelpers";

const RUNNABLE_LANGS: LangId[] = ["python", "javascript", "typescript", "c", "cpp", "java", "bash", "sql"];

export default function Ide() {
  const { projectId: projectIdParam } = useParams();
  const navigate = useNavigate();
  const projectId = projectIdParam as Id<"projects">;
  const { isAuthenticated } = useConvexAuth();

  // ---- Backend data ----
  const project = useQuery(api.projects.get, { projectId });
  const filesRes = useQuery(api.files.listForProject, { projectId });
  const workspace = useQuery(api.workspaces.status, {});
  const allContents = useQuery(api.files.getAllContents, { projectId });

  const createFile = useMutation(api.files.create);
  const saveFile = useMutation(api.files.save);
  const renameFile = useMutation(api.files.rename);
  const deleteFile = useMutation(api.files.remove);
  const duplicateFile = useMutation(api.files.duplicate);
  const setSession = useMutation(api.projects.setSession);
  const touchWs = useMutation(api.workspaces.touch);
  const updateEditorSettings = useMutation(api.workspaces.updateEditorSettings);
  const setEntryFile = useMutation(api.projects.setEntryFile);
  const exportZip = useAction(api.importExport.exportProjectZip);

  // ---- Local editor state ----
  const [tabs, setTabs] = useState<EditorTab[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [terminalLines, setTerminalLines] = useState<TerminalLine[]>([]);
  const [runState, setRunState] = useState<RunState>("idle");
  const [lastRunTarget, setLastRunTarget] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [previewMessages, setPreviewMessages] = useState<string[]>([]);
  const [previewOpen, setPreviewOpen] = useState(true);
  const [explorerOpen, setExplorerOpen] = useState(true);
  const [commandOpen, setCommandOpen] = useState(false);
  const [newFileDialog, setNewFileDialog] = useState<{ isFolder: boolean } | null>(null);
  const [newFileName, setNewFileName] = useState("");
  const [pyodideState, setPyodideState] = useState<string>("idle");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const lineIdRef = useRef(0);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3200);
  }, []);

  // ---- Warm runtimes ----
  useEffect(() => {
    startPyodideWarmup();
    warmEsbuild().catch(() => undefined);
  }, []);

  useEffect(() => {
    const unsub = subscribePyodideWarmup(setPyodideState);
    return () => {
      unsub();
    };
  }, []);

  // ---- Workspace activity heartbeat ----
  useEffect(() => {
    if (!isAuthenticated) return;
    const interval = window.setInterval(() => {
      touchWs().catch(() => undefined);
    }, 60_000);
    return () => window.clearInterval(interval);
  }, [isAuthenticated, touchWs]);

  // ---- Load saved session (tabs + active file) ----
  const sessionLoaded = useRef<string | null>(null);
  useEffect(() => {
    if (!project || !filesRes) return;
    if (sessionLoaded.current === project._id) return;
    sessionLoaded.current = project._id;

    const savedTabs = (project.openTabs ?? []).filter((p) =>
      filesRes.some((f) => f.path === p && !f.isFolder),
    );
    const paths = savedTabs.length > 0
      ? savedTabs
      : [project.entryFile].filter((p): p is string => Boolean(p) && filesRes.some((f) => f.path === p && !f.isFolder));

    if (paths.length > 0) {
      setTabs(paths.map((p) => ({ path: p, content: "", draft: "" })));
      setActivePath(project.activeFile ?? paths[0]);
    }
  }, [project, filesRes]);

  // ---- Hydrate tab contents from server ----
  useEffect(() => {
    if (!filesRes) return;
    setTabs((prev) =>
      prev.map((t) => {
        const f = filesRes.find((x) => x.path === t.path);
        if (!f) return t;
        if (t.content === "" && f.hasContent && !t.draft) {
          return t; // filled by fileContents query below
        }
        return t;
      }),
    );
  }, [filesRes]);

  // ---- Load active file content ----
  const activeFileRes = useQuery(
    api.files.getContent,
    activePath ? { projectId, path: activePath } : "skip",
  );

  useEffect(() => {
    if (!activeFileRes || !activePath) return;
    setTabs((prev) => {
      const idx = prev.findIndex((t) => t.path === activePath);
      if (idx === -1) return prev;
      // Fill empty tabs from the server; never clobber local edits.
      if (prev[idx].draft !== "" || prev[idx].content !== "") return prev;
      const content = activeFileRes.content ?? "";
      const next = [...prev];
      next[idx] = { path: activePath, content, draft: content };
      return next;
    });
  }, [activeFileRes, activePath]);

  // Fill other open tabs (not active) from bulk contents once.
  useEffect(() => {
    if (!allContents) return;
    setTabs((prev) => {
      let changed = false;
      const next = prev.map((t) => {
        if (t.draft !== "" || t.content !== "") return t;
        const found = allContents.find((c) => c.path === t.path);
        if (!found) return t;
        changed = true;
        return { path: t.path, content: found.content, draft: found.content };
      });
      return changed ? next : prev;
    });
  }, [allContents]);

  // ---- Persist session ----
  const persistSession = useCallback(
    (openTabs: string[], active: string | null) => {
      setSession({ projectId, openTabs, activeFile: active }).catch(() => undefined);
    },
    [projectId, setSession],
  );

  const openFile = useCallback(
    (path: string) => {
      setTabs((prev) => {
        if (prev.some((t) => t.path === path)) return prev;
        const meta = filesRes?.find((f) => f.path === path);
        if (meta?.isBinary) {
          showToast("Binary files can't be edited in the text editor.");
          return prev;
        }
        return [...prev, { path, content: "", draft: "" }];
      });
      setActivePath(path);
      const nextTabs = tabs.some((t) => t.path === path) ? tabs.map((t) => t.path) : [...tabs.map((t) => t.path), path];
      persistSession(nextTabs, path);
    },
    [filesRes, tabs, persistSession, showToast],
  );

  const closeTab = useCallback(
    (path: string) => {
      setTabs((prev) => {
        const next = prev.filter((t) => t.path !== path);
        if (activePath === path) {
          const fallback = next[next.length - 1]?.path ?? null;
          setActivePath(fallback);
          persistSession(next.map((t) => t.path), fallback);
        } else {
          persistSession(next.map((t) => t.path), activePath);
        }
        return next;
      });
    },
    [activePath, persistSession],
  );

  // ---- Saving ----
  const [saving, setSaving] = useState(false);
  const saveActive = useCallback(async () => {
    const tab = tabs.find((t) => t.path === activePath);
    if (!tab || tab.draft === tab.content) return;
    setSaving(true);
    try {
      await saveFile({ projectId, path: tab.path, content: tab.draft });
      setTabs((prev) =>
        prev.map((t) => (t.path === tab.path ? { ...t, content: t.draft } : t)),
      );
      touchWs().catch(() => undefined);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }, [tabs, activePath, projectId, saveFile, touchWs, showToast]);

  // Ctrl/Cmd+S outside the editor
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveActive();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handleRunRef.current?.();
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        setCommandOpen(true);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setExplorerOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [saveActive]);

  // ---- Files ----
  const allFiles = filesRes ?? [];
  const textFiles = useMemo(
    () => allFiles.filter((f) => !f.isFolder && !f.isBinary),
    [allFiles],
  );

  const dirtyPaths = useMemo(
    () => new Set(tabs.filter((t) => t.draft !== t.content).map((t) => t.path)),
    [tabs],
  );

  // ---- Preview (uses server contents so ALL project files are included) ----
  useEffect(() => {
    if (!allContents) return;
    const contents = new Map<string, string>();
    for (const f of allContents) {
      contents.set(f.path, f.content);
    }
    // Overlay unsaved drafts so preview reflects the editor live
    for (const t of tabs) {
      if (t.draft !== t.content) contents.set(t.path, t.draft);
    }
    const previewFiles: PreviewFiles = contents;
    const built = buildPreviewHtml(previewFiles, project?.entryFile ?? null);
    setPreviewHtml((prevHtml) => (built.html && built.html !== prevHtml ? built.html : prevHtml));
  }, [allContents, tabs, project?.entryFile]);

  const handlePreviewMessage = useCallback((msg: PreviewMessage) => {
    const ts = Date.now();
    if (msg.type === "error") {
      setTerminalLines((prev) => [
        ...prev.slice(-400),
        { id: ++lineIdRef.current, kind: "stderr", text: `[preview error] ${msg.message}${msg.line ? ` (line ${msg.line})` : ""}`, ts },
      ]);
    } else if (msg.type === "console") {
      setTerminalLines((prev) => [
        ...prev.slice(-400),
        { id: ++lineIdRef.current, kind: msg.level === "error" ? "stderr" : "stdout", text: `[console.${msg.level}] ${msg.text}`, ts },
      ]);
    } else if (msg.type === "asset-error") {
      setTerminalLines((prev) => [
        ...prev.slice(-400),
        { id: ++lineIdRef.current, kind: "stderr", text: `[preview] missing asset: ${msg.src}`, ts },
      ]);
    }
  }, []);

  // ---- Run system ----
  const activeTab = tabs.find((t) => t.path === activePath) ?? null;
  const activeLang = activePath ? (langFromPath(activePath) as LangId) : null;

  const runCallbacks = useMemo<Parameters<typeof runManager.runSingleFile>[1]>(
    () => ({
      onState: (s) => setRunState(s),
      onStdout: (text) =>
        setTerminalLines((prev) => [...prev.slice(-400), { id: ++lineIdRef.current, kind: "stdout", text, ts: Date.now() }]),
      onStderr: (text) =>
        setTerminalLines((prev) => [...prev.slice(-400), { id: ++lineIdRef.current, kind: "stderr", text, ts: Date.now() }]),
      onInfo: (text) =>
        setTerminalLines((prev) => [...prev.slice(-400), { id: ++lineIdRef.current, kind: "info", text, ts: Date.now() }]),
      onExit: (code) =>
        setTerminalLines((prev) => [
          ...prev.slice(-400),
          { id: ++lineIdRef.current, kind: "exit", text: `\nProcess finished with exit code ${code}`, ts: Date.now() },
        ]),
      onPreview: () => undefined,
    }),
    [],
  );

  useEffect(() => {
    // The orchestrator needs ad-hoc actions (SQLite persistence) with auth
    // context. A dedicated ConvexHttpClient authenticated via the same
    // deployment works for these non-reactive calls.
    let disposed = false;
    let client: import("convex/browser").ConvexHttpClient | null = null;
    (async () => {
      const { ConvexHttpClient: CHC } = await import("convex/browser");
      const api = (await import("@/convex/_generated/api")).api;
      if (disposed) return;
      client = new CHC(import.meta.env.VITE_CONVEX_URL);
      runManager.setClient({
        action: async <R,>(name: "load" | "save", args: Record<string, unknown>): Promise<R> => {
          if (!client) throw new Error("not ready");
          const fn =
            name === "load" ? api.sqlDb.loadDbBytes : api.sqlDb.saveDb;
          return (await client.action(fn as never, args as never)) as R;
        },
      });
    })();
    return () => {
      disposed = true;
    };
  }, []);

  const handleRun = useCallback(async () => {
    if (!activePath || !activeTab) {
      showToast("Open a file to run it.");
      return;
    }
    const lang = langFromPath(activePath) as LangId;
    const info = LANGUAGES[lang];

    // Web projects: run the entry HTML in the preview
    if (info.engine === "web-preview") {
      // Save all dirty tabs first so preview reflects real saved content
      for (const t of tabs.filter((x) => x.draft !== x.content)) {
        await saveFile({ projectId, path: t.path, content: t.draft }).catch(() => undefined);
      }
      setTabs((prev) => prev.map((t) => ({ ...t, content: t.draft })));
      const contents = new Map<string, string>();
      for (const t of tabs) contents.set(t.path, t.draft);
      const built = buildPreviewHtml(contents, project?.entryFile ?? null);
      setPreviewHtml(built.html);
      setPreviewOpen(true);
      setRunState("success");
      setTerminalLines((prev) => [
        ...prev.slice(-400),
        { id: ++lineIdRef.current, kind: "info", text: `— preview ${project?.entryFile ?? "index.html"} · live sandboxed preview started —`, ts: Date.now() },
      ]);
      setLastRunTarget(activePath);
      return;
    }

    if (!RUNNABLE_LANGS.includes(lang)) {
      setTerminalLines((prev) => [
        ...prev.slice(-400),
        { id: ++lineIdRef.current, kind: "info", text: info.runnable ? info.how : `${activePath}: ${info.how}`, ts: Date.now() },
      ]);
      return;
    }

    if (runManager.isRunning) {
      showToast("A process is already running — stop it first.");
      return;
    }

    // Save dirty active file before running (like a real IDE)
    if (activeTab.draft !== activeTab.content) {
      try {
        await saveFile({ projectId, path: activePath, content: activeTab.draft });
        setTabs((prev) => prev.map((t) => (t.path === activePath ? { ...t, content: t.draft } : t)));
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Failed to save before run");
        return;
      }
    }

    setTerminalLines((prev) => [
      ...prev.slice(-400),
      { id: ++lineIdRef.current, kind: "cmd", text: `$ run ${activePath}`, ts: Date.now() },
    ]);
    setLastRunTarget(activePath);
    await runManager.runSingleFile(
      { projectId, path: activePath, content: activeTab.draft, lang },
      runCallbacks,
    );
  }, [activePath, activeTab, tabs, project?.entryFile, projectId, saveFile, runCallbacks, showToast]);

  const handleRunRef = useRef(handleRun);
  handleRunRef.current = handleRun;

  const handleStop = useCallback(() => {
    runManager.stop();
    setRunState("stopped");
    setTerminalLines((prev) => [
      ...prev.slice(-400),
      { id: ++lineIdRef.current, kind: "info", text: "[user] Stop requested.", ts: Date.now() },
    ]);
  }, []);

  const handleRerun = useCallback(() => {
    if (lastRunTarget) {
      setActivePath(lastRunTarget);
      window.setTimeout(() => handleRunRef.current?.(), 50);
    }
  }, [lastRunTarget]);

  // ---- File operations ----
  const handleCreate = useCallback(
    async (parentFolder: string | null, isFolder: boolean) => {
      setNewFileDialog({ isFolder });
      setNewFileName(parentFolder ? parentFolder + "/" : "");
    },
    [],
  );

  const confirmCreate = useCallback(async () => {
    if (!newFileDialog || !newFileName.trim()) return;
    try {
      await createFile({
        projectId,
        path: newFileName.trim(),
        isFolder: newFileDialog.isFolder,
        content: "",
      });
      if (!newFileDialog.isFolder) {
        openFile(newFileName.trim());
      }
      setNewFileDialog(null);
      setNewFileName("");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to create");
    }
  }, [newFileDialog, newFileName, createFile, projectId, openFile, showToast]);

  const handleRename = useCallback(
    async (path: string, newPath: string) => {
      if (newPath === path) return;
      try {
        await renameFile({ projectId, path, newPath });
        // Update tabs: rename exact match, and remap folder descendants.
        setTabs((prev) =>
          prev.map((t) => {
            if (t.path === path) return { ...t, path: newPath };
            if (t.path.startsWith(path + "/")) {
              return { ...t, path: newPath + t.path.slice(path.length) };
            }
            return t;
          }),
        );
        if (activePath === path) setActivePath(newPath);
        else if (activePath && activePath.startsWith(path + "/")) {
          setActivePath(newPath + activePath.slice(path.length));
        }
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Failed to rename");
      }
    },
    [projectId, renameFile, activePath, showToast],
  );

  const handleDelete = useCallback(
    async (path: string) => {
      try {
        await deleteFile({ projectId, path });
        setTabs((prev) => prev.filter((t) => t.path !== path && !t.path.startsWith(path + "/")));
        if (activePath && (activePath === path || activePath.startsWith(path + "/"))) {
          setActivePath(null);
        }
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Failed to delete");
      }
    },
    [projectId, deleteFile, activePath, showToast],
  );

  const handleDuplicate = useCallback(
    async (path: string) => {
      try {
        await duplicateFile({ projectId, path });
        showToast("File duplicated");
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Failed to duplicate");
      }
    },
    [projectId, duplicateFile, showToast],
  );

  const handleDownloadFile = useCallback(
    async (path: string) => {
      try {
        const content = allContents?.find((c) => c.path === path)?.content;
        if (content === undefined) {
          showToast("Binary files: open the project's export ZIP to download them");
          return;
        }
        const blob = new Blob([content], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = path.split("/").pop() ?? "file.txt";
        a.click();
        URL.revokeObjectURL(url);
      } catch {
        showToast("Download failed");
      }
    },
    [allContents, showToast],
  );

  // ---- Export ----
  const [exporting, setExporting] = useState(false);
  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const result = (await exportZip({ projectId })) as { blobId: string; name: string };
      const { ConvexHttpClient } = await import("convex/browser");
      const client = new ConvexHttpClient(import.meta.env.VITE_CONVEX_URL);
      const url = await client.query(api.importExport.getDownloadUrl, { blobId: result.blobId as never });
      if (url) {
        const a = document.createElement("a");
        a.href = url as string;
        a.download = result.name;
        a.click();
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }, [projectId, exportZip, showToast]);

  // ---- Command palette ----
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p") {
        e.preventDefault();
        setCommandOpen(true);
      }
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, []);

  const commands = useMemo(() => {
    const items: Array<{ id: string; label: string; hint?: string; run: () => void; group: string }> = [];
    for (const f of textFiles) {
      items.push({
        id: `file:${f.path}`,
        label: f.path,
        hint: "Open",
        group: "Files",
        run: () => openFile(f.path),
      });
    }
    if (activePath) {
      items.push({ id: "save", label: "Save current file", hint: "Ctrl+S", group: "Actions", run: saveActive });
      items.push({ id: "run", label: `Run ${activePath}`, hint: "Ctrl+Enter", group: "Actions", run: () => handleRunRef.current?.() });
    }
    items.push(
      { id: "newfile", label: "New file", group: "Actions", run: () => setNewFileDialog({ isFolder: false }) },
      { id: "newfolder", label: "New folder", group: "Actions", run: () => setNewFileDialog({ isFolder: true }) },
      { id: "preview", label: "Toggle preview panel", group: "View", run: () => setPreviewOpen((v) => !v) },
      { id: "explorer", label: "Toggle explorer", hint: "Ctrl+B", group: "View", run: () => setExplorerOpen((v) => !v) },
      { id: "export", label: "Export project as ZIP", group: "Project", run: () => handleExport() },
      { id: "back", label: "Back to dashboard", group: "Project", run: () => navigate("/dashboard") },
    );
    return items;
  }, [textFiles, openFile, saveActive, activePath, handleExport, navigate]);

  // ---- Workspace expiry watch ----
  const workspaceExpired = workspace?.expiredNow ?? false;
  useEffect(() => {
    if (workspaceExpired) {
      // Server has expired this workspace; send the user to a clean state.
      navigate("/dashboard?expired=1");
    }
  }, [workspaceExpired, navigate]);

  // ---- Storage meter ----
  const usedPct = workspace
    ? Math.min(100, (workspace.usedBytes / workspace.storageLimitBytes) * 100)
    : 0;
  const storageWarn = usedPct > 85;

  // ---- Loading / error states ----
  if (project === undefined || filesRes === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0D1117]">
        <div className="flex items-center gap-3 text-zinc-400">
          <Loader2 className="size-5 animate-spin" />
          <span className="text-sm">Loading workspace…</span>
        </div>
      </div>
    );
  }

  if (project === null) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#0D1117] text-center">
        <p className="text-lg text-zinc-300">Project not found</p>
        <p className="text-sm text-zinc-500">It may have been deleted, or belongs to another account.</p>
        <Button onClick={() => navigate("/dashboard")}>Back to dashboard</Button>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#0D1117] text-zinc-200">
      {/* Title bar */}
      <header className="flex h-11 shrink-0 items-center gap-2 border-b border-border/60 bg-[#0D1117] px-3">
        <Button variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-zinc-400" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="size-4" /> Projects
        </Button>
        <div className="mx-1 h-4 w-px bg-border/60" />
        <span className="text-sm font-medium text-zinc-200">{project.name}</span>
        <Badge variant="secondary" className="ml-1 text-[10px]">{project.language}</Badge>
        {saving && <Loader2 className="size-3.5 animate-spin text-zinc-500" />}

        <div className="ml-auto flex items-center gap-1.5">
          {/* RUN button */}
          {runState === "running" || runState === "starting" ? (
            <Button size="sm" className="h-7 gap-1.5 bg-red-500/90 px-3 text-white hover:bg-red-500" onClick={handleStop}>
              <Square className="size-3.5" /> Stop
            </Button>
          ) : (
            <Button size="sm" className="h-7 gap-1.5 bg-emerald-600 px-4 text-white hover:bg-emerald-500" onClick={() => handleRunRef.current?.()}>
              <Play className="size-3.5 fill-current" /> Run
            </Button>
          )}
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-zinc-400" onClick={saveActive} title="Save (Ctrl+S)">
            <Save className="size-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-zinc-400" onClick={() => setNewFileDialog({ isFolder: false })} title="New file">
            <FilePlus2 className="size-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-zinc-400" onClick={() => setNewFileDialog({ isFolder: true })} title="New folder">
            <FolderPlus className="size-4" />
          </Button>
          <div className="mx-1 h-4 w-px bg-border/60" />
          <Button variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-zinc-400" onClick={handleExport} disabled={exporting} title="Export as ZIP">
            {exporting ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-4" />} Export
          </Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-zinc-400" onClick={() => setSettingsOpen(true)} title="Editor settings">
            <Palette className="size-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 font-mono text-[11px] text-zinc-500" onClick={() => setCommandOpen(true)}>
            <Command className="size-3" /> K
          </Button>
        </div>
      </header>

      {/* Main body */}
      <div className="min-h-0 flex-1">
        <PanelGroup direction="horizontal">
          {explorerOpen && (
            <>
              <Panel defaultSize={20} minSize={12} maxSize={40}>
                <FileExplorer
                  files={allFiles}
                  activeFile={activePath}
                  openTabs={tabs.map((t) => t.path)}
                  dirtyPaths={dirtyPaths}
                  onOpenFile={openFile}
                  onCreate={handleCreate}
                  onRename={handleRename}
                  onDelete={handleDelete}
                  onDuplicate={handleDuplicate}
                  onDownloadFile={handleDownloadFile}
                />
              </Panel>
              <PanelResizeHandle className="w-px bg-border/60 data-[resize-handle-active]:bg-sky-500" />
            </>
          )}

          <Panel>
            <PanelGroup direction="vertical">
              {/* Editor area */}
              <Panel defaultSize={65} minSize={25}>
                <div className="flex h-full min-h-0 flex-col">
                  {/* Tabs */}
                  <div className="flex h-9 shrink-0 items-center gap-0.5 overflow-x-auto border-b border-border/60 bg-[#0D1117] px-1">
                    {tabs.length === 0 && (
                      <span className="px-3 text-xs text-zinc-600">No open files — pick one from the explorer</span>
                    )}
                    {tabs.map((t) => {
                      const icon = fileIconMeta(t.path);
                      const dirty = t.draft !== t.content;
                      return (
                        <div
                          key={t.path}
                          className={`group flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-t-md border-b-2 px-2.5 text-xs ${
                            activePath === t.path
                              ? "border-sky-400 bg-white/5 text-zinc-100"
                              : "border-transparent text-zinc-500 hover:text-zinc-300"
                          }`}
                          onClick={() => openFile(t.path)}
                        >
                          <span className="rounded-sm px-0.5 text-[8px] font-bold" style={{ color: icon.color, border: `1px solid ${icon.color}55` }}>
                            {icon.label}
                          </span>
                          <span className="max-w-[140px] truncate">{t.path.split("/").pop()}</span>
                          {dirty && <span className="text-amber-400">●</span>}
                          <button
                            className="ml-1 rounded p-0.5 opacity-0 hover:bg-white/10 group-hover:opacity-100"
                            onClick={(e) => {
                              e.stopPropagation();
                              closeTab(t.path);
                            }}
                          >
                            <X className="size-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Editor + preview horizontal split */}
                  <div className="min-h-0 flex-1">
                    <PanelGroup direction="horizontal">
                      <Panel>
                        {activePath && activeTab ? (
                          <CodeEditor
                            tab={activeTab}
                            onChange={(content) =>
                              setTabs((prev) =>
                                prev.map((t) => (t.path === activePath ? { ...t, draft: content } : t)),
                              )
                            }
                            onSave={saveActive}
                            onRun={() => handleRunRef.current?.()}
                            theme={workspace?.editorTheme ?? "dark"}
                            fontSize={workspace?.fontSize ?? 13}
                            wordWrap={workspace?.wordWrap ?? false}
                            onFontSizeChange={(size) =>
                              updateEditorSettings({ fontSize: Math.min(24, Math.max(10, size)) })
                            }
                            onWordWrapToggle={() =>
                              updateEditorSettings({ wordWrap: !(workspace?.wordWrap ?? false) })
                            }
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-sm text-zinc-600">
                            Select a file to start editing
                          </div>
                        )}
                      </Panel>
                      {previewOpen && (
                        <>
                          <PanelResizeHandle className="w-px bg-border/60 data-[resize-handle-active]:bg-sky-500" />
                          <Panel defaultSize={40} minSize={20}>
                            <PreviewPanel html={previewHtml} onMessage={handlePreviewMessage} />
                          </Panel>
                        </>
                      )}
                    </PanelGroup>
                  </div>
                </div>
              </Panel>

              <PanelResizeHandle className="h-px bg-border/60 data-[resize-handle-active]:bg-sky-500" />

              {/* Terminal */}
              <Panel defaultSize={35} minSize={10}>
                <TerminalPanel
                  lines={terminalLines}
                  runState={runState}
                  onClear={() => setTerminalLines([])}
                  onStop={handleStop}
                  onRerun={handleRerun}
                  canRerun={lastRunTarget !== null}
                />
              </Panel>
            </PanelGroup>
          </Panel>
        </PanelGroup>
      </div>

      {/* Status bar */}
      <footer className="flex h-6 shrink-0 items-center gap-3 border-t border-border/60 bg-[#0D1117] px-3 text-[11px] text-zinc-500">
        <button className="flex items-center gap-1 hover:text-zinc-300" onClick={() => setExplorerOpen((v) => !v)}>
          {explorerOpen ? <PanelLeftClose className="size-3.5" /> : <PanelLeftOpen className="size-3.5" />} Explorer
        </button>
        <button className="flex items-center gap-1 hover:text-zinc-300" onClick={() => setPreviewOpen((v) => !v)}>
          <LayoutPanelLeft className="size-3.5" /> Preview
        </button>
        {activePath && (
          <span className="truncate">
            {activePath} · {activeLang ? LANGUAGES[activeLang].label : "Text"}
          </span>
        )}
        <span className="ml-auto flex items-center gap-3">
          {pyodideState === "loading" && <span className="text-sky-400">Python runtime loading…</span>}
          {pyodideState === "ready" && <span className="text-emerald-500">Python ready</span>}
          {pyodideState === "error" && <span className="text-amber-400">Python runtime unavailable</span>}
          <span className="flex items-center gap-1.5">
            <span className={`size-1.5 rounded-full ${storageWarn ? "bg-amber-400" : "bg-emerald-500"}`} />
            {workspace ? `${formatBytesClient(workspace.usedBytes)} / ${formatBytesClient(workspace.storageLimitBytes)}` : "…"}
          </span>
          {workspace && (
            <span>
              {workspace.kind === "guest" ? "Guest" : "Registered"} · expires in {formatTimeLeft(workspace.expiresAt)}
            </span>
          )}
        </span>
      </footer>

      {/* New file/folder dialog */}
      <Dialog open={newFileDialog !== null} onOpenChange={(open) => !open && setNewFileDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">{newFileDialog?.isFolder ? "New folder" : "New file"}</DialogTitle>
            <DialogDescription>
              Path relative to the project root. Use slashes for nested paths (e.g. <code>src/utils.ts</code>).
            </DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
            placeholder={newFileDialog?.isFolder ? "components" : "src/main.py"}
            onKeyDown={(e) => e.key === "Enter" && confirmCreate()}
          />
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setNewFileDialog(null)}>Cancel</Button>
            <Button size="sm" onClick={confirmCreate}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Settings dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Editor settings</DialogTitle>
            <DialogDescription>Stored with your workspace.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="flex items-center justify-between">
              <span className="text-sm">Editor theme</span>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant={(workspace?.editorTheme ?? "dark") === "dark" ? "default" : "ghost"}
                  className="h-7 w-7 p-0"
                  onClick={() => updateEditorSettings({ editorTheme: "dark" })}
                >
                  <Moon className="size-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant={(workspace?.editorTheme ?? "dark") === "light" ? "default" : "ghost"}
                  className="h-7 w-7 p-0"
                  onClick={() => updateEditorSettings({ editorTheme: "light" })}
                >
                  <Sun className="size-3.5" />
                </Button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Font size</span>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => updateEditorSettings({ fontSize: Math.max(10, (workspace?.fontSize ?? 13) - 1) })}>−</Button>
                <span className="w-8 text-center text-sm tabular-nums">{workspace?.fontSize ?? 13}</span>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => updateEditorSettings({ fontSize: Math.min(24, (workspace?.fontSize ?? 13) + 1) })}>+</Button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Word wrap</span>
              <Button size="sm" variant="outline" className="h-7" onClick={() => updateEditorSettings({ wordWrap: !(workspace?.wordWrap ?? false) })}>
                {workspace?.wordWrap ? "On" : "Off"}
              </Button>
            </div>
            {project.entryFile && (
              <div className="flex items-center justify-between">
                <span className="text-sm">Preview entry</span>
                <Button size="sm" variant="outline" className="h-7" onClick={() => {
                  if (activePath && /\.html?$/i.test(activePath)) {
                    setEntryFile({ projectId, entryFile: activePath });
                    showToast("Preview entry updated");
                  } else {
                    showToast("Open an .html file first to set it as the preview entry");
                  }
                }}>
                  {project.entryFile}
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Command palette */}
      <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
        <CommandInput placeholder="Search files and commands…" />
        <CommandList>
          <CommandEmpty>No results.</CommandEmpty>
          {["Files", "Actions", "View", "Project"].map((group) => (
            <CommandGroup key={group} heading={group}>
              {commands.filter((c) => c.group === group).map((c) => (
                <CommandItem
                  key={c.id}
                  onSelect={() => {
                    setCommandOpen(false);
                    c.run();
                  }}
                >
                  <span className="truncate">{c.label}</span>
                  {c.hint && <span className="ml-auto text-xs text-muted-foreground">{c.hint}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>

      {/* Toast */}
      {toast && (
        <div className="pointer-events-none fixed bottom-10 left-1/2 z-50 -translate-x-1/2 rounded-md border border-border bg-popover px-4 py-2 text-sm text-popover-foreground shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

function formatTimeLeft(expiresAt: number): string {
  const ms = expiresAt - Date.now();
  if (ms <= 0) return "expired";
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ${mins % 60}m`;
}
