// Tests for the automatic closing-tag decision logic.
// Run: bun scripts/test-tag-close.ts

import {
  buildMaskFromTokens,
  decideTagClose,
  shouldAutoCloseTag,
  supportsTagAutoClose,
  toLines,
} from "../src/lib/tagAutoClose";

let pass = 0;
let fail = 0;

function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    pass++;
    console.log(`  ok  ${name}`);
  } else {
    fail++;
    console.log(`FAIL  ${name}\n      expected ${JSON.stringify(expected)}\n      actual   ${JSON.stringify(actual)}`);
  }
}

/** Typing simulation: append ">" at the end of `before` and decide at the new cursor. */
function type(before: string, langId: string) {
  const text = before + ">";
  const offset = text.length;
  const mask = maskStringsAndComments(text);
  const isHtmlXml = langId === "html" || langId === "xml";
  // Stand-in for the tokenizer delimiter check: ">" closes a tag when the
  // nearest unmasked "<" backwards still has an unclosed tag shape.
  let typedGtIsTagEnd = true;
  if (isHtmlXml) {
    typedGtIsTagEnd = looksLikeTagEnd(text, offset - 1, mask);
  }
  return decideTagClose(text, offset, langId, (i) => mask[i] ?? false, typedGtIsTagEnd);
}

/** Masks string literals, template literals and comments (test stand-in for tokens). */
function maskStringsAndComments(text: string): boolean[] {
  const mask = new Array<boolean>(text.length).fill(false);
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    const n = text[i + 1] ?? "";
    if (c === "/" && n === "/") {
      while (i < text.length && text[i] !== "\n") mask[i++] = true;
    } else if (c === "/" && n === "*") {
      mask[i] = mask[i + 1] = true;
      i += 2;
      while (i < text.length) {
        mask[i] = true;
        if (text[i] === "*" && text[i + 1] === "/") {
          mask[i + 1] = true;
          i += 2;
          break;
        }
        i++;
      }
    } else if (c === '"' || c === "'" || c === "`") {
      const q = c;
      mask[i++] = true;
      while (i < text.length) {
        mask[i] = true;
        if (text[i] === "\\") {
          if (i + 1 < text.length) mask[i + 1] = true;
          i += 2;
          continue;
        }
        const done = text[i] === q;
        i++;
        if (done) break;
      }
    } else {
      i++;
    }
  }
  return mask;
}

/** Cheap "is this > the end of a tag" check (mirrors the delimiter token rule). */
function looksLikeTagEnd(text: string, gt: number, mask: boolean[]): boolean {
  if (mask[gt]) return false;
  let i = gt - 1;
  let depth = 0;
  while (i >= 0) {
    if (mask[i]) {
      i--;
      continue;
    }
    if (text[i] === ">") {
      depth++;
      i--;
      continue;
    }
    if (text[i] === "<") {
      if (depth > 0) {
        depth--;
        i--;
        continue;
      }
      const next = text[i + 1] ?? "";
      return /[A-Za-z]/.test(next) || next === "/" || next === "!" || next === "?";
    }
    i--;
  }
  return false;
}

function insert(tag: string) {
  return { action: "insert", tagName: tag };
}
function none(reason: string) {
  return { action: "none", reason };
}

// ---------------------------------------------------------------- HTML ---

check("html: <div> closes", type("<div", "html"), insert("div"));
check("html: <section> closes", type("<section", "html"), insert("section"));
check("html: <button> closes", type("<button", "html"), insert("button"));
check("html: nested <div><span> closes inner", type("<div><span", "html"), insert("span"));
check("html: attributes double-quoted", type('<div class="foo" id="bar"', "html"), insert("div"));
check("html: attribute unquoted", type("<div class=foo", "html"), insert("div"));
check("html: attribute single-quoted", type("<div class='foo'", "html"), insert("div"));
check("html: multiline tag", type('<div\n  class="x"\n  id="y"', "html"), insert("div"));
check("html: uppercase tag", type("<DIV", "html"), insert("DIV"));
check("html: hyphenated custom element", type("<my-widget", "html"), insert("my-widget"));
check("html: self-closing <img />", type("<img /", "html"), none("excluded-tag"));
check("html: self-closing <section />", type("<section /", "html"), none("self-closing"));
check("html: self-closing <div/>", type("<div/", "html"), none("self-closing"));
check("html: void <br>", type("<br", "html"), none("excluded-tag"));
check("html: void <input>", type("<input", "html"), none("excluded-tag"));
check("html: void <img>", type("<img", "html"), none("excluded-tag"));
check("html: void <hr>", type("<hr", "html"), none("excluded-tag"));
check("html: <p> not auto-closed", type("<p", "html"), none("excluded-tag"));
check("html: doctype not closed", type("<!DOCTYPE html", "html"), none("declaration"));
check("html: comment start not closed", type("<!-" + "- comment ", "html"), none("declaration"));
check("html: closing tag typed manually", type("</div", "html"), none("closing-tag"));
check("html: > in plain text ignored", type("if a ", "html"), none("not-tag-delimiter"));
check(
  "html: > inside attribute string ignored",
  type('<div title="a ', "html"),
  none("typed-inside-string-or-comment"),
);
check(
  "html: > inside comment ignored",
  type("<!-- note ", "html"),
  none("declaration"),
);
check(
  "html: no duplicate when closer exists after cursor",
  (() => {
    const text = "<div> </div>";
    const mask = maskStringsAndComments(text);
    return decideTagClose(text, 5, "html", (i) => mask[i] ?? false, true);
  })(),
  none("closing-exists"),
);
check(
  "html: no duplicate when closer typed further down",
  (() => {
    const text = "<div>\n  hello\n</div>";
    const mask = maskStringsAndComments(text);
    return decideTagClose(text, 5, "html", (i) => mask[i] ?? false, true);
  })(),
  none("closing-exists"),
);
check(
  "html: sibling closer does not block",
  type("<div></div><div", "html"),
  insert("div"),
);

// ----------------------------------------------------------------- XML ---

check("xml: custom tag closes", type("<note", "xml"), insert("note"));
check("xml: namespaced tag closes", type("<ns:item", "xml"), insert("ns:item"));
check("xml: self-closing", type("<node /", "xml"), none("self-closing"));
check("xml: processing instruction ignored", type("<?xml version='1.0'", "xml"), none("declaration"));
check("xml: cdata close ignored", type("<![CDATA[x", "xml"), none("declaration"));
check("xml: sibling closer does not block", (() => {
  const text = "<a></a><a";
  const t = text + ">";
  const mask = maskStringsAndComments(t);
  return decideTagClose(t, t.length, "xml", (i) => mask[i] ?? false, true);
})(), insert("a"));

// ------------------------------------------------------------ JSX / TSX ---

check("jsx: const el = <div> closes", type("const el = <div", "javascript"), insert("div"));
check("jsx: return <section> closes", type("return <section", "javascript"), insert("section"));
check("jsx: component <Button> closes", type("const x = <Button", "javascript"), insert("Button"));
check("jsx: tsx component closes", type("const x = <Foo.Bar", "typescript"), insert("Foo.Bar"));
check("jsx: nested elements", type("const x = <div><span", "javascript"), insert("span"));
check("jsx: prop with braces", type("<div className={cls}", "javascript"), insert("div"));
check("jsx: prop with expression + spaces", type("<div style={{ margin: 4 }} id='a'", "javascript"), insert("div"));
check("jsx: comparison x > y ignored", type("const big = x ", "javascript"), none("no-open-bracket"));
check("jsx: generic Array<T> ignored", type("const a: Array<number", "typescript"), none("jsx-not-jsx-context"));
check("jsx: foo < bar > baz ignored", type("const c = foo < bar ", "javascript"), none("jsx-not-jsx-context"));
check("jsx: arrow > inside braces ignored", type("<div onChange={() => count ", "javascript"), none("no-open-bracket"));
check(
  "jsx: > inside complete expression container ok",
  type("<div data-x={s.count > 1}", "javascript"),
  insert("div"),
);
check("jsx: fragment <> not closed", type("const x = <", "javascript"), none("no-tag-name"));
check("jsx: self-closing <Foo />", type("<Foo /", "javascript"), none("self-closing"));
check("jsx: void <img> not closed", type("<img", "javascript"), none("excluded-tag"));
check("jsx: duplicate closer ahead blocks", (() => {
  const text = "const x = <div>\n</div>;";
  const mask = maskStringsAndComments(text);
  return decideTagClose(text, 15, "javascript", (i) => mask[i] ?? false, true);
})(), none("closing-exists"));
check("jsx: string prop containing > ok", type("<div title='a > b'", "javascript"), insert("div"));
check("jsx: multiline props", type("<div\n  a={1}\n  b={2}", "javascript"), insert("div"));
check("jsx: comparison after 'return' keyword not element", type("return a ", "javascript"), none("no-open-bracket"));

// ------------------------------------------------------- helper exports ---

check("supports: html yes", supportsTagAutoClose("html"), true);
check("supports: xml yes", supportsTagAutoClose("xml"), true);
check("supports: javascript yes", supportsTagAutoClose("javascript"), true);
check("supports: typescript yes", supportsTagAutoClose("typescript"), true);
check("supports: python no", supportsTagAutoClose("python"), false);
check("supports: css no", supportsTagAutoClose("css"), false);
check("shouldAutoClose: img no", shouldAutoCloseTag("img", "html"), false);
check("shouldAutoClose: div yes", shouldAutoCloseTag("div", "html"), true);
check("shouldAutoClose: !doctype no", shouldAutoCloseTag("!DOCTYPE", "html"), false);

// mask builder from tokenizer-shaped input
{
  const text = '<div title="a>b">x</div>';
  const { lineStarts } = toLines(text);
  const tokens = [
    [
      { startIndex: 0, scopes: "tag.html" },
      { startIndex: 5, scopes: "delimiter.html" },
      { startIndex: 6, scopes: "attribute.name.html" },
      { startIndex: 12, scopes: "delimiter.html" },
      { startIndex: 13, scopes: "string.html" },
      { startIndex: 18, scopes: "delimiter.html" },
    ],
  ];
  const mask = buildMaskFromTokens(text, lineStarts, tokens);
  const insideString = mask[15];
  const tagName = mask[1];
  check("mask: string region masked", insideString, true);
  check("mask: tag name unmasked", tagName, false);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
