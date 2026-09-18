import { useConvexAuth } from "convex/react";
import { useAuth as useProviderAuth } from "@convex-dev/auth/react";
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";

export function RequireAuth({ children }: { children: ReactNode }) {
  // Two layers of auth state:
  //  - the auth provider (a token exists in storage) — flips true immediately
  //    after signIn() resolves
  //  - the Convex backend validation of that token — flips true a moment
  //    later, after a network round-trip
  // Treating only the second layer as "authenticated" bounces users who have
  // *just* signed in (guests from the landing page, or users completing OTP)
  // straight back to /auth during that window. The provider token is the
  // source of truth for whether a session exists, so we key off it.
  const { isLoading: providerLoading, isAuthenticated: providerAuthenticated } =
    useProviderAuth();
  const { isLoading: convexLoading, isAuthenticated: convexAuthenticated } =
    useConvexAuth();
  const location = useLocation();

  // No session token at all (and the provider finished loading) → signed out.
  if (!providerLoading && !providerAuthenticated) {
    const returnTo = `${location.pathname}${location.search}`;
    return (
      <Navigate
        to={`/auth?returnTo=${encodeURIComponent(returnTo)}`}
        replace
      />
    );
  }

  // Token exists but Convex hasn't validated it yet → still loading.
  // (Never redirect from here: it would strand fresh sign-ins on /auth.)
  if (providerLoading || (convexLoading && !convexAuthenticated)) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  return children;
}
