import { DefaultResourceLoader, ModelRuntime, SessionManager, createAgentSession, type ExtensionAPI } from "@earendil-works/pi-coding-agent"
import type { ModelConfig } from "../config/config.js"
import { canWrite, type AgentRole } from "../core/roles.js"
import { EventBus, event, type Usage } from "../core/events.js"
import { ContextInspector, type ContextSnapshot } from "../observability/context-inspector.js"
import { classifyTool, decidePolicy, type AutonomyMode, type PermissionPolicy } from "../policy/policy.js"
import type { MemoryRecord } from "../memory/memory-store.js"
import { isMcpToolName, openMcpTools } from "../mcp/mcp-bridge.js"
import { McpRegistry, type McpServerDefinition } from "../mcp/mcp-registry.js"
import { ToolProxy, defaultToolOutputBytes, type ToolProxyOptions } from "../tools/tool-proxy.js"

export interface TaskArtifact { label: string; content: string }
export interface TaskContext {
  objective: string
  constraints: string[]
  artifacts: TaskArtifact[]
  system?: string
  project?: string
  memory?: string[]
  memoryArtifacts?: TaskArtifact[]
  skills?: string[]
  toolResults?: string[]
  role?: AgentRole
  model?: ModelConfig
}
export interface PiRunResult { status: "completed" | "cancelled" | "failed"; text: string; usage?: Usage }
export interface PiSession {
  prompt(text: string): Promise<unknown>
  getLastAssistantText(): string | undefined
  subscribe(listener: (value: unknown) => void): () => void
  dispose(): void
  abort(): Promise<void>
}
export type PiSessionFactory = (context: TaskContext) => Promise<PiSession>
export interface PiPolicyOptions { autonomy?: AutonomyMode; policy?: PermissionPolicy; toolProxy?: ToolProxyOptions; mcp?: Record<string, McpServerDefinition> }

export class PiRunner {
  constructor(private readonly factory: PiSessionFactory, private readonly events: EventBus, private readonly sessionId: string, private readonly inspector = new ContextInspector()) {}

  async run(context: TaskContext, options: { signal?: AbortSignal } = {}): Promise<PiRunResult> {
    const session = await this.factory(context)
    const unsubscribe = observePiSession(session, this.events, this.sessionId)
    const abort = () => { void session.abort() }
    options.signal?.addEventListener("abort", abort, { once: true })
    try {
      if (options.signal?.aborted) return { status: "cancelled", text: "" }
      this.inspector.reset()
      recordContext(this.inspector, context)
      if (context.model) this.events.publish(event(this.sessionId, "model.selected", { provider: context.model.provider, model: context.model.model, source: "configured" }))
      await session.prompt(renderContext(context))
      if (options.signal?.aborted) return { status: "cancelled", text: "" }
      const text = session.getLastAssistantText() ?? ""
      return { status: "completed", text }
    } catch (error) {
      if (options.signal?.aborted) return { status: "cancelled", text: "" }
      return { status: "failed", text: error instanceof Error ? error.message : String(error) }
    } finally {
      options.signal?.removeEventListener("abort", abort)
      unsubscribe()
      session.dispose()
    }
  }

  contextSnapshot(): ContextSnapshot { return this.inspector.snapshot() }
}

function observePiSession(session: PiSession, events: EventBus, sessionId: string): () => void {
  return session.subscribe((value) => {
    if (!isRecord(value) || typeof value.type !== "string") return
    switch (value.type) {
      case "agent_start":
        events.publish(event(sessionId, "agent.started", {}))
        break
      case "agent_end":
        events.publish(event(sessionId, "agent.completed", {}))
        break
      case "tool_execution_start":
        if (typeof value.toolName === "string") events.publish(event(sessionId, "tool.started", { tool: value.toolName }))
        break
      case "tool_execution_end":
        if (typeof value.toolName === "string") events.publish(event(sessionId, "tool.completed", { tool: value.toolName, success: value.isError !== true }))
        break
      case "model_select": {
        const model = isRecord(value.model) ? value.model : undefined
        if (typeof model?.provider === "string" && typeof model.id === "string") events.publish(event(sessionId, "model.selected", { provider: model.provider, model: model.id, source: typeof value.source === "string" ? value.source : "session" }))
        break
      }
      case "message_end": {
        const message = isRecord(value.message) ? value.message : undefined
        const usage = message?.role === "assistant" ? toUsage(message.usage) : undefined
        if (usage) events.publish(event(sessionId, "usage.updated", usage))
        break
      }
      case "compaction_end":
        events.publish(event(sessionId, "checkpoint.created", { kind: "compaction", reason: value.reason, aborted: value.aborted === true }))
        break
    }
  })
}

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null }

function toUsage(value: unknown): Usage | undefined {
  if (!isRecord(value)) return undefined
  const usage = {
    input: numberAt(value, "inputTokens", "input"),
    output: numberAt(value, "outputTokens", "output"),
    cachedInput: numberAt(value, "cacheReadTokens", "cachedInput"),
    reasoning: numberAt(value, "reasoningTokens", "reasoning"),
    cost: numberAt(value, "cost"),
  }
  return Object.values(usage).some((number) => number !== undefined) ? usage : undefined
}

function numberAt(value: Record<string, unknown>, ...keys: string[]): number | undefined {
  const number = keys.map((key) => value[key]).find((candidate): candidate is number => typeof candidate === "number" && Number.isFinite(candidate))
  return number
}

export function renderContext(context: TaskContext): string {
  const memory = [...(context.memory ?? []), ...(context.memoryArtifacts ?? []).map(({ label, content }) => `### ${label}\n${content}`)]
  return [context.system && `# System\n${context.system}`, context.project && `# Project\n${context.project}`, memory.length && `# Memory\n${memory.join("\n")}`, context.skills?.length && `# Skills\n${context.skills.join("\n")}`, "# Task", context.objective, context.constraints.length ? `## Constraints\n${context.constraints.map((value) => `- ${value}`).join("\n")}` : "", context.artifacts.length ? `## Artifacts\n${context.artifacts.map(({ label, content }) => `### ${label}\n${content}`).join("\n")}` : "", context.toolResults?.length && `# Tool results\n${context.toolResults.join("\n")}`].filter(Boolean).join("\n\n")
}

export function memoryArtifacts(records: readonly MemoryRecord[]): TaskArtifact[] {
  return records.map((record) => ({ label: `${record.priority} memory: ${record.state}`, content: `${record.content}\nSource: ${record.provenance.source}\nCaptured at: ${record.provenance.capturedAt}\nConfidence: ${record.confidence}\nLocked: ${record.locked}` }))
}

function recordContext(inspector: ContextInspector, context: TaskContext): void {
  if (context.system) inspector.record("system", context.system)
  if (context.project) inspector.record("project", context.project)
  const memory = [...(context.memory ?? []), ...(context.memoryArtifacts ?? []).map(({ label, content }) => `${label}\n${content}`)]
  if (memory.length) inspector.record("memory", memory.join("\n"))
  if (context.skills?.length) inspector.record("skills", context.skills.join("\n"))
  inspector.record("task", [context.objective, ...context.constraints, ...context.artifacts.map(({ label, content }) => `${label}\n${content}`)].join("\n"))
  if (context.toolResults?.length) inspector.record("toolResults", context.toolResults.join("\n"))
}

export function toolDecision(tool: string, role: AgentRole, options: PiPolicyOptions = {}): "allow" | "confirm" | "deny" {
  // ponytail: MCP tools are governed by the per-agent config allowlist only, not the risk-class ceiling; revisit with interactive confirmations
  if (isMcpToolName(tool)) return "allow"
  const operation = classifyTool(tool)
  if (operation !== "read" && !canWrite(role)) return "deny"
  return decidePolicy(options.autonomy ?? "guided", operation, options.policy)
}

export function selectPiTools(role: AgentRole, options: PiPolicyOptions = {}): string[] {
  return ["read", "grep", "find", "ls", "bash", "edit", "write"].filter((tool) => toolDecision(tool, role, options) === "allow")
}

export function installToolPolicy(pi: ExtensionAPI, role: AgentRole, options: PiPolicyOptions = {}): void {
  pi.on("tool_call", (event) => {
    const decision = toolDecision(event.toolName, role, options)
    return decision === "allow" ? undefined : { block: true, reason: `Tool ${event.toolName} requires ${decision}` }
  })
}

export function installToolProxy(pi: ExtensionAPI, proxy: ToolProxy, options: ToolProxyOptions = {}): void {
  pi.on("tool_result", (event) => {
    let changed = false
    const content = event.content.map((part) => {
      if (part.type !== "text") return part
      const output = proxy.process(part.text, options)
      if (output.injected === part.text) return part
      changed = true
      return { ...part, text: output.injected }
    })
    return changed ? { content } : undefined
  })
}

export function createPiRunner(cwd: string, events: EventBus, sessionId: string, options: PiPolicyOptions = {}): PiRunner {
  const inspector = new ContextInspector()
  const proxy = new ToolProxy(inspector)
  return new PiRunner(async (context) => {
    const role = context.role ?? "builder"
    const resourceLoader = new DefaultResourceLoader({ cwd, agentDir: `${cwd}/.warden/pi`, noExtensions: true, noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true, extensionFactories: [(pi) => {
      installToolPolicy(pi, role, options)
      installToolProxy(pi, proxy, { maxBytes: defaultToolOutputBytes, ...options.toolProxy })
    }] })
    await resourceLoader.reload()
    // ponytail: MCP clients open per task; hoist to session level if startup cost matters
    const { tools: mcpTools, close } = await openMcpTools(new McpRegistry(options.mcp ?? {}).forAgent(role))
    try {
      const configuredModel = context.model
      const modelRuntime = configuredModel ? await ModelRuntime.create() : undefined
      const model = configuredModel && modelRuntime?.getModel(configuredModel.provider, configuredModel.model)
      if (configuredModel && !model) throw new Error(`configured Pi model not found: ${configuredModel.provider}/${configuredModel.model}`)
      const { session } = await createAgentSession({
        cwd,
        sessionManager: SessionManager.inMemory(),
        resourceLoader,
        tools: [...selectPiTools(role, options), ...mcpTools.map((tool) => tool.name)],
        customTools: mcpTools,
        modelRuntime,
        model: model && { ...model, contextWindow: configuredModel?.contextLimit ?? model.contextWindow },
        thinkingLevel: configuredModel?.reasoning
      })
      return {
        prompt: (text) => session.prompt(text),
        getLastAssistantText: () => session.getLastAssistantText(),
        subscribe: (listener) => session.subscribe(listener),
        abort: () => session.abort(),
        dispose: () => { session.dispose(); close() }
      }
    } catch (error) {
      close()
      throw error
    }
  }, events, sessionId, inspector)
}
