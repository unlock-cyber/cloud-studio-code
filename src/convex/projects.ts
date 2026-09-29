import { v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import {
  peekActiveWorkspace,
  requireActiveWorkspace,
  formatBytes,
} from "./workspaces";
import { deleteBlobIfUnreferenced } from "./blobCleanup";
import { Id } from "./_generated/dataModel";

const MAX_PROJECT_NAME = 60;

/**
 * Validates AND normalizes a project name — callers persist the returned
 * value. Trimming happens here so a name can never be stored as blank or with
 * stray outer whitespace (which would render as an indistinguishable empty
 * title on the dashboard).
 */
function validateProjectName(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, " ");
  if (!trimmed || trimmed.length > MAX_PROJECT_NAME) {
    throw new Error(`Project name must be 1-${MAX_PROJECT_NAME} characters`);
  }
  if (/[\\/:*?"<>|]/.test(trimmed)) {
    throw new Error('Project name contains invalid characters: \\ / : * ? " < > |');
  }
  return trimmed;
}

/** Project names are listed side by side, so renaming into a name another
 *  active project already uses is rejected with a clear message instead of
 *  silently producing two identical-looking entries. */
async function assertProjectNameIsFree(
  ctx: MutationCtx,
  workspaceId: Id<"workspaces">,
  name: string,
  exceptProjectId?: Id<"projects">,
) {
  const projects = await ctx.db
    .query("projects")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
    .collect();
  const taken = projects.some(
    (p) =>
      p._id !== exceptProjectId &&
      p.status === "active" &&
      p.name.trim().toLowerCase() === name.toLowerCase(),
  );
  if (taken) {
    throw new Error(`A project named "${name}" already exists — choose another name.`);
  }
}

/** "<base>", "<base> 2", "<base> 3" … — the first name this workspace has free. */
async function uniqueProjectName(
  ctx: MutationCtx,
  workspaceId: Id<"workspaces">,
  base: string,
): Promise<string> {
  const projects = await ctx.db
    .query("projects")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
    .collect();
  const taken = new Set(
    projects.filter((p) => p.status === "active").map((p) => p.name.trim().toLowerCase()),
  );
  let candidate = base.slice(0, MAX_PROJECT_NAME).trim() || "Copy";
  let n = 2;
  while (taken.has(candidate.toLowerCase())) {
    const suffix = ` ${n++}`;
    candidate = base.slice(0, MAX_PROJECT_NAME - suffix.length).trim() + suffix;
  }
  return candidate;
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
    const projectName = validateProjectName(name);

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
      name: projectName,
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
    const projectName = validateProjectName(name);
    if (projectName !== project.name) {
      await assertProjectNameIsFree(ctx, ws._id, projectName, projectId);
    }
    // Renaming only touches the project's display name — files, folders,
    // template, entry file and session are left exactly as they are.
    await ctx.db.patch(projectId, { name: projectName });
    return { name: projectName };
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
    const blobIds: Id<"_storage">[] = [];
    for (const f of files) {
      freed += f.size;
      if (f.blobId) blobIds.push(f.blobId);
      await ctx.db.delete(f._id);
    }
    const dbs = await ctx.db
      .query("sqlDatabases")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
    .collect();
    for (const db of dbs) {
      freed += db.size;
      blobIds.push(db.blobId);
      await ctx.db.delete(db._id);
    }
    await ctx.db.delete(projectId);
    // Only now that the documents are gone: free the blobs, skipping any that
    // a duplicated project (or duplicated file) still points at.
    for (const blobId of blobIds) {
      await deleteBlobIfUnreferenced(ctx, ws._id, blobId);
    }
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
    const fileBytes = files
      .filter((f) => !f.isFolder)
      .reduce((sum, f) => sum + f.size, 0);
    if (fileBytes > ws.storageLimitBytes - ws.usedBytes) {
      throw new Error("Not enough storage left to duplicate this project");
    }

    const now = Date.now();
    const newId = await ctx.db.insert("projects", {
      workspaceId: ws._id,
      name: await uniqueProjectName(ctx, ws._id, `${project.name} copy`),
      template: project.template,
      language: project.language,
      entryFile: project.entryFile,
      status: "active",
      createdAt: now,
      lastOpenedAt: now,
      // The copy opens with the same editor session, so it feels like a
      // continuation rather than a blank project.
      openTabs: project.openTabs,
      activeFile: project.activeFile,
    });

    // Every file gets its own document. Binary files share the underlying
    // storage blob: a stored blob is immutable and content-addressed, and
    // mutations can't re-upload one (storage.get/store are action-only), so
    // sharing is what keeps the copy byte-identical. Deletion is
    // reference-checked (see blobCleanup.ts), and writing to a file in either
    // project only touches that project's own document — so the duplicate
    // behaves as a fully independent project and the original is untouched.
    let copiedBytes = 0;
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
      if (!f.isFolder) copiedBytes += f.size;
    }

    await ctx.db.patch(ws._id, {
      usedBytes: Math.max(0, ws.usedBytes + copiedBytes),
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
// Read-only sharing (owner side)
// ---------------------------------------------------------------------------

/**
 * Opaque, unguessable share token. Random, never derived from (and never
 * equal to) any database id — a leaked link only ever grants read access to
 * the one project it was created for, and only until the owner revokes it.
 */
function newShareToken(): string {
  return (
    crypto.randomUUID().replace(/-/g, "") +
    crypto.randomUUID().replace(/-/g, "")
  );
}

/**
 * Owner-only share state. The token is returned to the owner so the link can
 * be re-copied later; it is never exposed to anyone else (every other project
 * response omits it, and the public shared queries only accept it as input).
 */
export const getShare = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const ws = await peekActiveWorkspace(ctx);
    if (!ws) return { enabled: false, token: null };
    const project = await ctx.db.get(projectId);
    if (!project || project.workspaceId !== ws._id) {
      throw new Error("Project not found");
    }
    return {
      enabled: project.shareToken !== undefined,
      token: project.shareToken ?? null,
    };
  },
});

/**
 * Enable or revoke read-only sharing for a project. Ownership is enforced
 * exactly like every other project mutation, so a viewer who somehow obtained
 * the share link still cannot call this.
 *
 * Enabling always mints a fresh token: a revoked link can never come back to
 * life, and re-sharing produces a new URL.
 */
export const setSharing = mutation({
  args: { projectId: v.id("projects"), enabled: v.boolean() },
  handler: async (ctx, { projectId, enabled }) => {
    const ws = await requireActiveWorkspace(ctx);
    const project = await ctx.db.get(projectId);
    if (!project || project.workspaceId !== ws._id) {
      throw new Error("Project not found");
    }
    if (!enabled) {
      if (project.shareToken !== undefined) {
        await ctx.db.patch(projectId, { shareToken: undefined });
      }
      return { enabled: false, token: null };
    }
    const token = newShareToken();
    await ctx.db.patch(projectId, { shareToken: token });
    return { enabled: true, token };
  },
});

// ---------------------------------------------------------------------------
// ZIP import lives in importExport.ts (server-side extraction + validation)
// ---------------------------------------------------------------------------
