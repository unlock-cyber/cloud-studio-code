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
  Terminal as TerminalIcon,
  X,
  Menu,
  Globe,
  MoreHorizontal,
  AlertTriangle,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Narrow-viewport detection for the IDE's mobile single-panel workflow. */
function useIsNarrowViewport() {
  const [isNarrow, setIsNarrow] = useState(
    () => typeof window !== "undefined" && window.innerWidth < 768,
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsNarrow(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isNarrow;
}
import { ThemeToggle } from "@/components/ThemeToggle";
import { useTheme } from "@/hooks/use-theme";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
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
import {
  loadRunHistory,
  pushRunHistory,
  saveRunHistory,
  type RunHistoryEntry,
  type RunHistoryState,
} from "@/lib/runHistory";
import { requestFileDialog } from "@/lib/fileActionBus";
import { startPyodideWarmup, subscribePyodideWarmup } from "@/lib/pyodideRunner";
import { warmEsbuild } from "@/lib/tsRunner";
import { formatBytesClient } from "@/lib/clientHelpers";
import { sessionIdFromAuthToken, storeGuestContext } from "@/lib/guestContext";
import { useAuthToken } from "@convex-dev/auth/react";

const RUNNABLE_LANGS: LangId[] = ["python", "javascript", "typescript", "c", "cpp", "java", "bash", "sql"];

// Auto-Save settles this long after the last keystroke, so typing never issues
// a write per character.
const AUTOSAVE_DELAY_MS = 1200;

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

  // ---- App theme (dark default, persisted in localStorage) ----
  // The editor theme setting stays in sync with the app theme so a reload
  // (or another device) restores the same look.
  const { theme, setTheme } = useTheme();
  const setAppTheme = useCallback(
    (next: "dark" | "light") => {
      setTheme(next);
      updateEditorSettings({ editorTheme: next }).catch(() => undefined);
    },
    [setTheme, updateEditorSettings],
  );
  const toggleAppTheme = useCallback(() => {
    setAppTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setAppTheme]);

  // ---- Local editor state ----
  const [tabs, setTabs] = useState<EditorTab[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [terminalLines, setTerminalLines] = useState<TerminalLine[]>([]);
  const [runState, setRunState] = useState<RunState>("idle");
  const [lastRunTarget, setLastRunTarget] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [previewMessages, setPreviewMessages] = useState<string[]>([]);
  const [previewOpen, setPreviewOpen] = useState(true);
  const [terminalOpen, setTerminalOpen] = useState(true);
  const [explorerOpen, setExplorerOpen] = useState(true);
  const isNarrow = useIsNarrowViewport();
  // Mobile panel state: which full-screen panel is showing (editor by default).
  // Explorer opens as a drawer over the editor; terminal/preview are dedicated
  // full-width panels. State (terminal lines, preview HTML) lives above, so it
  // is preserved when switching between panels.
  const [mobilePanel, setMobilePanel] = useState<"editor" | "terminal" | "preview">("editor");
  const [explorerDrawerOpen, setExplorerDrawerOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [newFileDialog, setNewFileDialog] = useState<{ isFolder: boolean } | null>(null);
  const [newFileName, setNewFileName] = useState("");
  const [newFileError, setNewFileError] = useState<string | null>(null);
  const [creatingFile, setCreatingFile] = useState(false);
  const [pyodideState, setPyodideState] = useState<string>("idle");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [autoSaving, setAutoSaving] = useState(false);
  const [runHistory, setRunHistory] = useState<RunHistoryEntry[]>([]);
  // Action waiting on the unsaved-changes confirmation (closing a dirty tab,
  // or leaving the project while edits are pending).
  const [unsavedPrompt, setUnsavedPrompt] = useState<
    { kind: "close-tab"; path: string } | { kind: "leave" } | null
  >(null);
  const [unsavedBusy, setUnsavedBusy] = useState(false);
  const lineIdRef = useRef(0);
  // Latest values for callbacks that must stay stable across keystrokes
  // (auto-save, run bookkeeping).
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;
  const projectIdRef = useRef(projectId);
  projectIdRef.current = projectId;
  const runHistoryRef = useRef<RunHistoryEntry[]>([]);
  const runContextRef = useRef<{ path: string; lang: LangId; startedAt: number } | null>(null);
  const lastExitCodeRef = useRef(0);
  const autoSaveInFlight = useRef(false);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3200);
  }, []);

  // ---- Run history (local only) ----
  // A short log of recent runs so the terminal can answer "what did I just
  // run?". No backend, no telemetry — see lib/runHistory.
  const recordRun = useCallback((state: RunHistoryState, exitCode: number) => {
    const ctx = runContextRef.current;
    if (!ctx) return;
    // Cleared immediately so a second terminal-state callback can't duplicate.
    runContextRef.current = null;
    const entry: RunHistoryEntry = {
      id: `${ctx.startedAt}-${ctx.path}`,
      path: ctx.path,
      lang: LANGUAGES[ctx.lang]?.label ?? ctx.lang,
      state,
      exitCode,
      durationMs: Math.round(performance.now() - ctx.startedAt),
      ts: Date.now(),
    };
    const next = pushRunHistory(runHistoryRef.current, entry);
    runHistoryRef.current = next;
    setRunHistory(next);
    saveRunHistory(projectIdRef.current, next);
  }, []);

  const historyLoadedFor = useRef<string | null>(null);
  useEffect(() => {
    const id = project?._id;
    if (!id || historyLoadedFor.current === id) return;
    historyLoadedFor.current = id;
    const stored = loadRunHistory(id);
    runHistoryRef.current = stored;
    setRunHistory(stored);
  }, [project?._id]);

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
  // The same heartbeat refreshes the guest upgrade context: the OTP handler on
  // /auth reads it to move this workspace after sign-in, and its 1-hour TTL is
  // measured from the capture time — a guest can easily work in the IDE longer
  // than that, and a stale entry would silently skip the migration.
  const providerToken = useAuthToken();
  useEffect(() => {
    if (!isAuthenticated) return;
    const refreshGuestContext = () => {
      if (workspace?.kind !== "guest" || !providerToken) return;
      // The session id is only an extra ownership proof server-side; the
      // workspace id is what the hand-off needs, so an unreadable token must
      // not stop the context (and its TTL) from being refreshed.
      storeGuestContext({
        workspaceId: workspace._id,
        sessionId: sessionIdFromAuthToken(providerToken),
      });
    };
    refreshGuestContext();
    const interval = window.setInterval(() => {
      touchWs().catch(() => undefined);
      refreshGuestContext();
    }, 60_000);
    return () => window.clearInterval(interval);
  }, [isAuthenticated, touchWs, workspace, providerToken]);

  // ---- Load saved session (tabs + active file) ----
  const sessionLoaded = useRef<string | null>(null);
  useEffect(() => {
    if (!project || !filesRes) return;
    if (sessionLoaded.current === project._id) return;
    sessionLoaded.current = project._id;

    // Opening a project is activity: this refreshes `lastOpenedAt`, which is
    // what the dashboard's Recent projects list is ordered by. No tab names
    // are passed, so the saved session is left exactly as it was.
    void setSession({ projectId }).catch(() => undefined);

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

  const closeTabNow = useCallback(
    (path: string) => {
      const next = tabs.filter((t) => t.path !== path);
      const nextActive =
        activePath === path ? next[next.length - 1]?.path ?? null : activePath;
      setTabs(next);
      setActivePath(nextActive);
      persistSession(next.map((t) => t.path), nextActive);
    },
    [tabs, activePath, persistSession],
  );

  // Closing a tab that has unsaved edits asks first — never discards silently.
  const requestCloseTab = useCallback(
    (path: string) => {
      const tab = tabs.find((t) => t.path === path);
      if (tab && tab.draft !== tab.content) {
        setUnsavedPrompt({ kind: "close-tab", path });
        return;
      }
      closeTabNow(path);
    },
    [tabs, closeTabNow],
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

  /** Mark only the files that were actually persisted as clean, so a partial
   *  failure can never silently discard a draft. */
  const applySavedContents = useCallback(
    (saved: Array<{ path: string; content: string }>) => {
      setTabs((prev) =>
        prev.map((t) => {
          const match = saved.find((s) => s.path === t.path);
          return match ? { ...t, content: match.content } : t;
        }),
      );
    },
    [],
  );

  // ---- Unsaved-changes protection ----
  // Manual saving stays explicit (Ctrl+S / the Save button); this also backs
  // Auto-Save and the "action would throw drafts away" confirmation.
  const saveAllDirty = useCallback(async () => {
    const dirty = tabsRef.current.filter((x) => x.draft !== x.content);
    if (dirty.length === 0) return;
    for (const t of dirty) {
      await saveFile({ projectId, path: t.path, content: t.draft });
    }
    applySavedContents(dirty.map((t) => ({ path: t.path, content: t.draft })));
    touchWs().catch(() => undefined);
  }, [projectId, saveFile, touchWs, applySavedContents]);

  // ---- Auto-Save ----
  // On by default for every workspace (see convex/workspaces.ts); the saved
  // per-workspace preference is honoured, so turning it off sticks. Writes go
  // through the same `files.save` mutation manual Save uses — no second
  // persistence path — debounced and skipped while a save is in flight.
  const autoSaveEnabled = workspace?.autoSave ?? true;
  useEffect(() => {
    if (!autoSaveEnabled) return;
    if (dirtyPaths.size === 0) return;
    let timer = 0;
    const attempt = () => {
      // A save is already running: try again shortly rather than dropping the
      // pending edits (they are read fresh when the retry fires).
      if (autoSaveInFlight.current) {
        timer = window.setTimeout(attempt, 400);
        return;
      }
      autoSaveInFlight.current = true;
      setAutoSaving(true);
      void saveAllDirty()
        .catch((e) =>
          showToast(e instanceof Error ? e.message : "Auto-save failed — use Save to retry."),
        )
        .finally(() => {
          autoSaveInFlight.current = false;
          setAutoSaving(false);
        });
    };
    timer = window.setTimeout(attempt, AUTOSAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [autoSaveEnabled, dirtyPaths, saveAllDirty, showToast]);

  const leaveProject = useCallback(() => {
    if (dirtyPaths.size > 0) {
      setUnsavedPrompt({ kind: "leave" });
      return;
    }
    navigate("/dashboard");
  }, [dirtyPaths.size, navigate]);

  const resolveUnsaved = useCallback(
    async (action: "save" | "discard") => {
      if (!unsavedPrompt) return;
      setUnsavedBusy(true);
      try {
        if (action === "save") await saveAllDirty();
        if (unsavedPrompt.kind === "close-tab") closeTabNow(unsavedPrompt.path);
        else navigate("/dashboard");
        setUnsavedPrompt(null);
      } catch (e) {
        // Keep the prompt open: nothing is discarded until saving works.
        showToast(e instanceof Error ? e.message : "Could not save your changes");
      } finally {
        setUnsavedBusy(false);
      }
    },
    [unsavedPrompt, saveAllDirty, closeTabNow, navigate, showToast],
  );

  // Browser-level safety net for reload/close/tab-switch. In-app navigation
  // goes through leaveProject above.
  useEffect(() => {
    if (dirtyPaths.size === 0) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirtyPaths.size]);

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

  // Web preview is only offered when the project actually has a web entry
  // (an .html entry file, or any .html file the builder can pick up).
  // Python/SQL/C++ etc. don't render a web page, so the panel stays hidden.
  const hasWebPreview = useMemo(
    () =>
      Boolean(project?.entryFile && /\.html?$/i.test(project.entryFile)) ||
      allFiles.some((f) => !f.isFolder && /\.html?$/i.test(f.path)),
    [project?.entryFile, allFiles],
  );
  const previewAvailable = hasWebPreview;

  // Auto-hide the preview panel when it isn't applicable to the current file.
  useEffect(() => {
    if (!previewAvailable) setPreviewOpen(false);
  }, [previewAvailable]);

  const runCallbacks = useMemo<Parameters<typeof runManager.runSingleFile>[1]>(
    () => ({
      onState: (s) => {
        setRunState(s);
        // Terminal states are recorded in Run History; "starting"/"running"
        // are not. The orchestrator calls onExit first, so the exit code the
        // history entry reports is the real one.
        if (s === "success" || s === "failed" || s === "stopped") {
          recordRun(s, lastExitCodeRef.current);
        }
      },
      onStdout: (text) =>
        setTerminalLines((prev) => [...prev.slice(-400), { id: ++lineIdRef.current, kind: "stdout", text, ts: Date.now() }]),
      onStderr: (text) =>
        setTerminalLines((prev) => [...prev.slice(-400), { id: ++lineIdRef.current, kind: "stderr", text, ts: Date.now() }]),
      onInfo: (text) =>
        setTerminalLines((prev) => [...prev.slice(-400), { id: ++lineIdRef.current, kind: "info", text, ts: Date.now() }]),
      onExit: (code) => {
        lastExitCodeRef.current = code;
        setTerminalLines((prev) => [
          ...prev.slice(-400),
          { id: ++lineIdRef.current, kind: "exit", text: `\nProcess finished with exit code ${code}`, ts: Date.now() },
        ]);
      },
      onPreview: () => undefined,
    }),
    [recordRun],
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
      if (!hasWebPreview) {
        showToast("No .html entry file — add an HTML file to get a live preview.");
        return;
      }
      runContextRef.current = { path: activePath, lang, startedAt: performance.now() };
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
      // Mobile shows one full-screen panel at a time (editor by default), so
      // the desktop-only `previewOpen` flag would leave the run invisibly
      // behind the editor. Bring the same preview panel forward there too.
      if (isNarrow) setMobilePanel("preview");
      setRunState("success");
      recordRun("success", 0);
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
    // Started here, finished in runCallbacks → recorded in Run History.
    runContextRef.current = { path: activePath, lang, startedAt: performance.now() };
    await runManager.runSingleFile(
      { projectId, path: activePath, content: activeTab.draft, lang },
      runCallbacks,
    );
  }, [activePath, activeTab, tabs, project?.entryFile, hasWebPreview, projectId, saveFile, runCallbacks, recordRun, showToast, isNarrow]);

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

  /** Clear is a reset: output goes away and, when nothing is in flight, the
   *  terminal returns to its idle badge. */
  const handleClearTerminal = useCallback(() => {
    setTerminalLines([]);
    setRunState((prev) =>
      prev === "running" || prev === "starting" ? prev : "idle",
    );
  }, []);

  /** Jump from a Run History entry back to the file it ran. */
  const handleOpenHistoryFile = useCallback(
    (path: string) => {
      openFile(path);
      if (isNarrow) setMobilePanel("editor");
    },
    [openFile, isNarrow],
  );

  // ---- File operations ----
  const handleCreate = useCallback(
    async (parentFolder: string | null, isFolder: boolean) => {
      setNewFileDialog({ isFolder });
      setNewFileName(parentFolder ? parentFolder + "/" : "");
    },
    [],
  );

  const confirmCreate = useCallback(async () => {
    if (!newFileDialog || creatingFile) return;
    const path = newFileName.trim();
    if (!path) {
      setNewFileError("Enter a file or folder name.");
      return;
    }
    setCreatingFile(true);
    try {
      await createFile({
        projectId,
        path,
        isFolder: newFileDialog.isFolder,
        content: "",
      });
      if (!newFileDialog.isFolder) {
        openFile(path);
      }
      setNewFileDialog(null);
      setNewFileName("");
      setNewFileError(null);
    } catch (e) {
      // Keep the dialog (and the typed path) so the name can be corrected.
      setNewFileError(e instanceof Error ? e.message : "Could not create that file. Please try again.");
    } finally {
      // Cleared on failure too, so a rejected create can't strand the dialog
      // on a disabled "Creating…" button.
      setCreatingFile(false);
    }
  }, [newFileDialog, newFileName, creatingFile, createFile, projectId, openFile]);

  /** Re-paths open tabs (and the active tab) after a rename/move, keeping
   *  unsaved drafts attached to the file they belong to. */
  const remapPath = useCallback(
    (path: string, newPath: string) => {
      const next = tabs.map((t) => {
        if (t.path === path) return { ...t, path: newPath };
        if (t.path.startsWith(path + "/")) return { ...t, path: newPath + t.path.slice(path.length) };
        return t;
      });
      let nextActive = activePath;
      if (activePath === path) nextActive = newPath;
      else if (activePath && activePath.startsWith(path + "/")) {
        nextActive = newPath + activePath.slice(path.length);
      }
      setTabs(next);
      setActivePath(nextActive);
      persistSession(next.map((t) => t.path), nextActive);
    },
    [tabs, activePath, persistSession],
  );

  // Rename/move and delete deliberately reject on failure: the explorer's
  // dialogs catch the error, keep the user's input and show the message
  // (conflicts like `"src/a.ts" already exists` included).
  const handleRename = useCallback(
    async (path: string, newPath: string) => {
      if (newPath === path || !newPath.trim()) return;
      await renameFile({ projectId, path, newPath });
      remapPath(path, newPath);
    },
    [projectId, renameFile, remapPath],
  );

  const handleDelete = useCallback(
    async (path: string) => {
      await deleteFile({ projectId, path });
      const next = tabs.filter((t) => t.path !== path && !t.path.startsWith(path + "/"));
      const nextActive =
        activePath && (activePath === path || activePath.startsWith(path + "/"))
          ? next[next.length - 1]?.path ?? null
          : activePath;
      setTabs(next);
      setActivePath(nextActive);
      persistSession(next.map((t) => t.path), nextActive);
    },
    [projectId, deleteFile, tabs, activePath, persistSession],
  );

  const handleDuplicate = useCallback(
    async (path: string) => {
      try {
        const result = (await duplicateFile({ projectId, path })) as { path: string } | undefined;
        showToast(result?.path ? `Duplicated as ${result.path}` : "Duplicated");
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Failed to duplicate");
      }
    },
    [projectId, duplicateFile, showToast],
  );

  /** Ask the explorer to open its rename/delete dialog for a path. Used by
   *  the command palette so those actions reuse the explorer's own dialogs
   *  (and its validation) instead of duplicating them. */
  const requestFileAction = useCallback(
    (kind: "rename" | "delete", path: string) => {
      // Make sure an explorer is mounted to pick the request up: panel on
      // desktop, drawer on mobile.
      setExplorerOpen(true);
      if (isNarrow) setExplorerDrawerOpen(true);
      requestFileDialog(kind, path);
    },
    [isNarrow],
  );

  const handleSaveAll = useCallback(async () => {
    const count = tabsRef.current.filter((t) => t.draft !== t.content).length;
    if (count === 0) {
      showToast("Nothing to save — everything is up to date.");
      return;
    }
    setSaving(true);
    try {
      await saveAllDirty();
      showToast(`Saved ${count} file${count === 1 ? "" : "s"}`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Save all failed");
    } finally {
      setSaving(false);
    }
  }, [saveAllDirty, showToast]);

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
    items.push({
      id: "saveall",
      label: "Save all files",
      hint: dirtyPaths.size > 0 ? `${dirtyPaths.size} unsaved` : undefined,
      group: "Actions",
      run: () => void handleSaveAll(),
    });
    if (activePath) {
      items.push({ id: "save", label: "Save current file", hint: "Ctrl+S", group: "Actions", run: saveActive });
      items.push({ id: "run", label: `Run ${activePath}`, hint: "Ctrl+Enter", group: "Actions", run: () => handleRunRef.current?.() });
      items.push({ id: "closefile", label: `Close ${activePath}`, group: "Actions", run: () => requestCloseTab(activePath) });
      items.push({ id: "dupfile", label: `Duplicate file: ${activePath}`, group: "Actions", run: () => void handleDuplicate(activePath) });
      items.push({ id: "renfile", label: "Rename current file…", group: "Actions", run: () => requestFileAction("rename", activePath) });
      items.push({ id: "delfile", label: "Delete current file…", group: "Actions", run: () => requestFileAction("delete", activePath) });
    }
    if (runState === "running" || runState === "starting") {
      items.push({ id: "stop", label: "Stop the running process", group: "Actions", run: handleStop });
    }
    items.push(
      { id: "newfile", label: "New file", group: "Actions", run: () => handleCreate(null, false) },
      { id: "newfolder", label: "New folder", group: "Actions", run: () => handleCreate(null, true) },
      { id: "preview", label: "Toggle preview panel", group: "View", run: () => setPreviewOpen((v) => !v) },
      { id: "terminal", label: "Toggle terminal panel", group: "View", run: () => setTerminalOpen((v) => !v) },
      { id: "explorer", label: "Toggle explorer", hint: "Ctrl+B", group: "View", run: () => setExplorerOpen((v) => !v) },
      {
        id: "theme",
        label: theme === "dark" ? "Switch to light mode" : "Switch to dark mode",
        group: "View",
        run: toggleAppTheme,
      },
      { id: "settings", label: "Editor settings", group: "View", run: () => setSettingsOpen(true) },
      {
        id: "autosave",
        label: autoSaveEnabled ? "Turn Auto Save off" : "Turn Auto Save on",
        group: "View",
        run: () => updateEditorSettings({ autoSave: !autoSaveEnabled }).catch(() => undefined),
      },
      { id: "export", label: "Export project as ZIP", group: "Project", run: () => handleExport() },
      { id: "back", label: "Back to dashboard", group: "Project", run: leaveProject },
    );
    return items;
  }, [
    textFiles,
    openFile,
    saveActive,
    activePath,
    handleExport,
    leaveProject,
    theme,
    toggleAppTheme,
    dirtyPaths.size,
    handleSaveAll,
    runState,
    handleStop,
    requestCloseTab,
    handleDuplicate,
    requestFileAction,
    handleCreate,
    autoSaveEnabled,
    updateEditorSettings,
  ]);

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
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-6 text-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
          <span className="text-sm">Loading your workspace…</span>
        </div>
        <p className="text-xs text-muted-foreground/70">
          Restoring your files, open tabs and editor settings.
        </p>
      </div>
    );
  }

  if (project === null) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <p className="text-lg text-foreground/80">Project not found</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          It may have been deleted, or it belongs to another account. Your other projects are
          waiting on the dashboard.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button onClick={() => navigate("/dashboard")}>Back to dashboard</Button>
          <Button
            variant="outline"
            onClick={() => {
              // Re-run the project/file queries once — a stale id or a hiccup
              // in the initial load can resolve on a second attempt.
              window.location.reload();
            }}
          >
            Try again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      {/* Title bar */}
      <header className="flex h-12 shrink-0 items-center gap-1.5 border-b border-border/60 bg-background px-2 sm:px-3 md:h-11">
        <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-muted-foreground md:h-7" onClick={leaveProject}>
          <ArrowLeft className="size-4" />
          <span className="hidden sm:inline">Projects</span>
        </Button>
        <div className="mx-0.5 h-4 w-px shrink-0 bg-border/60" />
        <span className="min-w-0 truncate text-sm font-medium">{project.name}</span>
        <Badge variant="secondary" className="hidden shrink-0 text-[10px] sm:inline-flex">{project.language}</Badge>
        {(saving || autoSaving) && (
          <span
            className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground"
            title={autoSaving ? "Auto-saving your changes" : "Saving"}
          >
            <Loader2 className="size-3.5 animate-spin" />
            <span className="hidden sm:inline">{autoSaving ? "Auto-saving…" : "Saving…"}</span>
          </span>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-1">
          {/* RUN button — always accessible */}
          {runState === "running" || runState === "starting" ? (
            <Button size="sm" className="h-8 gap-1.5 bg-red-500/90 px-3 text-white hover:bg-red-500 md:h-7" onClick={handleStop}>
              <Square className="size-3.5" /> Stop
            </Button>
          ) : (
            <Button size="sm" className="h-8 gap-1.5 bg-emerald-600 px-3 text-white hover:bg-emerald-500 md:h-7" onClick={() => handleRunRef.current?.()}>
              <Play className="size-3.5 fill-current" /> Run
            </Button>
          )}
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground md:h-7 md:w-7" onClick={saveActive} title="Save (Ctrl+S)">
            <Save className="size-4" />
          </Button>

          {/* Primary actions — always visible on mobile */}
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground md:hidden" onClick={() => setExplorerDrawerOpen(true)} title="Files">
            <Menu className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={`h-8 w-8 p-0 md:hidden ${mobilePanel === "terminal" ? "text-sky-500" : "text-muted-foreground"}`}
            onClick={() => setMobilePanel("terminal")}
            title="Terminal"
          >
            <TerminalIcon className="size-4" />
          </Button>
          {previewAvailable && (
            <Button
              variant="ghost"
              size="sm"
              className={`h-8 w-8 p-0 md:hidden ${mobilePanel === "preview" ? "text-sky-500" : "text-muted-foreground"}`}
              onClick={() => setMobilePanel("preview")}
              title="Preview"
            >
              <Globe className="size-4" />
            </Button>
          )}

          {/* Desktop extras — collapsed into an overflow menu on mobile */}
          <div className="hidden items-center gap-1.5 md:flex">
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground" onClick={() => setNewFileDialog({ isFolder: false })} title="New file">
              <FilePlus2 className="size-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground" onClick={() => setNewFileDialog({ isFolder: true })} title="New folder">
              <FolderPlus className="size-4" />
            </Button>
            <div className="mx-1 h-4 w-px bg-border/60" />
            <Button variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-muted-foreground" onClick={handleExport} disabled={exporting} title="Export as ZIP">
              {exporting ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-4" />} Export
            </Button>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground md:h-7 md:w-7" title="More">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem className="md:hidden" onClick={() => setNewFileDialog({ isFolder: false })}>
                <FilePlus2 className="mr-2 size-3.5" /> New file
              </DropdownMenuItem>
              <DropdownMenuItem className="md:hidden" onClick={() => setNewFileDialog({ isFolder: true })}>
                <FolderPlus className="mr-2 size-3.5" /> New folder
              </DropdownMenuItem>
              <div className="md:hidden">
                <DropdownMenuItem onClick={handleExport} disabled={exporting}>
                  {exporting ? <Loader2 className="mr-2 size-3.5 animate-spin" /> : <Download className="mr-2 size-3.5" />} Export ZIP
                </DropdownMenuItem>
              </div>
              <DropdownMenuItem onClick={() => setSettingsOpen(true)}>
                <Palette className="mr-2 size-3.5" /> Editor settings
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  updateEditorSettings({ autoSave: !autoSaveEnabled }).catch(() => undefined)
                }
              >
                <Save className="mr-2 size-3.5" /> Auto Save: {autoSaveEnabled ? "On" : "Off"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setCommandOpen(true)}>
                <Command className="mr-2 size-3.5" /> Command palette
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="hidden sm:block">
            <ThemeToggle theme={theme} onToggle={toggleAppTheme} />
          </div>
        </div>
      </header>

      {/* Main body */}
      <div className="min-h-0 flex-1">
        {isNarrow ? (
          /* ---------------- MOBILE: single-primary-panel workflow ---------------- */
          <div className="flex h-full min-h-0 flex-col">
            {mobilePanel === "editor" && (
              <>
                <div className="flex h-10 shrink-0 items-center gap-0.5 overflow-x-auto border-b border-border/60 bg-background px-1 md:h-9">
                  {tabs.length === 0 && (
                    <span className="px-3 text-xs text-muted-foreground/70">No open files</span>
                  )}
                  {tabs.map((t) => {
                    const icon = fileIconMeta(t.path);
                    const dirty = t.draft !== t.content;
                    return (
                      <div
                        key={t.path}
                        className={`group flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-t-md border-b-2 px-2.5 text-xs md:h-7 ${
                          activePath === t.path
                            ? "border-sky-500 bg-foreground/5 text-foreground"
                            : "border-transparent text-muted-foreground hover:text-foreground/80"
                        }`}
                        onClick={() => openFile(t.path)}
                      >
                        <span className="rounded-sm px-0.5 text-[8px] font-bold whitespace-nowrap shrink-0" style={{ color: icon.color, border: `1px solid ${icon.color}55` }}>
                          {icon.label}
                        </span>
                        <span className="max-w-[110px] truncate">{t.path.split("/").pop()}</span>
                        {dirty && <span className="text-amber-500 dark:text-amber-400">●</span>}
                        <button
                          className="ml-1 rounded p-1 hover:bg-foreground/10 md:p-0.5"
                          onClick={(e) => {
                            e.stopPropagation();
                            requestCloseTab(t.path);
                          }}
                        >
                          <X className="size-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
                <div className="min-h-0 flex-1 overflow-hidden">
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
                      theme={theme}
                      onThemeToggle={toggleAppTheme}
                      fontSize={workspace?.fontSize ?? 13}
                      wordWrap={workspace?.wordWrap ?? false}
                      onFontSizeChange={(size) =>
                        updateEditorSettings({ fontSize: Math.min(24, Math.max(10, size)) })
                      }
                      onWordWrapToggle={() =>
                        updateEditorSettings({ wordWrap: !(workspace?.wordWrap ?? false) })
                      }
                      compact={isNarrow}
                      autoSave={autoSaveEnabled}
                      onAutoSaveToggle={() =>
                        updateEditorSettings({ autoSave: !autoSaveEnabled }).catch(
                          () => undefined,
                        )
                      }
                    />
                  ) : allFiles.length === 0 ? (
                    <EmptyProjectState onCreateFile={() => setNewFileDialog({ isFolder: false })} />
                  ) : (
                    <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground/70">
                      Select a file to start editing — tap the ☰ menu to browse files
                    </div>
                  )}
                </div>
              </>
            )}

            {mobilePanel === "terminal" && (
              <div className="min-h-0 flex-1">
                <TerminalPanel
                  lines={terminalLines}
                  runState={runState}
                  history={runHistory}
                  onClear={handleClearTerminal}
                  onStop={handleStop}
                  onRerun={handleRerun}
                  canRerun={lastRunTarget !== null}
                  onOpenHistoryFile={handleOpenHistoryFile}
                  onClose={() => setMobilePanel("editor")}
                />
              </div>
            )}

            {mobilePanel === "preview" && (
              <div className="min-h-0 flex-1">
                <PreviewPanel
                  html={previewHtml}
                  onMessage={handlePreviewMessage}
                  onClose={() => setMobilePanel("editor")}
                />
              </div>
            )}
          </div>
        ) : (
          /* ---------------- DESKTOP: resizable panels (unchanged) ---------------- */
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
                    <div className="flex h-10 shrink-0 items-center gap-0.5 overflow-x-auto border-b border-border/60 bg-background px-1 md:h-9">
                    {tabs.length === 0 && (
                      <span className="px-3 text-xs text-muted-foreground/70">No open files — pick one from the explorer</span>
                    )}
                    {tabs.map((t) => {
                      const icon = fileIconMeta(t.path);
                      const dirty = t.draft !== t.content;
                      return (
                        <div
                          key={t.path}
                          className={`group flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-t-md border-b-2 px-2.5 text-xs md:h-7 ${
                            activePath === t.path
                              ? "border-sky-500 bg-foreground/5 text-foreground"
                              : "border-transparent text-muted-foreground hover:text-foreground/80"
                          }`}
                          onClick={() => openFile(t.path)}
                        >
                          <span className="rounded-sm px-0.5 text-[8px] font-bold whitespace-nowrap shrink-0" style={{ color: icon.color, border: `1px solid ${icon.color}55` }}>
                            {icon.label}
                          </span>
                          <span className="max-w-[140px] truncate">{t.path.split("/").pop()}</span>
                          {dirty && <span className="text-amber-500 dark:text-amber-400">●</span>}
                          <button
                            className="ml-1 rounded p-0.5 opacity-0 hover:bg-foreground/10 group-hover:opacity-100"
                            onClick={(e) => {
                              e.stopPropagation();
                              requestCloseTab(t.path);
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
                            theme={theme}
                            onThemeToggle={toggleAppTheme}
                            fontSize={workspace?.fontSize ?? 13}
                            wordWrap={workspace?.wordWrap ?? false}
                            onFontSizeChange={(size) =>
                              updateEditorSettings({ fontSize: Math.min(24, Math.max(10, size)) })
                            }
                            onWordWrapToggle={() =>
                              updateEditorSettings({ wordWrap: !(workspace?.wordWrap ?? false) })
                            }
                            autoSave={autoSaveEnabled}
                            onAutoSaveToggle={() =>
                              updateEditorSettings({ autoSave: !autoSaveEnabled }).catch(
                                () => undefined,
                              )
                            }
                          />
                        ) : allFiles.length === 0 ? (
                          <EmptyProjectState onCreateFile={() => setNewFileDialog({ isFolder: false })} />
                        ) : (
                          <div className="flex h-full items-center justify-center text-sm text-muted-foreground/70">
                            Select a file to start editing
                          </div>
                        )}
                      </Panel>
                      {previewAvailable && previewOpen && (
                        <>
                          <PanelResizeHandle className="w-px bg-border/60 data-[resize-handle-active]:bg-sky-500" />
                          <Panel defaultSize={40} minSize={20}>
                            <PreviewPanel
                              html={previewHtml}
                              onMessage={handlePreviewMessage}
                              onClose={() => setPreviewOpen(false)}
                            />
                          </Panel>
                        </>
                      )}
                    </PanelGroup>
                  </div>
                </div>
              </Panel>

              {terminalOpen && (
                <>
                  <PanelResizeHandle className="h-px bg-border/60 data-[resize-handle-active]:bg-sky-500" />

                  {/* Terminal */}
                  <Panel defaultSize={35} minSize={10}>
                    <TerminalPanel
                      lines={terminalLines}
                      runState={runState}
                      history={runHistory}
                      onClear={handleClearTerminal}
                      onStop={handleStop}
                      onRerun={handleRerun}
                      canRerun={lastRunTarget !== null}
                      onOpenHistoryFile={handleOpenHistoryFile}
                      onClose={() => setTerminalOpen(false)}
                    />
                  </Panel>
                </>
              )}
            </PanelGroup>
          </Panel>
        </PanelGroup>
        )}
      </div>

      {/* Status bar */}
      <footer className="flex h-7 shrink-0 items-center gap-3 overflow-x-auto border-t border-border/60 bg-background px-3 text-[11px] text-muted-foreground">
        {/* Mobile status-bar switches: explorer drawer + panel switcher */}
        <div className="flex items-center gap-3 md:hidden">
          <button className="flex items-center gap-1 hover:text-foreground" onClick={() => setExplorerDrawerOpen(true)}>
            <PanelLeftOpen className="size-3.5" /> Files
          </button>
          <button
            className={`flex items-center gap-1 hover:text-foreground ${mobilePanel === "terminal" ? "text-sky-500" : ""}`}
            onClick={() => setMobilePanel("terminal")}
          >
            <TerminalIcon className="size-3.5" /> Terminal
          </button>
          {previewAvailable && (
            <button
              className={`flex items-center gap-1 hover:text-foreground ${mobilePanel === "preview" ? "text-sky-500" : ""}`}
              onClick={() => setMobilePanel("preview")}
            >
              <LayoutPanelLeft className="size-3.5" /> Preview
            </button>
          )}
          <button
            className={`flex items-center gap-1 hover:text-foreground ${mobilePanel === "editor" ? "text-sky-500" : ""}`}
            onClick={() => setMobilePanel("editor")}
          >
            Editor
          </button>
        </div>
        <div className="hidden items-center gap-3 md:flex">
          <button className="flex items-center gap-1 hover:text-foreground" onClick={() => setExplorerOpen((v) => !v)}>
            {explorerOpen ? <PanelLeftClose className="size-3.5" /> : <PanelLeftOpen className="size-3.5" />} Explorer
          </button>
          <button className="flex items-center gap-1 hover:text-foreground" onClick={() => setTerminalOpen((v) => !v)}>
            <TerminalIcon className="size-3.5" /> Terminal
          </button>
          {previewAvailable && (
            <button className="flex items-center gap-1 hover:text-foreground" onClick={() => setPreviewOpen((v) => !v)}>
              <LayoutPanelLeft className="size-3.5" /> Preview
            </button>
          )}
        </div>
        {activePath && (
          <span className="hidden min-w-0 truncate sm:inline">
            {activePath} · {activeLang ? LANGUAGES[activeLang].label : "Text"}
          </span>
        )}
        <span className="ml-auto hidden items-center gap-3 sm:flex">
          {pyodideState === "loading" && <span className="text-sky-500 dark:text-sky-400">Python runtime loading…</span>}
          {pyodideState === "ready" && <span className="text-emerald-600 dark:text-emerald-500">Python ready</span>}
          {pyodideState === "error" && <span className="text-amber-600 dark:text-amber-400">Python runtime unavailable</span>}
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

      {/* Mobile file-explorer drawer — all file actions stay accessible */}
      <Sheet open={isNarrow && explorerDrawerOpen} onOpenChange={setExplorerDrawerOpen}>
        <SheetContent side="left" className="flex w-[86vw] max-w-xs flex-col gap-0 p-0 sm:max-w-sm">
          <SheetHeader className="border-b border-border/60 px-3 py-2">
            <SheetTitle className="text-sm">Files</SheetTitle>
          </SheetHeader>
          <div className="min-h-0 flex-1">
            <FileExplorer
              files={allFiles}
              activeFile={activePath}
              openTabs={tabs.map((t) => t.path)}
              dirtyPaths={dirtyPaths}
              onOpenFile={(path) => {
                openFile(path);
                setExplorerDrawerOpen(false);
                setMobilePanel("editor");
              }}
              onCreate={handleCreate}
              onRename={handleRename}
              onDelete={handleDelete}
              onDuplicate={handleDuplicate}
              onDownloadFile={handleDownloadFile}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* New file/folder dialog */}
      <Dialog open={newFileDialog !== null} onOpenChange={(open) => !open && !creatingFile && setNewFileDialog(null)}>
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
            disabled={creatingFile}
            onChange={(e) => {
              setNewFileError(null);
              setNewFileName(e.target.value);
            }}
            placeholder={newFileDialog?.isFolder ? "components" : "src/main.py"}
            onKeyDown={(e) => e.key === "Enter" && confirmCreate()}
          />
          {newFileError && (
            <p className="text-xs text-destructive" role="alert">
              {newFileError}
            </p>
          )}
          <DialogFooter>
            <Button
              variant="ghost"
              size="sm"
              disabled={creatingFile}
              onClick={() => {
                setNewFileDialog(null);
                setNewFileError(null);
              }}
            >
              Cancel
            </Button>
            <Button size="sm" disabled={creatingFile} onClick={confirmCreate}>
              {creatingFile ? "Creating…" : "Create"}
            </Button>
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
              <span className="text-sm">App & editor theme</span>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant={theme === "dark" ? "default" : "ghost"}
                  className="h-7 w-7 p-0"
                  onClick={() => setAppTheme("dark")}
                >
                  <Moon className="size-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant={theme === "light" ? "default" : "ghost"}
                  className="h-7 w-7 p-0"
                  onClick={() => setAppTheme("light")}
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

      {/* Unsaved-changes confirmation */}
      <Dialog
        open={unsavedPrompt !== null}
        onOpenChange={(open) => !open && !unsavedBusy && setUnsavedPrompt(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="size-4 text-amber-500" /> Unsaved changes
            </DialogTitle>
            <DialogDescription>
              {unsavedPrompt?.kind === "close-tab"
                ? `"${unsavedPrompt.path}" has unsaved changes. Save it before closing the tab?`
                : `${dirtyPaths.size} file${dirtyPaths.size === 1 ? "" : "s"} with unsaved changes. Save before leaving the project?`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-between">
            <Button variant="ghost" size="sm" disabled={unsavedBusy} onClick={() => setUnsavedPrompt(null)}>
              Cancel
            </Button>
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={unsavedBusy}
                onClick={() => void resolveUnsaved("discard")}
              >
                {unsavedPrompt?.kind === "close-tab" ? "Close without saving" : "Leave without saving"}
              </Button>
              <Button size="sm" disabled={unsavedBusy} onClick={() => void resolveUnsaved("save")}>
                {unsavedBusy
                  ? "Saving…"
                  : unsavedPrompt?.kind === "close-tab"
                    ? "Save & close"
                    : "Save all & leave"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Toast */}
      {toast && (
        <div className="pointer-events-none fixed bottom-10 left-1/2 z-50 -translate-x-1/2 rounded-md border border-border bg-popover px-4 py-2 text-sm text-popover-foreground shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

/** Shown when a project genuinely has no files yet — an empty project is a
 *  starting point, not an error. */
function EmptyProjectState({ onCreateFile }: { onCreateFile: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
      <FilePlus2 className="size-7 text-muted-foreground/40" />
      <p className="text-sm font-medium text-foreground/80">This project is empty</p>
      <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">
        Add your first file to start coding. You can also import an existing project as a ZIP from
        the dashboard.
      </p>
      <Button size="sm" variant="outline" className="mt-2" onClick={onCreateFile}>
        <FilePlus2 className="size-3.5" /> New file
      </Button>
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
