export type AutonomyMode = "ask" | "guided" | "auto" | "full"
export type OperationClass = "read" | "safe_write" | "dangerous" | "external_side_effect"
export type PolicyDecision = "allow" | "confirm" | "deny"

export interface PermissionPolicy {
  allowed?: OperationClass[]
  denied?: OperationClass[]
}

const readTools = new Set(["read", "read_file", "list", "list_files", "ls", "find", "search", "grep", "glob"])
const writeTools = new Set(["write", "write_file", "edit", "apply_patch", "mkdir"])
const dangerousTools = new Set(["rm", "delete", "delete_file", "git_reset", "git_clean", "shell"])
const externalTools = new Set(["fetch", "curl", "http", "request", "send_email", "publish"])

export function classifyTool(tool: string): OperationClass {
  if (readTools.has(tool)) return "read"
  if (writeTools.has(tool)) return "safe_write"
  if (externalTools.has(tool)) return "external_side_effect"
  if (dangerousTools.has(tool)) return "dangerous"
  return "dangerous"
}

export function decidePolicy(mode: AutonomyMode, operation: OperationClass, policy: PermissionPolicy = {}): PolicyDecision {
  if (policy.denied?.includes(operation)) return "deny"
  // Autonomy is a ceiling, not something an allowlist can override.
  if (mode === "ask" && (operation === "safe_write" || operation === "dangerous" || operation === "external_side_effect")) return "deny"
  if (mode === "auto" && operation === "external_side_effect") return "deny"
  if (policy.allowed?.includes(operation)) return "allow"
  if (mode === "ask") return "confirm"
  if (operation === "external_side_effect" || operation === "dangerous") return "confirm"
  return "allow"
}
