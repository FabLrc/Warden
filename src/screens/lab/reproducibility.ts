import { CONFIDENCE_LABELS, VARIABLE_LABELS } from "@/lib/labels";
import { links } from "@/lib/links";
import { checkCombination, getAgent, getHarness, getSkill } from "@/mock/queries";
import type { Confidence, Experiment, ExperimentVariable, HarnessId, LabConfiguration } from "@/mock/types";

/** What a configuration is made of; the studied variable must be the only one that changes (CDC §22). */
export type Dimension = "harness" | "model" | "agent" | "skills" | "features";

export const DIMENSION_LABELS: Record<Dimension, string> = {
  harness: "Harness",
  model: "Modèle",
  agent: "Agent",
  skills: "Skills",
  features: "Fonctionnalités Warden",
};

export const VARIABLE_DIMENSION: Record<ExperimentVariable, Dimension> = {
  harness: "harness",
  model: "model",
  skill: "skills",
  agent: "agent",
  feature: "features",
};

const DIMENSION_KEY: Record<Dimension, (c: LabConfiguration) => string> = {
  harness: (c) => c.harnessId,
  model: (c) => `${c.providerId}/${c.modelId}`,
  agent: (c) => c.agentId ?? "",
  skills: (c) => [...c.skillIds].sort().join(","),
  features: (c) =>
    Object.entries(c.features)
      .filter(([, on]) => on)
      .map(([id]) => id)
      .sort()
      .join(","),
};

export function differingDimensions(configurations: LabConfiguration[]): Dimension[] {
  return (Object.keys(DIMENSION_KEY) as Dimension[]).filter(
    (d) => new Set(configurations.map(DIMENSION_KEY[d])).size > 1,
  );
}

export type IssueSeverity = "blocking" | "warning" | "info";

export interface ReproIssue {
  id: string;
  severity: IssueSeverity;
  title: string;
  detail?: string;
  link?: { to: string; label: string };
}

export type ExperimentDefinition = Pick<
  Experiment,
  | "task"
  | "initialState"
  | "isolation"
  | "variable"
  | "configurations"
  | "checkers"
  | "runsPerConfiguration"
  | "timeLimitMinutes"
>;

/** Cost is observed only when the harness reports it; otherwise Warden estimates it from the price catalogue. */
const costConfidence = (harnessId: HarnessId): Confidence =>
  getHarness(harnessId).capabilities.costReporting.support === "supported" ? "observed" : "estimated";

/**
 * Everything that would make the comparison unfair or impossible.
 * "blocking" = cannot run; "warning" = runs but conclusions are doubtful; "info" = read results with care.
 */
export function analyzeExperiment(def: ExperimentDefinition): ReproIssue[] {
  const issues: ReproIssue[] = [];
  const configs = def.configurations;

  if (def.task.trim() === "") {
    issues.push({
      id: "task",
      severity: "blocking",
      title: "Tâche non décrite",
      detail: "Le même prompt est envoyé à chaque run.",
    });
  }
  if (def.initialState.ref.trim() === "") {
    issues.push({
      id: "ref",
      severity: "blocking",
      title: "État initial non défini",
      detail: "Sans ref git, les runs ne partiraient pas du même état du repository.",
    });
  }
  if (configs.length < 2) {
    issues.push({ id: "configs", severity: "blocking", title: "Au moins deux configurations sont nécessaires" });
  }
  if (def.timeLimitMinutes <= 0) {
    issues.push({ id: "time", severity: "blocking", title: "Limite de temps invalide" });
  }

  if (configs.length >= 2) {
    const differing = differingDimensions(configs);
    const studied = VARIABLE_DIMENSION[def.variable];
    if (!differing.includes(studied)) {
      issues.push({
        id: "variable-same",
        severity: "warning",
        title: `Les configurations ont le même ${DIMENSION_LABELS[studied].toLowerCase()}`,
        detail: `La variable étudiée (${VARIABLE_LABELS[def.variable]}) ne change pas : l'expérience ne mesurerait que le bruit entre runs.`,
      });
    }
    const confounders = differing.filter((d) => d !== studied);
    if (confounders.length > 0) {
      issues.push({
        id: "confounders",
        severity: "warning",
        title: `Les configurations diffèrent aussi par : ${confounders.map((d) => DIMENSION_LABELS[d]).join(", ")}`,
        detail: `Seule la variable étudiée (${VARIABLE_LABELS[def.variable]}) doit changer (CDC §22) ; sinon l'écart mesuré ne pourra pas lui être attribué.`,
      });
    }
  }

  for (const c of configs) {
    const harness = getHarness(c.harnessId);
    if (!harness.installed) {
      issues.push({
        id: `${c.id}-not-installed`,
        severity: "blocking",
        title: `${c.label} : ${harness.name} n'est pas installé`,
        detail: harness.statusDetail,
        link: { to: links.harnesses(), label: "Voir les harnesses" },
      });
    } else {
      if (harness.status === "outdated") {
        issues.push({
          id: `${c.id}-outdated`,
          severity: "warning",
          title: `${c.label} : ${harness.name} est obsolète`,
          detail: `${harness.statusDetail ?? ""} Mettre à jour avant de lancer, puis garder la même version pour tous les runs.`,
          link: { to: links.harnesses(), label: "Voir les harnesses" },
        });
      }
      const verdict = checkCombination(c);
      if (verdict.status === "unsupported") {
        issues.push({
          id: `${c.id}-combo`,
          severity: "blocking",
          title: `${c.label} : combinaison non supportée`,
          detail: verdict.reason,
          link: { to: links.models(), label: "Voir les modèles" },
        });
      } else if (verdict.status !== "supported") {
        issues.push({
          id: `${c.id}-combo`,
          severity: "warning",
          title: `${c.label} : combinaison ${verdict.status === "partial" ? "partiellement supportée" : "jamais vérifiée"}`,
          detail: verdict.reason,
        });
      }
    }

    const agent = c.agentId ? getAgent(c.agentId) : undefined;
    const agentSupport = agent?.compat[c.harnessId];
    if (agent && agentSupport && agentSupport.support !== "supported") {
      issues.push({
        id: `${c.id}-agent`,
        severity: agentSupport.support === "unsupported" ? "warning" : "info",
        title: `${c.label} : agent ${agent.name} ${agentSupport.support === "unsupported" ? "non supporté" : "adapté"} par ${harness.name}`,
        detail: agentSupport.note,
      });
    }

    const skillIssues = c.skillIds.flatMap((id) => {
      const skill = getSkill(id);
      const support = skill?.compat[c.harnessId];
      return skill && support && support.support !== "supported" ? [{ skill, support }] : [];
    });
    const unsupportedSkills = skillIssues.filter((s) => s.support.support === "unsupported");
    if (unsupportedSkills.length > 0) {
      issues.push({
        id: `${c.id}-skills-unsupported`,
        severity: "blocking",
        title: `${c.label} : skill non supporté par ${harness.name}`,
        detail: unsupportedSkills.map((s) => s.skill.name).join(", "),
        link: { to: links.skills(), label: "Voir les skills" },
      });
    }
    const degradedSkills = skillIssues.filter((s) => s.support.support !== "unsupported");
    if (degradedSkills.length > 0) {
      issues.push({
        id: `${c.id}-skills-partial`,
        severity: "info",
        title: `${c.label} : ${degradedSkills.map((s) => s.skill.name).join(", ")} chargé(s) différemment`,
        detail: `${degradedSkills[0].support.note ?? "Support partiel ou inconnu"} : le contexte reçu par le modèle n'est pas strictement identique.`,
      });
    }
  }

  if (def.checkers.length === 0) {
    issues.push({
      id: "no-checker",
      severity: "warning",
      title: "Aucun checker externe",
      detail:
        "L'agent ne doit pas être son propre juge (CDC §23) : sans tests, lint, build ou check personnalisé, la réussite reposerait sur sa propre déclaration.",
    });
  } else {
    const empty = def.checkers.filter((k) => k.command.trim() === "");
    if (empty.length > 0) {
      issues.push({
        id: "checker-empty",
        severity: "warning",
        title: `Checker sans commande : ${empty.map((k) => k.label || "sans nom").join(", ")}`,
      });
    }
    if (!def.checkers.some((k) => k.kind === "tests" || k.kind === "custom")) {
      issues.push({
        id: "checker-functional",
        severity: "info",
        title: "Aucun test ni check fonctionnel",
        detail: "Lint et build vérifient la forme, pas que la tâche est réellement accomplie.",
      });
    }
  }

  if (def.runsPerConfiguration < 3) {
    issues.push({
      id: "runs",
      severity: "warning",
      title: `${def.runsPerConfiguration} run${def.runsPerConfiguration > 1 ? "s" : ""} par configuration`,
      detail: "Moins de 3 runs : la variance due au non-déterminisme ne sera pas mesurable (CDC §22).",
    });
  }

  const costLevels = new Set(configs.map((c) => costConfidence(c.harnessId)));
  if (costLevels.size > 1) {
    const describe = configs.map((c) => `${CONFIDENCE_LABELS[costConfidence(c.harnessId)]} pour ${c.label}`);
    issues.push({
      id: "cost-confidence",
      severity: "info",
      title: "Coûts de confiance différente",
      detail: `${describe.join(", ")} : comparer les coûts avec prudence.`,
    });
  }
  const partialUsage = [...new Set(configs.map((c) => c.harnessId))]
    .map(getHarness)
    .filter((h) => h.capabilities.tokenUsage.support !== "supported");
  for (const h of partialUsage) {
    issues.push({
      id: `${h.id}-usage`,
      severity: "info",
      title: `${h.name} : usage tokens ${h.capabilities.tokenUsage.support === "partial" ? "partiel" : "incertain"}`,
      detail: h.capabilities.tokenUsage.note,
    });
  }

  return issues;
}

export const SEVERITY_ORDER: Record<IssueSeverity, number> = { blocking: 0, warning: 1, info: 2 };
