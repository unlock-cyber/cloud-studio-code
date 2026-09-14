// Real SQLite compiled to WebAssembly (sql.js). Runs actual SQL, returns real
// rows and real errors. Databases persist per-project via Convex blob storage.

import initSqlJs, { type Database, type SqlJsStatic } from "sql.js";

const WASM_BASE =
  "https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/";

let sqlJsPromise: Promise<SqlJsStatic> | null = null;

function ensureSqlJs(): Promise<SqlJsStatic> {
  if (!sqlJsPromise) {
    sqlJsPromise = initSqlJs({
      locateFile: (file: string) => WASM_BASE + file,
    });
  }
  return sqlJsPromise;
}

export type SqlRunResult = {
  statements: Array<{
    sql: string;
    columns: string[];
    rows: string[][];
    rowCount: number;
    changes?: number;
  }>;
  stderr: string;
  exitCode: number;
};

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "object") {
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }
  if (typeof v === "number" && !Number.isInteger(v)) {
    return String(Math.round(v * 10000) / 10000);
  }
  if (v instanceof Uint8Array) return `<blob ${v.length} bytes>`;
  return String(v);
}

/**
 * Execute a SQL script against a SQLite database (optionally restored from
 * bytes persisted earlier). Statements run in order; SELECTs return rows.
 */
export async function runSql(
  script: string,
  opts: {
    dbBytes?: Uint8Array | null;
    onStdout: (s: string) => void;
    onStderr: (s: string) => void;
    timeoutMs?: number;
  },
): Promise<SqlRunResult & { dbBytes: Uint8Array | null }> {
  const SQL = await ensureSqlJs();
  let db: Database;
  try {
    db = opts.dbBytes
      ? new SQL.Database(opts.dbBytes)
      : new SQL.Database();
  } catch (e) {
    const msg = `Failed to open database: ${e instanceof Error ? e.message : String(e)}`;
    opts.onStderr(msg);
    return { statements: [], stderr: msg, exitCode: 1, dbBytes: null };
  }

  const statements: SqlRunResult["statements"] = [];
  const errors: string[] = [];

  // Split on semicolons while respecting string literals and comments.
  const parts = splitStatements(script);

  for (const raw of parts) {
    const sql = raw.trim();
    if (!sql) continue;
    try {
      const isSelect =
        /^\s*(select|with|pragma\s+\w+|explain)/i.test(sql) ||
        /^pragma/i.test(sql);
      if (isSelect || /returning/i.test(sql)) {
        const results = db.exec(sql);
        if (results.length === 0) {
          statements.push({ sql, columns: [], rows: [], rowCount: 0 });
          opts.onStdout(`-- no rows for: ${sql.slice(0, 60)}${sql.length > 60 ? "..." : ""}`);
        } else {
          for (const r of results) {
            const rows = r.values.map((row) => row.map(formatValue));
            statements.push({
              sql,
              columns: r.columns,
              rows,
              rowCount: rows.length,
            });
            opts.onStdout(`-- ${rows.length} row(s)`);
          }
        }
      } else {
        db.run(sql);
        const changes = db.getRowsModified();
        statements.push({ sql, columns: [], rows: [], rowCount: 0, changes });
        opts.onStdout(`-- OK (${changes} row(s) affected)`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`SQL error: ${msg}`);
      opts.onStderr(`SQL error: ${msg}`);
    }
  }

  const exitCode = errors.length > 0 ? 1 : 0;
  return {
    statements,
    stderr: errors.join("\n"),
    exitCode,
    dbBytes: db.export(),
  };
}

/** Split a SQL script into statements (semicolon-separated, quote-aware). */
export function splitStatements(script: string): string[] {
  const out: string[] = [];
  let current = "";
  let inSingle = false;
  let inDouble = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < script.length; i++) {
    const ch = script[i];
    const next = script[i + 1];

    if (inLineComment) {
      current += ch;
      if (ch === "\n") inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      current += ch;
      if (ch === "*" && next === "/") {
        current += next;
        i++;
        inBlockComment = false;
      }
      continue;
    }

    if (!inSingle && !inDouble && ch === "-" && next === "-") {
      inLineComment = true;
      current += ch;
      continue;
    }
    if (!inSingle && !inDouble && ch === "/" && next === "*") {
      inBlockComment = true;
      current += ch;
      continue;
    }

    if (!inDouble && ch === "'") {
      inSingle = !inSingle;
      current += ch;
      continue;
    }
    if (!inSingle && ch === '"') {
      inDouble = !inDouble;
      current += ch;
      continue;
    }

    if (ch === ";" && !inSingle && !inDouble) {
      out.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim()) out.push(current);
  return out;
}

export type { Database as SqlDatabase };
