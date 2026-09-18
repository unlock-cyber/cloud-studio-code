// Standalone unit test for src/lib/tagAutoClose.ts — run with:
//   node --experimental-strip-types scripts/test-tag-close.mjs
// (Node >= 22.6) or bun scripts/test-tag-close.mjs

import {
  decideTagClose,
  handleTypedGt,
  buildLexicalMask,
  toLines,
  supportsTagAutoClose,
  shouldAutoCloseTag,
} from "../src/lib/tagAutoClose.ts";
import assert from "node:assert/strict";

const NO_MASK = () => false;

function maskFromQuotedSpans(text) {
  // Test-only mask: same as the lexical fallback (strings + HTML comments).
  return buildLexicalMask(text);
}

let passed = 0;
let failed = 0;
const failures = [];

function check(name, fn) {
  try {
    fn();
    passed++;
  } catch (e) {
    failed++;
    failures.push({ name, error: e.message });
  }
}

function expectInsert(text, gtOffset, lang, _maskFn, tagName) {
  const d = decideTagClose(text, gtOffset, lang, maskFnOf(text), true);
  assert.equal(d.action, "insert", `${name}: expected insert, got ${JSON.stringify(d)}`);
  if (tagName) assert.equal(d.tagName, tagName);
  return d;
}

function maskFnOf(text) {
  const mask = buildLexicalMask(text);
  return (i) => mask[i] ?? false;
}

let name = "";
function setName(n) {
  name = n;
}

// --- HTML ----------------------------------------------------------------

check("HTML: simple paired tag <p>", () => {
  const text = "<p>";
  expectInsert(text, 3, "html", undefined, "p");
});

check("HTML: <div> with attribute", () => {
  const text = '<div class="box">';
  expectInsert(text, text.length, "html", undefined, "div");
});

check("HTML: nested context", () => {
  const text = "<div><p>";
  expectInsert(text, text.length, "html", undefined, "p");
});

check("HTML: void tag <br> must NOT auto-close", () => {
  const text = "<br>";
  const d = decideTagClose(text, 4, "html", NO_MASK, true);
  assert.equal(d.action, "none");
  assert.equal(d.reason, "excluded-tag");
});

check("HTML: void tag <img> must NOT auto-close", () => {
  const text = "<img src=\"x.png\">";
  const d = decideTagClose(text, text.length, "html", NO_MASK, true);
  assert.equal(d.action, "none");
  assert.equal(d.reason, "excluded-tag");
});

check("HTML: self-closing <input /> must NOT auto-close", () => {
  const text = "<input />";
  const d = decideTagClose(text, text.length, "html", NO_MASK, true);
  assert.equal(d.action, "none");
  // "input" is a void element, so it is rejected as excluded even before
  // the self-closing scan runs — both reasons are acceptable outcomes.
  assert.ok(["self-closing", "excluded-tag"].includes(d.reason), `got ${d.reason}`);
});

check("HTML: manually typed closing tag </div> must NOT duplicate", () => {
  // User typed <div></div> — the ">" of the closing tag must not fire.
  const text = "<div></div>";
  const d = decideTagClose(text, text.length, "html", NO_MASK, true);
  assert.equal(d.action, "none");
});

check("HTML: opening tag that already has a closer further down", () => {
  const text = "<div>\n  <p>hello</p>\n</div>";
  // typing ">" of "<p>" again in a place where a closer exists later
  const text2 = "<div><p></p></div>";
  const d = decideTagClose(text2, text2.indexOf("<p>") + 3, "html", NO_MASK, true);
  // The closer </p> exists after the cursor → no duplicate.
  assert.equal(d.action, "none");
});

check("HTML: second opening tag among siblings gets its closer", () => {
  const text = "<ul><li>a</li><li>";
  expectInsert(text, text.length, "html", undefined, "li");
});

check("HTML: '>' inside attribute value is masked (no fire)", () => {
  const text = '<div title="a > b">';
  // The last ">" closes the tag; mask covers only the one inside the string.
  const d = decideTagClose(text, text.length, "html", maskFnOf(text), true);
  assert.equal(d.action, "insert");
  assert.equal(d.tagName, "div");
});

check("HTML: '>' typed while still inside an attribute (no fire)", () => {
  const text = '<div title="a>';
  const d = decideTagClose(text, text.length, "html", maskFnOf(text), true);
  assert.equal(d.action, "none");
});

check("HTML: '>' in plain text (not a tag delimiter) — tokenizer gate", () => {
  const text = "5 > 3";
  // typedGtIsTagEnd=false as the HTML tokenizer reports for plain text
  const d = decideTagClose(text, 5, "html", NO_MASK, false);
  assert.equal(d.action, "none");
});

check("HTML: doctype / comment never auto-close", () => {
  const text = "<!DOCTYPE html>";
  const d = decideTagClose(text, text.length, "html", NO_MASK, true);
  assert.equal(d.action, "none");
});

// --- JSX -----------------------------------------------------------------

check("JSX: return <p>", () => {
  const text = "return <p>";
  expectInsert(text, text.length, "javascript", undefined, "p");
});

check("JSX: <form> after return", () => {
  const text = "return <form>";
  expectInsert(text, text.length, "javascript", undefined, "form");
});

check("JSX: nested JSX", () => {
  const text = "return <div><span>";
  expectInsert(text, text.length, "javascript", undefined, "span");
});

check("JSX: fragment <> is NOT auto-closed", () => {
  const text = "return <>";
  const d = decideTagClose(text, text.length, "javascript", NO_MASK, true);
  assert.equal(d.action, "none");
  assert.equal(d.reason, "no-tag-name");
});

check("JSX: comparison a < b must NOT auto-close", () => {
  // User typed ">" completing a comparison: "if (a <" + ">".
  const text = "if (a <>";
  const d = decideTagClose(text, text.length, "javascript", NO_MASK, true);
  assert.equal(d.action, "none");
  assert.ok(["jsx-not-jsx-context", "no-tag-name"].includes(d.reason), `got ${d.reason}`);
});

check("JSX: self-closing <img />", () => {
  const text = "return <img />";
  const d = decideTagClose(text, text.length, "javascript", NO_MASK, true);
  assert.equal(d.action, "none");
  assert.ok(["self-closing", "excluded-tag"].includes(d.reason), `got ${d.reason}`);
});

check("JSX: component tag", () => {
  const text = "return <Foo>";
  expectInsert(text, text.length, "javascript", undefined, "Foo");
});

check("JSX: attributes on component", () => {
  const text = "return <Foo bar={1}>";
  expectInsert(text, text.length, "javascript", undefined, "Foo");
});

check("JSX: '>' inside expression container must not end the tag", () => {
  const text = "return <Foo bar={a > b}>";
  const d = decideTagClose(text, text.length, "javascript", NO_MASK, true);
  assert.equal(d.action, "insert");
  assert.equal(d.tagName, "Foo");
});

check("TSX: works same as JSX", () => {
  const text = "return <section>";
  expectInsert(text, text.length, "typescript", undefined, "section");
});

check("JSX: button tag with props", () => {
  const text = "return <button onClick={f}>";
  expectInsert(text, text.length, "javascript", undefined, "button");
});

// --- XML -----------------------------------------------------------------

check("XML: paired tag", () => {
  const text = "<note>";
  expectInsert(text, 6, "xml", undefined, "note");
});

check("XML: nested", () => {
  const text = "<root><item>";
  expectInsert(text, text.length, "xml", undefined, "item");
});

check("XML: self-closing", () => {
  const text = "<br />";
  const d = decideTagClose(text, text.length, "xml", NO_MASK, true);
  assert.equal(d.action, "none");
  assert.ok(["self-closing", "excluded-tag"].includes(d.reason), `got ${d.reason}`);
});

check("XML: processing instruction", () => {
  const text = "<?xml version=\"1.0\"?>";
  const d = decideTagClose(text, text.length, "xml", NO_MASK, true);
  assert.equal(d.action, "none");
});

// --- handleTypedGt end-to-end -------------------------------------------

check("handleTypedGt: HTML <p> with lexical fallback (no tokenizer)", () => {
  const r = handleTypedGt("<p>", 3, "html", 0, undefined, 0);
  assert.ok(r);
  assert.equal(r.tagName, "p");
});

check("handleTypedGt: HTML <form>", () => {
  const r = handleTypedGt("<form>", 6, "html", 0, undefined, 0);
  assert.ok(r);
  assert.equal(r.tagName, "form");
});

check("handleTypedGt: HTML <br> no-op", () => {
  const r = handleTypedGt("<br>", 4, "html", 0, undefined, 0);
  assert.equal(r, null);
});

check("handleTypedGt: JSX return <p>", () => {
  const r = handleTypedGt("return <p>", 10, "javascript", 0, undefined, 0);
  assert.ok(r);
  assert.equal(r.tagName, "p");
});

check("handleTypedGt: JSX return <form>", () => {
  const r = handleTypedGt("return <form>", 13, "javascript", 0, undefined, 0);
  assert.ok(r);
  assert.equal(r.tagName, "form");
});

check("handleTypedGt: XML <note>", () => {
  const r = handleTypedGt("<note>", 6, "xml", 0, undefined, 0);
  assert.ok(r);
  assert.equal(r.tagName, "note");
});

check("handleTypedGt: XML overtype path (placeholder \">\" replaced, rangeLength=1)", () => {
  // XML/JSX language configs auto-insert ">" right after a typed "<":
  // "<note>" then completing with the real ">" overtypes the placeholder.
  const r = handleTypedGt("<note>", 6, "xml", 1, undefined, 0);
  assert.ok(r, "overtype path should still insert");
  assert.equal(r.tagName, "note");
});

check("handleTypedGt: HTML with a mock Monarch tokenizer (delimiter gate on)", () => {
  // Simulate monaco.editor.tokenize output for "<p>": one token per line.
  const tokens = [[{ startIndex: 0, scopes: "tag.html" }]];
  const r = handleTypedGt("<p>", 3, "html", 0, () => tokens, 0);
  // scopes don't include "delimiter" → typedGtIsTagEnd=false → no fire.
  assert.equal(r, null);
});

check("handleTypedGt: HTML with proper delimiter tokens fires", () => {
  const tokens = [
    [
      { startIndex: 0, scopes: "delimiter.html" },
      { startIndex: 1, scopes: "tag.html" },
      { startIndex: 2, scopes: "delimiter.html" },
    ],
  ];
  const r = handleTypedGt("<p>", 3, "html", 0, () => tokens, 0);
  assert.ok(r);
  assert.equal(r.tagName, "p");
});

// --- sanity --------------------------------------------------------------

check("supportsTagAutoClose covers html/xml/js/ts", () => {
  assert.ok(supportsTagAutoClose("html"));
  assert.ok(supportsTagAutoClose("xml"));
  assert.ok(supportsTagAutoClose("javascript"));
  assert.ok(supportsTagAutoClose("typescript"));
  assert.ok(!supportsTagAutoClose("python"));
  assert.ok(!supportsTagAutoClose("css"));
});

check("shouldAutoCloseTag excludes voids/declarations", () => {
  for (const t of ["br", "img", "input", "hr", "meta", "link", "!doctype", "?xml"]) {
    assert.ok(!shouldAutoCloseTag(t, "html"), t);
  }
  assert.ok(shouldAutoCloseTag("div", "html"));
  assert.ok(shouldAutoCloseTag("Foo", "javascript"));
});

// --- run -----------------------------------------------------------------

console.log(`\n${passed} passed, ${failed} failed`);
if (failures.length) {
  console.log("\nFailures:");
  for (const f of failures) console.log(`  ✗ ${f.name}: ${f.error}`);
  process.exit(1);
}
