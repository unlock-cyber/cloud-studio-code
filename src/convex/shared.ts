// Public, read-only access to a shared project.
//
// These queries are the ONLY unauthenticated way into project data, and they
// are deliberately read-only: there is no shared mutation anywhere, so a
// viewer holding a link can never change, delete or escalate anything.
//
// What they never return:
//   - the share token itself, the project/workspace/file document ids
//   - workspace metadata (owner, kind, storage usage, expiry, settings)
//   - binary blobs (text files only)
//   - anything for a project whose sharing is off, whose token is unknown, or
//     whose owning workspace is gone/expired.

import { v } from "convex/values";
import { query, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { normalizePath } from "./projects";

const MAX_TOKEN_LENGTH = 128;

type SharedProject = {
  _id: Id<"projects">;
  name: string;
  language: string;
  entryFile?: string;
};

/**
 * Resolve a share token to a live project, or null when the link must be
 * treated as invalid (unknown/revoked token, no owner workspace, expired or
 * inactive project). Never throws — callers render a "no longer available"
 * state instead of an error.
 */
async function resolveShared(
  ctx: QueryCtx,
  token: string,
): Promise<SharedProject | null> {
  const key = token.trim();
  if (!key || key.length > MAX_TOKEN_LENGTH) return null;

  const project = await ctx.db
    .query("projects")
    .withIndex("by_share_token", (q) => q.eq("shareToken", key))
    .first();
  if (!project || project.status !== "active") return null;

  const ws = await ctx.db.get(project.workspaceId);
  // The owner's workspace must still exist and be active: an expired
  // workspace is reset server-side, so its data must not stay readable
  // through an old link.
  if (!ws || ws.status === "expired" || ws.expiresAt <= Date.now()) return null;

  return {
    _id: project._id,
    name: project.name,
    language: project.language,
    entryFile: project.entryFile,
  };
}

/**
 * Project overview + file listing for a shared link. Metadata only — file
 * contents are fetched per file through `content`, so opening a link never
 * ships the whole project.
 */
export const get = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const project = await resolveShared(ctx, token);
    if (!project) return null;

    const files = await ctx.db
      .query("files")
      .withIndex("by_project", (q) => q.eq("projectId", project._id))
      .collect();

    return {
      name: project.name,
      language: project.language,
      entryFile: project.entryFile ?? null,
      files: files.map((f) => ({
        path: f.path,
        name: f.name,
        isFolder: f.isFolder,
        size: f.size,
        // Text is viewable; binaries are never served through a link.
        isBinary: !f.isFolder && f.content === undefined && f.blobId !== undefined,
      })),
    };
  },
});

/** Source of one text file in a shared project (null when not viewable). */
export const content = query({
  args: { token: v.string(), path: v.string() },
  handler: async (ctx, { token, path }) => {
    const project = await resolveShared(ctx, token);
    if (!project) return null;

    const file = await ctx.db
      .query("files")
      .withIndex("by_project_path", (q) =>
        q.eq("projectId", project._id).eq("path", normalizePath(path)),
      )
      .first();
    if (!file) return null;
    if (file.isFolder) return null;
    return {
      path: file.path,
      content: file.content ?? null,
      isBinary: file.content === undefined,
    };
  },
});

/**
 * Every text file's content, used to build the sandboxed live preview with the
 * existing preview builder. Only fetched when a viewer opens the preview.
 */
export const preview = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const project = await resolveShared(ctx, token);
    if (!project) return null;

    const files = await ctx.db
      .query("files")
      .withIndex("by_project", (q) => q.eq("projectId", project._id))
      .collect();
    return files
      .filter((f) => !f.isFolder && f.content !== undefined)
      .map((f) => ({ path: f.path, content: f.content as string }));
  },
});
