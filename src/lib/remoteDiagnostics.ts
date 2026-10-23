// Short, accurate notes printed *next to* a remote compiler's own diagnostics.
//
// The compiler's output is always shown first and unchanged — a note never
// replaces, rewords or hides it, and no source is ever rewritten on the user's
// behalf. Notes only explain a failure mode that is genuinely confusing and
// that the compiler cannot explain by itself.

import type { LangId } from "./languages";

/**
 * `conio.h` is a DOS/Windows-only header; the remote sandbox is Linux, so GCC
 * and G++ report a missing file. The error is correct, but "No such file or
 * directory" reads like a broken toolchain, so the note names the real cause
 * and the replacements that actually exist on this runtime.
 */
const CONIO_NOTE =
  "[note] conio.h is a non-standard DOS/Windows header (Turbo C, MSVC) and does not exist on the Linux-based remote compiler, so the error above is accurate — it is not a toolchain failure. Portable replacements: clear the screen by printing " +
  'the ANSI escape "\\x1b[2J\\x1b[H" and move the cursor with "\\x1b[<row>;<col>H" (std::cout or printf); read input with std::cin / std::getline or scanf. ' +
  "getch(), kbhit() and textcolor() have no standard equivalent, so they have to be replaced or removed before this file can compile.";

/**
 * A missing-header diagnostic looks like:
 *   main.cpp:1:10: fatal error: conio.h: No such file or directory
 * (GCC and Clang word it the same way.) The source echo that follows also
 * contains `#include <conio.h>`, which is why the note is keyed on the
 * "No such file or directory" line rather than on the header name alone.
 */
const MISSING_CONIO =
  /\bconio\.h\b[^\n]*no such file or directory/i;

/**
 * Notes for a finished remote compile. Empty for every language the header is
 * irrelevant to, and empty when the output does not show that exact failure —
 * so a program that merely *mentions* conio.h (a string literal, a different
 * error) is left alone.
 */
export function compileDiagnosticNotes(
  lang: LangId,
  compileOutput: string | null | undefined,
): string[] {
  if (!compileOutput) return [];
  if (lang !== "c" && lang !== "cpp") return [];
  return MISSING_CONIO.test(compileOutput) ? [CONIO_NOTE] : [];
}
