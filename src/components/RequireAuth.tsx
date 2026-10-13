import { useConvexAuth } from "convex/react";
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { resolveAuthGuard } from "@/lib/authGuard";

export function RequireAuth({ children }: { children: ReactNode }) {
  // `useConvexAuth()` is loading until the stored session has been read *and*
  // confirmed by the backend. Gating on that single signal — rather than
  // treating "no token yet" as signed out — is what keeps a restored session on
  // its intended route instead of flashing /auth. See src/lib/authGuard.ts.
  const { isLoading, isAuthenticated } = useConvexAuth();
  const location = useLocation();

  const decision = resolveAuthGuard({
    isLoading,
    isAuthenticated,
    returnTo: `${location.pathname}${location.search}`,
  });

  if (decision.kind === "redirect") {
    return <Navigate to={decision.to} replace />;
  }

  if (decision.kind === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
          <span className="text-sm">Checking your session…</span>
        </div>
      </main>
    );
  }

  return children;
}
