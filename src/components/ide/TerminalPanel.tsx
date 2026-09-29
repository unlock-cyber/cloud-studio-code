import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Square,
  Trash2,
  RotateCw,
  CircleDashed,
  CheckCircle2,
  XCircle,
  Ban,
  History,
  X,
} from "lucide-react";
import type { RunState } from "@/lib/runOrchestrator";
import {
  formatRunDuration,
  formatRunTimeAgo,
  type RunHistoryEntry,
} from "@/lib/runHistory";

export type TerminalLine = {
  id: number;
  kind: "stdout" | "stderr" | "info" | "exit" | "cmd";
  text: string;
  ts: number;
};

type Props = {
  lines: TerminalLine[];
  runState: RunState;
  /** Newest-first log of recent runs (local only). */
  history?: RunHistoryEntry[];
  onClear: () => void;
  onStop: () => void;
  onRerun: () => void;
  canRerun: boolean;
  /** Open the file a past run belonged to. */
  onOpenHistoryFile?: (path: string) => void;
  onClose: () => void;
};

const KIND_CLASS: Record<TerminalLine["kind"], string> = {
  stdout: "text-foreground",
  stderr: "text-red-500 dark:text-red-400",
  info: "text-sky-600 dark:text-sky-400",
  exit: "text-muted-foreground",
  cmd: "text-emerald-600 dark:text-emerald-400",
};

const HISTORY_STATE_CLASS: Record<RunHistoryEntry["state"], string> = {
  success: "text-emerald-600 dark:text-emerald-400",
  failed: "text-red-500 dark:text-red-400",
  stopped: "text-amber-600 dark:text-amber-400",
};

const baseName = (path: string) => path.split("/").pop() ?? path;

export function TerminalPanel({
  lines,
  runState,
  history = [],
  onClear,
  onStop,
  onRerun,
  canRerun,
  onOpenHistoryFile,
  onClose,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

  const busy = runState === "running" || runState === "starting";
  const lastRun = history[0] ?? null;

  const stateBadge = () => {
    switch (runState) {
      case "starting":
        return (
          <Badge variant="secondary" className="gap-1.5">
            <CircleDashed className="size-3 animate-spin" />
            Starting…
          </Badge>
        );
      case "running":
        return (
          <Badge className="gap-1.5 bg-sky-500/15 text-sky-300 border-sky-500/30">
            <span className="size-2 rounded-full bg-sky-400 animate-pulse" /> Running
          </Badge>
        );
      case "success":
        return (
          <Badge className="gap-1.5 bg-emerald-500/15 text-emerald-300 border-emerald-500/30">
            <CheckCircle2 className="size-3" /> Success
          </Badge>
        );
      case "failed":
        return (
          <Badge className="gap-1.5 bg-red-500/15 text-red-300 border-red-500/30">
            <XCircle className="size-3" /> Failed
          </Badge>
        );
      case "stopped":
        return (
          <Badge className="gap-1.5 bg-amber-500/15 text-amber-300 border-amber-500/30">
            <Ban className="size-3" /> Stopped
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="gap-1.5 text-muted-foreground">
            Idle
          </Badge>
        );
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex h-10 shrink-0 items-center gap-2 overflow-x-auto border-b border-border/60 px-2 sm:h-9 sm:px-3">
        <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Terminal
        </span>
        <span className="shrink-0">{stateBadge()}</span>
        {/* Outcome of the most recent run — hidden on the narrowest screens. */}
        {!busy && lastRun && (
          <span className="hidden shrink-0 text-[11px] text-muted-foreground sm:inline">
            {baseName(lastRun.path)} · exit {lastRun.exitCode} · {formatRunDuration(lastRun.durationMs)}
          </span>
        )}
        <div className="ml-auto flex shrink-0 items-center gap-0.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="size-8 gap-1.5 p-0 text-muted-foreground sm:size-7 sm:w-auto sm:px-2"
                title="Recent runs"
              >
                <History className="size-3.5" />
                <span className="hidden sm:inline">History</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>Recent runs</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {history.length === 0 ? (
                <DropdownMenuItem disabled>No runs yet</DropdownMenuItem>
              ) : (
                history.map((entry) => (
                  <DropdownMenuItem
                    key={entry.id}
                    onClick={() => onOpenHistoryFile?.(entry.path)}
                  >
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-xs">{baseName(entry.path)}</span>
                      <span className="truncate text-[10px] text-muted-foreground">
                        {entry.lang} · {formatRunTimeAgo(entry.ts)}
                        {entry.state === "success" ? "" : ` · exit ${entry.exitCode}`}
                      </span>
                    </div>
                    <span className={`shrink-0 text-[10px] font-medium ${HISTORY_STATE_CLASS[entry.state]}`}>
                      {entry.state}
                    </span>
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {busy ? (
            <Button
              variant="ghost"
              size="sm"
              className="size-8 gap-1.5 p-0 text-red-500 hover:text-red-400 sm:size-7 sm:w-auto sm:px-2 dark:text-red-400 dark:hover:text-red-300"
              onClick={onStop}
              title="Stop the running process"
            >
              <Square className="size-3.5" />
              <span className="hidden sm:inline">Stop</span>
            </Button>
          ) : (
            canRerun && (
              <Button
                variant="ghost"
                size="sm"
                className="size-8 gap-1.5 p-0 text-muted-foreground sm:size-7 sm:w-auto sm:px-2"
                onClick={onRerun}
                title="Run the last file again"
              >
                <RotateCw className="size-3.5" />
                <span className="hidden sm:inline">Rerun</span>
              </Button>
            )
          )}
          <Button
            variant="ghost"
            size="sm"
            className="size-8 gap-1.5 p-0 text-muted-foreground sm:size-7 sm:w-auto sm:px-2"
            onClick={onClear}
            title="Clear the terminal output"
          >
            <Trash2 className="size-3.5" />
            <span className="hidden sm:inline">Clear</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="size-8 p-0 text-muted-foreground sm:size-7"
            onClick={onClose}
            title="Close terminal"
          >
            <X className="size-3.5" />
          </Button>
        </div>
      </div>
      <div
        ref={scrollRef}
        className="flex-1 overflow-auto px-2 py-2 font-mono text-[12px] leading-relaxed sm:px-3 sm:text-[12.5px]"
      >
        {lines.length === 0 ? (
          <div className="text-muted-foreground/70">
            <p>
              Output appears here when you run a file. Ctrl/Cmd+Enter runs the active file;
              Ctrl/Cmd+S saves.
            </p>
            <p className="mt-1.5 text-[11px]">
              Runs land in History with their runtime, exit code and duration.
            </p>
          </div>
        ) : (
          lines.map((line) => (
            <div key={line.id} className={`whitespace-pre-wrap break-words ${KIND_CLASS[line.kind]}`}>
              {line.text}
            </div>
          ))
        )}
        {busy && (
          <div className="mt-1 flex items-center gap-2 text-sky-400">
            <span className="inline-block h-3 w-1.5 animate-pulse bg-sky-400" />
            <span className="text-xs">process running — click Stop to terminate</span>
          </div>
        )}
      </div>
    </div>
  );
}
