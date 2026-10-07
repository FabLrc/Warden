import type { FeatureArmStats } from "@/mock/fixtures/lab";
import type { Confidence, Experiment, Observation, RunResult } from "@/mock/types";

/** Least trustworthy wins when values are combined (CDC §17). */
const CONFIDENCE_RANK: Record<Confidence, number> = { observed: 0, inferred: 1, estimated: 2, unavailable: 3 };

export function worstConfidence(confidences: Confidence[]): Confidence {
  return confidences.reduce<Confidence>(
    (worst, c) => (CONFIDENCE_RANK[c] > CONFIDENCE_RANK[worst] ? c : worst),
    "observed",
  );
}

/**
 * Mean of the available values. Unavailable runs are excluded (never counted as 0)
 * and the note says how many runs the mean is based on.
 */
export function averageObservation(values: Observation<number>[]): Observation<number> {
  const known = values.flatMap((o) => (o.value === null ? [] : [{ ...o, value: o.value }]));
  if (known.length === 0) {
    return { value: null, confidence: "unavailable", note: values[0]?.note ?? "Aucune valeur rapportée" };
  }
  return {
    value: known.reduce((sum, o) => sum + o.value, 0) / known.length,
    confidence: worstConfidence(known.map((o) => o.confidence)),
    source: known[0].source,
    note:
      known.length < values.length
        ? `Moyenne sur ${known.length}/${values.length} runs : valeurs indisponibles exclues`
        : undefined,
  };
}

/** Input + output tokens of a run; unavailable as soon as one side is. */
export function runTokens(run: RunResult): Observation<number> {
  const { inputTokens: i, outputTokens: o } = run;
  if (i.value === null || o.value === null) {
    return { value: null, confidence: "unavailable", note: i.note ?? o.note };
  }
  return { value: i.value + o.value, confidence: worstConfidence([i.confidence, o.confidence]), source: i.source };
}

export interface ConfigStats {
  runs: RunResult[];
  /** Runs that reached an end state (passed, failed, timeout, error). */
  finished: number;
  passed: number;
  successRate: number | null;
  avgDuration: Observation<number>;
  avgTokens: Observation<number>;
  avgCost: Observation<number>;
  avgToolCalls: Observation<number>;
  avgInterventions: number | null;
  /** Std-dev of the pass/fail outcome across runs (0 = always the same outcome). */
  successStdDev: number | null;
  /** Std-dev / mean of run durations. */
  durationSpread: number | null;
}

const FINISHED: Record<RunResult["status"], boolean> = {
  passed: true,
  failed: true,
  timeout: true,
  error: true,
  running: false,
  queued: false,
};

export function configStats(experiment: Experiment, configurationId: string): ConfigStats {
  const runs = experiment.results.filter((r) => r.configurationId === configurationId).sort((a, b) => a.run - b.run);
  const done = runs.filter((r) => FINISHED[r.status]);
  const passed = done.filter((r) => r.status === "passed").length;
  const successRate = done.length > 0 ? passed / done.length : null;
  const durations = done.flatMap((r) => (r.durationMs.value === null ? [] : [r.durationMs.value]));
  const meanDuration = durations.reduce((s, d) => s + d, 0) / (durations.length || 1);
  const durationStd = Math.sqrt(durations.reduce((s, d) => s + (d - meanDuration) ** 2, 0) / (durations.length || 1));
  return {
    runs,
    finished: done.length,
    passed,
    successRate,
    avgDuration: averageObservation(done.map((r) => r.durationMs)),
    avgTokens: averageObservation(done.map(runTokens)),
    avgCost: averageObservation(done.map((r) => r.cost)),
    avgToolCalls: averageObservation(done.map((r) => r.toolCalls)),
    avgInterventions: done.length > 0 ? done.reduce((s, r) => s + r.userInterventions, 0) / done.length : null,
    successStdDev: successRate === null ? null : Math.sqrt(successRate * (1 - successRate)),
    durationSpread: durations.length > 1 && meanDuration > 0 ? durationStd / meanDuration : null,
  };
}

/** A configuration of an experiment seen as one arm of an OFF/ON comparison. */
export function armFromConfiguration(experiment: Experiment, configurationId: string): FeatureArmStats {
  const s = configStats(experiment, configurationId);
  return {
    runs: s.finished,
    successRate: s.successRate ?? 0,
    avgCostUsd: s.avgCost,
    avgTokens: s.avgTokens,
    avgDurationMs: s.avgDuration,
    variance: s.successStdDev ?? 0,
  };
}

/** Below this many runs per configuration, results are flagged as fragile. */
export const LOW_SAMPLE_RUNS = 5;

/** (b − a) / a, or null when either side is unknown. */
export function relativeDelta(a: number | null, b: number | null): number | null {
  return a === null || b === null || a === 0 ? null : (b - a) / a;
}
