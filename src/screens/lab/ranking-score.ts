import { models } from "@/mock/fixtures/catalog";
import { rankingEntries } from "@/mock/fixtures/lab";
import type { RankingEntry } from "@/mock/types";

/** Models that appear in the ranking history, in catalogue order. */
export const RANKED_MODELS = models.filter((m) => rankingEntries.some((e) => e.modelId === m.id));

/** CDC §25 — criteria the composite score can weigh. */
export type CriterionId =
  | "quality"
  | "success"
  | "cost"
  | "tokens"
  | "speed"
  | "reliability"
  | "toolEfficiency"
  | "interventions";

export interface Criterion {
  label: string;
  help: string;
  better: "higher" | "lower";
  value: (e: RankingEntry) => number | null;
}

export const CRITERIA: Record<CriterionId, Criterion> = {
  quality: {
    label: "Qualité",
    help: "Score des checkers externes (tests, lint, build, checks), 0 à 1.",
    better: "higher",
    value: (e) => e.quality,
  },
  success: {
    label: "Réussite",
    help: "Part des runs validés par les checkers.",
    better: "higher",
    value: (e) => e.successRate,
  },
  cost: {
    label: "Coût",
    help: "Coût moyen par run (Observed ou Estimated).",
    better: "lower",
    value: (e) => e.avgCostUsd.value,
  },
  tokens: { label: "Tokens", help: "Tokens moyens par run.", better: "lower", value: (e) => e.avgTokens.value },
  speed: { label: "Vitesse", help: "Durée moyenne d'un run.", better: "lower", value: (e) => e.avgDurationMs },
  reliability: {
    label: "Fiabilité",
    help: "Écart-type de la réussite entre séries de runs : plus il est bas, plus le résultat est prévisible.",
    better: "lower",
    value: (e) => e.variance,
  },
  toolEfficiency: {
    label: "Efficacité outils",
    help: "Tool calls par run réussi.",
    better: "lower",
    value: (e) => e.toolEfficiency,
  },
  interventions: {
    label: "Interventions",
    help: "Interventions utilisateur moyennes par run (permissions, corrections).",
    better: "lower",
    value: (e) => e.avgInterventions,
  },
};

export const CRITERION_IDS = Object.keys(CRITERIA) as CriterionId[];

export type Weights = Record<CriterionId, number>;

/** Positional builder, in `CRITERION_IDS` order. */
const weightsOf = (...values: number[]): Weights =>
  Object.fromEntries(CRITERION_IDS.map((id, i) => [id, values[i] ?? 0])) as Weights;

export const WEIGHT_PRESETS: { id: string; label: string; weights: Weights }[] = [
  // quality, success, cost, tokens, speed, reliability, tool efficiency, interventions
  { id: "balanced", label: "Équilibré", weights: weightsOf(3, 3, 2, 1, 1, 2, 1, 1) },
  { id: "quality", label: "Qualité d'abord", weights: weightsOf(5, 5, 0, 0, 0, 3, 0, 1) },
  { id: "frugal", label: "Économe", weights: weightsOf(2, 2, 5, 3, 1, 1, 1, 0) },
  { id: "fast", label: "Rapide", weights: weightsOf(2, 2, 0, 0, 5, 1, 1, 3) },
];

export interface ScoredEntry {
  entry: RankingEntry;
  /** 0..100, relative to the pool it was computed in; null when no weighted criterion has a value. */
  score: number | null;
  /** Weighted criteria without a value for this entry (excluded, never counted as 0). */
  missing: CriterionId[];
}

export const entryKey = (e: RankingEntry) => `${e.modelId}|${e.harnessId}|${e.workload}`;

/**
 * Min–max normalisation of each criterion over `pool`, then weighted mean.
 * Unavailable values are excluded from both numerator and denominator.
 */
export function scoreEntries(pool: RankingEntry[], weights: Weights): ScoredEntry[] {
  const ranges = Object.fromEntries(
    CRITERION_IDS.map((id) => {
      const values = pool.flatMap((e) => {
        const v = CRITERIA[id].value(e);
        return v === null ? [] : [v];
      });
      return [id, { min: Math.min(...values), max: Math.max(...values) }];
    }),
  ) as Record<CriterionId, { min: number; max: number }>;

  return pool.map((entry) => {
    let sum = 0;
    let weightSum = 0;
    const missing: CriterionId[] = [];
    for (const id of CRITERION_IDS) {
      const w = weights[id];
      if (w === 0) continue;
      const v = CRITERIA[id].value(entry);
      if (v === null) {
        missing.push(id);
        continue;
      }
      const { min, max } = ranges[id];
      const norm = max === min ? 1 : (v - min) / (max - min);
      sum += w * (CRITERIA[id].better === "higher" ? norm : 1 - norm);
      weightSum += w;
    }
    return { entry, score: weightSum > 0 ? (sum / weightSum) * 100 : null, missing };
  });
}
