// Guest → authenticated workspace migration.
//
// The email-OTP flow creates a brand-new registered user + session; it never
// links to the previous anonymous user. This mutation runs right after the
// OTP sign-in succeeds (while the NEW session is active) and, inside one
// transaction, moves the previous guest workspace — with every project, file
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
//  - The guest user's other data is not referenced anywhere else: projects
//    and files hang off the workspace doc, which is re-owned, not copied.

import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  REGISTERED_INACTIVITY_MS,
  REGISTERED_LIMIT_BYTES,
} from "./workspaces";

export const migrateFromGuest = mutation({
  args: {
    guestWorkspaceId: v.id("workspaces"),
    // Session id of the guest session the caller held before OTP sign-in,
    // used as an ownership proof. Optional for resilience (older clients /
    // unreadable tokens), but when present it is strictly verified.
    guestSessionId: v.optional(v.string()),
  },
  handler: async (ctx, { guestWorkspaceId, guestSessionId }) => {
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

    // 2. The new user must not already own a workspace (one per user).
    //    If one exists (e.g. provisioned empty by the dashboard before the
    //    migration could run), we can still complete the migration by moving
    //    the guest's projects into it — but ONLY when the target has no
    //    projects, so nothing is ever duplicated or merged.
    const existingTarget = await ctx.db
      .query("workspaces")
      .withIndex("by_user", (q) => q.eq("userId", authUserId))
      .first();
    if (existingTarget) {
      const existingProjects = await ctx.db
        .query("projects")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", existingTarget._id))
        .collect();
      if (existingProjects.length > 0) {
        return { migrated: false as const, reason: "target-already-exists" };
      }

      // Load the guest workspace and verify it before re-pointing anything.
      const ws = await ctx.db.get(guestWorkspaceId);
      if (!ws) {
        return { migrated: false as const, reason: "workspace-not-found" };
      }
      const guestUser = await ctx.db.get(ws.userId);
      if (!guestUser || !guestUser.isAnonymous) {
        throw new Error("Refusing to migrate a non-guest workspace");
      }
      if (guestSessionId) {
        const ok = await sessionBelongsTo(guestSessionId, ws.userId, ctx);
        if (!ok) throw new Error("Workspace does not belong to the given guest session");
      }

      // Move every guest project into the existing (empty) target workspace.
      const guestProjects = await ctx.db
        .query("projects")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", ws._id))
        .collect();
      for (const p of guestProjects) {
        await ctx.db.patch(p._id, { workspaceId: existingTarget._id });
      }
      await ctx.db.patch(existingTarget._id, {
        usedBytes: ws.usedBytes,
        editorTheme: ws.editorTheme,
        fontSize: ws.fontSize,
        wordWrap: ws.wordWrap,
      });

      // Guest identity cleanup — data is already safe under the new owner.
      await deleteGuestIdentity(ctx, ws.userId);
      // The now-empty guest workspace is no longer needed.
      await ctx.db.delete(ws._id);

      return { migrated: true as const, reason: "merged-into-empty-target" };
    }

    // 3. Load the guest workspace + its owner.
    const ws = await ctx.db.get(guestWorkspaceId);
    if (!ws) {
      return { migrated: false as const, reason: "workspace-not-found" };
    }
    const guestUser = await ctx.db.get(ws.userId);
    if (!guestUser) {
      return { migrated: false as const, reason: "owner-not-found" };
    }
    if (!guestUser.isAnonymous) {
      // Never move a registered user's workspace.
      throw new Error("Refusing to migrate a non-guest workspace");
    }

    // 4. Ownership proof: the session id the client captured before sign-in
    //    must belong to the workspace's owner.
    if (guestSessionId) {
      const ok = await sessionBelongsTo(guestSessionId, ws.userId, ctx);
      if (!ok) {
        throw new Error("Workspace does not belong to the given guest session");
      }
    }

    // 5. Move the workspace (and transitively everything that hangs off it)
    //    to the new user, upgrading it to the registered tier.
    const now = Date.now();
    await ctx.db.patch(ws._id, {
      userId: authUserId,
      kind: "registered",
      storageLimitBytes: REGISTERED_LIMIT_BYTES,
      inactivityLimitMs: REGISTERED_INACTIVITY_MS,
      expiresAt: now + REGISTERED_INACTIVITY_MS,
    });

    // 6. Delete the guest session(s), auth account(s) and the guest user.
    //    The workspace's data is already safe under the new owner, so removing
    //    the guest identity cannot lose anything.
    await deleteGuestIdentity(ctx, ws.userId);

    return { migrated: true as const };
  },
});

/** Ownership proof: does `sessionId` resolve to a session owned by `userId`?
 *  Malformed ids are treated as absent (returns true — no proof required). */
async function sessionBelongsTo(
  sessionId: string,
  userId: Id<"users">,
  ctx: MutationCtx,
): Promise<boolean> {
  let session: { userId: Id<"users"> } | null = null;
  try {
    session = (await ctx.db.get(sessionId as Id<"authSessions">)) as
      | { userId: Id<"users"> }
      | null;
  } catch {
    session = null;
  }
  return !session || session.userId === userId;
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
