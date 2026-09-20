// Bug reporting + private bug-management backend.
//
// Security model:
// - The backstage password is stored ONLY as a SHA-256 hash (salted with an
//   env-var secret). The plaintext never reaches the database or the client.
// - Successful auth issues a random session token; the client stores the raw
//   token, the database stores only its SHA-256 hash.
// - All report reads/writes require a valid backstage session token.
// - Repeated failed logins lock the password check temporarily.

import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";

// ---------------------------------------------------------------------------
// SHA-256 (pure TS, no Node crypto — runs in the Convex JS runtime)
// ---------------------------------------------------------------------------

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rotr(x: number, n: number) {
  return (x >>> n) | (x << (32 - n));
}

export function sha256Hex(input: string): string {
  const utf8 = new TextEncoder().encode(input);
  const bitLen = utf8.length * 8;
  const withPad = new Uint8Array((((utf8.length + 8) >> 6) + 1) * 64);
  withPad.set(utf8);
  withPad[utf8.length] = 0x80;
  const dv = new DataView(withPad.buffer);
  dv.setUint32(withPad.length - 4, bitLen >>> 0);
  dv.setUint32(withPad.length - 8, Math.floor(bitLen / 0x100000000));

  const H = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c,
    0x1f83d9ab, 0x5be0cd19,
  ]);
  const w = new Uint32Array(64);

  for (let off = 0; off < withPad.length; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0;
      d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0; H[2] = (H[2] + c) >>> 0;
    H[3] = (H[3] + d) >>> 0; H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0;
    H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
  }
  let hex = "";
  for (let i = 0; i < 8; i++) hex += H[i].toString(16).padStart(8, "0");
  return hex;
}

// ---------------------------------------------------------------------------
// Public: submit a bug report (no auth, no way to read anything back)
// ---------------------------------------------------------------------------

export const submitReport = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    stepsToReproduce: v.string(),
    expectedBehavior: v.string(),
    actualBehavior: v.string(),
    browserInfo: v.optional(v.string()),
    reporterName: v.optional(v.string()),
    reporterEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const title = args.title.trim().slice(0, 200);
    const description = args.description.trim().slice(0, 8000);
    const steps = args.stepsToReproduce.trim().slice(0, 8000);
    if (!title || !description || !steps) {
      throw new Error("Title, description and steps to reproduce are required.");
    }
    const id = await ctx.db.insert("bugReports", {
      title,
      description,
      stepsToReproduce: steps,
      expectedBehavior: args.expectedBehavior.trim().slice(0, 8000),
      actualBehavior: args.actualBehavior.trim().slice(0, 8000),
      browserInfo: args.browserInfo?.trim().slice(0, 500) || undefined,
      reporterName: args.reporterName?.trim().slice(0, 120) || undefined,
      reporterEmail: args.reporterEmail?.trim().slice(0, 200) || undefined,
      status: "new",
      important: false,
      archived: false,
      submittedAt: Date.now(),
    });
    return { id };
  },
});

// ---------------------------------------------------------------------------
// Private: password auth
// ---------------------------------------------------------------------------

const MAX_ATTEMPTS = 5;
const LOCK_MS = 5 * 60 * 1000;
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

function passwordHash(password: string): string {
  // Salted with a server-side secret env var. The plaintext password and the
  // salt never appear in the client bundle or in the database.
  const salt = process.env.BACKSTAGE_PASSWORD_SALT || "csc-backstage";
  return sha256Hex(`${salt}:${password}`);
}

export const checkLockState = query({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.db.query("backstageAuth").first();
    const now = Date.now();
    return {
      locked: !!row?.lockedUntil && row.lockedUntil > now,
      lockedUntil: row?.lockedUntil ?? null,
    };
  },
});

/** Verify the password and return a session token. Throws on failure. */
export const signIn = mutation({
  args: { password: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();
    let row = await ctx.db.query("backstageAuth").first();
    if (!row) {
      // First run: create the tracking row and continue in the same
      // transaction. (Throwing here would roll the insert back and every
      // future attempt would re-enter this branch.) Authentication still
      // fails closed below if no password hash is configured.
      await ctx.db.insert("backstageAuth", {
        failedAttempts: 0,
        lastFailedAt: 0,
      });
      row = await ctx.db.query("backstageAuth").first();
    }

    if (!row) {
      throw new Error("Access is not configured. Try again later.");
    }

    if (row.lockedUntil && row.lockedUntil > now) {
      const mins = Math.ceil((row.lockedUntil - now) / 60000);
      throw new Error(`Too many failed attempts. Locked for ${mins} more minute(s).`);
    }

    const expected = process.env.BACKSTAGE_PASSWORD_HASH;
    if (!expected) {
      throw new Error("Access is not configured. Try again later.");
    }

    if (passwordHash(args.password) !== expected.toLowerCase()) {
      const attempts = row.failedAttempts + 1;
      const lock = attempts >= MAX_ATTEMPTS ? now + LOCK_MS : undefined;
      await ctx.db.patch(row._id, {
        failedAttempts: lock ? 0 : attempts,
        lastFailedAt: now,
        lockedUntil: lock,
      });
      throw new Error("Incorrect password.");
    }

    // Success: reset attempts, issue session.
    await ctx.db.patch(row._id, { failedAttempts: 0, lockedUntil: undefined });

    const raw = crypto.randomUUID().replace(/-/g, "") +
      crypto.randomUUID().replace(/-/g, "") +
      crypto.randomUUID().replace(/-/g, "") +
      crypto.randomUUID().replace(/-/g, "");
    const tokenHash = sha256Hex(raw);
    await ctx.db.insert("backstageSessions", {
      tokenHash,
      createdAt: now,
      expiresAt: now + SESSION_TTL_MS,
    });
    return { token: raw, expiresAt: now + SESSION_TTL_MS };
  },
});

export const validateSession = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("backstageSessions")
      .withIndex("by_token", (q) => q.eq("tokenHash", sha256Hex(args.token)))
      .first();
    if (!row || row.expiresAt <= Date.now()) {
      if (row) await ctx.db.delete(row._id);
      return { valid: false as const };
    }
    return { valid: true as const, expiresAt: row.expiresAt };
  },
});

export const signOut = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("backstageSessions")
      .withIndex("by_token", (q) => q.eq("tokenHash", sha256Hex(args.token)))
      .first();
    if (row) await ctx.db.delete(row._id);
  },
});

// ---------------------------------------------------------------------------
// Private: report management (all require a valid session token)
// ---------------------------------------------------------------------------

function reportView(r: {
  _id: string;
  title: string;
  description: string;
  stepsToReproduce: string;
  expectedBehavior: string;
  actualBehavior: string;
  browserInfo?: string;
  reporterName?: string;
  reporterEmail?: string;
  status: string;
  notes?: string;
  important: boolean;
  archived: boolean;
  submittedAt: number;
}) {
  return { ...r };
}

export const listReports = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("backstageSessions")
      .withIndex("by_token", (q) => q.eq("tokenHash", sha256Hex(args.token)))
      .first();
    if (!session || session.expiresAt <= Date.now()) {
      if (session) await ctx.db.delete(session._id);
      throw new Error("Unauthorized");
    }
    const reports = await ctx.db
      .query("bugReports")
      .withIndex("by_submitted")
      .order("desc")
      .collect();
    return { reports: reports.map(reportView) };
  },
});

export const updateReport = mutation({
  args: {
    token: v.string(),
    reportId: v.id("bugReports"),
    status: v.optional(
      v.union(
        v.literal("new"),
        v.literal("in_progress"),
        v.literal("resolved"),
        v.literal("closed"),
      ),
    ),
    notes: v.optional(v.string()),
    important: v.optional(v.boolean()),
    archived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("backstageSessions")
      .withIndex("by_token", (q) => q.eq("tokenHash", sha256Hex(args.token)))
      .first();
    if (!session || session.expiresAt <= Date.now()) {
      if (session) await ctx.db.delete(session._id);
      throw new Error("Unauthorized");
    }
    const patch: Record<string, unknown> = {};
    if (args.status !== undefined) patch.status = args.status;
    if (args.notes !== undefined) patch.notes = args.notes.slice(0, 8000);
    if (args.important !== undefined) patch.important = args.important;
    if (args.archived !== undefined) patch.archived = args.archived;
    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(args.reportId, patch);
    }
  },
});

export const deleteReport = mutation({
  args: { token: v.string(), reportId: v.id("bugReports") },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("backstageSessions")
      .withIndex("by_token", (q) => q.eq("tokenHash", sha256Hex(args.token)))
      .first();
    if (!session || session.expiresAt <= Date.now()) {
      if (session) await ctx.db.delete(session._id);
      throw new Error("Unauthorized");
    }
    await ctx.db.delete(args.reportId);
  },
});
