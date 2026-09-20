import { useEffect, useMemo, useRef } from "react";
import { Editor, defineIdeTheme, setMonacoTheme, type Monaco } from "@/lib/monacoSetup";
import {
  handleTypedGt,
  supportsTagAutoClose,
  type TokenizeFn,
} from "@/lib/tagAutoClose";
import { useMonaco } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { monacoLang, langFromPath, type LangId } from "@/lib/languages";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { load as yamlLoad } from "js-yaml";
import { Button } from "@/components/ui/button";
import { WrapText, Minus, Plus, Sun, Moon } from "lucide-react";

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
  onThemeToggle: () => void;
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
  onThemeToggle,
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

    // Automatic closing tags for HTML / JSX / TSX / XML.
    // Monaco core has no autoClosingTags option (VS Code extension feature),
    // so we react to a typed ">" and decide with the language's own tokenizer
    // (strings/comments masked, tag delimiters verified). Brackets and quotes
    // keep Monaco's native autoClosingPairs behavior.
    ed.onDidChangeModelContent((e) => {
      const model = ed.getModel();
      if (!model || e.isUndoing || e.isRedoing) return;
      const mLang = model.getLanguageId();
      if (!supportsTagAutoClose(mLang)) return;

      // Only react to typing a single ">": a pure insertion of ">" (not
      // paste, not multi-cursor, not undo/redo). Derive the cursor offset
      // from the change itself — NOT from editor.getSelections(), which can
      // still hold the pre-typing position while the event is dispatched,
      // causing every legitimate ">" to be silently rejected.
      const last = e.changes[e.changes.length - 1];
      if (!last || last.text !== ">" || last.rangeLength !== 0) return;
      const offset = last.rangeOffset + last.text.length; // cursor sits right after the typed ">"
      const value = model.getValue();
      if (value.charAt(offset - 1) !== ">") return;
      const cursorPos = model.getPositionAt(offset);

      // Tokenize with the language's own grammar (falls back to a lexical
      // mask when the tokenizer is unavailable) and decide.
      const result = handleTypedGt(
        value,
        offset,
        mLang,
        0, // pure insertion
        // NOTE: Monaco's .d.ts types editor.tokenize as Token[][] but the
        // runtime returns Monarch tokens — cast to the real shape.
        m.editor.tokenize as unknown as TokenizeFn | undefined,
        cursorPos.lineNumber - 1,
      );
      if (!result) return;

      const insertClose = () => {
        ed.executeEdits(
          "tag-autoclose",
          [
            {
              range: new m.Range(
                cursorPos.lineNumber,
                cursorPos.column,
                cursorPos.lineNumber,
                cursorPos.column,
              ),
              text: `</${result.tagName}>`,
            },
          ],
          [
            new m.Selection(
              cursorPos.lineNumber,
              cursorPos.column,
              cursorPos.lineNumber,
              cursorPos.column,
            ),
          ],
        );
      };
      try {
        insertClose();
      } catch {
        // Some Monaco versions forbid edits during event dispatch — retry
        // right after it finishes; the cursor is unchanged.
        window.setTimeout(insertClose, 0);
      }
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
      <div className="flex items-center gap-2 overflow-x-auto border-b border-border/60 bg-background px-2 py-1">
        <div className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
          <span className="max-w-[120px] truncate font-medium text-foreground/90 sm:max-w-none">{tab.path.split("/").pop()}</span>
          {dirty && <span className="text-amber-500 dark:text-amber-400">●</span>}
          <span className="mx-1 text-border">|</span>
          <span className="hidden sm:inline">{lang.toUpperCase()}</span>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-muted-foreground"
            onClick={onThemeToggle}
            title={theme === "dark" ? "Switch editor + UI to light mode" : "Switch editor + UI to dark mode"}
          >
            {theme === "dark" ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={`h-7 gap-1 px-2 text-xs ${wordWrap ? "text-sky-600 dark:text-sky-400" : "text-muted-foreground"}`}
            onClick={onWordWrapToggle}
          >
            <WrapText className="size-3.5" /> Wrap
          </Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground" onClick={() => onFontSizeChange(fontSize - 1)}>
            <Minus className="size-3.5" />
          </Button>
          <span className="text-xs text-muted-foreground tabular-nums">{fontSize}px</span>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground" onClick={() => onFontSizeChange(fontSize + 1)}>
            <Plus className="size-3.5" />
          </Button>
        </div>
      </div>
      <div className="relative min-h-0 flex-1">
        <Editor
          path={tab.path}
          language={monacoLang(lang)}
          value={value}
          theme={theme === "dark" ? "ide-dark" : "ide-light"}
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
