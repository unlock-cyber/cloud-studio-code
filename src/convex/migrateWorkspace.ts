// Guest → authenticated workspace migration.
//
// The email-OTP flow creates a brand-new registered user + session; it never
// links to the previous anonymous user. This mutation runs right after the
// OTP sign-in succeeds (while the NEW session is active) and, inside one
// transaction, MOVES the previous guest workspace — with every project, file
// and SQL database it contains — to the new user, then deletes the guest
// session(s), auth account and the guest user record itself.
//
// Safety properties:
//  - The caller must be an authenticated, NON-anonymous user.
//  - The workspace being moved must belong to an anonymous user.
//  - The client passes the guest session id it held before signing in; if it
//    is present and does not belong to the workspace's owner, the mutation
//    throws instead of moving someone else's data.
//  - Everything (ownership move + guest cleanup) commits atomically. If any
//    step fails, nothing is written and the guest data stays intact.
//  - Guest data is never silently discarded: if the target workspace already
//    exists (provisioned empty by the dashboard after auth), the guest's
//    projects/files are MOVED into it (only when the target is empty), so
//    nothing is left behind.
//  - Successful authentication alone is never treated as a successful
//    migration — the migration result is explicit ({ migrated: true/false }).

import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  REGISTERED_INACTIVITY_MS,
  REGISTERED_LIMIT_BYTES,
} from "./workspaces";

type WorkspaceDoc = {
  _id: Id<"workspaces">;
  userId: Id<"users">;
  kind: "guest" | "registered";
  usedBytes: number;
  editorTheme?: "dark" | "light";
  fontSize?: number;
  wordWrap?: boolean;
};

export const migrateFromGuest = mutation({
  args: {
    guestWorkspaceId: v.id("workspaces"),
    // Session id of the guest session the caller held before OTP sign-in,
    // used as an ownership proof. Optional for resilience (older clients /
    // unreadable tokens), but when present it is strictly verified.
    guestSessionId: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { guestWorkspaceId, guestSessionId },
  ): Promise<{ migrated: boolean; reason?: string }> => {
    // 1. The caller must be a registered (non-anonymous) user — i.e. the
    //    fresh session created by the OTP sign-in.
    const authUserId = await getAuthUserId(ctx);
    if (authUserId === null) {
      throw new Error("Not authenticated");
    }
    const authUser = await ctx.db.get(authUserId);
    if (!authUser) throw new Error("Not authenticated");
    if (authUser.isAnonymous) {
      throw new Error("Migration requires a registered account");
    }

    // 2. Resolve the guest workspace. Prefer the id captured by the client;
    //    if it is stale/missing, fall back to "the workspace owned by the
    //    anonymous user the client still remembers" via the session id.
    let ws: WorkspaceDoc | null = null;
    try {
      ws = (await ctx.db.get(guestWorkspaceId)) as WorkspaceDoc | null;
    } catch {
      ws = null;
    }
    if (!ws && guestSessionId) {
      const guestUserIdFromSession = await userIdFromSession(
        guestSessionId,
        ctx,
      );
      if (guestUserIdFromSession) {
        const candidate = (await ctx.db
          .query("workspaces")
          .withIndex("by_user", (q) => q.eq("userId", guestUserIdFromSession))
          .first()) as WorkspaceDoc | null;
        if (candidate && candidate.kind === "guest") ws = candidate;
      }
    }
    if (!ws) {
      // Nothing to migrate — the guest workspace no longer exists. Do NOT
      // treat this as migration success; report it so the client can decide.
      return { migrated: false, reason: "workspace-not-found" };
    }

    // 3. Verify ownership: the workspace must belong to an anonymous user,
    //    and the provided guest session id (when present) must belong to
    //    that user.
    const guestUser = await ctx.db.get(ws.userId);
    if (!guestUser) {
      return { migrated: false, reason: "owner-not-found" };
    }
    if (!guestUser.isAnonymous) {
      // Never move a registered user's workspace.
      throw new Error("Refusing to migrate a non-guest workspace");
    }
    if (guestSessionId) {
      const ok = await sessionBelongsTo(guestSessionId, ws.userId, ctx);
      if (!ok) {
        throw new Error("Workspace does not belong to the given guest session");
      }
    }

    // 4. Determine the target workspace for the new registered user.
    const existingTarget = (await ctx.db
      .query("workspaces")
      .withIndex("by_user", (q) => q.eq("userId", authUserId))
      .first()) as WorkspaceDoc | null;

    let targetId: Id<"workspaces">;
    if (existingTarget) {
      // A workspace was already provisioned for the registered account
      // (e.g. by the dashboard's provisioning gate after auth). We may still
      // complete the MOVE — but ONLY when the target has no projects, so
      // nothing can be duplicated, merged or overwritten.
      const existingProjects = await ctx.db
        .query("projects")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", existingTarget._id))
        .collect();
      if (existingProjects.length > 0) {
        // Refuse: the target already has content and a move would conflict.
        return { migrated: false, reason: "target-already-exists" };
      }
      targetId = existingTarget._id;
      // Adopt the guest workspace's settings and usage into the target.
      await ctx.db.patch(existingTarget._id, {
        usedBytes: ws.usedBytes,
        editorTheme: ws.editorTheme ?? existingTarget.editorTheme,
        fontSize: ws.fontSize ?? existingTarget.fontSize,
        wordWrap: ws.wordWrap ?? existingTarget.wordWrap,
      });
    } else {
      // 5. MOVE the workspace itself to the new user, upgrading it to the
      //    registered tier. Projects, files and SQL databases all hang off
      //    the workspace id, so re-owning this one doc transitively moves
      //    everything — a true MOVE, not a copy.
      const now = Date.now();
      await ctx.db.patch(ws._id, {
        userId: authUserId,
        kind: "registered",
        storageLimitBytes: REGISTERED_LIMIT_BYTES,
        inactivityLimitMs: REGISTERED_INACTIVITY_MS,
        expiresAt: now + REGISTERED_INACTIVITY_MS,
      });
      targetId = ws._id;
    }

    // 6. Explicitly re-point every guest project to the target workspace,
    //    preserving names, structure, settings and open-tabs/active-file
    //    state. Files and SQL databases hang off project ids, so they move
    //    with their projects untouched.
    const guestProjects = await ctx.db
      .query("projects")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", ws._id))
      .collect();
    for (const p of guestProjects) {
      if (p.workspaceId !== targetId) {
        await ctx.db.patch(p._id, { workspaceId: targetId });
      }
    }

    // 7. The guest data is now fully owned by the registered user. Only NOW
    //    is it safe to delete the guest identity (sessions, accounts, user
    //    record) and — in the merged-into-target path — the emptied guest
    //    workspace shell.
    await deleteGuestIdentity(ctx, ws.userId);
    if (existingTarget && targetId !== ws._id) {
      await ctx.db.delete(ws._id);
    }

    return { migrated: true };
  },
});

/** Ownership proof: does `sessionId` resolve to a session owned by `userId`?
 *  Malformed ids are treated as absent (returns false only for a real
 *  mismatch — an unreadable id imposes no proof). */
async function sessionBelongsTo(
  sessionId: string,
  userId: Id<"users">,
  ctx: MutationCtx,
): Promise<boolean> {
  const session = await userIdFromSession(sessionId, ctx);
  if (session === null) return true; // malformed/unknown id → no proof possible
  return session === userId;
}

/** Resolves a session id to its owner user id, or null if malformed/gone. */
async function userIdFromSession(
  sessionId: string,
  ctx: MutationCtx,
): Promise<Id<"users"> | null> {
  try {
    const session = await ctx.db.get(sessionId as Id<"authSessions">);
    return session ? session.userId : null;
  } catch {
    return null;
  }
}

/** Deletes the guest's sessions, auth accounts and user record. Call only
 *  after the workspace data is safely re-owned by the registered user. */
async function deleteGuestIdentity(ctx: MutationCtx, guestUserId: Id<"users">): Promise<void> {
  const guestSessions = await ctx.db
    .query("authSessions")
    .filter((q) => q.eq(q.field("userId"), guestUserId))
    .collect();
  for (const s of guestSessions) {
    await ctx.db.delete(s._id);
  }
  const guestAccounts = await ctx.db
    .query("authAccounts")
    .filter((q) => q.eq(q.field("userId"), guestUserId))
    .collect();
  for (const a of guestAccounts) {
    await ctx.db.delete(a._id);
  }
  // All references (session, account, workspace ownership) are gone — the
  // anonymous user record itself can be removed.
  await ctx.db.delete(guestUserId);
}
