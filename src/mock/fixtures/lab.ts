import { mcpServers, skills } from "@/mock/fixtures/workspace";
import type {
  CheckResult,
  Confidence,
  Experiment,
  HarnessId,
  LabConfiguration,
  Observation,
  RankingEntry,
  RunResult,
  Workload,
} from "@/mock/types";

// ── Warden feature toggles (CDC §26) ───────────────────────────────────────

export type WardenFeatureId = "inspector" | "memory" | "reviewer" | "tool-optimization";

export const WARDEN_FEATURE_LABELS: Record<WardenFeatureId, string> = {
  inspector: "Agent Inspector",
  memory: "Memory",
  reviewer: "Reviewer",
  "tool-optimization": "Tool optimization",
};

export const WARDEN_FEATURE_IDS = Object.keys(WARDEN_FEATURE_LABELS) as WardenFeatureId[];

export const featuresOff = (overrides: Partial<Record<WardenFeatureId, boolean>> = {}): Record<string, boolean> => ({
  inspector: false,
  memory: false,
  reviewer: false,
  "tool-optimization": false,
  ...overrides,
});

// ── Run builder ────────────────────────────────────────────────────────────

/** What each harness reports for a lab run (same pattern as session metrics, CDC §17). */
const TOKEN_SOURCE: Record<HarnessId, string> = {
  opencode: "ACP usage (total par tour)",
  "claude-code": "Agent SDK usage",
  codex: "codex-acp token_count",
  pi: "usage par message",
  omp: "usage par message",
};

const COST_SOURCE: Record<HarnessId, { confidence: Confidence; source: string }> = {
  opencode: { confidence: "estimated", source: "tokens × catalogue de prix" },
  "claude-code": { confidence: "observed", source: "Agent SDK total_cost_usd" },
  codex: { confidence: "estimated", source: "tokens × catalogue de prix" },
  pi: { confidence: "observed", source: "coût par message" },
  omp: { confidence: "observed", source: "coût par message" },
};

const unavailable = (note: string): Observation<number> => ({ value: null, confidence: "unavailable", note });

interface RawRun {
  n: number;
  status: RunResult["status"];
  min: number;
  /** `null` when the harness never reported usage (e.g. turn killed by the time limit). */
  input: number | null;
  output: number | null;
  cost: number | null;
  tools: number;
  interventions: number;
  checks: CheckResult[];
  sessionId?: string;
  usageNote?: string;
}

const ok = (checkerId: string, detail?: string): CheckResult => ({ checkerId, passed: true, detail });
const ko = (checkerId: string, detail: string): CheckResult => ({ checkerId, passed: false, detail });

function makeRun(experimentId: string, cfg: LabConfiguration, r: RawRun): RunResult {
  const note = r.usageNote ?? "Usage non rapporté par le harness";
  const tokens = (value: number | null): Observation<number> =>
    value === null
      ? unavailable(note)
      : {
          value,
          confidence: "observed",
          source: TOKEN_SOURCE[cfg.harnessId],
          note: r.status === "timeout" ? "Jusqu'à l'arrêt par la limite de temps" : undefined,
        };
  const costMeta = COST_SOURCE[cfg.harnessId];
  return {
    id: `${experimentId}-${cfg.id}-r${r.n}`,
    configurationId: cfg.id,
    run: r.n,
    status: r.status,
    checks: r.checks,
    durationMs: { value: r.min * 60_000, confidence: "observed", source: "horloge Warden" },
    inputTokens: tokens(r.input),
    outputTokens: tokens(r.output),
    cost: r.cost === null ? unavailable(note) : { value: r.cost, ...costMeta },
    toolCalls: { value: r.tools, confidence: "observed", source: "ACP tool_call" },
    userInterventions: r.interventions,
    sessionId: r.sessionId,
  };
}

const runsFor = (experimentId: string, cfg: LabConfiguration, raws: RawRun[]): RunResult[] =>
  raws.map((r) => makeRun(experimentId, cfg, r));

// ── (a) OpenCode vs Claude Code — same model (P8) ──────────────────────────

const A = "exp-refresh-token";
const aOpenCode: LabConfiguration = {
  id: "cfg-opencode",
  label: "OpenCode",
  harnessId: "opencode",
  providerId: "anthropic",
  modelId: "claude-sonnet",
  agentId: "debugger",
  skillIds: ["debugging", "typescript"],
  features: featuresOff(),
};
const aClaudeCode: LabConfiguration = {
  ...aOpenCode,
  id: "cfg-claude-code",
  label: "Claude Code",
  harnessId: "claude-code",
};

const experimentA: Experiment = {
  id: A,
  name: "Bug refresh token — OpenCode vs Claude Code",
  task: "Les refresh tokens expirent au bout de 15 minutes au lieu de 7 jours. Trouver la cause, corriger, et ajouter un test de régression dans `src/auth/__tests__/refresh.test.ts`.",
  workload: "debugging",
  projectId: "atlas-api",
  initialState: {
    kind: "git-ref",
    ref: "fix/refresh-expiry@b7e21d4",
    description: "Bug reproduit, aucun correctif appliqué",
  },
  isolation: "git-worktree",
  variable: "harness",
  configurations: [aOpenCode, aClaudeCode],
  runsPerConfiguration: 3,
  timeLimitMinutes: 30,
  checkers: [
    { id: "tests", kind: "tests", label: "Tests auth", command: "npm test -- auth" },
    { id: "lint", kind: "lint", label: "Lint", command: "npm run lint" },
  ],
  status: "completed",
  createdAt: "2026-10-07T13:20:00+02:00",
  results: [
    ...runsFor(A, aOpenCode, [
      {
        n: 1,
        status: "passed",
        min: 19,
        input: 84_210,
        output: 6_480,
        cost: 0.35,
        tools: 9,
        interventions: 1,
        checks: [ok("tests", "38 tests passent"), ok("lint")],
        sessionId: "s-atlas-101",
      },
      {
        n: 2,
        status: "failed",
        min: 24,
        input: 101_400,
        output: 7_900,
        cost: 0.42,
        tools: 14,
        interventions: 0,
        checks: [ko("tests", "2 échecs : refresh.test.ts › rotation après expiration"), ok("lint")],
      },
      {
        n: 3,
        status: "passed",
        min: 16,
        input: 77_900,
        output: 5_600,
        cost: 0.32,
        tools: 8,
        interventions: 1,
        checks: [ok("tests", "38 tests passent"), ok("lint")],
      },
    ]),
    ...runsFor(A, aClaudeCode, [
      {
        n: 1,
        status: "passed",
        min: 11,
        input: 61_900,
        output: 4_120,
        cost: 0.27,
        tools: 11,
        interventions: 1,
        checks: [ok("tests", "37 tests passent"), ok("lint")],
        sessionId: "s-atlas-102",
      },
      {
        n: 2,
        status: "passed",
        min: 13,
        input: 66_400,
        output: 4_710,
        cost: 0.29,
        tools: 12,
        interventions: 0,
        checks: [ok("tests", "38 tests passent"), ok("lint")],
      },
      {
        n: 3,
        status: "timeout",
        min: 30,
        input: 142_000,
        output: 9_800,
        cost: 0.61,
        tools: 31,
        interventions: 0,
        checks: [
          ko("tests", "Non exécuté : limite de temps atteinte"),
          ko("lint", "Non exécuté : limite de temps atteinte"),
        ],
      },
    ]),
  ],
};

// ── (b) Claude Sonnet vs GPT-5 in OpenCode ─────────────────────────────────

const B = "exp-sonnet-vs-gpt5";
const bSonnet: LabConfiguration = {
  id: "cfg-sonnet",
  label: "Claude Sonnet",
  harnessId: "opencode",
  providerId: "anthropic",
  modelId: "claude-sonnet",
  agentId: "developer",
  skillIds: ["typescript"],
  features: featuresOff(),
};
const bGpt5: LabConfiguration = { ...bSonnet, id: "cfg-gpt5", label: "GPT-5", providerId: "openai", modelId: "gpt-5" };

const experimentB: Experiment = {
  id: B,
  name: "Claude Sonnet vs GPT-5 dans OpenCode",
  task: "Ajouter le calcul de TVA aux factures : taux par pays (FR, DE, ES), arrondi au centime par ligne, total TTC exposé dans `GET /invoices/:id`.",
  workload: "feature",
  projectId: "atlas-api",
  initialState: { kind: "git-ref", ref: "main@a41c9e2", description: "Avant l'ajout de la TVA" },
  isolation: "git-worktree",
  variable: "model",
  configurations: [bSonnet, bGpt5],
  runsPerConfiguration: 3,
  timeLimitMinutes: 45,
  checkers: [
    { id: "tests", kind: "tests", label: "Tests billing", command: "npm test -- billing" },
    { id: "build", kind: "build", label: "Build", command: "npm run build" },
  ],
  status: "completed",
  createdAt: "2026-10-06T17:40:00+02:00",
  results: [
    ...runsFor(B, bSonnet, [
      {
        n: 1,
        status: "passed",
        min: 28,
        input: 176_000,
        output: 14_200,
        cost: 0.74,
        tools: 18,
        interventions: 1,
        checks: [ok("tests", "52 tests passent"), ok("build")],
      },
      {
        n: 2,
        status: "passed",
        min: 31,
        input: 191_000,
        output: 15_800,
        cost: 0.81,
        tools: 21,
        interventions: 0,
        checks: [ok("tests", "52 tests passent"), ok("build")],
      },
      {
        n: 3,
        status: "passed",
        min: 34,
        input: 204_000,
        output: 16_900,
        cost: 0.87,
        tools: 23,
        interventions: 1,
        checks: [ok("tests", "53 tests passent"), ok("build")],
      },
    ]),
    ...runsFor(B, bGpt5, [
      {
        n: 1,
        status: "passed",
        min: 39,
        input: 212_000,
        output: 18_700,
        cost: 0.45,
        tools: 31,
        interventions: 1,
        checks: [ok("tests", "54 tests passent"), ok("build")],
        sessionId: "s-atlas-097",
      },
      {
        n: 2,
        status: "failed",
        min: 41,
        input: 226_000,
        output: 19_900,
        cost: 0.48,
        tools: 27,
        interventions: 2,
        checks: [ko("tests", "3 échecs : TVA arrondie à l'unité au lieu du centime"), ok("build")],
      },
      {
        n: 3,
        status: "timeout",
        min: 45,
        input: null,
        output: null,
        cost: null,
        tools: 33,
        interventions: 0,
        usageNote: "Tour interrompu par la limite de temps : OpenCode n'envoie l'usage qu'en fin de tour",
        checks: [ko("tests", "Non exécuté : limite de temps atteinte"), ko("build", "Non exécuté")],
      },
    ]),
  ],
};

// ── (c) Skill debugging OFF vs ON ──────────────────────────────────────────

const C = "exp-skill-debugging";
const cOff: LabConfiguration = {
  id: "cfg-skill-off",
  label: "Sans skill debugging",
  harnessId: "pi",
  providerId: "anthropic",
  modelId: "claude-sonnet",
  skillIds: ["typescript"],
  features: featuresOff(),
};
const cOn: LabConfiguration = {
  ...cOff,
  id: "cfg-skill-on",
  label: "Avec skill debugging",
  skillIds: ["debugging", "typescript"],
};
const flakyOk = ok("stability", "20/20 exécutions passent");

const experimentC: Experiment = {
  id: C,
  name: "Skill debugging ON vs OFF",
  task: "Les tests du webhook Stripe échouent de façon intermittente (~1 fois sur 5). Trouver la cause et stabiliser sans désactiver de test.",
  workload: "debugging",
  projectId: "atlas-api",
  initialState: { kind: "git-ref", ref: "main@d03b7aa", description: "Flaky reproduit sur `webhooks.test.ts`" },
  isolation: "container",
  variable: "skill",
  configurations: [cOff, cOn],
  runsPerConfiguration: 5,
  timeLimitMinutes: 30,
  checkers: [
    { id: "tests", kind: "tests", label: "Tests webhooks", command: "npm test -- webhooks" },
    {
      id: "stability",
      kind: "custom",
      label: "Stabilité ×20",
      command: "node scripts/repeat.js 'npm test -- webhooks' 20",
    },
  ],
  status: "completed",
  createdAt: "2026-10-04T09:10:00+02:00",
  results: [
    ...runsFor(C, cOff, [
      {
        n: 1,
        status: "passed",
        min: 18,
        input: 92_000,
        output: 7_100,
        cost: 0.37,
        tools: 15,
        interventions: 1,
        checks: [ok("tests"), flakyOk],
      },
      {
        n: 2,
        status: "failed",
        min: 22,
        input: 108_000,
        output: 8_400,
        cost: 0.43,
        tools: 19,
        interventions: 0,
        checks: [ok("tests"), ko("stability", "3/20 exécutions échouent")],
      },
      {
        n: 3,
        status: "passed",
        min: 17,
        input: 88_000,
        output: 6_600,
        cost: 0.35,
        tools: 14,
        interventions: 0,
        checks: [ok("tests"), flakyOk],
      },
      {
        n: 4,
        status: "failed",
        min: 26,
        input: 121_000,
        output: 9_100,
        cost: 0.49,
        tools: 22,
        interventions: 1,
        checks: [ok("tests"), ko("stability", "5/20 exécutions échouent : le timeout a seulement été augmenté")],
      },
      {
        n: 5,
        status: "passed",
        min: 20,
        input: 97_000,
        output: 7_500,
        cost: 0.4,
        tools: 16,
        interventions: 1,
        checks: [ok("tests"), flakyOk],
      },
    ]),
    ...runsFor(C, cOn, [
      {
        n: 1,
        status: "passed",
        min: 15,
        input: 86_000,
        output: 6_200,
        cost: 0.34,
        tools: 12,
        interventions: 0,
        checks: [ok("tests"), flakyOk],
      },
      {
        n: 2,
        status: "passed",
        min: 16,
        input: 90_000,
        output: 6_800,
        cost: 0.36,
        tools: 13,
        interventions: 1,
        checks: [ok("tests"), flakyOk],
      },
      {
        n: 3,
        status: "passed",
        min: 14,
        input: 83_000,
        output: 5_900,
        cost: 0.32,
        tools: 11,
        interventions: 0,
        checks: [ok("tests"), flakyOk],
      },
      {
        n: 4,
        status: "failed",
        min: 23,
        input: 104_000,
        output: 8_000,
        cost: 0.42,
        tools: 18,
        interventions: 1,
        checks: [ok("tests"), ko("stability", "1/20 exécution échoue")],
      },
      {
        n: 5,
        status: "passed",
        min: 15,
        input: 87_000,
        output: 6_300,
        cost: 0.35,
        tools: 12,
        interventions: 0,
        checks: [ok("tests"), flakyOk],
      },
    ]),
  ],
};

// ── (d) Pi vs OMP — draft, cannot run (OMP not installed) ──────────────────

const dPi: LabConfiguration = {
  id: "cfg-pi",
  label: "Pi",
  harnessId: "pi",
  providerId: "anthropic",
  modelId: "claude-sonnet",
  skillIds: ["typescript", "git-hygiene"],
  features: featuresOff(),
};
const dOmp: LabConfiguration = { ...dPi, id: "cfg-omp", label: "OMP", harnessId: "omp" };

const experimentD: Experiment = {
  id: "exp-pi-vs-omp",
  name: "Pi vs OMP — refactoring",
  task: "Supprimer l'export XML legacy (`src/export/xml/**`) et migrer ses deux appelants vers l'export JSON, sans changer l'API publique.",
  workload: "refactoring",
  projectId: "atlas-api",
  initialState: {
    kind: "git-ref",
    ref: "main@3f9a1c0",
    description: "Export XML encore utilisé par billing et reports",
  },
  isolation: "git-worktree",
  variable: "harness",
  configurations: [dPi, dOmp],
  runsPerConfiguration: 3,
  timeLimitMinutes: 40,
  checkers: [
    { id: "build", kind: "build", label: "Build", command: "npm run build" },
    { id: "tests", kind: "tests", label: "Tests", command: "npm test" },
  ],
  status: "draft",
  createdAt: "2026-10-07T15:30:00+02:00",
  results: [],
};

// ── (e) Reviewer OFF vs ON (Warden feature) ────────────────────────────────

const E = "exp-reviewer";
const eOff: LabConfiguration = {
  id: "cfg-reviewer-off",
  label: "Baseline",
  harnessId: "opencode",
  providerId: "anthropic",
  modelId: "claude-sonnet",
  agentId: "frontend",
  skillIds: ["react", "typescript"],
  features: featuresOff(),
};
const eOn: LabConfiguration = {
  ...eOff,
  id: "cfg-reviewer-on",
  label: "+ Reviewer",
  features: featuresOff({ reviewer: true }),
};
/** Passed run with every checker green. */
const ePassed = (
  n: number,
  min: number,
  input: number,
  output: number,
  cost: number,
  tools: number,
  interventions: number,
): RawRun => ({
  n,
  status: "passed",
  min,
  input,
  output,
  cost,
  tools,
  interventions,
  checks: [ok("lint"), ok("build"), ok("tests", "24 tests passent")],
});

const experimentE: Experiment = {
  id: E,
  name: "Reviewer OFF vs ON — DataGrid",
  task: "Rendre les colonnes de `DataGrid` redimensionnables à la souris, avec une largeur minimale de 64 px et persistance par utilisateur.",
  workload: "frontend",
  projectId: "lumen-web",
  initialState: { kind: "git-ref", ref: "main@91c4e0f", description: "DataGrid sans redimensionnement" },
  isolation: "git-worktree",
  variable: "feature",
  configurations: [eOff, eOn],
  runsPerConfiguration: 4,
  timeLimitMinutes: 40,
  checkers: [
    { id: "lint", kind: "lint", label: "Lint", command: "pnpm lint" },
    { id: "build", kind: "build", label: "Build", command: "pnpm build" },
    { id: "tests", kind: "tests", label: "Tests DataGrid", command: "pnpm test -- DataGrid" },
  ],
  status: "completed",
  createdAt: "2026-10-06T08:45:00+02:00",
  results: [
    ...runsFor(E, eOff, [
      ePassed(1, 20, 118_000, 9_200, 0.49, 19, 1),
      {
        n: 2,
        status: "failed",
        min: 24,
        input: 131_000,
        output: 10_400,
        cost: 0.55,
        tools: 23,
        interventions: 1,
        checks: [ok("lint"), ok("build"), ko("tests", "DataGrid › resize respecte la largeur minimale")],
      },
      ePassed(3, 19, 112_000, 8_700, 0.47, 18, 0),
      ePassed(4, 21, 121_000, 9_500, 0.51, 20, 1),
    ]),
    ...runsFor(E, eOn, [
      ePassed(1, 27, 176_000, 13_800, 0.74, 26, 0),
      ePassed(2, 29, 188_000, 14_600, 0.78, 28, 1),
      ePassed(3, 26, 171_000, 13_100, 0.71, 25, 0),
      ePassed(4, 28, 181_000, 14_100, 0.75, 27, 0),
    ]),
  ],
};

export const experiments: Experiment[] = [experimentA, experimentB, experimentC, experimentE, experimentD];

// ── Rankings (CDC §24, §25) — Model × Harness × Workload ───────────────────

/** One row per Model × Harness × Workload, aggregated from past lab runs and tagged sessions. */
type RawRanking = [
  modelId: string,
  harnessId: HarnessId,
  workload: Workload,
  runs: number,
  passed: number,
  /** `null` when no price is known (local model). */
  costUsd: number | null,
  tokens: number,
  minutes: number,
  variance: number,
  toolCallsPerSuccess: number,
  interventions: number,
  quality: number,
];

const rawRankings: RawRanking[] = [
  // model, harness, workload, runs, passed, cost, tokens, minutes, σ, tool calls/success, interventions, quality
  ["claude-sonnet", "claude-code", "debugging", 12, 10, 0.29, 68_000, 12.5, 0.14, 11.2, 0.4, 0.86],
  ["claude-sonnet", "opencode", "debugging", 14, 10, 0.36, 89_000, 17, 0.21, 10.1, 0.7, 0.8],
  ["claude-sonnet", "pi", "debugging", 10, 7, 0.38, 96_000, 18, 0.19, 14.6, 0.5, 0.79],
  ["claude-opus", "claude-code", "debugging", 6, 5, 1.42, 74_000, 14, 0.12, 9.6, 0.3, 0.91],
  ["claude-opus", "omp", "debugging", 3, 3, 1.18, 66_000, 13, 0, 9.0, 0.3, 0.9],
  ["gpt-5", "opencode", "debugging", 9, 6, 0.31, 97_000, 21, 0.24, 13.4, 0.9, 0.74],
  ["gpt-5-codex", "codex", "debugging", 8, 6, 0.22, 71_000, 15, 0.18, 9.8, 0.5, 0.78],
  ["gemini-pro", "opencode", "debugging", 4, 2, 0.27, 102_000, 19, 0.35, 14.5, 1.2, 0.66],
  ["qwen3-coder", "opencode", "debugging", 3, 1, null, 64_000, 26, 0.42, 18.0, 1.7, 0.48],
  ["claude-sonnet", "opencode", "frontend", 10, 7, 0.51, 125_000, 21, 0.16, 16.3, 1.1, 0.76],
  ["claude-sonnet", "claude-code", "frontend", 6, 5, 0.41, 98_000, 18, 0.12, 14.0, 0.8, 0.82],
  ["gemini-flash", "pi", "frontend", 7, 4, 0.06, 52_000, 8, 0.24, 12.5, 1.4, 0.61],
  ["gpt-5", "opencode", "frontend", 5, 3, 0.39, 134_000, 27, 0.22, 19.0, 1.0, 0.7],
  ["gpt-5-codex", "codex", "frontend", 4, 3, 0.25, 88_000, 16, 0.2, 13.0, 0.8, 0.72],
  ["gpt-5-codex", "codex", "refactoring", 9, 5, 0.34, 143_000, 24, 0.27, 15.2, 1.1, 0.64],
  ["claude-opus", "claude-code", "refactoring", 5, 4, 1.65, 92_000, 16, 0.18, 12.4, 0.4, 0.87],
  ["claude-sonnet", "pi", "refactoring", 6, 4, 0.31, 77_000, 15, 0.21, 13.1, 0.7, 0.75],
  ["kimi-k2", "opencode", "refactoring", 6, 3, 0.09, 110_000, 23, 0.3, 17.8, 1.3, 0.6],
  ["claude-sonnet", "opencode", "feature", 8, 7, 0.71, 188_000, 31, 0.13, 19.6, 0.9, 0.83],
  ["gpt-5", "opencode", "feature", 8, 6, 0.47, 216_000, 38, 0.19, 22.4, 1.0, 0.78],
  ["gpt-5-mini", "pi", "feature", 10, 6, 0.08, 96_000, 14, 0.25, 14.9, 1.2, 0.62],
  ["gpt-5-codex", "codex", "tests", 7, 6, 0.19, 66_000, 13, 0.14, 8.7, 0.3, 0.81],
  ["claude-haiku", "claude-code", "tests", 6, 4, 0.07, 54_000, 7, 0.2, 10.2, 0.6, 0.68],
  ["claude-opus", "claude-code", "long-task", 4, 3, 3.8, 410_000, 58, 0.25, 41.0, 2.1, 0.84],
  ["kimi-k2", "opencode", "long-task", 3, 1, 0.42, 380_000, 71, 0.4, 55.0, 3.0, 0.55],
];

export const rankingEntries: RankingEntry[] = rawRankings.map((row): RankingEntry => {
  const [modelId, harnessId, workload, runs, passed, costUsd, tokens, minutes, variance, toolEff, interv, quality] =
    row;
  return {
    modelId,
    harnessId,
    workload,
    runs,
    successRate: passed / runs,
    avgCostUsd:
      costUsd === null
        ? unavailable("Modèle local : aucun prix catalogue")
        : { value: costUsd, ...COST_SOURCE[harnessId] },
    avgTokens: { value: tokens, confidence: "observed", source: TOKEN_SOURCE[harnessId] },
    avgDurationMs: minutes * 60_000,
    variance,
    toolEfficiency: toolEff,
    avgInterventions: interv,
    quality,
  };
});

// ── Feature observatory (CDC §26, §27) ─────────────────────────────────────

export interface FeatureArmStats {
  runs: number;
  successRate: number;
  avgCostUsd: Observation<number>;
  avgTokens: Observation<number>;
  avgDurationMs: Observation<number>;
  /** Std-dev of success across runs (lower is more reliable). */
  variance: number;
}

export interface FeatureEvaluation {
  id: string;
  name: string;
  kind: "skill" | "agent" | "memory" | "reviewer" | "mcp";
  description: string;
  workload: Workload;
  /** Context added to every model call when the layer is ON. */
  contextCost: Observation<number>;
  source:
    | { kind: "experiment"; experimentId: string; offConfigurationId: string; onConfigurationId: string }
    | { kind: "history"; note: string; off: FeatureArmStats; on: FeatureArmStats };
}

const arm = (
  runs: number,
  passed: number,
  cost: number,
  costConfidence: Confidence,
  tokens: number,
  min: number,
  variance: number,
): FeatureArmStats => ({
  runs,
  successRate: passed / runs,
  avgCostUsd: {
    value: cost,
    confidence: costConfidence,
    source: costConfidence === "observed" ? "rapporté par le harness" : "tokens × catalogue de prix",
  },
  avgTokens: { value: tokens, confidence: "observed", source: "usage rapporté par le harness" },
  avgDurationMs: { value: min * 60_000, confidence: "observed", source: "horloge Warden" },
  variance,
});

const debuggingSkill = skills.find((s) => s.id === "debugging");
const githubMcp = mcpServers.find((m) => m.id === "github");

export const featureEvaluations: FeatureEvaluation[] = [
  {
    id: "feat-skill-debugging",
    name: "Skill debugging",
    kind: "skill",
    description: "Méthode reproduire → isoler → corriger → test de régression, injectée dans le contexte.",
    workload: "debugging",
    contextCost: debuggingSkill?.tokenEstimate ?? unavailable("Skill introuvable"),
    source: {
      kind: "experiment",
      experimentId: C,
      offConfigurationId: cOff.id,
      onConfigurationId: cOn.id,
    },
  },
  {
    id: "feat-reviewer",
    name: "Reviewer",
    kind: "reviewer",
    description: "Second passage d'un agent Reviewer sur le diff avant de rendre la main.",
    workload: "frontend",
    contextCost: {
      value: 2_600,
      confidence: "estimated",
      source: "instructions + diff relu",
      note: "Par passage de revue",
    },
    source: {
      kind: "experiment",
      experimentId: E,
      offConfigurationId: eOff.id,
      onConfigurationId: eOn.id,
    },
  },
  {
    id: "feat-memory",
    name: "Memory",
    kind: "memory",
    description: "Résumé des sessions précédentes du projet injecté au démarrage de chaque session.",
    workload: "feature",
    contextCost: { value: 3_400, confidence: "estimated", source: "taille moyenne du résumé injecté" },
    source: {
      kind: "history",
      note: "Sessions atlas-api et lumen-web sous Claude Code · Claude Sonnet, avant / après activation (sept. 2026).",
      off: arm(12, 9, 0.31, "observed", 72_000, 14, 0.18),
      on: arm(10, 6, 0.43, "observed", 101_000, 16, 0.24),
    },
  },
  {
    id: "feat-mcp-github",
    name: "MCP github",
    kind: "mcp",
    description: "Serveur MCP github chargé dans chaque session (issues, PR).",
    workload: "debugging",
    contextCost: githubMcp?.contextTokens ?? unavailable("Serveur introuvable"),
    source: {
      kind: "history",
      note: "Sessions de debugging OpenCode · Claude Sonnet, avec et sans le serveur chargé.",
      off: arm(8, 6, 0.36, "estimated", 88_000, 17, 0.2),
      on: arm(8, 6, 0.4, "estimated", 98_000, 18, 0.21),
    },
  },
  {
    id: "feat-inspector",
    name: "Agent Inspector",
    kind: "agent",
    description: "Exploration en lecture seule produisant une carte du code avant l'implémentation.",
    workload: "feature",
    contextCost: { value: 1_900, confidence: "estimated", source: "instructions + carte produite" },
    source: {
      kind: "history",
      note: "Premiers essais manuels sur atlas-api (OpenCode · Claude Sonnet).",
      off: arm(4, 2, 0.41, "estimated", 96_000, 22, 0.5),
      on: arm(3, 2, 0.52, "estimated", 121_000, 25, 0.47),
    },
  },
];
