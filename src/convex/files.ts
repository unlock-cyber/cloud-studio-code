import { v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import {
  peekActiveWorkspace,
  requireActiveWorkspace,
  assertQuota,
  formatBytes,
} from "./workspaces";
import { normalizePath } from "./projects";
import { deleteBlobIfUnreferenced } from "./blobCleanup";
import { Id } from "./_generated/dataModel";

const MAX_PATH_DEPTH = 12;
const MAX_SEGMENT_LENGTH = 80;
// Characters that are invalid in file names on any platform, plus path
// separators (paths use "/" and are split before this runs).
const INVALID_NAME_CHARS = /[\\:*?"<>|]/;

/**
 * Validates a normalized project-relative path. Shared by create, rename/move
 * and duplicate so no operation can introduce a path the explorer can't
 * render or that escapes the project. Returns the path segments.
 */
function validatePathSegments(norm: string): string[] {
  if (!norm) throw new Error("Enter a file or folder name.");
  const segments = norm.split("/");
  if (segments.length > MAX_PATH_DEPTH) {
    throw new Error(`Paths can be at most ${MAX_PATH_DEPTH} folders deep.`);
  }
  for (const segment of segments) {
    if (!segment || segment === "." || segment === "..") {
      throw new Error("Enter a valid file or folder name.");
    }
    if (segment.length > MAX_SEGMENT_LENGTH) {
      throw new Error(`Names can be at most ${MAX_SEGMENT_LENGTH} characters.`);
    }
    if (INVALID_NAME_CHARS.test(segment) || /[\u0000-\u001f]/.test(segment)) {
      throw new Error('Names can\'t contain \\ : * ? " < > |');
    }
    if (segment.trim() !== segment) {
      throw new Error("Names can't start or end with a space.");
    }
  }
  return segments;
}

/** Normalizes a user-supplied path and rejects unsafe/invalid results. */
function normalizeAndValidatePath(raw: string): string {
  if (/(^|[\\/])\.\.($|[\\/])/.test(raw)) {
    throw new Error('Paths can\'t contain "..".');
  }
  const norm = normalizePath(raw);
  validatePathSegments(norm);
  return norm;
}

/** Creates any missing parent folders for `segments` (mirrors create()). */
async function ensureParentFolders(
  ctx: MutationCtx,
  projectId: Id<"projects">,
  segments: string[],
  now: number,
) {
  for (let i = 1; i < segments.length; i++) {
    const folderPath = segments.slice(0, i).join("/");
    const exists = await ctx.db
      .query("files")
      .withIndex("by_project_path", (q) =>
        q.eq("projectId", projectId).eq("path", folderPath),
      )
      .first();
    if (!exists) {
      await ctx.db.insert("files", {
        projectId,
        path: folderPath,
        name: segments[i - 1],
        isFolder: true,
        size: 0,
        updatedAt: now,
      });
    }
  }
}

/** Inserts a copy of a file/folder doc at `targetPath` and returns the bytes
 *  to charge to the workspace.
 *
 *  Binary content is shared rather than re-uploaded: mutations can't read or
 *  store blobs (`storage.get`/`storage.store` are action-only in Convex),
 *  and a blob's contents are immutable once stored, so the copy is still a
 *  distinct file whose edits never touch the original. Deleting a copied file
 *  is reference-checked (see blobCleanup.ts), so it can't take the original's
 *  content with it. */
async function copyFileDoc(
  ctx: MutationCtx,
  projectId: Id<"projects">,
  source: { path: string; isFolder: boolean; content?: string; blobId?: Id<"_storage">; size: number },
  targetPath: string,
  now: number,
): Promise<number> {
  await ctx.db.insert("files", {
    projectId,
    path: targetPath,
    name: targetPath.split("/").pop()!,
    isFolder: source.isFolder,
    content: source.content,
    blobId: source.blobId,
    size: source.size,
    updatedAt: now,
  });
  return source.isFolder ? 0 : source.size;
}

/** "name copy.ext", "name copy 2.ext", … — first free path in the project. */
function uniqueCopyPath(sourcePath: string, taken: Set<string>): string {
  const slash = sourcePath.lastIndexOf("/");
  const parent = slash === -1 ? "" : sourcePath.slice(0, slash + 1);
  const name = sourcePath.slice(slash + 1);
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";
  let candidate = `${base} copy${ext}`;
  let n = 2;
  while (taken.has(parent + candidate)) {
    candidate = `${base} copy ${n++}${ext}`;
  }
  return parent + candidate;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export const listForProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const ws = await peekActiveWorkspace(ctx);
    if (!ws) throw new Error("WORKSPACE_EXPIRED");
    const project = await ctx.db.get(projectId);
    if (!project || project.workspaceId !== ws._id) {
      throw new Error("Project not found");
    }
    const files = await ctx.db
      .query("files")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
    return files.map((f) => ({
      _id: f._id,
      path: f.path,
      name: f.name,
      isFolder: f.isFolder,
      size: f.size,
      updatedAt: f.updatedAt,
      hasContent: f.isFolder || f.content !== undefined || f.blobId !== undefined,
      isBinary: !f.isFolder && f.content === undefined && f.blobId !== undefined,
    }));
  },
});

export const getContent = query({
  args: { projectId: v.id("projects"), path: v.string() },
  handler: async (ctx, { projectId, path }) => {
    const ws = await peekActiveWorkspace(ctx);
    if (!ws) throw new Error("WORKSPACE_EXPIRED");
    const project = await ctx.db.get(projectId);
    if (!project || project.workspaceId !== ws._id) {
      throw new Error("Project not found");
    }
    const file = await ctx.db
      .query("files")
      .withIndex("by_project_path", (q) =>
        q.eq("projectId", projectId).eq("path", normalizePath(path)),
      )
      .first();
    if (!file || file.isFolder) return null;
    return {
      path: file.path,
      content: file.content ?? null,
      isBinary: file.blobId !== undefined,
      blobId: file.blobId ?? null,
      size: file.size,
    };
  },
});

export const getBinaryUrl = query({
  args: { fileId: v.id("files") },
  handler: async (ctx, { fileId }) => {
    const file = await ctx.db.get(fileId);
    if (!file) return null;
    const ws = await peekActiveWorkspace(ctx);
    if (!ws) return null;
    const project = await ctx.db.get(file.projectId);
    if (!project || project.workspaceId !== ws._id) return null;
    return await ctx.storage.getUrl(file.blobId!);
  },
});

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export const create = mutation({
  args: {
    projectId: v.id("projects"),
    path: v.string(),
    isFolder: v.boolean(),
    content: v.optional(v.string()),
  },
  handler: async (ctx, { projectId, path, isFolder, content }) => {
    const ws = await requireActiveWorkspace(ctx);
    const project = await ctx.db.get(projectId);
    if (!project || project.workspaceId !== ws._id) {
      throw new Error("Project not found");
    }
    const norm = normalizeAndValidatePath(path);
    const segments = norm.split("/");
    const name = segments[segments.length - 1];

    const existing = await ctx.db
      .query("files")
      .withIndex("by_project_path", (q) =>
        q.eq("projectId", projectId).eq("path", norm),
      )
      .first();
    if (existing) throw new Error(`"${norm}" already exists`);

    const size = isFolder ? 0 : new Blob([content ?? ""]).size;
    await assertQuota(ws, size, 0);

    const now = Date.now();
    await ensureParentFolders(ctx, projectId, segments, now);

    const fileId = await ctx.db.insert("files", {
      projectId,
      path: norm,
      name,
      isFolder,
      content: isFolder ? undefined : (content ?? ""),
      size,
      updatedAt: now,
    });

    await touchWorkspace(ctx, ws, size);
    return { fileId, path: norm };
  },
});

export const save = mutation({
  args: {
    projectId: v.id("projects"),
    path: v.string(),
    content: v.string(),
  },
  handler: async (ctx, { projectId, path, content }) => {
    const ws = await requireActiveWorkspace(ctx);
    const project = await ctx.db.get(projectId);
    if (!project || project.workspaceId !== ws._id) {
      throw new Error("Project not found");
    }
    const norm = normalizePath(path);
    const file = await ctx.db
      .query("files")
      .withIndex("by_project_path", (q) =>
        q.eq("projectId", projectId).eq("path", norm),
      )
      .first();
    if (!file || file.isFolder) throw new Error(`"${norm}" not found`);

    const newSize = new Blob([content]).size;
    const oldSize = file.size;
    await assertQuota(ws, newSize, oldSize);

    const replacedBlobId = file.blobId;
    await ctx.db.patch(file._id, {
      content,
      blobId: undefined,
      size: newSize,
      updatedAt: Date.now(),
    });
    // Overwriting a binary file detaches its blob — free it only when no copy
    // elsewhere in the workspace still uses it.
    if (replacedBlobId) {
      await deleteBlobIfUnreferenced(ctx, ws._id, replacedBlobId);
    }
    await touchWorkspace(ctx, ws, newSize - oldSize);
    return { path: norm };
  },
});

export const rename = mutation({
  args: {
    projectId: v.id("projects"),
    path: v.string(),
    newPath: v.string(),
  },
  handler: async (ctx, { projectId, path, newPath }) => {
    const ws = await requireActiveWorkspace(ctx);
    const project = await ctx.db.get(projectId);
    if (!project || project.workspaceId !== ws._id) {
      throw new Error("Project not found");
    }
    const from = normalizePath(path);
    const to = normalizeAndValidatePath(newPath);
    if (to === from) return { path: to };

    const file = await ctx.db
      .query("files")
      .withIndex("by_project_path", (q) =>
        q.eq("projectId", projectId).eq("path", from),
      )
      .first();
    if (!file) throw new Error(`"${from}" not found`);

    if (file.isFolder && to.startsWith(from + "/")) {
      throw new Error("A folder can't be moved inside itself.");
    }

    const all = await ctx.db
      .query("files")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();

    // A folder takes its descendants with it; a rename/move is a re-path of
    // the entry plus everything under it.
    const moving = file.isFolder
      ? all.filter((f) => f.path === from || f.path.startsWith(from + "/"))
      : [file];
    const remaps = moving.map((f) => ({
      doc: f,
      newPath: f.path === from ? to : to + f.path.slice(from.length),
    }));

    // Reject a move that would land on top of existing entries: unlike a
    // rename inside one folder, a move can collide with anything already at
    // the destination.
    const movingIds = new Set(moving.map((f) => f._id));
    const collision = remaps.find((r) =>
      all.some((f) => !movingIds.has(f._id) && f.path === r.newPath),
    );
    if (collision) {
      throw new Error(`"${collision.newPath}" already exists — rename or remove it first.`);
    }

    const now = Date.now();
    await ensureParentFolders(ctx, projectId, to.split("/"), now);
    for (const r of remaps) {
      await ctx.db.patch(r.doc._id, {
        path: r.newPath,
        name: r.newPath.split("/").pop()!,
        updatedAt: now,
      });
    }

    // Keep the project's preview entry pointing at a real file.
    if (
      project.entryFile &&
      (project.entryFile === from || project.entryFile.startsWith(from + "/"))
    ) {
      const nextEntry =
        project.entryFile === from
          ? to
          : to + project.entryFile.slice(from.length);
      await ctx.db.patch(projectId, { entryFile: nextEntry });
    }

    await touchWorkspace(ctx, ws, 0);
    return { path: to };
  },
});

export const remove = mutation({
  args: { projectId: v.id("projects"), path: v.string() },
  handler: async (ctx, { projectId, path }) => {
    const ws = await requireActiveWorkspace(ctx);
    const project = await ctx.db.get(projectId);
    if (!project || project.workspaceId !== ws._id) {
      throw new Error("Project not found");
    }
    const norm = normalizePath(path);
    const file = await ctx.db
      .query("files")
      .withIndex("by_project_path", (q) =>
        q.eq("projectId", projectId).eq("path", norm),
      )
      .first();
    if (!file) throw new Error(`"${norm}" not found`);

    const all = await ctx.db
      .query("files")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
    const targets = file.isFolder
      ? [file, ...all.filter((f) => f.path.startsWith(norm + "/"))]
      : [file];

    let freed = 0;
    const blobIds: Id<"_storage">[] = [];
    for (const t of targets) {
      freed += t.size;
      if (t.blobId) blobIds.push(t.blobId);
      await ctx.db.delete(t._id);
    }
    // Blob cleanup runs after the docs are gone, and only for blobs nothing
    // else references (a duplicated file shares the same bytes).
    for (const blobId of blobIds) {
      await deleteBlobIfUnreferenced(ctx, ws._id, blobId);
    }

    // A deleted preview entry would leave the project pointing at nothing;
    // clearing it lets the preview fall back to any HTML file it can find.
    if (
      project.entryFile &&
      (project.entryFile === norm || project.entryFile.startsWith(norm + "/"))
    ) {
      await ctx.db.patch(projectId, { entryFile: undefined });
    }

    await touchWorkspace(ctx, ws, -freed);
    return { deleted: targets.length };
  },
});

export const duplicate = mutation({
  args: { projectId: v.id("projects"), path: v.string() },
  handler: async (ctx, { projectId, path }) => {
    const ws = await requireActiveWorkspace(ctx);
    const project = await ctx.db.get(projectId);
    if (!project || project.workspaceId !== ws._id) {
      throw new Error("Project not found");
    }
    const norm = normalizePath(path);
    const file = await ctx.db
      .query("files")
      .withIndex("by_project_path", (q) =>
        q.eq("projectId", projectId).eq("path", norm),
      )
      .first();
    if (!file) throw new Error(`"${norm}" not found`);

    const all = await ctx.db
      .query("files")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
    const taken = new Set(all.map((f) => f.path));

    // Folders copy with everything inside them; files copy alone.
    const sources = file.isFolder
      ? [file, ...all.filter((f) => f.path.startsWith(norm + "/"))]
      : [file];
    const neededBytes = sources
      .filter((f) => !f.isFolder)
      .reduce((sum, f) => sum + f.size, 0);
    await assertQuota(ws, neededBytes, 0);

    const now = Date.now();
    const newRoot = uniqueCopyPath(file.path, taken);
    await ensureParentFolders(ctx, projectId, newRoot.split("/"), now);

    let copiedBytes = 0;
    for (const source of sources) {
      const targetPath =
        source.path === file.path
          ? newRoot
          : newRoot + source.path.slice(file.path.length);
      copiedBytes += await copyFileDoc(ctx, projectId, source, targetPath, now);
    }

    await touchWorkspace(ctx, ws, copiedBytes);
    return { path: newRoot };
  },
});

async function touchWorkspace(
  ctx: any,
  ws: { _id: Id<"workspaces">; usedBytes: number; inactivityLimitMs: number },
  deltaBytes: number,
) {
  const now = Date.now();
  await ctx.db.patch(ws._id, {
    usedBytes: Math.max(0, ws.usedBytes + deltaBytes),
    lastActivityAt: now,
    expiresAt: now + ws.inactivityLimitMs,
  });
}

/** Bulk text contents for a project (drives editor tabs + web preview). */
export const getAllContents = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const ws = await peekActiveWorkspace(ctx);
    if (!ws) throw new Error("WORKSPACE_EXPIRED");
    const project = await ctx.db.get(projectId);
    if (!project || project.workspaceId !== ws._id) {
      throw new Error("Project not found");
    }
    const files = await ctx.db
      .query("files")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
    return files
      .filter((f) => !f.isFolder && f.content !== undefined)
      .map((f) => ({ path: f.path, content: f.content as string }));
  },
});

export const findByPath = query({
  args: { projectId: v.id("projects"), path: v.string() },
  handler: async (ctx, { projectId, path }) => {
    const ws = await peekActiveWorkspace(ctx);
    if (!ws) return null;
    const project = await ctx.db.get(projectId);
    if (!project || project.workspaceId !== ws._id) return null;
    const file = await ctx.db
      .query("files")
      .withIndex("by_project_path", (q) =>
        q.eq("projectId", projectId).eq("path", normalizePath(path)),
      )
      .first();
    if (!file) return null;
    return { _id: file._id, path: file.path, isFolder: file.isFolder, size: file.size };
  },
});
