import { getAuthUserId } from "@convex-dev/auth/server";
import {
  internalMutation,
  mutation,
  query,
  MutationCtx,
  QueryCtx,
} from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

export const GUEST_LIMIT_BYTES = 50 * 1024 * 1024; // 50 MB
export const REGISTERED_LIMIT_BYTES = 150 * 1024 * 1024; // 150 MB
export const GUEST_INACTIVITY_MS = 60 * 60 * 1000; // 1 hour
export const REGISTERED_INACTIVITY_MS = 24 * 60 * 60 * 1000; // 24 hours

export type WorkspaceDoc = {
  _id: Id<"workspaces">;
  _creationTime: number;
  userId: Id<"users">;
  kind: "guest" | "registered";
  status: "active" | "expired";
  storageLimitBytes: number;
  usedBytes: number;
  inactivityLimitMs: number;
  lastActivityAt: number;
  expiresAt: number;
  editorTheme: "dark" | "light";
  fontSize: number;
  wordWrap: boolean;
};

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export class WorkspaceExpiredError extends Error {
  constructor() {
    super("WORKSPACE_EXPIRED: Your workspace has expired due to inactivity.");
  }
}

export async function requireUser(ctx: QueryCtx) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new Error("Not authenticated");
  const user = await ctx.db.get(userId);
  if (!user) throw new Error("Not authenticated");
  return user;
}

function isExpired(ws: WorkspaceDoc) {
  return ws.status === "expired" || ws.expiresAt <= Date.now();
}

/**
 * Read-only workspace lookup for queries. Never writes.
 * Returns null when the workspace is missing; returns the doc even when
 * expired so callers can decide (queries must not create/destroy data).
 */
export async function peekWorkspace(
  ctx: QueryCtx,
): Promise<WorkspaceDoc | null> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) return null;
  return (await ctx.db
    .query("workspaces")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first()) as WorkspaceDoc | null;
}

/** Valid workspace for read-only queries: null when expired/missing. */
export async function peekActiveWorkspace(
  ctx: QueryCtx,
): Promise<WorkspaceDoc | null> {
  const ws = await peekWorkspace(ctx);
  if (!ws || isExpired(ws)) return null;
  return ws;
}

/**
 * Mutation context: get the caller's workspace, creating one if needed and
 * destroying expired data server-side. Throws WorkspaceExpiredError only if
 * creation itself fails — expired workspaces are reset transparently.
 */
export async function requireActiveWorkspace(
  ctx: MutationCtx,
): Promise<WorkspaceDoc> {
  const user = await requireUser(ctx);
  const existing = (await ctx.db
    .query("workspaces")
    .withIndex("by_user", (q) => q.eq("userId", user._id))
    .first()) as WorkspaceDoc | null;

  if (!existing) {
    return createWorkspace(ctx, user._id, user.isAnonymous ? "guest" : "registered");
  }

  if (isExpired(existing)) {
    await deleteWorkspaceData(ctx, existing._id);
    await ctx.db.delete(existing._id);
    return createWorkspace(
      ctx,
      user._id,
      existing.kind === "guest" ? "guest" : "registered",
    );
  }

  // Tier may have changed (guest -> registered after sign-up)
  const correctKind = user.isAnonymous ? "guest" : "registered";
  if (existing.kind !== correctKind) {
    await ctx.db.patch(existing._id, {
      kind: correctKind,
      storageLimitBytes:
        correctKind === "guest" ? GUEST_LIMIT_BYTES : REGISTERED_LIMIT_BYTES,
      inactivityLimitMs:
        correctKind === "guest" ? GUEST_INACTIVITY_MS : REGISTERED_INACTIVITY_MS,
      expiresAt: existing.lastActivityAt + (correctKind === "guest" ? GUEST_INACTIVITY_MS : REGISTERED_INACTIVITY_MS),
    });
    return (await ctx.db.get(existing._id)) as WorkspaceDoc;
  }

  return existing;
}

async function createWorkspace(
  ctx: MutationCtx,
  userId: Id<"users">,
  kind: "guest" | "registered",
): Promise<WorkspaceDoc> {
  const now = Date.now();
  const inactivityLimitMs =
    kind === "guest" ? GUEST_INACTIVITY_MS : REGISTERED_INACTIVITY_MS;
  const id = await ctx.db.insert("workspaces", {
    userId,
    kind,
    status: "active",
    storageLimitBytes:
      kind === "guest" ? GUEST_LIMIT_BYTES : REGISTERED_LIMIT_BYTES,
    usedBytes: 0,
    inactivityLimitMs,
    lastActivityAt: now,
    expiresAt: now + inactivityLimitMs,
    editorTheme: "dark",
    fontSize: 13,
    wordWrap: false,
  });
  return (await ctx.db.get(id)) as WorkspaceDoc;
}

/** Delete a workspace and every project/file/db inside it. Frees blobs. */
export async function deleteWorkspaceData(
  ctx: MutationCtx,
  workspaceId: Id<"workspaces">,
) {
  const projects = await ctx.db
    .query("projects")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
    .collect();

  for (const project of projects) {
    const files = await ctx.db
      .query("files")
      .withIndex("by_project", (q) => q.eq("projectId", project._id))
      .collect();
    for (const file of files) {
      if (file.blobId) await ctx.storage.delete(file.blobId);
      await ctx.db.delete(file._id);
    }
    const dbs = await ctx.db
      .query("sqlDatabases")
      .withIndex("by_project", (q) => q.eq("projectId", project._id))
      .collect();
    for (const db of dbs) {
      await ctx.storage.delete(db.blobId);
      await ctx.db.delete(db._id);
    }
    await ctx.db.delete(project._id);
  }

  await ctx.db.delete(workspaceId);
}

/**
 * Expire any workspaces whose inactivity window has passed.
 * Runs on a cron schedule; also enforced on every workspace access.
 */
export const expireStaleWorkspaces = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const stale = await ctx.db
      .query("workspaces")
      .withIndex("by_expiry", (q) => q.lte("expiresAt", now))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();

    for (const ws of stale) {
      await deleteWorkspaceData(ctx, ws._id);
    }
    return stale.length;
  },
});

/** Ensure the signed-in user has an active workspace (also resets expired). */
export const getOrCreateWorkspace = mutation({
  args: {},
  handler: async (ctx) => {
    return await requireActiveWorkspace(ctx);
  },
});

/**
 * Bump activity: resets the inactivity window.
 * Called on any meaningful workspace interaction (edit/save/create/run/etc).
 */
export const touch = mutation({
  args: {},
  handler: async (ctx) => {
    const ws = await requireActiveWorkspace(ctx);
    const now = Date.now();
    await ctx.db.patch(ws._id, {
      lastActivityAt: now,
      expiresAt: now + ws.inactivityLimitMs,
    });
    return { expiresAt: now + ws.inactivityLimitMs };
  },
});

/** Read workspace status for the UI (storage usage, time left, tier). */
export const status = query({
  args: {},
  handler: async (ctx) => {
    const ws = await peekWorkspace(ctx);
    if (!ws) return null;
    return {
      _id: ws._id,
      kind: ws.kind,
      status: ws.status,
      storageLimitBytes: ws.storageLimitBytes,
      usedBytes: ws.usedBytes,
      lastActivityAt: ws.lastActivityAt,
      expiresAt: ws.expiresAt,
      editorTheme: ws.editorTheme,
      fontSize: ws.fontSize,
      wordWrap: ws.wordWrap,
      expiredNow: isExpired(ws),
    };
  },
});

/** Update editor preferences (persisted server-side). */
export const updateEditorSettings = mutation({
  args: {
    editorTheme: v.optional(v.union(v.literal("dark"), v.literal("light"))),
    fontSize: v.optional(v.number()),
    wordWrap: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const ws = await requireActiveWorkspace(ctx);
    const patch: Record<string, unknown> = {};
    if (args.editorTheme !== undefined) patch.editorTheme = args.editorTheme;
    if (args.fontSize !== undefined)
      patch.fontSize = Math.min(24, Math.max(10, args.fontSize));
    if (args.wordWrap !== undefined) patch.wordWrap = args.wordWrap;
    await ctx.db.patch(ws._id, patch);
  },
});

/**
 * Called by storage-accounting mutations before writes:
 * throws if the write would exceed quota. Client checks are never trusted.
 */
export async function assertQuota(
  ws: { storageLimitBytes: number; usedBytes: number },
  incomingBytes: number,
  freedBytes: number,
) {
  const projected = ws.usedBytes - freedBytes + incomingBytes;
  if (projected > ws.storageLimitBytes) {
    throw new Error(
      `Storage limit exceeded: ${formatBytes(ws.usedBytes)} used of ${formatBytes(ws.storageLimitBytes)}. Delete files or export your project to free space.`,
    );
  }
}
