import { readFile } from "node:fs/promises"
import { homedir } from "node:os"
import { join } from "node:path"
import { parse } from "yaml"
import { agentRoles } from "../core/roles.js"
import type { McpAgentAccess, McpServerDefinition } from "../mcp/mcp-registry.js"
import type { AutonomyMode, PermissionPolicy } from "../policy/policy.js"

export type ReasoningLevel = "low" | "medium" | "high"

export interface ModelConfig {
  provider: string
  model: string
  reasoning?: ReasoningLevel
  contextLimit?: number
}

export interface CategoryConfig {
  model: string
  reasoning?: ReasoningLevel
  contextLimit?: number
  validation?: string[]
}

export interface WardenConfig {
  version: 1
  autonomy: AutonomyMode
  models: Record<string, ModelConfig>
  categories: Record<string, CategoryConfig>
  policy: PermissionPolicy
  mcp: Record<string, McpServerDefinition>
}

type ConfigInput = {
  version?: unknown
  autonomy?: unknown
  models?: Record<string, Partial<ModelConfig>>
  categories?: Record<string, Partial<CategoryConfig>>
  policy?: PermissionPolicy
  mcp?: Record<string, Partial<McpServerDefinition>>
}

const defaults: WardenConfig = { version: 1, autonomy: "guided", models: {}, categories: {}, policy: {}, mcp: {} }

export async function loadConfig(project: string, home = homedir()): Promise<WardenConfig> {
  const global = await readConfig(join(home, ".warden", "config.yaml"))
  const local = await readConfig(join(project, ".warden", "config.yaml"))
  return parseConfig(merge(merge(defaults, global), local))
}

export function parseConfig(input: unknown): WardenConfig {
  if (!isRecord(input)) throw new Error("invalid Warden config: expected an object")
  const config = merge(defaults, input as ConfigInput)
  if (config.version !== 1) throw new Error("invalid Warden config: unsupported version")
  if (!isAutonomyMode(config.autonomy)) throw new Error("invalid Warden config: invalid autonomy mode")
  if (!isRecord(config.models) || !isRecord(config.categories) || !isPolicy(config.policy) || !isRecord(config.mcp)) throw new Error("invalid Warden config: invalid sections")
  for (const [name, model] of Object.entries(config.models)) {
    if (!isRecord(model) || typeof model.provider !== "string" || typeof model.model !== "string" || !isReasoning(model.reasoning) || !isLimit(model.contextLimit)) throw new Error(`invalid Warden config: invalid model ${name}`)
  }
  for (const [name, category] of Object.entries(config.categories)) {
    if (!isRecord(category) || typeof category.model !== "string" || !(category.model in config.models) || !isReasoning(category.reasoning) || !isLimit(category.contextLimit) || !isStrings(category.validation)) throw new Error(`invalid Warden config: invalid category ${name}${typeof category.model === "string" && !(category.model in config.models) ? " (unknown model)" : ""}`)
  }
  for (const [name, server] of Object.entries(config.mcp)) {
    if (!isMcpServer(server)) throw new Error(`invalid Warden config: invalid MCP server ${name}`)
  }
  return config as WardenConfig
}

async function readConfig(path: string): Promise<ConfigInput> {
  try {
    return parse(await readFile(path, "utf8")) as ConfigInput
  } catch (error: unknown) {
    if (isRecord(error) && error.code === "ENOENT") return {}
    throw new Error(`invalid Warden config at ${path}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

function merge(base: WardenConfig | ConfigInput, override: ConfigInput): WardenConfig {
  return {
    ...base,
    ...override,
    models: mergeRecords(base.models, override.models),
    categories: mergeRecords(base.categories, override.categories),
    policy: { ...base.policy, ...override.policy },
    mcp: mergeMcpRecords(base.mcp, override.mcp)
  } as WardenConfig
}

function mergeMcpRecords(base: Record<string, Partial<McpServerDefinition>> | undefined, override: Record<string, Partial<McpServerDefinition>> | undefined): Record<string, McpServerDefinition> {
  return Object.fromEntries([...new Set([...Object.keys(base ?? {}), ...Object.keys(override ?? {})])].map((name) => [name, {
    ...base?.[name],
    ...override?.[name],
    env: { ...base?.[name]?.env, ...override?.[name]?.env },
    agents: mergeRecords(base?.[name]?.agents, override?.[name]?.agents)
  }])) as Record<string, McpServerDefinition>
}

function mergeRecords<T>(base: Record<string, T> | undefined, override: Record<string, Partial<T>> | undefined): Record<string, T> {
  return Object.fromEntries([...new Set([...Object.keys(base ?? {}), ...Object.keys(override ?? {})])].map((name) => [name, { ...base?.[name], ...override?.[name] }])) as Record<string, T>
}

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value) }
function isAutonomyMode(value: unknown): value is AutonomyMode { return value === "ask" || value === "guided" || value === "auto" || value === "full" }
function isReasoning(value: unknown): value is ReasoningLevel | undefined { return value === undefined || value === "low" || value === "medium" || value === "high" }
function isLimit(value: unknown): boolean { return value === undefined || (typeof value === "number" && Number.isInteger(value) && value > 0) }
function isStrings(value: unknown): boolean { return value === undefined || (Array.isArray(value) && value.every((item) => typeof item === "string")) }
function isPolicy(value: unknown): value is PermissionPolicy { return isRecord(value) && isStrings(value.allowed) && isStrings(value.denied) }
function isMcpServer(value: unknown): value is McpServerDefinition {
  return isRecord(value) && typeof value.command === "string" && value.command.length > 0 && isStrings(value.args) && isStringRecord(value.env) && isBoolean(value.enabled) && isMcpAgents(value.agents)
}
function isMcpAgents(value: unknown): value is Record<string, McpAgentAccess> | undefined {
  return value === undefined || (isRecord(value) && Object.entries(value).every(([agent, access]) => agentRoles.includes(agent as typeof agentRoles[number]) && isRecord(access) && isBoolean(access.enabled) && isStrings(access.allowedTools)))
}
function isStringRecord(value: unknown): value is Record<string, string> | undefined { return value === undefined || (isRecord(value) && Object.values(value).every((item) => typeof item === "string")) }
function isBoolean(value: unknown): boolean { return value === undefined || typeof value === "boolean" }
