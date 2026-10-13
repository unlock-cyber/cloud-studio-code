// Auth-route guard regression test — run with:
//   bun scripts/test-auth-guard.mjs
//
// Update 8 fixed a dashboard flicker: a restored session was briefly treated as
// signed out and bounced through /auth before returning. The guard decision is
// pure, so it is tested directly here:
//   * a session that is still being resolved keeps the user where they are;
//   * a confirmed session is allowed through;
//   * only a confirmed signed-out state redirects, and it preserves the target.

import { resolveAuthGuard } from "../src/lib/authGuard.ts";
import assert from "node:assert/strict";

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

check("a session still being checked stays put (no /auth bounce)", () => {
  const decision = resolveAuthGuard({
    isLoading: true,
    isAuthenticated: false,
    returnTo: "/dashboard",
  });
  assert.deepEqual(decision, { kind: "loading" });
});

check("a confirmed session is allowed through", () => {
  const decision = resolveAuthGuard({
    isLoading: false,
    isAuthenticated: true,
    returnTo: "/dashboard",
  });
  assert.deepEqual(decision, { kind: "allow" });
});

check("a staying-signed-out user is redirected to auth with the return path", () => {
  const decision = resolveAuthGuard({
    isLoading: false,
    isAuthenticated: false,
    returnTo: "/ide/abc?panel=preview",
  });
  assert.equal(decision.kind, "redirect");
  assert.equal(
    decision.to,
    `/auth?returnTo=${encodeURIComponent("/ide/abc?panel=preview")}`,
  );
});

check("an authenticated user is never redirected even if it is still loading", () => {
  const decision = resolveAuthGuard({
    isLoading: true,
    isAuthenticated: true,
    returnTo: "/dashboard",
  });
  assert.equal(decision.kind, "loading");
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failures.length) {
  console.log("\nFailures:");
  for (const f of failures) console.log(`  ✗ ${f.name}: ${f.error}`);
  process.exit(1);
}
