import { v } from "convex/values";
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import {
  peekActiveWorkspace,
  requireActiveWorkspace,
  formatBytes,
} from "./workspaces";
import { normalizePath } from "./projects";

const MAX_ZIP_BYTES = 25 * 1024 * 1024;

function asActionCtx(ctx: unknown) {
  // In actions, storage is the full StorageActionWriter (get/store/delete);
  // runtime type guards keep TS happy across the mutation/action split.
  return ctx as unknown as {
    storage: {
      get: (id: any) => Promise<Blob | null>;
      store: (blob: Blob) => Promise<any>;
      delete: (id: any) => Promise<void>;
    };
  };
}

// ---------------------------------------------------------------------------
// ZIP export
// ---------------------------------------------------------------------------

export const exportProjectZip = action({
  args: { projectId: v.id("projects") },
  handler: async (
    ctx,
    { projectId },
  ): Promise<{ blobId: Id<"_storage">; name: string }> => {
    const actx = asActionCtx(ctx);
    const collected = await ctx.runQuery(
      internal.importExport.collectProjectFiles,
      { projectId },
    );
    if (!collected) throw new Error("Project not found");
    const files = collected.files;

    const zipFiles: Record<string, Uint8Array> = {};
    const enc = new TextEncoder();
    for (const f of files) {
      if (f.content !== undefined) {
        zipFiles[f.path] = enc.encode(f.content);
      } else if (f.blobId) {
        const blob = await actx.storage.get(f.blobId);
        if (!blob) continue;
        zipFiles[f.path] = new Uint8Array(await blob.arrayBuffer());
      }
    }

    const { zipSync } = await import("fflate");
    const zipped = zipSync(zipFiles, { level: 6 });
    const blobId = await actx.storage.store(new Blob([zipped as BlobPart]));

    return { blobId, name: `${collected.name}.zip` };
  },
});

export const collectProjectFiles = internalQuery({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const ws = await peekActiveWorkspace(ctx);
    if (!ws) throw new Error("WORKSPACE_EXPIRED");
    const project = await ctx.db.get(projectId);
    if (!project || project.workspaceId !== ws._id) return null;
    const files = await ctx.db
      .query("files")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
    return {
      name: project.name,
      files: files
        .filter((f) => !f.isFolder)
        .map((f) => ({
          path: f.path,
          content: f.content,
          blobId: f.blobId,
        })),
    };
  },
});

/** One-shot URL for downloading the exported ZIP. */
export const getDownloadUrl = query({
  args: { blobId: v.id("_storage") },
  handler: async (ctx, { blobId }) => {
    return await ctx.storage.getUrl(blobId);
  },
});

// ---------------------------------------------------------------------------
// ZIP import: client uploads archive blob, server extracts + validates
// ---------------------------------------------------------------------------

export const uploadImportBlob = action({
  args: { blob: v.any() }, // pass-through: client sends ArrayBuffer via runtime
  handler: async (ctx, { blob }) => {
    // Convex actions cannot receive raw binary through the function args
    // serializer; the client instead stores the blob via useUpload helper
    // below. This action exists for future use.
    void ctx;
    void blob;
  },
});

/** Client requests an upload URL, POSTs the zip there, then calls importZipAction. */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireActiveWorkspace(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const importZipAction = action({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }): Promise<{ projectId: Id<"projects"> }> => {
    return await ctx.runMutation(internal.importExport.importZipInternal, {
      storageId,
    });
  },
});

export const importZipInternal = internalMutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }) => {
    const actx = asActionCtx(ctx);
    const ws = await requireActiveWorkspace(ctx as any);

    const blob = await actx.storage.get(storageId);
    if (!blob) throw new Error("Upload not found — try again");
    if (blob.size > MAX_ZIP_BYTES) {
      await actx.storage.delete(storageId);
      throw new Error("ZIP file too large (max 25 MB)");
    }

    const { unzipSync } = await import("fflate");
    const buf = new Uint8Array(await blob.arrayBuffer());
    let entries: Record<string, Uint8Array>;
    try {
      entries = unzipSync(buf);
    } catch {
      await actx.storage.delete(storageId);
      throw new Error("Invalid ZIP archive");
    }
    await actx.storage.delete(storageId);

    const allPaths = Object.keys(entries).filter((p) => !p.endsWith("/"));
    if (allPaths.length === 0) throw new Error("ZIP archive is empty");
    if (allPaths.length > 2000) {
      throw new Error("ZIP contains too many files (max 2000)");
    }

    // Detect a single top-level folder and strip it
    const topDirs = new Set(
      allPaths
        .map((p) => p.split("/")[0])
        .filter((_, i, arr) => arr.length > 1),
    );
    let prefix = "";
    const firstDir = allPaths[0].split("/")[0];
    if (
      allPaths[0].includes("/") &&
      allPaths.every((p) => p.startsWith(firstDir + "/"))
    ) {
      prefix = firstDir + "/";
    }
    void topDirs;

    const projectName =
      (prefix ? firstDir : "Imported Project").slice(0, 60) ||
      "Imported Project";

    let totalBytes = 0;
    for (const p of allPaths) {
      const segs = normalizePath(p).split("/");
      if (segs.some((s) => s.length > 80)) {
        throw new Error(`File name too long: ${p}`);
      }
      totalBytes += entries[p].length;
    }
    if (totalBytes > ws.storageLimitBytes - ws.usedBytes) {
      throw new Error(
        `Extracted size ${formatBytes(totalBytes)} exceeds remaining storage (${formatBytes(ws.storageLimitBytes - ws.usedBytes)})`,
      );
    }

    const now = Date.now();
    const projectId = await ctx.db.insert("projects", {
      workspaceId: ws._id,
      name: projectName,
      template: "imported",
      language: detectLanguageFromFiles(allPaths),
      status: "active",
      createdAt: now,
      lastOpenedAt: now,
    });

    for (const p of allPaths) {
      const rel = prefix ? p.slice(prefix.length) : p;
      const bytes = entries[p];
      const norm = normalizePath(rel);
      if (!norm) continue;
      if (isTextLike(norm)) {
        const content = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
        await insertFileWithPath(ctx, projectId, norm, content);
      } else {
        const stored = await actx.storage.store(new Blob([bytes as BlobPart]));
        await ensureFolders(ctx, projectId, norm);
        await ctx.db.insert("files", {
          projectId,
          path: norm,
          name: norm.split("/").pop()!,
          isFolder: false,
          blobId: stored,
          size: bytes.length,
          updatedAt: now,
        });
      }
    }

    await ctx.db.patch(ws._id, {
      usedBytes: ws.usedBytes + totalBytes,
      lastActivityAt: now,
      expiresAt: now + ws.inactivityLimitMs,
    });

    return { projectId };
  },
});

async function ensureFolders(ctx: any, projectId: any, path: string) {
  const segments = path.split("/");
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
}

async function insertFileWithPath(
  ctx: any,
  projectId: any,
  path: string,
  content: string,
) {
  await ensureFolders(ctx, projectId, path);
  const now = Date.now();
  await ctx.db.insert("files", {
    projectId,
    path,
    name: path.split("/").pop()!,
    isFolder: false,
    content,
    size: new Blob([content]).size,
    updatedAt: now,
  });
}

function detectLanguageFromFiles(paths: string[]): string {
  const joined = paths.join(" ");
  if (joined.includes("index.html")) return "html";
  if (paths.some((p) => p.endsWith(".py"))) return "python";
  if (paths.some((p) => p.endsWith(".java"))) return "java";
  if (paths.some((p) => p.endsWith(".cpp") || p.endsWith(".cc"))) return "cpp";
  if (paths.some((p) => p.endsWith(".c"))) return "c";
  if (paths.some((p) => p.endsWith(".ts") || p.endsWith(".tsx"))) return "ts";
  if (paths.some((p) => p.endsWith(".sql"))) return "sql";
  return "blank";
}

function isTextLike(path: string): boolean {
  return (
    /\.(txt|md|json|js|jsx|mjs|cjs|ts|tsx|css|scss|html|htm|xml|yml|yaml|csv|py|java|c|h|cpp|hpp|cc|sh|bash|sql|toml|ini|svg|vue|svelte|go|rs|rb|php|lock)$/i.test(
      path,
    ) ||
    /(package\.json|tsconfig\.json|README|Makefile|Dockerfile|\.gitignore|\.env)/i.test(
      path,
    )
  );
}
