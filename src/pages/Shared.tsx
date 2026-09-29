import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  ResizablePanelGroup as PanelGroup,
  ResizablePanel as Panel,
  ResizableHandle as PanelResizeHandle,
} from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BrandMark } from "@/components/BrandMark";
import { FileExplorer } from "@/components/ide/FileExplorer";
import { CodeEditor } from "@/components/ide/CodeEditor";
import { PreviewPanel, type PreviewMessage } from "@/components/ide/PreviewPanel";
import { fileIconMeta, type FileMeta } from "@/lib/fileTree";
import { buildPreviewHtml } from "@/lib/previewBuilder";
import { formatRelativeTime } from "@/lib/clientHelpers";
import { usePageMeta } from "@/lib/seo";
import { useTheme } from "@/hooks/use-theme";
import { useIsNarrowViewport } from "@/hooks/use-narrow-viewport";
import {
  Eye,
  FileCode2,
  FolderOpen,
  Globe,
  LayoutPanelLeft,
  Link2Off,
  Loader2,
  Menu,
  Play,
  X,
} from "lucide-react";

/** A preview message with a stable key and a severity, so errors can be shown
 *  as errors instead of blending into a wall of console text. */
type PreviewLogLine = { id: number; level: "error" | "info"; text: string };

/**
 * Public, read-only view of a shared project (/s/:token).
 *
 * Reuses the IDE's own building blocks — FileExplorer, CodeEditor (read-only),
 * PreviewPanel and the sandboxed preview builder — so there is no second
 * editor implementation and no second runtime. Nothing on this page can write:
 * it renders no create/rename/delete/duplicate/save/run control, every file
 * it shows comes from the public `shared.*` queries, and the owner-only
 * mutations reject any caller who doesn't own the project's workspace.
 */
export default function Shared() {
  const { token = "" } = useParams();
  const isNarrow = useIsNarrowViewport();
  const { theme, toggleTheme } = useTheme();

  const project = useQuery(api.shared.get, { token });

  const [openPaths, setOpenPaths] = useState<string[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [explorerDrawerOpen, setExplorerDrawerOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  // Mobile shows one panel at a time; the preview is the only "second" panel.
  const [mobilePreview, setMobilePreview] = useState(false);
  const [previewLog, setPreviewLog] = useState<PreviewLogLine[]>([]);
  const previewLogId = useRef(0);
  const [viewFontSize, setViewFontSize] = useState(13);
  const [viewWordWrap, setViewWordWrap] = useState(false);

  // Viewer-only view preferences. They are local by design: a shared viewer
  // must never be able to write into the owner's workspace settings.
  const files: FileMeta[] = useMemo(
    () =>
      (project?.files ?? []).map((f) => ({
        // The tree only needs a stable key; internal ids never leave the server.
        _id: f.path,
        path: f.path,
        name: f.name,
        isFolder: f.isFolder,
        size: f.size,
        updatedAt: 0,
        isBinary: f.isBinary,
      })),
    [project?.files],
  );

  // Preview availability comes from the server (api.shared.get) using the same
  // rule as the owner's share dialog, so both surfaces always agree.
  const previewAvailable = project?.previewAvailable ?? false;
  const fileCount = project?.fileCount ?? 0;
  const updatedAt = project?.updatedAt ?? 0;

  // Open the entry file (or the first text file) once the project resolves.
  const initialisedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!project || initialisedFor.current === token) return;
    initialisedFor.current = token;
    const textPaths = project.files
      .filter((f) => !f.isFolder && !f.isBinary)
      .map((f) => f.path);
    const preferred =
      project.entryFile && textPaths.includes(project.entryFile)
        ? project.entryFile
        : textPaths[0] ?? null;
    if (preferred) {
      setOpenPaths([preferred]);
      setActivePath(preferred);
    }
    setPreviewOpen(previewAvailable && !isNarrow);
  }, [project, token, previewAvailable, isNarrow]);

  const activeContent = useQuery(
    api.shared.content,
    activePath ? { token, path: activePath } : "skip",
  );

  const previewFiles = useQuery(
    api.shared.preview,
    previewAvailable && previewOpen ? { token } : "skip",
  );

  const previewHtml = useMemo(() => {
    if (!previewFiles) return "";
    const map = new Map(previewFiles.map((f) => [f.path, f.content]));
    return buildPreviewHtml(map, project?.entryFile ?? null).html;
  }, [previewFiles, project?.entryFile]);

  const handlePreviewMessage = (msg: PreviewMessage) => {
    if (msg.type === "ready") return;
    const entry: PreviewLogLine | null =
      msg.type === "error"
        ? {
            id: ++previewLogId.current,
            level: "error",
            text: `Preview error: ${msg.message}${msg.line ? ` (line ${msg.line})` : ""}`,
          }
        : msg.type === "asset-error"
          ? {
              id: ++previewLogId.current,
              level: "error",
              text: `Missing asset: ${msg.src}`,
            }
          : msg.type === "console"
            ? {
                id: ++previewLogId.current,
                level: msg.level === "error" ? "error" : "info",
                text: `[${msg.level}] ${msg.text}`,
              }
            : null;
    if (!entry) return;
    setPreviewLog((prev) => [...prev.slice(-4), entry]);
  };

  const openFile = (path: string) => {
    setOpenPaths((prev) => (prev.includes(path) ? prev : [...prev, path]));
    setActivePath(path);
  };

  const closeTab = (path: string) => {
    const next = openPaths.filter((p) => p !== path);
    setOpenPaths(next);
    if (activePath === path) setActivePath(next[next.length - 1] ?? null);
  };

  const openPreview = () => {
    setPreviewOpen(true);
    setExplorerDrawerOpen(false);
    setPreviewLog([]);
    if (isNarrow) setMobilePreview(true);
  };

  usePageMeta({
    title: project
      ? `${project.name} — shared project · Cloud Studio Code`
      : "Shared project · Cloud Studio Code",
    description:
      "A read-only project shared from Cloud Studio Code: browse the files and preview the result without editing.",
    noindex: true,
  });

  if (project === undefined) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-6 text-center">
        <BrandMark size={28} />
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          <span className="text-sm">Opening shared project…</span>
        </div>
        <p className="max-w-xs text-xs text-muted-foreground/80">
          Loading a read-only copy of a Cloud Studio Code project. No account needed.
        </p>
      </div>
    );
  }

  if (project === null) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm rounded-xl border border-border/60 bg-card p-6 text-center">
          <Link2Off className="mx-auto size-7 text-muted-foreground/60" />
          <h1 className="mt-3 text-base font-semibold">This link isn&rsquo;t available</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            The share link is invalid, or it has been revoked. Links stop working as soon as the
            owner turns sharing off, and when the shared project is deleted. If someone sent it to
            you, ask them for a new one.
          </p>
          <Button asChild size="sm" className="mt-5 gap-1.5 bg-emerald-600 text-white hover:bg-emerald-500">
            <Link to="/">
              <Play className="size-3.5 fill-current" /> Create your own project
            </Link>
          </Button>
          <p className="mt-3 text-xs text-muted-foreground/80">
            Cloud Studio Code is a browser IDE — nothing to install.
          </p>
        </div>
      </div>
    );
  }

  const editorBody = (() => {
    if (fileCount === 0) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
          <FolderOpen className="size-7 text-muted-foreground/40" />
          <p className="text-sm font-medium text-foreground/80">This shared project is empty</p>
          <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
            The owner hasn&rsquo;t added any files yet, so there is nothing to browse or preview.
          </p>
          <Button asChild size="sm" variant="outline" className="mt-1 gap-1.5">
            <Link to="/">
              <Play className="size-3.5 fill-current" /> Create your own project
            </Link>
          </Button>
        </div>
      );
    }
    if (!activePath) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
          <FileCode2 className="size-7 text-muted-foreground/40" />
          <p className="text-sm text-foreground/80">Select a file to view its source</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            {previewAvailable
              ? "You can also open the live preview to see the project running."
              : "This is a read-only view of a shared project."}
          </p>
          {previewAvailable && (
            <Button size="sm" variant="outline" className="mt-1 gap-1.5" onClick={openPreview}>
              <Globe className="size-3.5" /> Open live preview
            </Button>
          )}
        </div>
      );
    }
    if (activeContent === undefined) {
      return (
        <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading file…
        </div>
      );
    }
    if (activeContent === null || activeContent.content === null) {
      return (
        <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
          {activeContent?.isBinary
            ? "Binary files aren’t included in a shared link."
            : "This file isn’t available in the shared view."}
        </div>
      );
    }
    const content = activeContent.content;
    return (
      <CodeEditor
        tab={{ path: activePath, content, draft: content }}
        onChange={() => undefined}
        onSave={() => undefined}
        onRun={() => undefined}
        theme={theme}
        onThemeToggle={toggleTheme}
        fontSize={viewFontSize}
        wordWrap={viewWordWrap}
        onFontSizeChange={(size) => setViewFontSize(Math.min(24, Math.max(10, size)))}
        onWordWrapToggle={() => setViewWordWrap((v) => !v)}
        compact={isNarrow}
        readOnly
      />
    );
  })();

  const previewBody = !previewAvailable ? (
    <div className="flex h-full flex-col items-center justify-center gap-2 bg-background px-6 text-center">
      <Globe className="size-7 text-muted-foreground/40" />
      <p className="text-sm font-medium text-foreground/80">No live preview for this project</p>
      <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">
        Live previews need an HTML entry file. Other project types are shared as source code only —
        running them stays with the owner.
      </p>
    </div>
  ) : previewHtml ? (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1">
        <PreviewPanel
          html={previewHtml}
          onMessage={handlePreviewMessage}
          onClose={() => {
            setPreviewOpen(false);
            if (isNarrow) setMobilePreview(false);
          }}
        />
      </div>
      {previewLog.length > 0 && (
        <div className="max-h-28 shrink-0 overflow-auto border-t border-border/60 bg-background px-3 py-1.5">
          <div className="flex items-center justify-between gap-2 pb-1">
            <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
              Preview output
            </span>
            <button
              className="text-[10px] text-muted-foreground hover:text-foreground"
              onClick={() => setPreviewLog([])}
            >
              Clear
            </button>
          </div>
          {previewLog.map((line) => (
            <div
              key={line.id}
              className={`font-mono text-[11px] leading-relaxed break-words whitespace-pre-wrap ${
                line.level === "error" ? "text-destructive" : "text-muted-foreground"
              }`}
            >
              {line.text}
            </div>
          ))}
        </div>
      )}
    </div>
  ) : (
    <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" /> Building preview…
    </div>
  );

  const tabStrip = (
    <div className="flex h-10 shrink-0 items-center gap-0.5 overflow-x-auto border-b border-border/60 bg-background px-1 md:h-9">
      {openPaths.length === 0 && (
        <span className="px-3 text-xs text-muted-foreground/70">No open files</span>
      )}
      {openPaths.map((path) => {
        const icon = fileIconMeta(path);
        return (
          <div
            key={path}
            className={`group flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-t-md border-b-2 px-2.5 text-xs md:h-7 ${
              activePath === path
                ? "border-sky-500 bg-foreground/5 text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground/80"
            }`}
            onClick={() => setActivePath(path)}
          >
            <span
              className="shrink-0 rounded-sm px-0.5 text-[8px] font-bold whitespace-nowrap"
              style={{ color: icon.color, border: `1px solid ${icon.color}55` }}
            >
              {icon.label}
            </span>
            <span className="max-w-[140px] truncate">{path.split("/").pop()}</span>
            <button
              className="ml-1 rounded p-1 hover:bg-foreground/10 md:p-0.5"
              onClick={(e) => {
                e.stopPropagation();
                closeTab(path);
              }}
              aria-label={`Close ${path}`}
            >
              <X className="size-3" />
            </button>
          </div>
        );
      })}
    </div>
  );

  const explorer = (
    <FileExplorer
      files={files}
      activeFile={activePath}
      openTabs={openPaths}
      dirtyPaths={new Set<string>()}
      onOpenFile={openFile}
      onCreate={() => undefined}
      onRename={async () => undefined}
      onDelete={async () => undefined}
      onDuplicate={() => undefined}
      onDownloadFile={() => undefined}
      readOnly
    />
  );

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      {/* Title bar */}
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border/60 bg-background px-2 sm:px-3">
        <BrandMark size={20} className="shrink-0" />
        <span className="hidden shrink-0 text-sm font-semibold sm:inline">
          Cloud Studio Code
        </span>
        <div className="mx-0.5 h-4 w-px shrink-0 bg-border/60" />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{project.name}</span>
        <Badge
          variant="outline"
          className="h-6 shrink-0 gap-1 border-border/60 px-1.5 text-[10px] font-medium text-muted-foreground"
          title="Shared read-only view — browse and preview, but not edit"
          aria-label="Read-only shared view"
        >
          <Eye className="size-3" />
          Read-only
        </Badge>
        <ThemeToggle theme={theme} onToggle={toggleTheme} />
        <Button
          asChild
          size="sm"
          className="h-8 shrink-0 gap-1.5 bg-emerald-600 text-white hover:bg-emerald-500"
          title="Open Cloud Studio Code to create your own project"
        >
          <Link to="/" aria-label="Start coding in Cloud Studio Code">
            <Play className="size-3.5 fill-current" />
            <span className="hidden sm:inline">Start coding</span>
          </Link>
        </Button>
      </header>

      {/* Main body */}
      <div className="min-h-0 flex-1">
        {isNarrow ? (
          <div className="flex h-full min-h-0 flex-col">
            {!mobilePreview ? (
              <>
                {tabStrip}
                <div className="min-h-0 flex-1 overflow-hidden">{editorBody}</div>
              </>
            ) : (
              <div className="min-h-0 flex-1">{previewBody}</div>
            )}
          </div>
        ) : (
          <PanelGroup direction="horizontal">
            <Panel defaultSize={22} minSize={14} maxSize={40}>
              {explorer}
            </Panel>
            <PanelResizeHandle className="w-px bg-border/60 data-[resize-handle-active]:bg-sky-500" />
            <Panel>
              <div className="flex h-full min-h-0 flex-col">
                {tabStrip}
                <div className="min-h-0 flex-1">
                  <PanelGroup direction="horizontal">
                    <Panel>{editorBody}</Panel>
                    {previewAvailable && previewOpen && (
                      <>
                        <PanelResizeHandle className="w-px bg-border/60 data-[resize-handle-active]:bg-sky-500" />
                        <Panel defaultSize={42} minSize={20}>
                          {previewBody}
                        </Panel>
                      </>
                    )}
                  </PanelGroup>
                </div>
              </div>
            </Panel>
          </PanelGroup>
        )}
      </div>

      {/* Status bar */}
      <footer className="flex h-8 shrink-0 items-center gap-3 overflow-x-auto border-t border-border/60 bg-background px-3 text-[11px] text-muted-foreground md:h-7">
        <div className="flex h-full items-center gap-3 md:hidden">
          <button
            className="flex h-full items-center gap-1 hover:text-foreground"
            onClick={() => setExplorerDrawerOpen(true)}
          >
            <Menu className="size-3.5" /> Files
          </button>
          <button
            className={`flex h-full items-center gap-1 hover:text-foreground ${!mobilePreview ? "text-sky-500" : ""}`}
            onClick={() => setMobilePreview(false)}
          >
            <FileCode2 className="size-3.5" /> Code
          </button>
          {previewAvailable && (
            <button
              className={`flex h-full items-center gap-1 hover:text-foreground ${mobilePreview ? "text-sky-500" : ""}`}
              onClick={openPreview}
            >
              <LayoutPanelLeft className="size-3.5" /> Preview
            </button>
          )}
        </div>
        <div className="hidden items-center gap-3 md:flex">
          <span className="flex items-center gap-1.5">
            <Eye className="size-3.5" /> Read-only
          </span>
          {previewAvailable && (
            <button
              className="flex items-center gap-1 hover:text-foreground"
              onClick={() => setPreviewOpen((v) => !v)}
            >
              <LayoutPanelLeft className="size-3.5" /> Preview
            </button>
          )}
        </div>
        {activePath && (
          <span className="hidden min-w-0 truncate sm:inline">{activePath}</span>
        )}
        <span className="ml-auto hidden min-w-0 truncate sm:inline">
          Shared project · {project.language}
          {fileCount > 0 ? ` · ${fileCount} file${fileCount === 1 ? "" : "s"}` : ""}
          {updatedAt > 0 ? ` · Updated ${formatRelativeTime(updatedAt)}` : ""}
        </span>
      </footer>

      {/* Mobile file browser */}
      <Sheet open={isNarrow && explorerDrawerOpen} onOpenChange={setExplorerDrawerOpen}>
        <SheetContent side="left" className="flex w-[86vw] max-w-xs flex-col gap-0 p-0 sm:max-w-sm">
          <SheetHeader className="border-b border-border/60 px-3 py-2">
            <SheetTitle className="text-sm">Files</SheetTitle>
          </SheetHeader>
          <div className="min-h-0 flex-1">
            <FileExplorer
              files={files}
              activeFile={activePath}
              openTabs={openPaths}
              dirtyPaths={new Set<string>()}
              onOpenFile={(path) => {
                openFile(path);
                setExplorerDrawerOpen(false);
                setMobilePreview(false);
              }}
              onCreate={() => undefined}
              onRename={async () => undefined}
              onDelete={async () => undefined}
              onDuplicate={() => undefined}
              onDownloadFile={() => undefined}
              readOnly
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
