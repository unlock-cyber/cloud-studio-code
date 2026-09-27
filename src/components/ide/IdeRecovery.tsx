// Recovery UI for the editor route.
//
// The editor's queries answer about a specific project inside a specific
// workspace, and the server rejects that read when the workspace is gone
// (expired) or the project isn't the caller's. Without this boundary those
// errors propagate to the app-level error boundary, which shows a raw runtime
// error — the opposite of a recovery path. Here the failure is caught, turned
// into a plain-language explanation, and paired with the two actions that
// actually help: try the load again, or go back to the dashboard (where an
// expired workspace is recreated).
//
// This is deliberately narrow: it only renders when loading genuinely fails.
// A project that simply has no files is a normal, empty project and never
// reaches this component.

import { Component, Fragment, type ReactNode } from "react";
import { AlertTriangle, LayoutDashboard, RotateCcw } from "lucide-react";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";

type RecoveryCopy = { title: string; body: string; expired: boolean };

/** Maps a load failure onto user-facing copy — never the raw server text. */
function recoveryCopy(error: Error): RecoveryCopy {
  const raw = error.message ?? "";
  if (/WORKSPACE_EXPIRED|expired/i.test(raw)) {
    return {
      expired: true,
      title: "This workspace has expired",
      body:
        "A workspace expires after a period of inactivity (1 hour as a guest, 24 hours with an account), and its contents are removed when it does. Your dashboard shows the current state of your projects.",
    };
  }
  if (/not found/i.test(raw)) {
    return {
      expired: false,
      title: "This project isn't available",
      body: "It may have been deleted, or it belongs to another account.",
    };
  }
  return {
    expired: false,
    title: "We couldn't load this workspace",
    body:
      "Something went wrong while loading your files. Your work is stored on the server, so trying again is safe.",
  };
}

type Props = { children: ReactNode; onLeave: (expired: boolean) => void };
type State = { error: Error | null; attempt: number };

class IdeErrorBoundary extends Component<Props, State> {
  state: State = { error: null, attempt: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error) {
    // Details stay in the console rather than in the UI.
    console.error("[IDE] workspace load failed:", error);
  }

  private retry = () => {
    // Remounting the editor re-issues its queries.
    this.setState((prev) => ({ error: null, attempt: prev.attempt + 1 }));
  };

  render() {
    const { error } = this.state;
    if (!error) {
      return <Fragment key={this.state.attempt}>{this.props.children}</Fragment>;
    }
    const copy = recoveryCopy(error);
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
        <div className="w-full max-w-md rounded-xl border border-border/80 bg-card p-6 text-center shadow-xl shadow-black/5">
          <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-amber-500/10">
            <AlertTriangle className="size-5 text-amber-500" />
          </div>
          <h1 className="mt-3 text-base font-semibold">{copy.title}</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{copy.body}</p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <Button size="sm" onClick={this.retry}>
              <RotateCcw className="size-3.5" /> Try again
            </Button>
            <Button size="sm" variant="outline" onClick={() => this.props.onLeave(copy.expired)}>
              <LayoutDashboard className="size-3.5" /> Back to dashboard
            </Button>
          </div>
        </div>
      </main>
    );
  }
}

export function IdeRecovery({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  return (
    <IdeErrorBoundary
      onLeave={(expired) => navigate(expired ? "/dashboard?expired=1" : "/dashboard")}
    >
      {children}
    </IdeErrorBoundary>
  );
}
