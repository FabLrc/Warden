import type {
  Confidence,
  ExperimentVariable,
  ModelTier,
  PermissionDecision,
  PermissionKind,
  PermissionPolicyValue,
  SessionStatus,
  Support,
  Workload,
} from "@/mock/types";

export const CONFIDENCE_LABELS: Record<Confidence, string> = {
  observed: "Observed",
  estimated: "Estimated",
  inferred: "Inferred",
  unavailable: "Unavailable",
};

export const CONFIDENCE_HELP: Record<Confidence, string> = {
  observed: "Valeur rapportée directement par le harness.",
  estimated: "Valeur calculée par Warden (ex. tokens × prix catalogue).",
  inferred: "Valeur déduite indirectement d'autres événements.",
  unavailable: "Le harness n'expose pas cette information.",
};

export const SUPPORT_LABELS: Record<Support, string> = {
  supported: "Supporté",
  partial: "Partiel",
  unsupported: "Non supporté",
  unknown: "Inconnu",
};

export const SESSION_STATUS_LABELS: Record<SessionStatus, string> = {
  running: "En cours",
  "awaiting-permission": "Permission requise",
  completed: "Terminée",
  interrupted: "Interrompue",
  failed: "Échec",
};

export const WORKLOAD_LABELS: Record<Workload, string> = {
  debugging: "Debugging",
  frontend: "Frontend",
  refactoring: "Refactoring",
  feature: "Feature",
  tests: "Tests",
  "long-task": "Tâche longue",
};

export const PERMISSION_KIND_LABELS: Record<PermissionKind, string> = {
  read: "Lecture",
  write: "Écriture",
  shell: "Shell",
  network: "Réseau",
  git: "Git",
  external: "Effet externe",
  dangerous: "Opération dangereuse",
};

export const PERMISSION_POLICY_LABELS: Record<PermissionPolicyValue, string> = {
  allow: "Autoriser",
  ask: "Demander",
  deny: "Refuser",
};

export const PERMISSION_DECISION_LABELS: Record<PermissionDecision, string> = {
  "allow-once": "Autorisé une fois",
  "allow-always": "Toujours autorisé",
  deny: "Refusé",
};

export const MODEL_TIER_LABELS: Record<ModelTier, string> = {
  fast: "Rapide",
  balanced: "Équilibré",
  powerful: "Puissant",
};

export const INTEGRATION_LABELS = {
  "acp-native": "ACP natif",
  "acp-adapter": "ACP via adaptateur",
  "native-rpc": "Protocole natif",
} as const;

export const VARIABLE_LABELS: Record<ExperimentVariable, string> = {
  harness: "Harness",
  model: "Modèle",
  skill: "Skill",
  agent: "Agent",
  feature: "Fonctionnalité Warden",
};
