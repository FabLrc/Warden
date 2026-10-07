import { AlertTriangle, Check, Info, OctagonX, ShieldCheck } from "lucide-react";
import { Link } from "react-router";
import { VARIABLE_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { ISOLATION_LABELS } from "@/screens/lab/lab-meta";
import {
  DIMENSION_LABELS,
  differingDimensions,
  type ExperimentDefinition,
  type IssueSeverity,
  type ReproIssue,
  SEVERITY_ORDER,
  VARIABLE_DIMENSION,
} from "@/screens/lab/reproducibility";

const SEVERITY_META: Record<IssueSeverity, { icon: typeof Info; cls: string; label: string }> = {
  blocking: { icon: OctagonX, cls: "text-destructive", label: "Bloquant" },
  warning: { icon: AlertTriangle, cls: "text-warning", label: "À corriger" },
  info: { icon: Info, cls: "text-info", label: "À savoir" },
};

/** CDC §22 — what a fair benchmark keeps constant, and whether this definition does. */
function constantsChecklist(def: ExperimentDefinition) {
  const differing = differingDimensions(def.configurations);
  const studied = VARIABLE_DIMENSION[def.variable];
  const otherChanges = differing.filter((d) => d !== studied);
  return [
    {
      label: "Même état du repository",
      ok: def.initialState.ref.trim() !== "",
      detail: def.initialState.ref || "ref manquante",
    },
    { label: "Même tâche", ok: def.task.trim() !== "", detail: "un seul prompt pour tous les runs" },
    {
      label: "Mêmes réglages hors variable",
      ok: otherChanges.length === 0,
      detail:
        otherChanges.length === 0
          ? `seul « ${VARIABLE_LABELS[def.variable]} » change`
          : `change aussi : ${otherChanges.map((d) => DIMENSION_LABELS[d]).join(", ")}`,
    },
    { label: "Même environnement", ok: true, detail: ISOLATION_LABELS[def.isolation] },
    {
      label: "Même checker",
      ok: def.checkers.length > 0,
      detail: def.checkers.length > 0 ? `${def.checkers.length} checker(s) externes` : "aucun checker",
    },
  ];
}

export function ReproducibilityPanel({
  definition,
  issues,
  className,
}: {
  definition: ExperimentDefinition;
  issues: ReproIssue[];
  className?: string;
}) {
  const sorted = [...issues].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  const blocking = issues.filter((i) => i.severity === "blocking").length;
  const warnings = issues.filter((i) => i.severity === "warning").length;
  const verdict =
    blocking > 0
      ? { icon: OctagonX, cls: "text-destructive", text: `Lancement impossible · ${blocking} bloquant(s)` }
      : warnings > 0
        ? { icon: AlertTriangle, cls: "text-warning", text: `Comparaison fragile · ${warnings} point(s) à corriger` }
        : { icon: ShieldCheck, cls: "text-success", text: "Comparaison équitable" };
  const VerdictIcon = verdict.icon;

  return (
    <div className={cn("space-y-4 rounded-lg border border-border bg-card p-4", className)}>
      <div>
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Reproductibilité</div>
        <div className={cn("mt-1.5 flex items-center gap-2 text-sm font-medium", verdict.cls)}>
          <VerdictIcon className="size-4 shrink-0" />
          {verdict.text}
        </div>
      </div>

      <ul className="space-y-1.5">
        {constantsChecklist(definition).map((item) => (
          <li key={item.label} className="flex items-start gap-2 text-xs">
            {item.ok ? (
              <Check className="mt-0.5 size-3.5 shrink-0 text-success" />
            ) : (
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" />
            )}
            <span className="min-w-0">
              <span className="text-foreground">{item.label}</span>
              <span className="block truncate text-muted-foreground">{item.detail}</span>
            </span>
          </li>
        ))}
      </ul>

      {sorted.length > 0 && (
        <ul className="space-y-2 border-t border-border pt-3">
          {sorted.map((issue) => {
            const meta = SEVERITY_META[issue.severity];
            const Icon = meta.icon;
            return (
              <li key={issue.id} className="flex items-start gap-2">
                <Icon className={cn("mt-0.5 size-3.5 shrink-0", meta.cls)} aria-label={meta.label} />
                <div className="min-w-0 text-xs">
                  <div className="font-medium text-foreground">{issue.title}</div>
                  {issue.detail && <div className="mt-0.5 text-muted-foreground">{issue.detail}</div>}
                  {issue.link && (
                    <Link to={issue.link.to} className="mt-0.5 inline-block text-primary hover:underline">
                      {issue.link.label}
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
