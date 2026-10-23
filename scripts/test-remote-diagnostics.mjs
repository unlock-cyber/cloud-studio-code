// Remote compiler note regression test — run with:
//   bun scripts/test-remote-diagnostics.mjs
//
// The notes exist only to explain a known, confusing failure next to the real
// compiler output. These checks pin the two invariants that matter:
//   1. the conio.h case produces a note that names the real cause;
//   2. nothing else produces a note, and the note never claims the code was
//      changed — the runner prints the compiler's own text unchanged, first.

import { compileDiagnosticNotes } from "../src/lib/remoteDiagnostics.ts";

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

// Verbatim shape of GCC's output for a missing header (C++ and C).
const CPP_CONIO = [
  "/usr/src/app/main.cpp:1:10: fatal error: conio.h: No such file or directory",
  "    1 | #include <conio.h>",
  "      |          ^~~~~~~~~",
  "compilation terminated.",
].join("\n");

const C_CONIO = [
  "/usr/src/app/main.c:2:10: fatal error: conio.h: No such file or directory",
  "    2 | #include <conio.h>",
  "      |          ^~~~~~~~~",
  "compilation terminated.",
].join("\n");

check("C++ conio.h failure produces exactly one note", () => {
  const notes = compileDiagnosticNotes("cpp", CPP_CONIO);
  if (notes.length !== 1) throw new Error(`expected 1 note, got ${notes.length}`);
});

check("C conio.h failure produces the note as well", () => {
  const notes = compileDiagnosticNotes("c", C_CONIO);
  if (notes.length !== 1) throw new Error(`expected 1 note, got ${notes.length}`);
});

check("the note names conio.h and explains it is non-standard", () => {
  const [note] = compileDiagnosticNotes("cpp", CPP_CONIO);
  if (!/\bconio\.h\b/.test(note)) throw new Error("note does not name conio.h");
  if (!/non-standard/i.test(note)) throw new Error("note does not say non-standard");
  if (!/DOS\/Windows/i.test(note)) throw new Error("note does not name the platform");
});

check("the note states the compiler error is accurate, not a tool failure", () => {
  const [note] = compileDiagnosticNotes("cpp", CPP_CONIO);
  if (!/error above is accurate/i.test(note)) throw new Error("note does not confirm the error");
  if (!/not a toolchain failure/i.test(note)) throw new Error("note does not rule out a tool failure");
});

check("the note offers only real alternatives and admits what has none", () => {
  const [note] = compileDiagnosticNotes("cpp", CPP_CONIO);
  if (!/(std::cin|std::getline|scanf)/.test(note)) {
    throw new Error("note gives no portable input replacement");
  }
  if (!/no standard equivalent/i.test(note)) throw new Error("note overpromises for getch/kbhit");
  if (!/replace or remove|replaced or removed/i.test(note)) throw new Error("note does not say what to do");
});

check("a different missing header gets no note", () => {
  const out = "/usr/src/app/main.cpp:1:10: fatal error: graphics.h: No such file or directory\ncompilation terminated.";
  if (compileDiagnosticNotes("cpp", out).length !== 0) throw new Error("unexpected note for graphics.h");
});

check("an ordinary syntax error gets no note", () => {
  const out = "/usr/src/app/main.cpp:3:1: error: expected ';' before 'return'";
  if (compileDiagnosticNotes("cpp", out).length !== 0) throw new Error("unexpected note for syntax error");
});

check("mentioning conio.h without the missing-file diagnostic gets no note", () => {
  const out = "/usr/src/app/main.cpp:4:5: error: 'conio' was not declared in this scope";
  if (compileDiagnosticNotes("cpp", out).length !== 0) throw new Error("unexpected note");
});

check("non-C/C++ languages never get the note", () => {
  for (const lang of ["python", "java", "javascript", "typescript", "bash", "sql"]) {
    if (compileDiagnosticNotes(lang, CPP_CONIO).length !== 0) {
      throw new Error(`unexpected note for ${lang}`);
    }
  }
});

check("empty / missing compile output gets no note", () => {
  if (compileDiagnosticNotes("cpp", "").length !== 0) throw new Error("note for empty output");
  if (compileDiagnosticNotes("cpp", null).length !== 0) throw new Error("note for null output");
  if (compileDiagnosticNotes("cpp", undefined).length !== 0) throw new Error("note for undefined output");
});

check("the note does not pretend the source was rewritten", () => {
  const [note] = compileDiagnosticNotes("cpp", CPP_CONIO);
  if (/rewrit|removed (the|your) include|automatically/i.test(note)) {
    throw new Error("note implies the source was changed");
  }
});


if (failures.length > 0) {
  console.error(`\n${failed} failed, ${passed} passed`);
  for (const f of failures) console.error(`  ✗ ${f.name}: ${f.error}`);
  process.exit(1);
}
console.log(`ok — ${passed} remote-diagnostic checks passed`);
