import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Square,
  Trash2,
  RotateCw,
  CircleDashed,
  CheckCircle2,
  XCircle,
  Ban,
} from "lucide-react";
import type { RunState } from "@/lib/runOrchestrator";

export type TerminalLine = {
  id: number;
  kind: "stdout" | "stderr" | "info" | "exit" | "cmd";
  text: string;
  ts: number;
};

type Props = {
  lines: TerminalLine[];
  runState: RunState;
  onClear: () => void;
  onStop: () => void;
  onRerun: () => void;
  canRerun: boolean;
};

const KIND_CLASS: Record<TerminalLine["kind"], string> = {
  stdout: "text-zinc-200",
  stderr: "text-red-400",
  info: "text-sky-400",
  exit: "text-zinc-500",
  cmd: "text-emerald-400",
};

export function TerminalPanel({ lines, runState, onClear, onStop, onRerun, canRerun }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

  const stateBadge = () => {
    switch (runState) {
      case "starting":
        return (
          <Badge variant="secondary" className="gap-1.5">
            <CircleDashed className="size-3 animate-spin" /> Starting
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
        return null;
    }
  };

  return (
    <div className="flex h-full flex-col bg-[#0D1117]">
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border/60 px-3">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
          Terminal
        </span>
        {stateBadge()}
        <div className="ml-auto flex items-center gap-1">
          {runState === "running" || runState === "starting" ? (
            <Button variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-red-400 hover:text-red-300" onClick={onStop}>
              <Square className="size-3.5" /> Stop
            </Button>
          ) : (
            canRerun && (
              <Button variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-zinc-400" onClick={onRerun}>
                <RotateCw className="size-3.5" /> Rerun
              </Button>
            )
          )}
          <Button variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-zinc-400" onClick={onClear}>
            <Trash2 className="size-3.5" /> Clear
          </Button>
        </div>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-auto px-3 py-2 font-mono text-[12.5px] leading-relaxed">
        {lines.length === 0 ? (
          <p className="text-zinc-600">
            Output appears here when you run a file. Ctrl/Cmd+Enter runs the active file; Ctrl/Cmd+S saves.
          </p>
        ) : (
          lines.map((line) => (
            <div key={line.id} className={`whitespace-pre-wrap break-words ${KIND_CLASS[line.kind]}`}>
              {line.text}
            </div>
          ))
        )}
        {(runState === "running" || runState === "starting") && (
          <div className="mt-1 flex items-center gap-2 text-sky-400">
            <span className="inline-block h-3 w-1.5 animate-pulse bg-sky-400" />
            <span className="text-xs">process running — click Stop to terminate</span>
          </div>
        )}
      </div>
    </div>
  );
}
