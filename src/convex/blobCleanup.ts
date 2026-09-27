// Safe deletion of storage blobs.
//
// Duplicated files and duplicated projects share the underlying storage blob
// (Convex storage blobs are immutable and content-addressed, and mutations
// cannot read/re-upload them — `storage.get`/`storage.store` exist only in
// actions). Sharing is safe as long as removing a document never removes
// content another document still points at, so every blob deletion in a
// mutation goes through here: a blob is deleted only when nothing in the
// workspace references it anymore.
//
// The check is workspace-scoped: projects (and therefore their files and SQL
// databases) never move between workspaces, so anything that could reference
// the blob lives in the same workspace.

import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

async function isBlobReferenced(
  ctx: MutationCtx,
  workspaceId: Id<"workspaces">,
  blobId: Id<"_storage">,
): Promise<boolean> {
  const projects = await ctx.db
    .query("projects")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
    .collect();

  for (const project of projects) {
    const files = await ctx.db
      .query("files")
      .withIndex("by_project", (q) => q.eq("projectId", project._id))
      .collect();
    if (files.some((f) => f.blobId === blobId)) return true;

    const sqlDbs = await ctx.db
      .query("sqlDatabases")
      .withIndex("by_project", (q) => q.eq("projectId", project._id))
      .collect();
    if (sqlDbs.some((d) => d.blobId === blobId)) return true;
  }

  return false;
}

/**
 * Deletes a blob unless another document in the workspace still references it.
 * Call this *after* deleting/patching the document that referenced it.
 */
export async function deleteBlobIfUnreferenced(
  ctx: MutationCtx,
  workspaceId: Id<"workspaces">,
  blobId: Id<"_storage">,
): Promise<boolean> {
  if (await isBlobReferenced(ctx, workspaceId, blobId)) return false;
  await ctx.storage.delete(blobId);
  return true;
}
