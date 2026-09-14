import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  peekActiveWorkspace,
  requireActiveWorkspace,
  assertQuota,
  formatBytes,
} from "./workspaces";
import { normalizePath } from "./projects";
import { Id } from "./_generated/dataModel";

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
    const norm = normalizePath(path);
    if (!norm) throw new Error("Invalid path");
    const segments = norm.split("/");
    if (segments.length > 12) throw new Error("Path too deep (max 12 levels)");
    const name = segments[segments.length - 1];
    if (name.length > 80) throw new Error("File name too long (max 80 chars)");

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
    // Create parent folders as needed
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

    await ctx.db.patch(file._id, {
      content,
      blobId: undefined,
      size: newSize,
      updatedAt: Date.now(),
    });
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
    const to = normalizePath(newPath);
    if (!to) throw new Error("Invalid path");

    const file = await ctx.db
      .query("files")
      .withIndex("by_project_path", (q) =>
        q.eq("projectId", projectId).eq("path", from),
      )
      .first();
    if (!file) throw new Error(`"${from}" not found`);

    const conflict = await ctx.db
      .query("files")
      .withIndex("by_project_path", (q) =>
        q.eq("projectId", projectId).eq("path", to),
      )
      .first();
    if (conflict) throw new Error(`"${to}" already exists`);

    // moving a folder must move all descendants
    const all = await ctx.db
      .query("files")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
    const descendants = all.filter((f) =>
      f.isFolder ? to.startsWith(f.path + "/") : false,
    );
    if (file.isFolder) {
      // prevent moving folder into itself
      if (to.startsWith(from + "/")) {
        throw new Error("Cannot move a folder into itself");
      }
    }
    void descendants;

    const now = Date.now();
    if (file.isFolder) {
      const children = all.filter((f) => f.path.startsWith(from + "/"));
      for (const child of children) {
        const childNewPath = to + child.path.slice(from.length);
        await ctx.db.patch(child._id, {
          path: childNewPath,
          name: childNewPath.split("/").pop()!,
          updatedAt: now,
        });
      }
    }
    await ctx.db.patch(file._id, {
      path: to,
      name: to.split("/").pop()!,
      updatedAt: now,
    });
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
    for (const t of targets) {
      freed += t.size;
      if (t.blobId) await ctx.storage.delete(t.blobId);
      await ctx.db.delete(t._id);
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
    if (!file || file.isFolder) throw new Error("Only files can be duplicated");

    // find non-conflicting copy name: "name copy.ext", "name copy 2.ext", ...
    const all = await ctx.db
      .query("files")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
    const dot = file.name.lastIndexOf(".");
    const base = dot > 0 ? file.name.slice(0, dot) : file.name;
    const ext = dot > 0 ? file.name.slice(dot) : "";
    let copyName = `${base} copy${ext}`;
    let n = 2;
    while (all.some((f) => f.path === copyName)) {
      copyName = `${base} copy ${n}${ext}`;
      n++;
    }
    const newPath = copyName.includes("/")
      ? copyName
      : file.path.includes("/")
        ? file.path.slice(0, file.path.lastIndexOf("/") + 1) + copyName
        : copyName;

    await assertQuota(ws, file.size, 0);
    const now = Date.now();
    await ctx.db.insert("files", {
      projectId,
      path: newPath,
      name: copyName,
      isFolder: false,
      content: file.content,
      size: file.size,
      updatedAt: now,
    });
    await touchWorkspace(ctx, ws, file.size);
    return { path: newPath };
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
