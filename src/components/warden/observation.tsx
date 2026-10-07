import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CONFIDENCE_HELP, CONFIDENCE_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { Confidence, Observation } from "@/mock/types";

const CONFIDENCE_CLASSES: Record<Confidence, string> = {
  observed: "text-success border-success/40 bg-success/10",
  estimated: "text-warning border-warning/40 bg-warning/10",
  inferred: "text-info border-info/40 bg-info/10",
  unavailable: "text-muted-foreground border-border bg-muted/40",
};

/** CDC §17 — every displayed metric carries its confidence level. */
export function ConfidenceBadge({ confidence, className }: { confidence: Confidence; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded border px-1.5 font-mono text-[10px] uppercase tracking-wide",
        CONFIDENCE_CLASSES[confidence],
        className,
      )}
    >
      {CONFIDENCE_LABELS[confidence]}
    </span>
  );
}

/**
 * Value + confidence badge; the tooltip explains the source.
 * Unavailable values render as "—", never as 0.
 */
export function ObservedValue<T>({
  obs,
  format,
  hideBadge = false,
  className,
}: {
  obs: Observation<T>;
  format: (value: T) => string;
  hideBadge?: boolean;
  className?: string;
}) {
  const text = obs.value === null ? "—" : format(obs.value);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn("inline-flex flex-wrap items-center gap-x-2 gap-y-1", className)}>
          <span
            className={cn(
              "whitespace-nowrap tabular-nums",
              obs.confidence === "unavailable" && "text-muted-foreground",
              obs.confidence === "estimated" && "italic",
            )}
          >
            {obs.confidence === "estimated" && obs.value !== null ? "≈ " : ""}
            {text}
          </span>
          {!hideBadge && <ConfidenceBadge confidence={obs.confidence} />}
        </span>
      </TooltipTrigger>
      <TooltipContent className="flex-col items-start gap-0.5">
        <span className="font-medium">{CONFIDENCE_LABELS[obs.confidence]}</span>
        <span>{CONFIDENCE_HELP[obs.confidence]}</span>
        {obs.source && <span className="opacity-80">Source : {obs.source}</span>}
        {obs.note && <span className="opacity-80">{obs.note}</span>}
      </TooltipContent>
    </Tooltip>
  );
}
