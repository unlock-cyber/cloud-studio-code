import { useMemo, useState } from "react";
import {
  ChevronRight,
  ChevronDown,
  File as FileIcon,
  Folder,
  FolderOpen,
  Plus,
  Search,
  Trash2,
  Pencil,
  Copy,
  Download,
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
  buildTree,
  fileIconMeta,
  type FileMeta,
  type TreeNode,
} from "@/lib/fileTree";

type Props = {
  files: FileMeta[];
  activeFile: string | null;
  openTabs: string[];
  dirtyPaths: Set<string>;
  onOpenFile: (path: string) => void;
  onCreate: (parentFolder: string | null, isFolder: boolean) => void;
  /** Called with (oldPath, newPath) once the user confirms the rename/move dialog. */
  onRename: (path: string, newPath: string) => void;
  onDelete: (path: string) => void;
  onDuplicate: (path: string) => void;
  onDownloadFile: (path: string) => void;
};

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
}: Props) {
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [renaming, setRenaming] = useState<{ path: string; isFolder: boolean; value: string } | null>(null);
  const [deleting, setDeleting] = useState<{ path: string; isFolder: boolean } | null>(null);

  const tree = useMemo(() => buildTree(files), [files]);

  const filteredTree = useMemo(() => {
    if (!query.trim()) return tree;
    const q = query.toLowerCase();
    return files
      .filter((f) => !f.isFolder && f.path.toLowerCase().includes(q))
      .map((f) => ({ id: f._id, path: f.path, name: f.name, isFolder: false, children: [] as TreeNode[] }));
  }, [tree, files, query]);

  const toggleFolder = (path: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const renderNode = (node: TreeNode, depth: number) => {
    const isCollapsed = collapsed.has(node.path);
    const isActive = !node.isFolder && activeFile === node.path;
    const isDirty = !node.isFolder && dirtyPaths.has(node.path);
    const icon = fileIconMeta(node.name);

    const row = (
      <div
        className={`group flex h-7 cursor-pointer items-center gap-1.5 rounded-md pr-2 text-[13px] ${
          isActive ? "bg-sky-500/15 text-sky-200" : "text-zinc-300 hover:bg-white/5"
        }`}
        style={{ paddingLeft: 6 + depth * 12 }}
        onClick={() => (node.isFolder ? toggleFolder(node.path) : onOpenFile(node.path))}
      >
        {node.isFolder ? (
          <>
            {isCollapsed ? (
              <ChevronRight className="size-3.5 shrink-0 text-zinc-500" />
            ) : (
              <ChevronDown className="size-3.5 shrink-0 text-zinc-500" />
            )}
            {isCollapsed ? (
              <Folder className="size-3.5 shrink-0 text-sky-400/80" />
            ) : (
              <FolderOpen className="size-3.5 shrink-0 text-sky-400/80" />
            )}
            <span className="truncate">{node.name}</span>
          </>
        ) : (
          <>
            <span className="ml-[18px] inline-flex w-4 shrink-0 justify-center">
              <span
                className="rounded-sm px-0.5 text-[8px] font-bold leading-4"
                style={{ color: icon.color, border: `1px solid ${icon.color}55` }}
              >
                {icon.label}
              </span>
            </span>
            <span className={`truncate ${isDirty ? "text-amber-300" : ""}`}>{node.name}</span>
            {isDirty && <span className="text-[10px] text-amber-400">●</span>}
          </>
        )}
      </div>
    );

    return (
      <div key={node.id}>
        <ContextMenu>
          <ContextMenuTrigger asChild>{row}</ContextMenuTrigger>
          <ContextMenuContent className="w-48">
            {!node.isFolder && (
              <ContextMenuItem onClick={() => onOpenFile(node.path)}>Open</ContextMenuItem>
            )}
            <ContextMenuItem onClick={() => setRenaming({ path: node.path, isFolder: node.isFolder, value: node.name })}>
              <Pencil className="mr-2 size-3.5" /> Rename / Move
            </ContextMenuItem>
            {!node.isFolder && (
              <ContextMenuItem onClick={() => onDuplicate(node.path)}>
                <Copy className="mr-2 size-3.5" /> Duplicate
              </ContextMenuItem>
            )}
            {!node.isFolder && (
              <ContextMenuItem onClick={() => onDownloadFile(node.path)}>
                <Download className="mr-2 size-3.5" /> Download
              </ContextMenuItem>
            )}
            <ContextMenuSeparator />
            <ContextMenuItem className="text-red-400 focus:text-red-300" onClick={() => setDeleting({ path: node.path, isFolder: node.isFolder })}>
              <Trash2 className="mr-2 size-3.5" /> Delete
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
        {node.isFolder && !isCollapsed && (
          <div>{node.children.map((child) => renderNode(child, depth + 1))}</div>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-full flex-col bg-[#0D1117]">
      <div className="flex h-9 shrink-0 items-center gap-1 border-b border-border/60 px-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Explorer</span>
        <div className="ml-auto flex items-center gap-0.5">
          <Button variant="ghost" size="sm" className="size-7 p-0 text-zinc-400" title="New file" onClick={() => onCreate(null, false)}>
            <Plus className="size-4" />
          </Button>
          <Button variant="ghost" size="sm" className="size-7 p-0 text-zinc-400" title="New folder" onClick={() => onCreate(null, true)}>
            <FolderPlusIcon />
          </Button>
        </div>
      </div>
      <div className="px-2 pb-1 pt-1.5">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-zinc-600" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search files…"
            className="h-7 border-border/60 bg-white/[0.03] pl-7 text-xs"
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-1.5 pb-2">
        {filteredTree.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-zinc-600">
            {query ? "No files match your search." : "No files yet — create one with + above."}
          </p>
        ) : (
          filteredTree.map((node) => renderNode(node, 0))
        )}
      </div>

      {/* Rename / move dialog: accepts nested paths like folder/name.ext */}
      <Dialog open={renaming !== null} onOpenChange={(open) => !open && setRenaming(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">{renaming?.isFolder ? "Rename / move folder" : "Rename / move file"}</DialogTitle>
            <DialogDescription>
              Enter a new name — or a full path (e.g. <code>src/utils/helpers.ts</code>) to move it.
            </DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            value={renaming?.value ?? ""}
            onChange={(e) => setRenaming((r) => (r ? { ...r, value: e.target.value } : r))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && renaming) {
                const parent = renaming.path.includes("/") ? renaming.path.slice(0, renaming.path.lastIndexOf("/") + 1) : "";
                onRename(renaming.path, parent + renaming.value.replace(/^\/+/, ""));
                setRenaming(null);
              }
            }}
          />
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setRenaming(null)}>Cancel</Button>
            <Button
              size="sm"
              onClick={() => {
                if (!renaming) return;
                const parent = renaming.path.includes("/") ? renaming.path.slice(0, renaming.path.lastIndexOf("/") + 1) : "";
                onRename(renaming.path, parent + renaming.value.replace(/^\/+/, ""));
                setRenaming(null);
              }}
            >
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Delete {deleting?.isFolder ? "folder" : "file"}</DialogTitle>
            <DialogDescription>
              {deleting?.isFolder
                ? `"${deleting?.path}" and everything inside it will be permanently deleted.`
                : `"${deleting?.path}" will be permanently deleted.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setDeleting(null)}>Cancel</Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (deleting) onDelete(deleting.path);
                setDeleting(null);
              }}
            >
              Delete
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
