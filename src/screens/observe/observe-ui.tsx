import { FileCode2 } from "lucide-react";
import { Link } from "react-router";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ConfidenceBadge, ObservedValue } from "@/components/warden/observation";
import { formatDuration, formatPercent } from "@/lib/format";
import { CONFIDENCE_HELP, CONFIDENCE_LABELS } from "@/lib/labels";
import { links } from "@/lib/links";
import { cn } from "@/lib/utils";
import type { Confidence, Observation, TraceEventStatus } from "@/mock/types";
import { type TimeBreakdown, type TimeCategory, TRACE_STATUS_META } from "./analysis";

const CONFIDENCE_DOT: Record<Confidence, string> = {
  observed: "bg-success",
  estimated: "bg-warning",
  inferred: "bg-info",
  unavailable: "border border-muted-foreground/60 bg-transparent",
};

/** Dense-table variant of ObservedValue: the badge becomes a coloured dot, the tooltip keeps source and help. */
export function CompactObserved({ obs, format }: { obs: Observation<number>; format: (value: number) => string }) {
  return (
    <span className="inline-flex items-center justify-end gap-1.5">
      <ObservedValue obs={obs} format={format} hideBadge />
      <span
        className={cn("size-1.5 shrink-0 rounded-full", CONFIDENCE_DOT[obs.confidence])}
        role="img"
        aria-label={CONFIDENCE_LABELS[obs.confidence]}
      />
    </span>
  );
}

/** Legend for CompactObserved dots. */
export function ConfidenceLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
      {(Object.keys(CONFIDENCE_DOT) as Confidence[]).map((c) => (
        <Tooltip key={c}>
          <TooltipTrigger asChild>
            <span className="inline-flex items-center gap-1.5">
              <span className={cn("size-1.5 rounded-full", CONFIDENCE_DOT[c])} />
              {CONFIDENCE_LABELS[c]}
            </span>
          </TooltipTrigger>
          <TooltipContent>{CONFIDENCE_HELP[c]}</TooltipContent>
        </Tooltip>
      ))}
      <span>· « ≈ » = valeur estimée · « — » = non disponible (jamais 0)</span>
    </div>
  );
}

/** File reference opening the code workspace (edits → diff, reads → file). */
export function FileLink({
  projectId,
  sessionId,
  file,
  view,
  className,
}: {
  projectId: string;
  sessionId: string;
  file: { path: string; line?: number };
  view: "file" | "diff";
  className?: string;
}) {
  return (
    <Link
      to={links.code(projectId, { file: file.path, line: file.line, view, sessionId })}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "inline-flex min-w-0 items-center gap-1 font-mono text-xs text-foreground/90 hover:text-primary hover:underline",
        className,
      )}
      title={view === "diff" ? "Ouvrir le diff dans le mode code" : "Ouvrir le fichier dans le mode code"}
    >
      <FileCode2 className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="truncate">
        {file.path}
        {file.line !== undefined && <span className="text-muted-foreground">:{file.line}</span>}
      </span>
    </Link>
  );
}

export function TraceStatusBadge({ status }: { status: TraceEventStatus }) {
  const { label, cls } = TRACE_STATUS_META[status];
  return (
    <span className={cn("inline-flex h-5 shrink-0 items-center rounded border px-1.5 text-[11px] font-medium", cls)}>
      {label}
    </span>
  );
}

const TIME_COLORS: Record<TimeCategory, string> = {
  model: "bg-chart-4",
  tools: "bg-chart-3",
  permission: "bg-warning",
  other: "bg-muted-foreground/40",
};

/** CDC §16 / P4 — "Où est passé le temps" as horizontal bars. */
export function TimeBreakdownBars({ breakdown, dense = false }: { breakdown: TimeBreakdown; dense?: boolean }) {
  const { total, slices } = breakdown;
  const reference = total.value ?? Math.max(1, ...slices.map((s) => s.ms));
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Durée totale</span>
        <ObservedValue obs={total} format={formatDuration} className="text-foreground" />
      </div>
      {slices.map((s) => {
        const ratio = Math.min(1, s.ms / reference);
        return (
          <div key={s.category} className="space-y-1">
            <div className="flex items-center justify-between gap-2 text-xs">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex min-w-0 items-center gap-2">
                    <span className={cn("size-2 shrink-0 rounded-sm", TIME_COLORS[s.category])} />
                    <span className="truncate">{s.label}</span>
                    {!dense && s.count > 0 && <span className="text-muted-foreground tabular-nums">×{s.count}</span>}
                  </span>
                </TooltipTrigger>
                <TooltipContent>{s.help}</TooltipContent>
              </Tooltip>
              <span className="flex shrink-0 items-center gap-2">
                <span className={cn("tabular-nums", s.confidence !== "observed" && "italic")}>
                  {s.confidence !== "observed" ? "≈ " : ""}
                  {formatDuration(s.ms)}
                </span>
                {total.value !== null && (
                  <span className="w-10 text-right text-muted-foreground tabular-nums">{formatPercent(ratio)}</span>
                )}
                <ConfidenceBadge confidence={s.confidence} />
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted/60">
              <div
                className={cn("h-full rounded-full", TIME_COLORS[s.category])}
                style={{ width: `${Math.max(ratio * 100, s.ms > 0 ? 0.8 : 0)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
