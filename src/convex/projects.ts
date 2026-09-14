import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  peekActiveWorkspace,
  requireActiveWorkspace,
  formatBytes,
} from "./workspaces";
import { Id } from "./_generated/dataModel";

const MAX_PROJECT_NAME = 60;

function validateProjectName(name: string) {
  if (!name || name.length > MAX_PROJECT_NAME) {
    throw new Error(`Project name must be 1-${MAX_PROJECT_NAME} characters`);
  }
  if (/[\\/:*?"<>|]/.test(name)) {
    throw new Error('Project name contains invalid characters: \\ / : * ? " < > |');
  }
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export const list = query({
  args: {},
  handler: async (ctx) => {
    const ws = await peekActiveWorkspace(ctx);
    if (!ws) return [];
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", ws._id))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();
    return projects
      .sort((a, b) => b.lastOpenedAt - a.lastOpenedAt)
      .map((p) => ({
        _id: p._id,
        name: p.name,
        template: p.template,
        language: p.language,
        entryFile: p.entryFile ?? null,
        createdAt: p.createdAt,
        lastOpenedAt: p.lastOpenedAt,
        status: p.status,
      }));
  },
});

export const get = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const ws = await peekActiveWorkspace(ctx);
    if (!ws) return null;
    const project = await ctx.db.get(projectId);
    if (!project || project.workspaceId !== ws._id) return null;
    return {
      _id: project._id,
      name: project.name,
      template: project.template,
      language: project.language,
      entryFile: project.entryFile ?? null,
      openTabs: project.openTabs ?? null,
      activeFile: project.activeFile ?? null,
      lastOpenedAt: project.lastOpenedAt,
    };
  },
});

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export const create = mutation({
  args: {
    name: v.string(),
    template: v.string(),
    language: v.string(),
    files: v.array(v.object({ path: v.string(), content: v.string() })),
    entryFile: v.optional(v.string()),
  },
  handler: async (ctx, { name, template, language, files, entryFile }) => {
    const ws = await requireActiveWorkspace(ctx);
    validateProjectName(name);

    const totalBytes = files.reduce(
      (sum, f) => sum + new Blob([f.content]).size,
      0,
    );
    if (totalBytes > ws.storageLimitBytes - ws.usedBytes) {
      throw new Error(
        `Not enough storage left for this project (needs ${formatBytes(totalBytes)}, ${formatBytes(ws.storageLimitBytes - ws.usedBytes)} free).`,
      );
    }

    const now = Date.now();
    const projectId = await ctx.db.insert("projects", {
      workspaceId: ws._id,
      name,
      template,
      language,
      entryFile,
      status: "active",
      createdAt: now,
      lastOpenedAt: now,
    });

    for (const f of files) {
      await insertFileInternal(ctx, projectId, f.path, f.content);
    }

    await ctx.db.patch(ws._id, {
      usedBytes: ws.usedBytes + totalBytes,
      lastActivityAt: now,
      expiresAt: now + ws.inactivityLimitMs,
    });

    return projectId;
  },
});async function insertFileInternal(
  ctx: any,
  projectId: Id<"projects">,
  rawPath: string,
  content: string,
) {
  const path = normalizePath(rawPath);
  const segments = path.split("/");
  // Auto-create parent folders
  for (let i = 1; i < segments.length; i++) {
    const folderPath = segments.slice(0, i).join("/");
    const existing = await ctx.db
      .query("files")
      .withIndex("by_project_path", (q: any) =>
        q.eq("projectId", projectId).eq("path", folderPath),
      )
      .first();
    if (!existing) {
      await ctx.db.insert("files", {
        projectId,
        path: folderPath,
        name: segments[i - 1],
        isFolder: true,
        size: 0,
        updatedAt: Date.now(),
      });
    }
  }

  const now = Date.now();
  await ctx.db.insert("files", {
    projectId,
    path,
    name: segments[segments.length - 1],
    isFolder: false,
    content,
    size: new Blob([content]).size,
    updatedAt: now,
  });
}

export function normalizePath(p: string): string {
  return p
    .replace(/\\/g, "/")
    .split("/")
    .filter((s) => s.length > 0 && s !== "." && s !== "..")
    .join("/");
}

export const rename = mutation({
  args: { projectId: v.id("projects"), name: v.string() },
  handler: async (ctx, { projectId, name }) => {
    const ws = await requireActiveWorkspace(ctx);
    const project = await ctx.db.get(projectId);
    if (!project || project.workspaceId !== ws._id) {
      throw new Error("Project not found");
    }
    validateProjectName(name);
    await ctx.db.patch(projectId, { name });
  },
});

export const remove = mutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const ws = await requireActiveWorkspace(ctx);
    const project = await ctx.db.get(projectId);
    if (!project || project.workspaceId !== ws._id) {
      throw new Error("Project not found");
    }
    const files = await ctx.db
      .query("files")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
    let freed = 0;
    for (const f of files) {
      freed += f.size;
      if (f.blobId) await ctx.storage.delete(f.blobId);
      await ctx.db.delete(f._id);
    }
    const dbs = await ctx.db
      .query("sqlDatabases")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
    .collect();
    for (const db of dbs) {
      freed += db.size;
      await ctx.storage.delete(db.blobId);
      await ctx.db.delete(db._id);
    }
    await ctx.db.delete(projectId);
    await ctx.db.patch(ws._id, {
      usedBytes: Math.max(0, ws.usedBytes - freed),
      lastActivityAt: Date.now(),
      expiresAt: Date.now() + ws.inactivityLimitMs,
    });
  },
});

export const duplicate = mutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const ws = await requireActiveWorkspace(ctx);
    const project = await ctx.db.get(projectId);
    if (!project || project.workspaceId !== ws._id) {
      throw new Error("Project not found");
    }
    const files = await ctx.db
      .query("files")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();

    const totalBytes = files
      .filter((f) => !f.isFolder)
      .reduce((sum, f) => sum + f.size, 0);
    if (totalBytes > ws.storageLimitBytes - ws.usedBytes) {
      throw new Error("Not enough storage left to duplicate this project");
    }

    const now = Date.now();
    const newId = await ctx.db.insert("projects", {
      workspaceId: ws._id,
      name: `${project.name} copy`,
      template: project.template,
      language: project.language,
      entryFile: project.entryFile,
      status: "active",
      createdAt: now,
      lastOpenedAt: now,
    });
    for (const f of files) {
      await ctx.db.insert("files", {
        projectId: newId,
        path: f.path,
        name: f.name,
        isFolder: f.isFolder,
        content: f.content,
        blobId: f.blobId,
        size: f.size,
        updatedAt: now,
      });
    }
    await ctx.db.patch(ws._id, {
      usedBytes: ws.usedBytes + totalBytes,
      lastActivityAt: now,
      expiresAt: now + ws.inactivityLimitMs,
    });
    return newId;
  },
});

export const setSession = mutation({
  args: {
    projectId: v.id("projects"),
    openTabs: v.optional(v.array(v.string())),
    activeFile: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, { projectId, openTabs, activeFile }) => {
    const ws = await requireActiveWorkspace(ctx);
    const project = await ctx.db.get(projectId);
    if (!project || project.workspaceId !== ws._id) return;
    const patch: Record<string, unknown> = {};
    if (openTabs !== undefined) patch.openTabs = openTabs;
    if (activeFile !== undefined) patch.activeFile = activeFile ?? undefined;
    patch.lastOpenedAt = Date.now();
    await ctx.db.patch(projectId, patch);
  },
});

export const setEntryFile = mutation({
  args: { projectId: v.id("projects"), entryFile: v.string() },
  handler: async (ctx, { projectId, entryFile }) => {
    const ws = await requireActiveWorkspace(ctx);
    const project = await ctx.db.get(projectId);
    if (!project || project.workspaceId !== ws._id) {
      throw new Error("Project not found");
    }
    await ctx.db.patch(projectId, { entryFile });
  },
});

// ---------------------------------------------------------------------------
// ZIP import lives in importExport.ts (server-side extraction + validation)
// ---------------------------------------------------------------------------
