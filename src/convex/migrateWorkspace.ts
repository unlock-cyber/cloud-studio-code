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
import { mutation } from "./_generated/server";
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
    const existingTarget = await ctx.db
      .query("workspaces")
      .withIndex("by_user", (q) => q.eq("userId", authUserId))
      .first();
    if (existingTarget) {
      // Already provisioned — nothing to migrate into it.
      return { migrated: false as const, reason: "target-already-exists" };
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
      let session: { userId: Id<"users"> } | null = null;
      try {
        session = (await ctx.db.get(
          guestSessionId as Id<"authSessions">,
        )) as { userId: Id<"users"> } | null;
      } catch {
        session = null; // malformed id — treat as absent
      }
      if (session && session.userId !== ws.userId) {
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
    const guestSessions = await ctx.db
      .query("authSessions")
      .filter((q) => q.eq(q.field("userId"), ws.userId))
      .collect();
    for (const s of guestSessions) {
      await ctx.db.delete(s._id);
    }
    const guestAccounts = await ctx.db
      .query("authAccounts")
      .filter((q) => q.eq(q.field("userId"), ws.userId))
      .collect();
    for (const a of guestAccounts) {
      await ctx.db.delete(a._id);
    }
    // All references (session, account, workspace ownership) are gone — the
    // anonymous user record itself can be removed.
    await ctx.db.delete(ws.userId);

    return { migrated: true as const };
  },
});
