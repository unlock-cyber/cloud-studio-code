// The decision an authenticated-route guard makes while the session resolves.
//
// Convex reports auth in two stages: the auth provider first reads any stored
// token, then the backend confirms it. Until that whole sequence finishes,
// `useConvexAuth().isLoading` is true and `isAuthenticated` is false — which is
// NOT the same as "signed out". Treating that window as signed out is what
// bounced a restored session from /dashboard through /auth and back again.
//
// The rule is therefore: while the status is unknown, stay put and show a
// loading state; redirect only once the status is known to be unauthenticated.

export type AuthGuardDecision =
  | { kind: "loading" }
  | { kind: "redirect"; to: string }
  | { kind: "allow" };

export function resolveAuthGuard(input: {
  isLoading: boolean;
  isAuthenticated: boolean;
  returnTo: string;
}): AuthGuardDecision {
  if (input.isLoading) return { kind: "loading" };
  if (!input.isAuthenticated) {
    return {
      kind: "redirect",
      to: `/auth?returnTo=${encodeURIComponent(input.returnTo)}`,
    };
  }
  return { kind: "allow" };
}
