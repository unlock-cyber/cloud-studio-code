import { v } from "convex/values";
import { action, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireActiveWorkspace } from "./workspaces";
import type { Id } from "./_generated/dataModel";

// Persistent per-project SQLite database (sql.js export bytes in blob storage).
// Blob reads/writes happen in actions; DB metadata lives in queries/mutations.

export const getDb = internalQuery({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const rec = await ctx.db
      .query("sqlDatabases")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .first();
    if (!rec) return null;
    return {
      _id: rec._id,
      blobId: rec.blobId,
      size: rec.size,
      updatedAt: rec.updatedAt,
    };
  },
});

/** Client-facing: does this project have a persisted SQL database? */
export const hasDb = internalQuery({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const rec = await ctx.db
      .query("sqlDatabases")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .first();
    return rec ? { size: rec.size, updatedAt: rec.updatedAt } : null;
  },
});

export const saveDb = action({
  args: {
    projectId: v.id("projects"),
    // base64 of the exported sqlite db (actions can't take binary args)
    dataBase64: v.string(),
    size: v.number(),
  },
  handler: async (
    ctx,
    { projectId, dataBase64, size },
  ): Promise<{ ok: boolean }> => {
    const ws = await requireActiveWorkspace(ctx as never);
    const binary = Uint8Array.from(atob(dataBase64), (c) => c.charCodeAt(0));
    const blobId = await ctx.storage.store(new Blob([binary as BlobPart]));

    await ctx.runMutation(internal.sqlDb.saveDbInternal, {
      projectId,
      blobId,
      size,
      workspaceId: ws._id,
    });
    return { ok: true };
  },
});

export const saveDbInternal = internalMutation({
  args: {
    projectId: v.id("projects"),
    blobId: v.id("_storage"),
    size: v.number(),
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, { projectId, blobId, size, workspaceId }) => {
    const ws = await ctx.db.get(workspaceId);
    if (!ws) throw new Error("WORKSPACE_EXPIRED");
    const project = await ctx.db.get(projectId);
    if (!project || project.workspaceId !== workspaceId) {
      throw new Error("Project not found");
    }

    const existing = await ctx.db
      .query("sqlDatabases")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .first();

    const now = Date.now();
    if (existing) {
      const delta = size - existing.size;
      await ctx.storage.delete(existing.blobId);
      await ctx.db.patch(existing._id, { blobId, size, updatedAt: now });
      await ctx.db.patch(workspaceId, {
        usedBytes: Math.max(0, ws.usedBytes + delta),
        lastActivityAt: now,
        expiresAt: now + ws.inactivityLimitMs,
      });
    } else {
      await ctx.db.insert("sqlDatabases", {
        projectId,
        blobId,
        size,
        updatedAt: now,
      });
      await ctx.db.patch(workspaceId, {
        usedBytes: ws.usedBytes + size,
        lastActivityAt: now,
        expiresAt: now + ws.inactivityLimitMs,
      });
    }
    return { ok: true };
  },
});

export const loadDbBytes = action({
  args: { projectId: v.id("projects") },
  handler: async (
    ctx,
    { projectId },
  ): Promise<{ dataBase64: string | null }> => {
    const ws = await requireActiveWorkspace(ctx as never);
    const rec = await ctx.runQuery(internal.sqlDb.getDbMetaForAction, {
      projectId,
      workspaceId: ws._id,
    });
    if (!rec) return { dataBase64: null };
    const blob = await ctx.storage.get(rec.blobId);
    if (!blob) return { dataBase64: null };
    const buf = new Uint8Array(await blob.arrayBuffer());
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < buf.length; i += chunk) {
      binary += String.fromCharCode(...buf.subarray(i, i + chunk));
    }
    return { dataBase64: btoa(binary) };
  },
});

export const getDbMetaForAction = internalQuery({
  args: { projectId: v.id("projects"), workspaceId: v.id("workspaces") },
  handler: async (ctx, { projectId, workspaceId }) => {
    const project = await ctx.db.get(projectId);
    if (!project || project.workspaceId !== workspaceId) return null;
    const rec = await ctx.db
      .query("sqlDatabases")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .first();
    if (!rec) return null;
    return { blobId: rec.blobId, size: rec.size };
  },
});
