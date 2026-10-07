/**
 * Prototype-only types (Étape 0).
 *
 * They exist to feed the UI mock-up and model the concepts of the CDC §7.
 * They are NOT the Étape 1 schema: re-examine every field before reusing any of it.
 */

// ── Observations ────────────────────────────────────────────────────────────

/** CDC §17 — Warden never presents an estimate as a certain value. */
export type Confidence = "observed" | "estimated" | "inferred" | "unavailable";

export interface Observation<T> {
  /** `null` when `confidence === "unavailable"`. */
  value: T | null;
  confidence: Confidence;
  /** Where the value comes from (e.g. "ACP session/update", "prix catalogue"). */
  source?: string;
  note?: string;
}

// ── Harnesses, providers, models ───────────────────────────────────────────

export type HarnessId = "opencode" | "claude-code" | "codex" | "pi" | "omp";

export type CapabilityId =
  | "streaming"
  | "toolCalls"
  | "permissions"
  | "interrupt"
  | "resume"
  | "providerSelection"
  | "modelSelection"
  | "tokenUsage"
  | "costReporting"
  | "skills"
  | "customAgents"
  | "mcp"
  | "rawEvents";

export type Support = "supported" | "partial" | "unsupported" | "unknown";

export interface CapabilitySupport {
  support: Support;
  note?: string;
}

export type HarnessStatus = "available" | "not-installed" | "outdated" | "error";

export interface Harness {
  id: HarnessId;
  name: string;
  /** How Warden talks to it. */
  integration: "acp-native" | "acp-adapter" | "native-rpc";
  /** Adapter binary when integration is "acp-adapter". */
  adapter?: string;
  command: string;
  installed: boolean;
  version?: string;
  latestVersion?: string;
  status: HarnessStatus;
  statusDetail?: string;
  capabilities: Record<CapabilityId, CapabilitySupport>;
  limitations: string[];
}

export interface Provider {
  id: string;
  name: string;
  kind: "cloud" | "local" | "router";
}

export type ModelTier = "fast" | "balanced" | "powerful";

export interface Model {
  id: string;
  name: string;
  providerId: string;
  tier: ModelTier;
  contextWindow: number;
  /** USD per million tokens (catalogue price, used for estimates). */
  inputPricePerMTok?: number;
  outputPricePerMTok?: number;
}

/**
 * CDC §11 — explicit compatibility. A rule without `modelId` applies to the whole provider.
 * Combinations not covered by any rule are "unknown", never silently "supported".
 */
export interface CompatibilityRule {
  harnessId: HarnessId;
  providerId: string;
  modelId?: string;
  status: "supported" | "unsupported" | "partial";
  reason?: string;
}

export interface Combination {
  harnessId: HarnessId;
  providerId: string;
  modelId: string;
}

// ── Permissions ─────────────────────────────────────────────────────────────

/** CDC §30 */
export type PermissionKind = "read" | "write" | "shell" | "network" | "git" | "external" | "dangerous";

export type PermissionPolicyValue = "allow" | "ask" | "deny";

export type PermissionPolicy = Record<PermissionKind, PermissionPolicyValue>;

export type PermissionDecision = "allow-once" | "allow-always" | "deny";

// ── Skills, agents, MCP, profiles ──────────────────────────────────────────

export type Scope = { kind: "global" } | { kind: "project"; projectIds: string[] };

export interface Skill {
  id: string;
  name: string;
  description: string;
  /** Markdown body. */
  content: string;
  enabled: boolean;
  scope: Scope;
  origin: { kind: "warden" } | { kind: "imported"; from: string };
  compat: Record<HarnessId, CapabilitySupport>;
  /** Estimated context cost when loaded. */
  tokenEstimate: Observation<number>;
  updatedAt: string;
}

export interface Agent {
  id: string;
  name: string;
  objective: string;
  instructions: string;
  preferredModelId?: string;
  preferredHarnessIds: HarnessId[];
  skillIds: string[];
  toolIds: string[];
  permissions: PermissionPolicy;
  compat: Record<HarnessId, CapabilitySupport>;
}

export interface McpTool {
  name: string;
  description: string;
  tokenEstimate: Observation<number>;
}

export interface McpServer {
  id: string;
  name: string;
  transport: "stdio" | "http";
  endpoint: string;
  status: "connected" | "disconnected" | "error";
  statusDetail?: string;
  tools: McpTool[];
  allowedAgentIds: string[] | "all";
  /** Harnesses that load this server themselves (Warden does not proxy MCP). */
  harnessIds: HarnessId[];
  contextTokens: Observation<number>;
}

export interface Profile {
  id: string;
  name: string;
  description: string;
  scope: Scope;
  harnessId: HarnessId;
  providerId: string;
  modelId: string;
  agentId?: string;
  skillIds: string[];
}

// ── Projects & sessions ────────────────────────────────────────────────────

export type FileChangeKind = "added" | "modified" | "deleted";

export interface FileChange {
  path: string;
  change: FileChangeKind;
  additions: number;
  deletions: number;
  sessionId?: string;
  at: string;
}

export interface Project {
  id: string;
  name: string;
  path: string;
  description: string;
  branch: string;
  languages: string[];
  lastOpenedAt: string;
  defaultProfileId?: string;
  recentChanges: FileChange[];
  preferences: { label: string; value: string }[];
}

export type SessionStatus = "running" | "awaiting-permission" | "completed" | "interrupted" | "failed";

export interface SessionMetrics {
  durationMs: Observation<number>;
  inputTokens: Observation<number>;
  outputTokens: Observation<number>;
  cacheReadTokens: Observation<number>;
  cost: Observation<number>;
  modelCalls: Observation<number>;
  toolCalls: Observation<number>;
  errors: Observation<number>;
  permissionsRequested: Observation<number>;
  systemPromptTokens: Observation<number>;
}

export interface Session {
  id: string;
  projectId: string;
  title: string;
  harnessId: HarnessId;
  providerId: string;
  modelId: string;
  agentId?: string;
  profileId?: string;
  skillIds: string[];
  status: SessionStatus;
  startedAt: string;
  endedAt?: string;
  /** Harness can resume this session. */
  resumable: boolean;
  workload: Workload;
  metrics: SessionMetrics;
  filesChanged: FileChange[];
}

// ── Traces ─────────────────────────────────────────────────────────────────

/** CDC §18 — prompt → model call → tool → model → edit → test → result. */
export type TraceEventKind =
  | "session-start"
  | "user-prompt"
  | "model-call"
  | "thinking"
  | "assistant-message"
  | "tool-call"
  | "permission-request"
  | "file-read"
  | "file-edit"
  | "command"
  | "error"
  | "interrupt"
  | "session-end";

export type TraceEventStatus = "pending" | "ok" | "error" | "denied" | "cancelled";

export interface TraceEvent {
  id: string;
  sessionId: string;
  /** Parent/child relation (tool-call → command, model-call → assistant-message…). */
  parentId?: string;
  kind: TraceEventKind;
  /** ISO timestamp. */
  at: string;
  durationMs?: number;
  title: string;
  status?: TraceEventStatus;
  /** Free text: prompt, assistant message (markdown), thinking. */
  text?: string;
  tool?: string;
  file?: { path: string; line?: number };
  /** Unified diff for file-edit. */
  diff?: string;
  command?: string;
  output?: string;
  exitCode?: number;
  permission?: { kind: PermissionKind; decision?: PermissionDecision; reason: string };
  tokens?: { input: Observation<number>; output: Observation<number> };
  cost?: Observation<number>;
  /** Event exactly as received from the harness (ACP JSON-RPC payload). */
  raw: unknown;
}

// ── Lab, benchmarks, rankings ──────────────────────────────────────────────

export type Workload = "debugging" | "frontend" | "refactoring" | "feature" | "tests" | "long-task";

export interface LabConfiguration {
  id: string;
  label: string;
  harnessId: HarnessId;
  providerId: string;
  modelId: string;
  agentId?: string;
  skillIds: string[];
  /** Warden feature toggles under evaluation (CDC §26). */
  features: Record<string, boolean>;
}

export interface Checker {
  id: string;
  kind: "tests" | "lint" | "build" | "custom";
  label: string;
  command: string;
}

export interface CheckResult {
  checkerId: string;
  passed: boolean;
  detail?: string;
}

export interface RunResult {
  id: string;
  configurationId: string;
  run: number;
  status: "passed" | "failed" | "timeout" | "error" | "running" | "queued";
  checks: CheckResult[];
  durationMs: Observation<number>;
  inputTokens: Observation<number>;
  outputTokens: Observation<number>;
  cost: Observation<number>;
  toolCalls: Observation<number>;
  userInterventions: number;
  sessionId?: string;
}

export type ExperimentVariable = "harness" | "model" | "skill" | "agent" | "feature";

export interface Experiment {
  id: string;
  name: string;
  task: string;
  workload: Workload;
  projectId: string;
  initialState: { kind: "git-ref"; ref: string; description: string };
  isolation: "git-worktree" | "container";
  variable: ExperimentVariable;
  configurations: LabConfiguration[];
  runsPerConfiguration: number;
  timeLimitMinutes: number;
  checkers: Checker[];
  status: "draft" | "running" | "completed";
  createdAt: string;
  results: RunResult[];
}

export interface RankingEntry {
  modelId: string;
  harnessId: HarnessId;
  workload: Workload;
  runs: number;
  successRate: number;
  avgCostUsd: Observation<number>;
  avgTokens: Observation<number>;
  avgDurationMs: number;
  /** Std-dev of success across repeated runs, 0..1 (lower is better). */
  variance: number;
  /** Tool calls per successful run. */
  toolEfficiency: number;
  avgInterventions: number;
  /** Quality score from external checkers, 0..1. */
  quality: number;
}

// ── Code workspace ─────────────────────────────────────────────────────────

export interface FileNode {
  name: string;
  path: string;
  kind: "file" | "dir";
  children?: FileNode[];
}
