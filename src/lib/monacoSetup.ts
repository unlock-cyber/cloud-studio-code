// Monaco editor bootstrap for the Cloud IDE.
// Monaco is very large (~5 MB with all languages), so it loads from the
// official jsdelivr CDN via @monaco-editor/react's AMD loader — the same
// approach as the other runtime engines (Pyodide, esbuild-wasm, sql.js).
// This keeps the app bundle small and the editor fully featured.

import { Editor, loader } from "@monaco-editor/react";
import type * as MonacoNs from "monaco-editor";

// Pin the CDN version for stability.
loader.config({
  paths: { vs: "https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs" },
});

export { Editor };
export type Monaco = typeof MonacoNs;

let themeDefined = false;

/** Register the custom IDE themes once Monaco is available. */
export function defineIdeTheme(monaco: Monaco) {
  if (themeDefined) {
    return;
  }
  themeDefined = true;
  monaco.editor.defineTheme("ide-light", {
    base: "vs",
    inherit: true,
    rules: [
      { token: "comment", foreground: "6A737D", fontStyle: "italic" },
      { token: "keyword", foreground: "CF222E", fontStyle: "bold" },
      { token: "string", foreground: "0A3069" },
      { token: "number", foreground: "0550AE" },
      { token: "type", foreground: "953800" },
    ],
    colors: {
      "editor.background": "#FFFFFF",
      "editorGutter.background": "#FFFFFF",
      "editor.lineHighlightBackground": "#F6F8FA",
      "editorLineNumber.foreground": "#8C959F",
      "editorCursor.foreground": "#0969DA",
    },
  });
  monaco.editor.defineTheme("ide-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "6A737D", fontStyle: "italic" },
      { token: "keyword", foreground: "C792EA" },
      { token: "string", foreground: "A5D6A5" },
      { token: "number", foreground: "F78C6C" },
      { token: "type", foreground: "82AAFF" },
    ],
    colors: {
      "editor.background": "#0D1117",
      "editorGutter.background": "#0D1117",
      "editor.lineHighlightBackground": "#161B22",
      "editorLineNumber.foreground": "#3D4A5C",
      "editorCursor.foreground": "#58A6FF",
    },
  });
}

export function setMonacoTheme(monaco: Monaco, theme: "dark" | "light") {
  monaco.editor.setTheme(theme === "dark" ? "ide-dark" : "ide-light");
}
