import { Trophy } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatCost, formatPercent } from "@/lib/format";
import { CONFIDENCE_LABELS, WORKLOAD_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { harnesses } from "@/mock/fixtures/catalog";
import { checkCombination, getProvider } from "@/mock/queries";
import type { Workload } from "@/mock/types";
import { LOW_SAMPLE_RUNS } from "@/screens/lab/lab-stats";
import { entryKey, RANKED_MODELS, type ScoredEntry } from "@/screens/lab/ranking-score";

export type MatrixMetric = "success" | "score";

/**
 * CDC §24 — Model × Harness for one workload. Cells without data say why
 * (never run vs. combination not supported), instead of looking like a bad score.
 */
export function RankingMatrix({
  workload,
  scored,
  metric,
  highlighted,
  onSelect,
}: {
  workload: Workload;
  /** Entries of `workload`, scored among themselves. */
  scored: ScoredEntry[];
  metric: MatrixMetric;
  highlighted: string | null;
  onSelect: (key: string) => void;
}) {
  const best = scored
    .filter((s) => s.entry.runs >= LOW_SAMPLE_RUNS && s.score !== null)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="text-xs text-muted-foreground">
            <th className="w-48 px-3 py-2 text-left font-medium">Modèle \ Harness</th>
            {harnesses.map((h) => (
              <th key={h.id} className="px-2 py-2 text-center font-medium">
                {h.name}
                {!h.installed && <span className="block text-[10px] font-normal">non installé</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {RANKED_MODELS.map((m) => (
            <tr key={m.id} className="border-t border-border">
              <td className="px-3 py-1.5">
                <span className="font-medium">{m.name}</span>
                <span className="block text-[11px] text-muted-foreground">{getProvider(m.providerId).name}</span>
              </td>
              {harnesses.map((h) => {
                const cell = scored.find((s) => s.entry.modelId === m.id && s.entry.harnessId === h.id);
                if (!cell) {
                  const verdict = checkCombination({ harnessId: h.id, providerId: m.providerId, modelId: m.id });
                  const unsupported = verdict.status === "unsupported";
                  return (
                    <td key={h.id} className="p-1">
                      <div
                        className={cn(
                          "flex h-12 items-center justify-center rounded-md text-[11px] text-muted-foreground/70",
                          unsupported &&
                            "bg-[repeating-linear-gradient(135deg,transparent_0_6px,var(--border)_6px_7px)]",
                        )}
                        title={
                          unsupported
                            ? verdict.reason
                            : `Aucun run ${WORKLOAD_LABELS[workload].toLowerCase()} enregistré`
                        }
                      >
                        {unsupported ? "incompatible" : "—"}
                      </div>
                    </td>
                  );
                }
                const key = entryKey(cell.entry);
                const ratio = metric === "success" ? cell.entry.successRate : (cell.score ?? 0) / 100;
                const lowSample = cell.entry.runs < LOW_SAMPLE_RUNS;
                const isBest = best !== undefined && entryKey(best.entry) === key;
                return (
                  <td key={h.id} className="p-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => onSelect(key)}
                          className={cn(
                            "relative flex h-12 w-full flex-col items-center justify-center rounded-md border text-center transition-shadow hover:ring-2 hover:ring-primary/50",
                            lowSample ? "border-dashed border-muted-foreground/40" : "border-transparent",
                            isBest && "glow-soul",
                            highlighted === key && "ring-2 ring-primary",
                          )}
                          style={{
                            backgroundColor: `color-mix(in srgb, var(${metric === "success" ? "--success" : "--primary"}) ${Math.round(6 + ratio * 44)}%, transparent)`,
                          }}
                        >
                          {isBest && <Trophy className="absolute top-1 right-1 size-3 text-soul" />}
                          <span className="font-medium tabular-nums">
                            {metric === "success"
                              ? formatPercent(cell.entry.successRate)
                              : cell.score === null
                                ? "—"
                                : Math.round(cell.score)}
                          </span>
                          <span className="text-[10px] tabular-nums text-foreground/70">{cell.entry.runs} runs</span>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="flex-col items-start gap-0.5">
                        <span className="font-medium">
                          {m.name} × {h.name}
                        </span>
                        <span>
                          Réussite {formatPercent(cell.entry.successRate)} · qualité{" "}
                          {cell.entry.quality.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}
                        </span>
                        <span>
                          Coût moy.{" "}
                          {cell.entry.avgCostUsd.value === null ? "—" : formatCost(cell.entry.avgCostUsd.value)} (
                          {CONFIDENCE_LABELS[cell.entry.avgCostUsd.confidence]})
                        </span>
                        {lowSample && <span className="text-warning">Échantillon faible ({cell.entry.runs} runs)</span>}
                        {isBest && (
                          <span className="text-soul">Meilleur score avec au moins {LOW_SAMPLE_RUNS} runs</span>
                        )}
                        <span className="opacity-80">Cliquer pour la retrouver dans le tableau</span>
                      </TooltipContent>
                    </Tooltip>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
