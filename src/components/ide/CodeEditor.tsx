import { useEffect, useMemo, useRef } from "react";
import { Editor, defineIdeTheme, setMonacoTheme, type Monaco } from "@/lib/monacoSetup";
import { useMonaco } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { monacoLang, langFromPath, type LangId } from "@/lib/languages";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { load as yamlLoad } from "js-yaml";
import { Button } from "@/components/ui/button";
import { WrapText, Minus, Plus } from "lucide-react";

export type EditorTab = {
  path: string;
  content: string; // saved content
  draft: string; // current editor content
};

type Props = {
  tab: EditorTab;
  onChange: (content: string) => void;
  onSave: () => void;
  onRun: () => void;
  theme: "dark" | "light";
  fontSize: number;
  wordWrap: boolean;
  onFontSizeChange: (size: number) => void;
  onWordWrapToggle: () => void;
};

export function CodeEditor({
  tab,
  onChange,
  onSave,
  onRun,
  theme,
  fontSize,
  wordWrap,
  onFontSizeChange,
  onWordWrapToggle,
}: Props) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const saveRef = useRef(onSave);
  const runRef = useRef(onRun);
  saveRef.current = onSave;
  runRef.current = onRun;

  const lang = langFromPath(tab.path) as LangId;
  const monaco = useMonaco();

  useEffect(() => {
    if (!monaco) return;
    const m = monaco as unknown as Monaco;
    defineIdeTheme(m);
    setMonacoTheme(m, theme);
  }, [monaco, theme]);

  const handleMount = (ed: editor.IStandaloneCodeEditor, m: Monaco) => {
    editorRef.current = ed;
    defineIdeTheme(m);
    ed.addCommand(m.KeyMod.CtrlCmd | m.KeyCode.KeyS, () => {
      saveRef.current();
    });
    ed.addCommand(m.KeyMod.CtrlCmd | m.KeyCode.Enter, () => {
      runRef.current();
    });
  };

  const value = tab.draft;
  const isMarkdown = lang === "markdown";
  const isStructured = lang === "json" || lang === "yaml" || lang === "xml";
  const dirty = tab.draft !== tab.content;

  const prettyJson = useMemo(() => {
    if (lang !== "json") return null;
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch (e) {
      return `Invalid JSON: ${e instanceof Error ? e.message : String(e)}`;
    }
  }, [lang, value]);

  const prettyYaml = useMemo(() => {
    if (lang !== "yaml") return null;
    try {
      const parsed = yamlLoad(value);
      return JSON.stringify(parsed, null, 2);
    } catch (e) {
      return `Invalid YAML: ${e instanceof Error ? e.message : String(e)}`;
    }
  }, [lang, value]);

  const prettyXml = useMemo(() => {
    if (lang !== "xml") return null;
    // basic indentation for a structural preview (not a validator)
    const indented = value
      .replace(/></g, ">\n<")
      .split("\n")
      .reduce<{ depth: number; lines: string[] }>(
        (acc, line) => {
          if (/^<\/.+/.test(line.trim())) acc.depth = Math.max(0, acc.depth - 1);
          acc.lines.push("  ".repeat(acc.depth) + line.trim());
          if (/^<[^/!?].*[^/]>$/.test(line.trim()) && !/^<\?/.test(line.trim())) {
            acc.depth += 1;
          }
        return acc;
      },
      { depth: 0, lines: [] },
    );
    return indented.lines.join("\n");
  }, [lang, value]);

  const htmlPreview = useMemo(() => {
    if (isMarkdown) {
      const rendered = marked.parse(value, { async: false });
      return DOMPurify.sanitize(rendered);
    }
    if (prettyJson) {
      return `<pre class="code">${DOMPurify.sanitize(prettyJson.replace(/</g, "&lt;"))}</pre>`;
    }
    if (prettyYaml) {
      return `<pre class="code">${DOMPurify.sanitize(prettyYaml.replace(/</g, "&lt;"))}</pre>`;
    }
    if (prettyXml) {
      return `<pre class="code">${DOMPurify.sanitize(prettyXml.replace(/</g, "&lt;"))}</pre>`;
    }
    return null;
  }, [isMarkdown, prettyJson, prettyYaml, prettyXml, value]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-border/60 bg-[#0D1117] px-2 py-1">
        <div className="flex items-center gap-1 text-[11px] text-zinc-500">
          <span className="font-medium text-zinc-300">{tab.path.split("/").pop()}</span>
          {dirty && <span className="text-amber-400">●</span>}
          <span className="mx-1 text-zinc-700">|</span>
          <span>{lang.toUpperCase()}</span>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className={`h-7 gap-1 px-2 text-xs ${wordWrap ? "text-sky-400" : "text-zinc-500"}`}
            onClick={onWordWrapToggle}
          >
            <WrapText className="size-3.5" /> Wrap
          </Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-zinc-500" onClick={() => onFontSizeChange(fontSize - 1)}>
            <Minus className="size-3.5" />
          </Button>
          <span className="text-xs text-zinc-500 tabular-nums">{fontSize}px</span>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-zinc-500" onClick={() => onFontSizeChange(fontSize + 1)}>
            <Plus className="size-3.5" />
          </Button>
        </div>
      </div>
      <div className="relative min-h-0 flex-1">
        <Editor
          path={tab.path}
          language={monacoLang(lang)}
          value={value}
          theme={theme === "dark" ? "ide-dark" : "vs"}
          onMount={handleMount}
          onChange={(v: string | undefined) => onChange(v ?? "")}
          options={{
            fontSize,
            wordWrap: wordWrap ? "on" : "off",
            minimap: { enabled: true, scale: 1 },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            fontFamily: "'JetBrains Mono', 'Fira Code', Menlo, monospace",
            fontLigatures: true,
            renderWhitespace: "selection",
            bracketPairColorization: { enabled: true },
            folding: true,
            smoothScrolling: true,
            cursorBlinking: "smooth",
            padding: { top: 8 },
          }}
        />
        {htmlPreview && (
          <div
            className="prose-preview pointer-events-none absolute inset-0 z-10 overflow-auto bg-background/95 p-4 backdrop-blur-sm"
            dangerouslySetInnerHTML={{ __html: htmlPreview }}
          />
        )}
      </div>
    </div>
  );
}
