import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// default user roles. can add / remove based on the project as needed
export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);
export type Role = Infer<typeof roleValidator>;

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // the users table is the default users table that is brought in by the authTables
    users: defineTable({
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // email verification time. do not remove
      isAnonymous: v.optional(v.boolean()), // is the user anonymous. do not remove

      role: v.optional(roleValidator), // role of the user. do not remove
    }).index("email", ["email"]), // index for the email. do not remove or modify

    // ===== Cloud IDE =====

    // One workspace per user. Guests get 50MB / 1h inactivity, registered 150MB / 24h.
    workspaces: defineTable({
      userId: v.id("users"),
      kind: v.union(v.literal("guest"), v.literal("registered")),
      status: v.union(v.literal("active"), v.literal("expired")),
      storageLimitBytes: v.number(),
      usedBytes: v.number(),
      inactivityLimitMs: v.number(),
      lastActivityAt: v.number(),
      expiresAt: v.number(),
      // per-workspace editor settings
      editorTheme: v.union(v.literal("dark"), v.literal("light")),
      fontSize: v.number(),
      wordWrap: v.boolean(),
    })
      .index("by_user", ["userId"])
      .index("by_expiry", ["expiresAt"]),

    projects: defineTable({
      workspaceId: v.id("workspaces"),
      name: v.string(),
      template: v.string(),
      language: v.string(), // html | python | cpp | c | java | ts | node | sql | blank
      entryFile: v.optional(v.string()),
      status: v.union(v.literal("active"), v.literal("expired")),
      createdAt: v.number(),
      lastOpenedAt: v.number(),
      // persisted editor session
      openTabs: v.optional(v.array(v.string())),
      activeFile: v.optional(v.string()),
    }).index("by_workspace", ["workspaceId"]),

    files: defineTable({
      projectId: v.id("projects"),
      // normalized path relative to project root, e.g. "src/main.ts"
      path: v.string(),
      name: v.string(),
      isFolder: v.boolean(),
      // text content (text files only)
      content: v.optional(v.string()),
      // binary files are stored in blob storage
      blobId: v.optional(v.id("_storage")),
      size: v.number(),
      updatedAt: v.number(),
    })
      .index("by_project", ["projectId"])
      .index("by_project_path", ["projectId", "path"]),

    // per-project persistent SQLite database (sql.js export), stored as a blob
    sqlDatabases: defineTable({
      projectId: v.id("projects"),
      blobId: v.id("_storage"),
      size: v.number(),
      updatedAt: v.number(),
    }).index("by_project", ["projectId"]),

    // add other tables here
  },
  {
    schemaValidation: false,
  },
);

export default schema;
