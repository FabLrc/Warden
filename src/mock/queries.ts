import { compatibilityRules, harnesses, models, providers } from "@/mock/fixtures/catalog";
import { sessions } from "@/mock/fixtures/sessions";
import { traces } from "@/mock/fixtures/traces";
import { agents, mcpServers, profiles, projects, skills } from "@/mock/fixtures/workspace";
import type {
  Agent,
  Combination,
  CompatibilityRule,
  Harness,
  HarnessId,
  Model,
  Profile,
  Project,
  Provider,
  Session,
  Skill,
  TraceEvent,
} from "@/mock/types";

function must<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`Mock data: ${what} introuvable`);
  return value;
}

export const getHarness = (id: HarnessId): Harness =>
  must(
    harnesses.find((h) => h.id === id),
    `harness ${id}`,
  );
export const getProvider = (id: string): Provider =>
  must(
    providers.find((p) => p.id === id),
    `provider ${id}`,
  );
export const getModel = (id: string): Model =>
  must(
    models.find((m) => m.id === id),
    `model ${id}`,
  );
export const getProject = (id: string): Project | undefined => projects.find((p) => p.id === id);
export const getSession = (id: string): Session | undefined => sessions.find((s) => s.id === id);
export const getAgent = (id: string): Agent | undefined => agents.find((a) => a.id === id);
export const getSkill = (id: string): Skill | undefined => skills.find((s) => s.id === id);
export const getProfile = (id: string): Profile | undefined => profiles.find((p) => p.id === id);
export const getMcpServer = (id: string) => mcpServers.find((m) => m.id === id);

export const getTrace = (sessionId: string): TraceEvent[] => traces[sessionId] ?? [];

/** Newest first. */
export const sessionsForProject = (projectId: string): Session[] =>
  sessions.filter((s) => s.projectId === projectId).sort((a, b) => b.startedAt.localeCompare(a.startedAt));

export const allSessionsNewestFirst = (): Session[] =>
  [...sessions].sort((a, b) => b.startedAt.localeCompare(a.startedAt));

export const modelsForProvider = (providerId: string): Model[] => models.filter((m) => m.providerId === providerId);

/** Profiles usable in a project: global + scoped to it. */
export const profilesForProject = (projectId: string): Profile[] =>
  profiles.filter((p) => p.scope.kind === "global" || p.scope.projectIds.includes(projectId));

export const skillsForProject = (projectId: string): Skill[] =>
  skills.filter((s) => s.scope.kind === "global" || s.scope.projectIds.includes(projectId));

export type CompatibilityStatus = CompatibilityRule["status"] | "unknown";

export interface CompatibilityVerdict {
  status: CompatibilityStatus;
  reason?: string;
}

/** Provider-level verdict for a harness. */
export function checkProvider(harnessId: HarnessId, providerId: string): CompatibilityVerdict {
  const rule = compatibilityRules.find((r) => r.harnessId === harnessId && r.providerId === providerId && !r.modelId);
  return rule
    ? { status: rule.status, reason: rule.reason }
    : { status: "unknown", reason: "Combinaison jamais vérifiée" };
}

/**
 * CDC §11 — never pretend a combination works. A model-specific rule overrides the provider rule;
 * a harness that is not installed makes everything at most "partial".
 */
export function checkCombination({ harnessId, providerId, modelId }: Combination): CompatibilityVerdict {
  const model = models.find((m) => m.id === modelId);
  if (model && model.providerId !== providerId) {
    return { status: "unsupported", reason: `${model.name} n'est pas servi par ${getProvider(providerId).name}` };
  }
  const modelRule = compatibilityRules.find(
    (r) => r.harnessId === harnessId && r.providerId === providerId && r.modelId === modelId,
  );
  const verdict: CompatibilityVerdict = modelRule
    ? { status: modelRule.status, reason: modelRule.reason }
    : checkProvider(harnessId, providerId);
  const harness = getHarness(harnessId);
  if (!harness.installed && verdict.status !== "unsupported") {
    return {
      status: "partial",
      reason: `${harness.name} n'est pas installé${verdict.reason ? ` · ${verdict.reason}` : ""}`,
    };
  }
  return verdict;
}
