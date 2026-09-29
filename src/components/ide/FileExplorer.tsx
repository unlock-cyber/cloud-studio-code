import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  Plus,
  Search,
  Trash2,
  Pencil,
  Copy,
  Download,
  ArrowRightLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  buildTree,
  fileIconMeta,
  type FileMeta,
  type TreeNode,
} from "@/lib/fileTree";
import { consumeFileDialog, subscribeFileDialogs } from "@/lib/fileActionBus";

type Props = {
  files: FileMeta[];
  activeFile: string | null;
  openTabs: string[];
  dirtyPaths: Set<string>;
  onOpenFile: (path: string) => void;
  onCreate: (parentFolder: string | null, isFolder: boolean) => void;
  /**
   * Renames and/or moves an entry. Rejects with an Error whose message is
   * safe to show the user (conflicts, invalid names, …) — the dialogs keep
   * the user's input and display it inline instead of closing silently.
   */
  onRename: (path: string, newPath: string) => Promise<void>;
  /** Deletes an entry (and, for folders, everything inside it). Rejects like `onRename`. */
  onDelete: (path: string) => Promise<void>;
  onDuplicate: (path: string) => void;
  onDownloadFile: (path: string) => void;
  /**
   * Read-only viewing (shared projects): no create/rename/delete/move actions
   * are rendered at all — the explorer becomes a pure file browser.
   */
  readOnly?: boolean;
};

const MAX_NAME_LENGTH = 80;
const INVALID_NAME = /[\\/:*?"<>|]/;
// Radix Select rejects empty-string item values, so the project root uses a
// sentinel and is mapped back to "" (no parent folder).
const ROOT_DESTINATION = "__root__";

/** Client-side mirror of the server's path rules, for instant feedback. */
function validateName(raw: string): string | null {
  const name = raw.trim();
  if (!name) return "Enter a file or folder name.";
  if (name.length > MAX_NAME_LENGTH) {
    return `Names can be at most ${MAX_NAME_LENGTH} characters.`;
  }
  if (INVALID_NAME.test(name)) {
    return 'Names can\'t contain \\ / : * ? " < > |';
  }
  if (name === "." || name === "..") return "That name isn't allowed.";
  return null;
}

export function FileExplorer({
  files,
  activeFile,
  openTabs,
  dirtyPaths,
  onOpenFile,
  onCreate,
  onRename,
  onDelete,
  onDuplicate,
  onDownloadFile,
  readOnly = false,
}: Props) {
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [renaming, setRenaming] = useState<{ path: string; isFolder: boolean; name: string } | null>(null);
  const [moving, setMoving] = useState<{ path: string; isFolder: boolean; dest: string } | null>(null);
  const [deleting, setDeleting] = useState<{ path: string; isFolder: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dialogs requested from elsewhere (the command palette) arrive through a
  // small channel, so this works for the desktop panel and the mobile drawer
  // alike — whichever one happens to be mounted.
  const filesRef = useRef(files);
  filesRef.current = files;
  useEffect(
    () =>
      subscribeFileDialogs((request) => {
        const { kind, path } = request;
        const isFolder = filesRef.current.find((f) => f.path === path)?.isFolder ?? false;
        setError(null);
        if (kind === "rename") {
          setRenaming({ path, isFolder, name: path.split("/").pop() ?? path });
        } else if (kind === "move") {
          const dest = path.includes("/")
            ? path.slice(0, path.lastIndexOf("/") + 1).replace(/\/$/, "")
            : "";
          setMoving({ path, isFolder, dest });
        } else {
          setDeleting({ path, isFolder });
        }
        consumeFileDialog(request.token);
      }),
    [],
  );

  const tree = useMemo(() => buildTree(files), [files]);

  const filteredTree = useMemo(() => {
    if (!query.trim()) return tree;
    const q = query.toLowerCase();
    return files
      .filter((f) => !f.isFolder && f.path.toLowerCase().includes(q))
      .map((f) => ({ id: f._id, path: f.path, name: f.name, isFolder: false, children: [] as TreeNode[] }));
  }, [tree, files, query]);

  const openTabsSet = useMemo(() => new Set(openTabs), [openTabs]);

  const toggleFolder = (path: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const parentOf = (path: string) =>
    path.includes("/") ? path.slice(0, path.lastIndexOf("/") + 1) : "";

  /** Close whichever dialog is open and clear its error state. */
  const closeDialogs = () => {
    setRenaming(null);
    setMoving(null);
    setDeleting(null);
    setError(null);
    setBusy(false);
  };

  const submitRename = async () => {
    if (!renaming) return;
    const name = renaming.name.trim();
    const invalid = validateName(name);
    if (invalid) {
      setError(invalid);
      return;
    }
    const newPath = parentOf(renaming.path) + name;
    if (newPath === renaming.path) {
      closeDialogs();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onRename(renaming.path, newPath);
      closeDialogs();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Rename failed. Please try again.");
      setBusy(false);
    }
  };

  const submitMove = async () => {
    if (!moving) return;
    const name = moving.path.split("/").pop() ?? moving.path;
    const newPath = moving.dest ? `${moving.dest}/${name}` : name;
    if (newPath === moving.path) {
      closeDialogs();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onRename(moving.path, newPath);
      closeDialogs();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Move failed. Please try again.");
      setBusy(false);
    }
  };

  const submitDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    setError(null);
    try {
      await onDelete(deleting.path);
      closeDialogs();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed. Please try again.");
      setBusy(false);
    }
  };

  // Move destinations: the project root plus every existing folder, minus
  // anything inside the entry being moved (a folder can't contain itself).
  const moveDestinations = useMemo(() => {
    const entry = moving?.path;
    const folders = files
      .filter((f) => f.isFolder)
      .map((f) => f.path)
      .filter((p) => !entry || (p !== entry && !p.startsWith(entry + "/")))
      .sort((a, b) => a.localeCompare(b));
    return ["", ...folders];
  }, [files, moving?.path]);

  const renderNode = (node: TreeNode, depth: number) => {
    const isCollapsed = collapsed.has(node.path);
    const isActive = !node.isFolder && activeFile === node.path;
    const isDirty = !node.isFolder && dirtyPaths.has(node.path);
    const isOpen = !node.isFolder && openTabsSet.has(node.path);
    const icon = fileIconMeta(node.name);

    const row = (
      <div
        className={`group flex h-9 cursor-pointer items-center gap-1.5 rounded-md pr-2 text-[13px] md:h-7 ${
          isActive ? "bg-sky-500/15 text-sky-700 dark:text-sky-200" : "text-foreground/80 hover:bg-foreground/5"
        }`}
        style={{ paddingLeft: 6 + depth * 12 }}
        onClick={() => (node.isFolder ? toggleFolder(node.path) : onOpenFile(node.path))}
      >
        {node.isFolder ? (
          <>
            {isCollapsed ? (
              <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
            )}
            {isCollapsed ? (
              <Folder className="size-3.5 shrink-0 text-sky-500 dark:text-sky-400/80" />
            ) : (
              <FolderOpen className="size-3.5 shrink-0 text-sky-500 dark:text-sky-400/80" />
            )}
            <span className="truncate">{node.name}</span>
          </>
        ) : (
          <>
            <span className="ml-[18px] inline-flex w-4 shrink-0 justify-center">
              <span
                className="rounded-sm px-0.5 text-[8px] font-bold leading-4 whitespace-nowrap shrink-0"
                style={{ color: icon.color, border: `1px solid ${icon.color}55` }}
              >
                {icon.label}
              </span>
            </span>
            <span
              className={`truncate ${
                isDirty ? "text-amber-600 dark:text-amber-300" : isOpen ? "" : "text-muted-foreground"
              }`}
            >
              {node.name}
            </span>
            {isDirty && <span className="text-[10px] text-amber-500 dark:text-amber-400">●</span>}
          </>
        )}
      </div>
    );

    return (
      <div key={node.id}>
        {readOnly ? (
          row
        ) : (
        <ContextMenu>
          <ContextMenuTrigger asChild>{row}</ContextMenuTrigger>
          <ContextMenuContent className="w-52">
            {!node.isFolder && (
              <ContextMenuItem onClick={() => onOpenFile(node.path)}>Open</ContextMenuItem>
            )}
            <ContextMenuItem onClick={() => { setError(null); setRenaming({ path: node.path, isFolder: node.isFolder, name: node.name }); }}>
              <Pencil className="mr-2 size-3.5" /> Rename
            </ContextMenuItem>
            <ContextMenuItem onClick={() => { setError(null); setMoving({ path: node.path, isFolder: node.isFolder, dest: parentOf(node.path).replace(/\/$/, "") }); }}>
              <ArrowRightLeft className="mr-2 size-3.5" /> Move to…
            </ContextMenuItem>
            <ContextMenuItem onClick={() => onDuplicate(node.path)}>
              <Copy className="mr-2 size-3.5" /> Duplicate
            </ContextMenuItem>
            {!node.isFolder && (
              <ContextMenuItem onClick={() => onDownloadFile(node.path)}>
                <Download className="mr-2 size-3.5" /> Download
              </ContextMenuItem>
            )}
            <ContextMenuSeparator />
            <ContextMenuItem className="text-destructive focus:text-destructive" onClick={() => { setError(null); setDeleting({ path: node.path, isFolder: node.isFolder }); }}>
              <Trash2 className="mr-2 size-3.5" /> Delete
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
        )}
        {node.isFolder && !isCollapsed && (
          <div>{node.children.map((child) => renderNode(child, depth + 1))}</div>
        )}
      </div>
    );
  };

  const fileCount = files.filter((f) => !f.isFolder).length;

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex h-11 shrink-0 items-center gap-1 border-b border-border/60 px-2 md:h-9">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Explorer</span>
        {!readOnly && (
          <div className="ml-auto flex items-center gap-0.5">
            <Button variant="ghost" size="sm" className="size-8 p-0 text-muted-foreground md:size-7" title="New file" onClick={() => onCreate(null, false)}>
              <Plus className="size-4" />
            </Button>
            <Button variant="ghost" size="sm" className="size-8 p-0 text-muted-foreground md:size-7" title="New folder" onClick={() => onCreate(null, true)}>
              <FolderPlusIcon />
            </Button>
          </div>
        )}
      </div>
      {fileCount > 0 && (
        <div className="px-2 pb-1 pt-1.5">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/60" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search files…"
              className="h-9 border-border/60 bg-white/[0.03] pl-7 text-xs md:h-7"
            />
          </div>
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-auto px-1.5 pb-2">
        {filteredTree.length === 0 ? (
          <div className="px-3 py-6 text-center">
            <p className="text-xs text-muted-foreground/70">
              {query ? "No files match your search." : "This project is empty."}
            </p>
            {!query && !readOnly && (
              <Button size="sm" variant="outline" className="mt-3 h-7 text-xs" onClick={() => onCreate(null, false)}>
                <Plus className="size-3.5" /> New file
              </Button>
            )}
          </div>
        ) : (
          filteredTree.map((node) => renderNode(node, 0))
        )}
      </div>

      {/* Rename dialog */}
      <Dialog open={renaming !== null} onOpenChange={(open) => !open && !busy && closeDialogs()}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">
              Rename {renaming?.isFolder ? "folder" : "file"}
            </DialogTitle>
            <DialogDescription>
              {renaming?.path} — files inside stay where they are.
            </DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            value={renaming?.name ?? ""}
            disabled={busy}
            onChange={(e) => setRenaming((r) => (r ? { ...r, name: e.target.value } : r))}
            onKeyDown={(e) => {
              if (e.key === "Enter") void submitRename();
              if (e.key === "Escape") closeDialogs();
            }}
          />
          {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
          <DialogFooter>
            <Button variant="ghost" size="sm" disabled={busy} onClick={closeDialogs}>Cancel</Button>
            <Button size="sm" disabled={busy} onClick={() => void submitRename()}>
              {busy ? "Renaming…" : "Rename"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move dialog */}
      <Dialog open={moving !== null} onOpenChange={(open) => !open && !busy && closeDialogs()}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">
              Move {moving?.isFolder ? "folder" : "file"}
            </DialogTitle>
            <DialogDescription>
              {moving?.path} — pick a destination folder. Existing folders inside a moved folder come along.
            </DialogDescription>
          </DialogHeader>
          <Select
            value={moving?.dest ? moving.dest : ROOT_DESTINATION}
            onValueChange={(value) =>
              setMoving((m) => (m ? { ...m, dest: value === ROOT_DESTINATION ? "" : value } : m))
            }
            disabled={busy}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="Project root" />
            </SelectTrigger>
            <SelectContent>
              {moveDestinations.map((dest) => (
                <SelectItem key={dest || ROOT_DESTINATION} value={dest || ROOT_DESTINATION}>
                  {dest || "Project root"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
          <DialogFooter>
            <Button variant="ghost" size="sm" disabled={busy} onClick={closeDialogs}>Cancel</Button>
            <Button size="sm" disabled={busy} onClick={() => void submitMove()}>
              {busy ? "Moving…" : "Move"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={deleting !== null} onOpenChange={(open) => !open && !busy && closeDialogs()}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Delete {deleting?.isFolder ? "folder" : "file"}</DialogTitle>
            <DialogDescription>
              {deleting?.isFolder
                ? `"${deleting?.path}" and everything inside it will be permanently deleted.`
                : `"${deleting?.path}" will be permanently deleted.`}
              {dirtyPaths.has(deleting?.path ?? "") && " It has unsaved changes."}
            </DialogDescription>
          </DialogHeader>
          {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
          <DialogFooter>
            <Button variant="ghost" size="sm" disabled={busy} onClick={closeDialogs}>Cancel</Button>
            <Button variant="destructive" size="sm" disabled={busy} onClick={() => void submitDelete()}>
              {busy ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FolderPlusIcon() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 20h10.5a2.5 2.5 0 0 0 2.5-2.5v-6.5a2 2 0 0 0-2-2h-7L8.4 5.6A2 2 0 0 0 6.8 5H4a2 2 0 0 0-2 2v10.5A2.5 2.5 0 0 0 4.5 20" />
      <path d="M12 10v6" />
      <path d="M9 13h6" />
    </svg>
  );
}
