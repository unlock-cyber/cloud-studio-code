// Automatic closing-tag insertion for HTML / JSX / TSX / XML in Monaco.
//
// Monaco core has no native autoClosingTags option (that is a VS Code
// extension feature), so we implement the behavior VS Code itself uses:
// react to a typed ">", decide from tokenizer-level context whether the tag
// just typed still needs its closing tag, and insert "</name>" with the
// cursor left inside the element. Brackets/quotes keep Monaco's native
// autoClosingPairs behavior untouched.
//
// Decision inputs:
//  - the document text and the cursor offset (right after the typed ">")
//  - the language mode (html / xml / javascript / typescript)
//  - a mask marking positions inside strings/comments/regexps, built from
//    Monaco's own tokenizer (monaco.editor.tokenize) so grammar rules stay
//    with the grammar
//  - for HTML/XML: whether the typed ">" itself is tokenized as a tag
//    delimiter (prevents firing on ">" in plain text or inside strings)
//
// The core is a pure function and is covered by scripts/test-tag-close.ts.

export type TagCloseDecision =
  | { action: "insert"; tagName: string }
  | { action: "none"; reason: string };

/** Monaco language ids that get tag auto-closing. */
export function supportsTagAutoClose(monacoLangId: string): boolean {
  return (
    monacoLangId === "html" ||
    monacoLangId === "xml" ||
    monacoLangId === "javascript" ||
    monacoLangId === "typescript"
  );
}

const VOID_HTML_TAGS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input",
  "link", "meta", "param", "source", "track", "wbr",
]);

/**
 * Tag names that must never be auto-closed: void/self-closing elements,
 * comments/CDATA/doctype/processing instructions, and (in HTML only) <p>,
 * whose end tag is optional — auto-inserting it surprises users.
 */
export function shouldAutoCloseTag(tagName: string, langId: string): boolean {
  const name = tagName.toLowerCase();
  if (!name) return false;
  if (name.startsWith("!") || name.startsWith("?")) return false;
  if (name === "doctype") return false;
  if (VOID_HTML_TAGS.has(name)) return false;
  if (langId === "html" && name === "p") return false;
  return true;
}

const WS = " \t\n\r";
const TAG_NAME_RE = /^[A-Za-z][A-Za-z0-9._:-]*/;
/** Characters that may legally appear unmasked between a tag name and ">" . */
const TAG_BODY_OK_RE = /^[A-Za-z0-9_.:\-@#= \t\n\r]*$/;
/** Keywords that may directly precede a JSX element. */
const JSX_PARENT_KEYWORDS = new Set([
  "return", "typeof", "instanceof", "in", "of", "case", "delete",
  "void", "new", "await", "yield", "do", "else", "default", "throw",
]);

function charAt(text: string, offset: number): string {
  return offset >= 0 && offset < text.length ? text[offset] : "";
}

/** Splits `text` into lines plus their start offsets in one pass. */
export function toLines(text: string): { lines: string[]; lineStarts: number[] } {
  const lines: string[] = [];
  const lineStarts: number[] = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\n") {
      lines.push(text.slice(start, i));
      lineStarts.push(start);
      start = i + 1;
    }
  }
  lines.push(text.slice(start));
  lineStarts.push(start);
  return { lines, lineStarts };
}

/** Monarch scope segments that mean "not markup". */
const MASKED_SCOPES = new Set(["string", "comment", "regexp"]);

/**
 * Builds a mask aligned with `text` from `monaco.editor.tokenize` output:
 * mask[offset] is true when the position sits inside a string, comment or
 * regexp token according to the language's own grammar.
 */
export function buildMaskFromTokens(
  text: string,
  lineStarts: number[],
  tokensPerLine: Array<Array<{ startIndex: number; scopes: string }>>,
): boolean[] {
  const mask = new Array<boolean>(text.length).fill(false);
  for (let ln = 0; ln < tokensPerLine.length; ln++) {
    const base = lineStarts[ln] ?? 0;
    const toks = tokensPerLine[ln] ?? [];
    for (let t = 0; t < toks.length; t++) {
      const start = base + toks[t].startIndex;
      let end: number;
      if (t + 1 < toks.length) {
        end = base + toks[t + 1].startIndex;
      } else {
        const nl = text.indexOf("\n", base);
        end = nl === -1 ? text.length : nl;
      }
      const isMasked = toks[t].scopes.split(".").some((s) => MASKED_SCOPES.has(s));
      if (!isMasked) continue;
      for (let i = start; i < Math.min(end, text.length); i++) mask[i] = true;
    }
  }
  return mask;
}

/** True when the Monarch scope string marks a tag delimiter ("<" or ">"). */
export function scopeIsTagDelimiter(scope: string): boolean {
  return scope.split(".").some((s) => s === "delimiter");
}

/**
 * Finds the end index (inclusive) of the tag starting at `<`-position `lt`,
 * skipping masked regions and quoted attribute values. Returns -1 if the
 * tag does not end with a plain ">" within `limit`.
 */
function tagEndIndex(
  text: string,
  lt: number,
  limit: number,
  isMasked: (i: number) => boolean,
): number {
  let p = lt + 1;
  while (p <= limit) {
    if (isMasked(p)) {
      p++;
      continue;
    }
    const c = text[p];
    if (c === "=") {
      p++;
      while (p <= limit && WS.includes(text[p])) p++;
      const q = text[p];
      if (q === '"' || q === "'") {
        p++;
        while (p <= limit && text[p] !== q) p++;
        p++; // past closing quote (or limit+1, loop ends anyway)
      } else {
        while (p <= limit && !WS.includes(text[p]) && text[p] !== ">") p++;
      }
      continue;
    }
    if (c === '"' || c === "'") {
      // Un-tokenized quote (grammar gap): skip opaquely.
      p++;
      while (p <= limit && text[p] !== c) p++;
      p++;
      continue;
    }
    if (c === ">") return p;
    p++;
  }
  return -1;
}

/**
 * Stack-aware check: does a closing tag `</tagName>` exist in the document
 * that pairs with the tag opened at `lt`? Counts same-name tags across the
 * whole document so siblings earlier in the file consume their own closers
 * and never block the insertion; and so an already-typed closer (right after
 * the cursor or further down) prevents a duplicate.
 */
function closerExistsForTag(
  text: string,
  lt: number,
  offset: number,
  tagName: string,
  isMasked: (i: number) => boolean,
  caseInsensitive: boolean,
): boolean {
  const norm = (s: string) => (caseInsensitive ? s.toLowerCase() : s);
  const target = norm(tagName);

  const visit = (from: number, to: number, onTag: (isClose: boolean, end: number) => void) => {
    let i = from;
    while (i < to) {
      if (isMasked(i) || text[i] !== "<") {
        i++;
        continue;
      }
      let j = i + 1;
      let isClose = false;
      if (charAt(text, j) === "/") {
        isClose = true;
        j++;
      }
      const m = TAG_NAME_RE.exec(text.slice(j, j + 128));
      if (m && norm(m[0]) === target) {
        const end = tagEndIndex(text, i, text.length - 1, isMasked);
        if (end !== -1) {
          const selfClosing = text[end - 1] === "/";
          onTag(isClose && !selfClosing, end);
          i = end + 1;
          continue;
        }
      }
      i++;
    }
  };

  // Depth of same-name open tags before our tag.
  let depthBefore = 0;
  visit(0, lt, (isClose) => {
    if (isClose) depthBefore = Math.max(0, depthBefore - 1);
    else depthBefore++;
  });

  // Scan ahead: a closer that pops our tag's level proves it already exists.
  let depth = depthBefore + 1; // our tag is open at the cursor
  let found = false;
  visit(offset, text.length, (isClose) => {
    if (found) return;
    if (isClose) {
      depth--;
      if (depth === 0) found = true;
    } else {
      depth++;
    }
  });
  return found;
}

/** The significant (non-whitespace) character immediately before `pos`. */
function sigCharBefore(text: string, pos: number): { char: string; word: string } {
  let i = pos - 1;
  while (i >= 0 && WS.includes(text[i])) i--;
  if (i < 0) return { char: "", word: "" };
  const c = text[i];
  if (/[A-Za-z_$]/.test(c)) {
    let j = i;
    while (j >= 0 && /[A-Za-z0-9_$]/.test(text[j])) j--;
    return { char: c, word: text.slice(j + 1, i + 1) };
  }
  return { char: c, word: "" };
}

/**
 * The core decision. `text` is the full document, `offset` the cursor
 * position right after the ">" the user just typed. `typedGtIsTagEnd` is
 * supplied by the caller from the tokenizer: for HTML/XML it must be true
 * only when the typed ">" is a tag delimiter token.
 */
export function decideTagClose(
  text: string,
  offset: number,
  langId: string,
  isMasked: (i: number) => boolean,
  typedGtIsTagEnd: boolean,
): TagCloseDecision {
  const isMarkupLang = langId === "html" || langId === "xml";
  const isJsLike = langId === "javascript" || langId === "typescript";

  // The typed character must be ">" at offset - 1 …
  if (charAt(text, offset - 1) !== ">") {
    return { action: "none", reason: "not-gt" };
  }
  // … and it must not live inside a string/comment/regexp.
  if (isMasked(offset - 1)) {
    return { action: "none", reason: "typed-inside-string-or-comment" };
  }
  // HTML/XML: the tokenizer must confirm this ">" closes a tag.
  if (isMarkupLang && !typedGtIsTagEnd) {
    return { action: "none", reason: "not-tag-delimiter" };
  }
  // Only fire at a token boundary (not ">>" for generics, not mid-word).
  const next = charAt(text, offset);
  if (next && next !== "\n" && next !== "\r" && !WS.includes(next)) {
    return { action: "none", reason: "next-not-boundary" };
  }
  // Walk backwards (masked-aware) to the "<" that opens the tag just typed.
  // Balanced brace/bracket/paren groups are skipped opaquely so a ">" typed
  // inside an expression container (e.g. JSX attr={a > b}) can never be
  // mistaken for a tag end and make the scan hop to an earlier tag.
  let i = offset - 2;
  let depth = 0;
  while (i >= 0) {
    if (isMasked(i)) {
      i--;
      continue;
    }
    const c = text[i];
    if (c === ">") {
      depth++;
      i--;
      continue;
    }
    if (c === "<") {
      if (depth > 0) {
        depth--;
        i--;
        continue;
      }
      break;
    }
    if (isJsLike && (c === "}" || c === ")" || c === "]")) {
      let bal = 1;
      i--;
      while (i >= 0 && bal > 0) {
        if (isMasked(i)) {
          i--;
          continue;
        }
        const d = text[i];
        if (d === "}") bal++;
        else if (d === "{") bal--;
        i--;
      }
      continue;
    }
    i--;
  }
  if (i < 0) {
    return { action: "none", reason: "no-open-bracket" };
  }
  const lt = i;

  // JS/TS: the "<" must begin JSX markup, not a comparison or generic.
  if (isJsLike) {
    const sig = sigCharBefore(text, lt);
    const okChar =
      sig.char === "" ||
      /^[({\[;,=?:&|!+\-*/%~>]$/.test(sig.char) ||
      sig.char === "/";
    const okWord = JSX_PARENT_KEYWORDS.has(sig.word.toLowerCase());
    if (!okChar && !okWord) {
      return { action: "none", reason: "jsx-not-jsx-context" };
    }
  }

  const p0 = lt + 1;
  // Closing tag "</…>": nothing to auto-close, never duplicate.
  if (charAt(text, p0) === "/") {
    return { action: "none", reason: "closing-tag" };
  }
  // Comments, CDATA, doctype, processing instructions.
  if (charAt(text, p0) === "!" || charAt(text, p0) === "?") {
    return { action: "none", reason: "declaration" };
  }
  const nameMatch = TAG_NAME_RE.exec(text.slice(p0, p0 + 128));
  if (!nameMatch) {
    return { action: "none", reason: "no-tag-name" }; // includes JSX fragments "<>"
  }
  const tagName = nameMatch[0];
  if (!shouldAutoCloseTag(tagName, langId)) {
    return { action: "none", reason: "excluded-tag" };
  }

  // Attribute-aware scan from the tag name to the ">" at offset - 1.
  let p = p0 + tagName.length;
  let sawGt = false;
  if (isJsLike) {
    // JSX: track expression containers so a ">" typed inside {…} or (…)
    // is never mistaken for the tag end.
    let balance = 0;
    while (p < offset) {
      if (isMasked(p)) {
        p++;
        continue;
      }
      const c = text[p];
      if (c === "{" || c === "(" || c === "[") {
        balance++;
        p++;
        continue;
      }
      if (c === "}" || c === ")" || c === "]") {
        if (balance === 0) return { action: "none", reason: "implausible-tag" };
        balance--;
        p++;
        continue;
      }
      if (balance > 0) {
        p++; // opaque expression content (operators, ternaries, arrows…)
        continue;
      }
      if (c === "/" && charAt(text, p + 1) === ">") {
        return { action: "none", reason: "self-closing" };
      }      if (c === "=") {
        // JSX attribute values are strings or {expressions}; expressions are
        // handled by the balance logic, so only quoted values need skipping
        // here. An unquoted skip would wrongly jump over expression
        // containers and mistake a ">" inside {…} for the tag end.
        p++;
        while (p < offset && WS.includes(text[p])) p++;
        const q = text[p];
        if (q === '"' || q === "'") {
          p++;
          while (p < offset && text[p] !== q) p++;
          if (p < offset) p++;
        }
        continue;
      }
      if (c === '"' || c === "'") {
        p++;
        while (p < offset && text[p] !== c) p++;
        p++;
        continue;
      }
      if (c === ">") {
        // The tag must end exactly at the typed ">" (offset - 1); any other
        // unmasked ">" in the body (e.g. an arrow function's) means this is
        // not the tag we think it is.
        if (p === offset - 1) {
          sawGt = true;
          break;
        }
        return { action: "none", reason: "stray-gt-in-tag" };
      }
      if (!TAG_BODY_OK_RE.test(c)) {
        return { action: "none", reason: "implausible-tag" };
      }
      p++;
    }
    if (!sawGt) return { action: "none", reason: "no-gt" };
    if (balance > 0) return { action: "none", reason: "unbalanced-expr" };
  } else {
    while (p < offset) {
      if (isMasked(p)) {
        p++;
        continue;
      }
      const c = text[p];
      if (c === "/" && charAt(text, p + 1) === ">") {
        return { action: "none", reason: "self-closing" };
      }
      if (c === "=") {
        p++;
        while (p < offset && WS.includes(text[p])) p++;
        const q = text[p];
        if (q === '"' || q === "'") {
          p++;
          while (p < offset && text[p] !== q) p++;
          if (p < offset) p++;
        } else {
          while (p < offset && !WS.includes(text[p]) && text[p] !== ">") p++;
        }
        continue;
      }
      if (c === '"') {
        p++;
        while (p < offset && text[p] !== '"') p++;
        p++;
        continue;
      }
      if (c === ">") {
        if (p === offset - 1) {
          sawGt = true;
          break;
        }
        return { action: "none", reason: "stray-gt-in-tag" };
      }
      if (!TAG_BODY_OK_RE.test(c)) {
        return { action: "none", reason: "implausible-tag" };
      }
      p++;
    }
    if (!sawGt) return { action: "none", reason: "no-gt" };
  }
  // Self-closing written with a trailing space: "<img / >".
  if (charAt(text, offset - 2) === "/") {
    return { action: "none", reason: "self-closing" };
  }

  // Never duplicate a closing tag that already pairs with this element.
  const caseInsensitive = langId === "html";
  if (closerExistsForTag(text, lt, offset, tagName, isMasked, caseInsensitive)) {
    return { action: "none", reason: "closing-exists" };
  }

  return { action: "insert", tagName };
}
