import { formatCost, formatDuration, formatNumber, formatTokens } from "@/lib/format";
import { getHarness } from "@/mock/queries";
import type {
  Confidence,
  Observation,
  Session,
  SessionMetrics,
  TraceEvent,
  TraceEventKind,
  TraceEventStatus,
} from "@/mock/types";

// ── Metrics ────────────────────────────────────────────────────────────────

export interface MetricDef {
  key: keyof SessionMetrics;
  label: string;
  format: (value: number) => string;
  /** Lower is better (used only to colour a delta, never to rank). */
  lowerIsBetter?: boolean;
}

export const METRIC_DEFS: MetricDef[] = [
  { key: "durationMs", label: "Durée", format: formatDuration, lowerIsBetter: true },
  { key: "cost", label: "Coût", format: formatCost, lowerIsBetter: true },
  { key: "inputTokens", label: "Tokens d'entrée", format: formatTokens },
  { key: "outputTokens", label: "Tokens de sortie", format: formatTokens },
  { key: "cacheReadTokens", label: "Tokens lus en cache", format: formatTokens },
  { key: "systemPromptTokens", label: "Prompt système", format: formatTokens },
  { key: "modelCalls", label: "Appels modèle", format: formatNumber },
  { key: "toolCalls", label: "Tool calls", format: formatNumber },
  { key: "errors", label: "Erreurs", format: formatNumber, lowerIsBetter: true },
  { key: "permissionsRequested", label: "Permissions demandées", format: formatNumber },
];

/** Increasing uncertainty: a derived value is only as certain as its weakest input. */
const CONFIDENCE_RANK: Record<Confidence, number> = { observed: 0, estimated: 1, inferred: 2, unavailable: 3 };

export function weakestConfidence(...values: Confidence[]): Confidence {
  return values.reduce((a, b) => (CONFIDENCE_RANK[b] > CONFIDENCE_RANK[a] ? b : a), "observed");
}

/** Input + output tokens; unavailable as soon as one side is unavailable (never counted as 0). */
export function totalTokens(metrics: SessionMetrics): Observation<number> {
  const { inputTokens: a, outputTokens: b } = metrics;
  const confidence = weakestConfidence(a.confidence, b.confidence);
  return {
    value: a.value === null || b.value === null ? null : a.value + b.value,
    confidence: a.value === null || b.value === null ? "unavailable" : confidence,
    source: "somme entrée + sortie",
  };
}

// ── Trace classification ─────────────────────────────────────────────────

/** ACP has no native "model call" event: Warden synthesises them and marks the raw payload. */
export function isSynthesized(event: TraceEvent): boolean {
  const raw = event.raw;
  return typeof raw === "object" && raw !== null && (raw as Record<string, unknown>)._warden === "inferred";
}

export const TOOL_KINDS: TraceEventKind[] = ["tool-call", "file-read", "file-edit", "command"];

export const isError = (e: TraceEvent): boolean => e.kind === "error" || e.status === "error";

export const TRACE_STATUS_META: Record<TraceEventStatus, { label: string; cls: string }> = {
  pending: { label: "En attente", cls: "text-warning border-warning/40 bg-warning/10" },
  ok: { label: "OK", cls: "text-success border-success/35 bg-success/10" },
  error: { label: "Erreur", cls: "text-destructive border-destructive/35 bg-destructive/10" },
  denied: { label: "Refusé", cls: "text-warning border-warning/40 bg-warning/10" },
  cancelled: { label: "Annulé", cls: "text-muted-foreground border-border bg-muted/40" },
};

/** Milliseconds since the session start. */
export const offsetMs = (session: Session, event: TraceEvent): number =>
  new Date(event.at).getTime() - new Date(session.startedAt).getTime();

/** "+02:41" (or "+1:02:41") relative to session start. */
export function formatOffset(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h ? `+${h}:${pad(m)}:${pad(s)}` : `+${pad(m)}:${pad(s)}`;
}

/** Nesting depth via parentId chains (model-call → children). */
export function depthOf(event: TraceEvent, byId: Map<string, TraceEvent>): number {
  let depth = 0;
  let current = event.parentId ? byId.get(event.parentId) : undefined;
  while (current) {
    depth++;
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return depth;
}

// ── Where did the time go ────────────────────────────────────────────────

export type TimeCategory = "model" | "tools" | "permission" | "other";

export interface TimeSlice {
  category: TimeCategory;
  label: string;
  help: string;
  ms: number;
  count: number;
  confidence: Confidence;
}

export interface TimeBreakdown {
  total: Observation<number>;
  slices: TimeSlice[];
}

export function timeBreakdown(session: Session, trace: TraceEvent[]): TimeBreakdown {
  const sum = (events: TraceEvent[]) => events.reduce((acc, e) => acc + (e.durationMs ?? 0), 0);
  const modelEvents = trace.filter((e) => e.kind === "model-call");
  const toolEvents = trace.filter((e) => TOOL_KINDS.includes(e.kind));
  const permissionEvents = trace.filter((e) => e.kind === "permission-request");
  const total = session.metrics.durationMs;

  const slices: TimeSlice[] = [
    {
      category: "model",
      label: "Appels modèle",
      help: "Somme des durées des appels modèle (génération, réflexion).",
      ms: sum(modelEvents),
      count: modelEvents.length,
      confidence: modelEvents.some(isSynthesized) ? "inferred" : "observed",
    },
    {
      category: "tools",
      label: "Outils et commandes",
      help: "Lectures, éditions, recherches et commandes shell, mesurées par Warden.",
      ms: sum(toolEvents),
      count: toolEvents.length,
      confidence: "observed",
    },
    {
      category: "permission",
      label: "Attente de permission",
      help: "Temps passé à attendre votre réponse à une demande de permission.",
      ms: sum(permissionEvents),
      count: permissionEvents.length,
      confidence: "observed",
    },
  ];
  if (total.value !== null) {
    const accounted = slices.reduce((acc, s) => acc + s.ms, 0);
    slices.push({
      category: "other",
      label: "Autre / inactivité",
      help: "Durée totale moins les catégories ci-dessus : session ouverte sans activité, latences non tracées.",
      ms: Math.max(0, total.value - accounted),
      count: 0,
      confidence: "inferred",
    });
  }
  return { total, slices };
}

// ── Where did the tokens go ──────────────────────────────────────────────

export interface ModelCallUsage {
  event: TraceEvent;
  input: Observation<number>;
  output: Observation<number>;
  cost?: Observation<number>;
}

export interface TokenBreakdown {
  calls: ModelCallUsage[];
  /** At least one model call carries a usable per-call value. */
  perCallAvailable: boolean;
  /** Why per-call usage is missing, taken from the harness capability or the event itself. */
  unavailableReason: string;
}

const UNAVAILABLE: Observation<number> = { value: null, confidence: "unavailable" };

export function tokenBreakdown(session: Session, trace: TraceEvent[]): TokenBreakdown {
  const calls = trace
    .filter((e) => e.kind === "model-call")
    .map((event) => ({
      event,
      input: event.tokens?.input ?? UNAVAILABLE,
      output: event.tokens?.output ?? UNAVAILABLE,
      cost: event.cost,
    }));
  const perCallAvailable = calls.some((c) => c.input.value !== null || c.output.value !== null);
  const harness = getHarness(session.harnessId);
  const capability = harness.capabilities.tokenUsage;
  const eventNote = calls.find((c) => c.input.note)?.input.note;
  const unavailableReason =
    capability.support !== "supported" && capability.note
      ? `${harness.name} : ${capability.note}.`
      : (eventNote ?? "Les appels modèle de cette trace ne portent pas d'usage tokens.");
  return { calls, perCallAvailable, unavailableReason };
}

/** Sum of a list of observations, only when every one of them is known. */
export function sumKnown(values: Observation<number>[]): number | null {
  if (values.length === 0 || values.some((v) => v.value === null)) return null;
  return values.reduce((acc, v) => acc + (v.value ?? 0), 0);
}

// ── Trace statistics (Compare) ───────────────────────────────────────────

export interface TraceStats {
  events: number;
  modelCalls: number;
  toolCalls: number;
  filesRead: number;
  fileEdits: number;
  commands: number;
  failedCommands: number;
  errors: number;
  permissions: number;
  deniedPermissions: number;
  interrupts: number;
}

export function traceStats(trace: TraceEvent[]): TraceStats {
  const count = (pred: (e: TraceEvent) => boolean) => trace.filter(pred).length;
  return {
    events: trace.length,
    modelCalls: count((e) => e.kind === "model-call"),
    toolCalls: count((e) => TOOL_KINDS.includes(e.kind)),
    filesRead: count((e) => e.kind === "file-read"),
    fileEdits: count((e) => e.kind === "file-edit"),
    commands: count((e) => e.kind === "command"),
    failedCommands: count((e) => e.kind === "command" && e.exitCode !== undefined && e.exitCode !== 0),
    errors: count(isError),
    permissions: count((e) => e.kind === "permission-request"),
    deniedPermissions: count((e) => e.permission?.decision === "deny"),
    interrupts: count((e) => e.kind === "interrupt"),
  };
}

export const TRACE_STAT_LABELS: Record<keyof TraceStats, string> = {
  events: "Événements conservés",
  modelCalls: "Appels modèle",
  toolCalls: "Tool calls",
  filesRead: "Fichiers lus",
  fileEdits: "Éditions",
  commands: "Commandes",
  failedCommands: "Commandes en échec",
  errors: "Erreurs",
  permissions: "Permissions",
  deniedPermissions: "Permissions refusées",
  interrupts: "Interruptions",
};
