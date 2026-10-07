import { CheckCircle2 } from "lucide-react";
import { SupportBadge } from "@/components/warden/badges";
import { CAPABILITY_LABELS } from "@/mock/fixtures/catalog";
import { mcpServers } from "@/mock/fixtures/workspace";
import { getAgent, getHarness, getSkill } from "@/mock/queries";
import type { CapabilityId, HarnessId, Support } from "@/mock/types";

/** Capabilities that change what Warden can offer in a session (CDC §9, §10). */
const SESSION_FEATURES: CapabilityId[] = [
  "permissions",
  "interrupt",
  "resume",
  "tokenUsage",
  "costReporting",
  "skills",
  "customAgents",
  "mcp",
  "rawEvents",
];

const SUPPORT_ORDER: Record<Support, number> = { unsupported: 0, partial: 1, unknown: 2, supported: 3 };

interface FeatureIssue {
  key: string;
  label: string;
  support: Support;
  note?: string;
}

/**
 * Everything that will not fully work with this harness for the chosen agent / skills,
 * most severe first. Empty when the session gets every Warden feature.
 */
function featureIssues(harnessId: HarnessId, agentId: string | undefined, skillIds: string[]): FeatureIssue[] {
  const harness = getHarness(harnessId);
  const issues: FeatureIssue[] = SESSION_FEATURES.filter((id) => harness.capabilities[id].support !== "supported").map(
    (id) => ({ key: id, label: CAPABILITY_LABELS[id], ...harness.capabilities[id] }),
  );
  const agent = agentId ? getAgent(agentId) : undefined;
  if (agent && agent.compat[harnessId].support !== "supported") {
    issues.push({ key: `agent-${agent.id}`, label: `Agent ${agent.name}`, ...agent.compat[harnessId] });
  }
  for (const id of skillIds) {
    const skill = getSkill(id);
    if (skill && skill.compat[harnessId].support !== "supported") {
      issues.push({ key: `skill-${id}`, label: `Skill ${skill.name}`, ...skill.compat[harnessId] });
    }
  }
  if (harness.capabilities.mcp.support === "unsupported") {
    const servers = mcpServers.filter(
      (m) =>
        m.status === "connected" && (m.allowedAgentIds === "all" || (agentId && m.allowedAgentIds.includes(agentId))),
    );
    if (servers.length > 0) {
      issues.push({
        key: "mcp-servers",
        label: `${servers.length} serveur${servers.length > 1 ? "s" : ""} MCP ignoré${servers.length > 1 ? "s" : ""}`,
        support: "unsupported",
        note: `${servers.map((m) => m.name).join(", ")} : ${harness.name} ne charge pas de serveurs MCP.`,
      });
    }
  }
  return issues.sort((a, b) => SUPPORT_ORDER[a.support] - SUPPORT_ORDER[b.support]);
}

/** Compact line above the composer: what will not work with this harness (CDC §9 "le signaler clairement"). */
export function HarnessFeatureSummary({
  harnessId,
  agentId,
  skillIds,
}: {
  harnessId: HarnessId;
  agentId?: string;
  skillIds: string[];
}) {
  const harness = getHarness(harnessId);
  const issues = featureIssues(harnessId, agentId, skillIds);
  if (issues.length === 0) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <CheckCircle2 className="size-3.5 text-success" />
        Toutes les fonctionnalités Warden sont disponibles avec {harness.name}.
      </p>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      <span className="text-muted-foreground">Avec {harness.name} :</span>
      {issues.map((issue) => (
        <SupportBadge key={issue.key} support={issue.support} note={issue.note} label={issue.label} />
      ))}
    </div>
  );
}

/** Full capability table for the selected harness (new-session empty state). */
export function HarnessFeatureGrid({ harnessId }: { harnessId: HarnessId }) {
  const harness = getHarness(harnessId);
  return (
    <ul className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
      {SESSION_FEATURES.map((id) => {
        const cap = harness.capabilities[id];
        return (
          <li key={id} className="flex items-start justify-between gap-3 py-1 text-sm">
            <span className="min-w-0">
              <span className={cap.support === "unsupported" ? "text-muted-foreground line-through" : undefined}>
                {CAPABILITY_LABELS[id]}
              </span>
              {cap.note && <span className="block text-[11px] text-muted-foreground">{cap.note}</span>}
            </span>
            <SupportBadge support={cap.support} className="shrink-0" />
          </li>
        );
      })}
    </ul>
  );
}
