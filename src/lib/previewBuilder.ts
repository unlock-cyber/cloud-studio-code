// Builds a real, self-contained HTML document from project files for the
// live preview iframe. Local <script src> and <link href> are inlined with
// actual project content. A boot script forwards runtime errors and console
// output to the IDE. If the project has no HTML entry, we synthesize one from
// the project's JS/CSS so preview still shows real output.

export type PreviewFiles = Map<string, string>;

export type PreviewBuild = {
  html: string;
  entryFile: string | null;
  missingAssets: string[];
};

const BOOT_JS = `
<script>
(function () {
  var send = function (payload) {
    try { parent.postMessage(Object.assign({ __preview: true }, payload), "*"); } catch (e) {}
  };
  window.addEventListener("error", function (e) {
    var el = e.target;
    if (el && (el.tagName === "SCRIPT" || el.tagName === "LINK" || el.tagName === "IMG")) {
      send({ type: "asset-error", src: (el.src || el.href || "") });
      return;
    }
    send({
      type: "error",
      message: e.message,
      line: e.lineno,
      col: e.colno,
      source: e.filename || ""
    });
  }, true);
  window.addEventListener("unhandledrejection", function (e) {
    var r = e.reason;
    send({ type: "error", message: "Unhandled promise rejection: " + (r && r.message ? r.message : String(r)) });
  });
  var fmt = function (v, d) {
    d = d || 0;
    try {
      if (v === null) return "null";
      if (v === undefined) return "undefined";
      var t = typeof v;
      if (t === "string") return d === 0 ? v : JSON.stringify(v);
      if (t === "number" || t === "boolean" || t === "bigint") return String(v);
      if (t === "function") return "[Function: " + (v.name || "anonymous") + "]";
      if (v instanceof Error) return v.name + ": " + v.message;
      if (d > 3) return Array.isArray(v) ? "[Array]" : "[Object]";
      if (Array.isArray(v)) return "[ " + v.slice(0, 100).map(function (x) { return fmt(x, d + 1); }).join(", ") + " ]";
      var keys = Object.keys(v).slice(0, 50);
      return "{ " + keys.map(function (k) { return k + ": " + fmt(v[k], d + 1); }).join(", ") + " }";
    } catch (e) { return String(v); }
  };
  var origLog = console.log, origWarn = console.warn, origError = console.error, origInfo = console.info;
  function pack(args) { return Array.prototype.map.call(args, function (a) { return fmt(a, 0); }).join(" "); }
  console.log = function () { send({ type: "console", level: "log", text: pack(arguments) }); origLog.apply(console, arguments); };
  console.info = function () { send({ type: "console", level: "log", text: pack(arguments) }); origInfo.apply(console, arguments); };
  console.warn = function () { send({ type: "console", level: "warn", text: pack(arguments) }); origWarn.apply(console, arguments); };
  console.error = function () { send({ type: "console", level: "error", text: pack(arguments) }); origError.apply(console, arguments); };
  send({ type: "ready" });
})();
<\/script>
`;

function escapeHtmlAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/**
 * Inline local <script src> / <link href> / <img src> references with actual
 * project file contents so the preview is fully self-contained.
 */
export function buildPreviewHtml(
  files: PreviewFiles,
  entryFile: string | null,
): PreviewBuild {
  const missingAssets: string[] = [];
  const norm = (p: string) => p.replace(/^\.?\//, "").replace(/\\/g, "/");

  const resolvePath = (base: string | null, href: string): string | null => {
    if (/^(https?:)?\/\//i.test(href) || href.startsWith("data:")) return null;
    if (href.startsWith("/")) return norm(href);
    // resolve relative to the entry file's directory
    const baseDir = base && base.includes("/") ? base.slice(0, base.lastIndexOf("/") + 1) : "";
    const parts = (baseDir + href).split("/");
    const stack: string[] = [];
    for (const part of parts) {
      if (part === "." || part === "") continue;
      if (part === "..") stack.pop();
      else stack.push(part);
    }
    return stack.join("/");
  };

  // Find an HTML entry: prefer index.html, then entryFile, then any .html
  let htmlPath: string | null = null;
  if (entryFile && /\.(html|htm)$/i.test(entryFile) && files.has(norm(entryFile))) {
    htmlPath = norm(entryFile);
  } else if (files.has("index.html")) {
    htmlPath = "index.html";
  } else {
    for (const p of files.keys()) {
      if (/\.(html|htm)$/i.test(p)) {
        htmlPath = p;
        break;
      }
    }
  }

  if (htmlPath) {
    let html = files.get(htmlPath)!;

    // Inline <link rel="stylesheet" href="...">
    html = html.replace(
      /<link\b[^>]*href=["']([^"']+)["'][^>]*>/gi,
      (match, href: string) => {
        if (!/stylesheet/i.test(match)) return match;
        const resolved = resolvePath(htmlPath, href);
        if (!resolved) return match;
        const css = files.get(resolved);
        if (css === undefined) {
          missingAssets.push(resolved);
          return match;
        }
        return `<style data-src="${escapeHtmlAttr(resolved)}">\n${css}\n</style>`;
      },
    );

    // Inline <script src="...">
    html = html.replace(
      /<script\b[^>]*src=["']([^"']+)["'][^>]*><\/script>/gi,
      (match, src: string) => {
        const resolved = resolvePath(htmlPath, src);
        if (!resolved) return match;
        const js = files.get(resolved);
        if (js === undefined) {
          missingAssets.push(resolved);
          return match;
        }
        const typeMatch = match.match(/type=["']([^"']+)["']/i);
        const typeAttr = typeMatch && !/^text\/javascript$/i.test(typeMatch[1]) ? ` type="${typeMatch[1]}"` : "";
        return `<script${typeAttr} data-src="${escapeHtmlAttr(resolved)}">\n${js}\n</script>`;
      },
    );

    const injected = BOOT_JS.replace("<\\/script>", "<\/script>");
    if (/<head[^>]*>/i.test(html)) {
      html = html.replace(/<head[^>]*>/i, (m) => m + "\n" + injected);
    } else {
      html = injected + html;
    }
    return { html, entryFile: htmlPath, missingAssets };
  }

  // No HTML file: synthesize a document from the project's JS/CSS so the
  // preview still runs the real code.
  const cssFiles = [...files.keys()].filter((p) => /\.css$/i.test(p));
  const jsFiles = [...files.keys()].filter((p) => /\.(js|jsx|mjs)$/i.test(p));
  if (jsFiles.length === 0 && cssFiles.length === 0) {
    return { html: "", entryFile: null, missingAssets };
  }
  const css = cssFiles.map((p) => `/* ${p} */\n${files.get(p) ?? ""}`).join("\n\n");
  const scripts = jsFiles
    .map((p) => `<script data-src="${escapeHtmlAttr(p)}">\n${files.get(p) ?? ""}\n</script>`)
    .join("\n");
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Preview</title>
  <style>\n${css}\n</style>
  ${BOOT_JS}
</head>
<body>
  <div id="root"></div>
  ${scripts}
</body>
</html>`;
  return { html, entryFile: null, missingAssets };
}
