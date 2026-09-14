// File tree construction + helpers shared by the explorer and IDE.

export type FileMeta = {
  _id: string;
  path: string;
  name: string;
  isFolder: boolean;
  size: number;
  updatedAt: number;
  isBinary?: boolean;
};

export type TreeNode = {
  id: string;
  path: string;
  name: string;
  isFolder: boolean;
  children: TreeNode[];
};

export function buildTree(files: FileMeta[]): TreeNode[] {
  const folderNodes = new Map<string, TreeNode>();
  const ensureFolder = (path: string): TreeNode => {
    let node = folderNodes.get(path);
    if (node) return node;
    node = { id: `folder:${path}`, path, name: path.split("/").pop()!, isFolder: true, children: [] };
    folderNodes.set(path, node);
    // attach to parent
    if (path.includes("/")) {
      const parentPath = path.slice(0, path.lastIndexOf("/"));
      ensureFolder(parentPath).children.push(node);
    }
    return node;
  };

  const rootFiles: TreeNode[] = [];
  const sorted = [...files].sort((a, b) => {
    if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  for (const f of sorted) {
    if (f.isFolder) {
      ensureFolder(f.path);
    } else {
      const node: TreeNode = {
        id: f._id,
        path: f.path,
        name: f.name,
        isFolder: false,
        children: [],
      };
      if (f.path.includes("/")) {
        const parentPath = f.path.slice(0, f.path.lastIndexOf("/"));
        ensureFolder(parentPath).children.push(node);
      } else {
        rootFiles.push(node);
      }
    }
  }

  const sortRecursive = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    nodes.forEach((n) => sortRecursive(n.children));
  };
  const roots: TreeNode[] = [...folderNodes.values()].filter((n) => !n.path.includes("/"));
  roots.push(...rootFiles);
  sortRecursive(roots);
  return roots;
}

export function flattenPaths(nodes: TreeNode[], prefix = ""): string[] {
  const out: string[] = [];
  for (const n of nodes) {
    out.push(n.path);
    out.push(...flattenPaths(n.children));
  }
  return out;
}

export function findNode(nodes: TreeNode[], path: string): TreeNode | null {
  for (const n of nodes) {
    if (n.path === path) return n;
    const hit = findNode(n.children, path);
    if (hit) return hit;
  }
  return null;
}

/** All descendant paths of a folder (excluding the folder itself). */
export function descendantsOf(files: FileMeta[], folderPath: string): string[] {
  return files
    .filter((f) => f.path.startsWith(folderPath + "/"))
    .map((f) => f.path);
}

// ---------------------------------------------------------------------------
// File-type icons (colored dot + label styling)
// ---------------------------------------------------------------------------

const ICON_MAP: Record<string, { color: string; label: string }> = {
  py: { color: "#4B8BBE", label: "PY" },
  js: { color: "#F7DF1E", label: "JS" },
  mjs: { color: "#F7DF1E", label: "JS" },
  cjs: { color: "#F7DF1E", label: "JS" },
  jsx: { color: "#61DAFB", label: "JSX" },
  ts: { color: "#3178C6", label: "TS" },
  tsx: { color: "#3178C6", label: "TSX" },
  c: { color: "#5C6BC0", label: "C" },
  h: { color: "#5C6BC0", label: "H" },
  cpp: { color: "#E76F51", label: "C++" },
  cc: { color: "#E76F51", label: "C++" },
  hpp: { color: "#E76F51", label: "H++" },
  java: { color: "#E76F00", label: "JAVA" },
  sh: { color: "#89E051", label: "SH" },
  bash: { color: "#89E051", label: "SH" },
  sql: { color: "#F29111", label: "SQL" },
  html: { color: "#E34C26", label: "</>" },
  htm: { color: "#E34C26", label: "</>" },
  css: { color: "#563D7C", label: "CSS" },
  scss: { color: "#C6538C", label: "SCSS" },
  json: { color: "#CBCB41", label: "{}" },
  md: { color: "#8DBCDF", label: "MD" },
  yml: { color: "#CB171E", label: "YML" },
  yaml: { color: "#CB171E", label: "YAML" },
  xml: { color: "#0060AC", label: "XML" },
  svg: { color: "#FFB13B", label: "SVG" },
  txt: { color: "#9CA3AF", label: "TXT" },
};

export function fileIconMeta(name: string): { color: string; label: string } {
  const dot = name.lastIndexOf(".");
  const ext = dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
  return ICON_MAP[ext] ?? { color: "#9CA3AF", label: "•" };
}
