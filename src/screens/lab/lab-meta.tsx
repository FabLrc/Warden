import { Check, ExternalLink, X } from "lucide-react";
import { Link } from "react-router";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDuration } from "@/lib/format";
import { links } from "@/lib/links";
import { cn } from "@/lib/utils";
import type { Checker, Experiment, RunResult } from "@/mock/types";

export const EXPERIMENT_STATUS_LABELS: Record<Experiment["status"], string> = {
  draft: "Brouillon",
  running: "En cours",
  completed: "Terminée",
};

const EXPERIMENT_STATUS_CLASSES: Record<Experiment["status"], string> = {
  draft: "text-muted-foreground border-border bg-muted/40",
  running: "text-primary border-primary/40 bg-primary/10",
  completed: "text-success border-success/35 bg-success/10",
};

export function ExperimentStatusBadge({ status }: { status: Experiment["status"] }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1 rounded border px-1.5 text-[11px] font-medium",
        EXPERIMENT_STATUS_CLASSES[status],
      )}
    >
      {status === "running" && <span className="size-1.5 animate-soul rounded-full bg-primary" />}
      {EXPERIMENT_STATUS_LABELS[status]}
    </span>
  );
}

/** Selected state for outline toggle groups in the Lab (the default only tints the background). */
export const TOGGLE_ON = "data-[state=on]:border-primary/40 data-[state=on]:text-primary";

export const ISOLATION_LABELS: Record<Experiment["isolation"], string> = {
  "git-worktree": "Git worktree",
  container: "Conteneur",
};

export const ISOLATION_HELP: Record<Experiment["isolation"], string> = {
  "git-worktree": "Chaque run part d'un worktree neuf créé depuis l'état initial.",
  container: "Chaque run s'exécute dans un conteneur jetable (dépendances et réseau isolés).",
};

export const CHECKER_KIND_LABELS: Record<Checker["kind"], string> = {
  tests: "Tests",
  lint: "Lint",
  build: "Build",
  custom: "Personnalisé",
};

export const RUN_STATUS_META: Record<RunResult["status"], { label: string; dot: string }> = {
  passed: { label: "Réussi", dot: "bg-success" },
  failed: { label: "Échec", dot: "bg-destructive" },
  timeout: { label: "Timeout", dot: "bg-warning" },
  error: { label: "Erreur", dot: "bg-transparent ring-2 ring-inset ring-destructive" },
  running: { label: "En cours", dot: "bg-primary animate-soul" },
  queued: { label: "En attente", dot: "bg-muted-foreground/40" },
};

/** One dot per run; links to the run's trace when it was kept. */
export function RunDot({ run, checkers }: { run: RunResult; checkers: Checker[] }) {
  const meta = RUN_STATUS_META[run.status];
  const dot = <span className={cn("block size-3 rounded-full", meta.dot)} />;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {run.sessionId ? (
          <Link
            to={links.observeSession(run.sessionId)}
            className="rounded-full p-0.5 hover:ring-2 hover:ring-primary/60"
            aria-label={`Run ${run.run} : ${meta.label}, ouvrir la trace`}
          >
            {dot}
          </Link>
        ) : (
          <span className="rounded-full p-0.5" role="img" aria-label={`Run ${run.run} : ${meta.label}`}>
            {dot}
          </span>
        )}
      </TooltipTrigger>
      <TooltipContent className="flex-col items-start gap-1">
        <span className="font-medium">
          Run {run.run} · {meta.label}
          {run.durationMs.value !== null && ` · ${formatDuration(run.durationMs.value)}`}
        </span>
        {run.checks.map((c) => (
          <span key={c.checkerId} className="flex items-center gap-1">
            {c.passed ? <Check className="size-3" /> : <X className="size-3" />}
            {checkers.find((k) => k.id === c.checkerId)?.label ?? c.checkerId}
            {c.detail && <span className="opacity-80">: {c.detail}</span>}
          </span>
        ))}
        {run.sessionId ? (
          <span className="flex items-center gap-1 opacity-80">
            <ExternalLink className="size-3" /> Cliquer pour ouvrir la trace
          </span>
        ) : (
          <span className="opacity-80">Trace non conservée pour ce run</span>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

export function RunLegend() {
  const shown: RunResult["status"][] = ["passed", "failed", "timeout", "error"];
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
      {shown.map((s) => (
        <span key={s} className="flex items-center gap-1.5">
          <span className={cn("size-2.5 rounded-full", RUN_STATUS_META[s].dot)} />
          {RUN_STATUS_META[s].label}
        </span>
      ))}
    </div>
  );
}

/**
 * Signed change between two arms, coloured by whether it is an improvement.
 * `points` = absolute ratio difference shown in percentage points; `percent` = relative change.
 */
export function Delta({
  value,
  kind,
  betterWhen,
  approximate = false,
}: {
  value: number | null;
  kind: "points" | "percent";
  betterWhen: "higher" | "lower";
  approximate?: boolean;
}) {
  if (value === null) return <span className="text-xs text-muted-foreground">non comparable</span>;
  const negligible = Math.abs(value) < 0.005;
  const better = betterWhen === "higher" ? value > 0 : value < 0;
  const magnitude = Math.abs(value * 100).toLocaleString("fr-FR", { maximumFractionDigits: 0 });
  return (
    <span
      className={cn(
        "font-mono text-xs tabular-nums",
        negligible ? "text-muted-foreground" : better ? "text-success" : "text-destructive",
        approximate && "italic",
      )}
      title={approximate ? "Au moins une des deux valeurs est estimée" : undefined}
    >
      {approximate && "≈ "}
      {negligible ? "±0" : `${value > 0 ? "+" : "−"}${magnitude}`} {kind === "points" ? "pts" : "%"}
    </span>
  );
}
