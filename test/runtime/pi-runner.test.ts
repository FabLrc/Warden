import { describe, expect, it, vi } from "vitest"

vi.mock("@earendil-works/pi-coding-agent", () => ({
  DefaultResourceLoader: class {},
  SessionManager: { inMemory: vi.fn() },
  createAgentSession: vi.fn()
}))

import { installToolPolicy, installToolProxy, memoryArtifacts, PiRunner, renderContext, selectPiTools, toolDecision, type PiSessionFactory } from "../../src/runtime/pi-runner.js"
import { EventBus } from "../../src/core/events.js"
import { ToolProxy } from "../../src/tools/tool-proxy.js"

describe("PiRunner", () => {
  it("creates and disposes a fresh session for each task", async () => {
    const prompts: string[] = []
    let disposed = 0
    const factory: PiSessionFactory = async () => ({
      prompt: async (text) => { prompts.push(text) },
      getLastAssistantText: () => "done",
      subscribe: () => () => {},
      dispose: () => { disposed++ },
      abort: async () => {}
    })
    const runner = new PiRunner(factory, new EventBus(), "s1")
    await expect(runner.run({ objective: "rename x", constraints: [], artifacts: [] })).resolves.toMatchObject({ status: "completed", text: "done" })
    expect(prompts[0]).toContain("rename x")
    expect(disposed).toBe(1)
  })

  it("accounts for explicit context sources", async () => {
    const factory: PiSessionFactory = async () => ({ prompt: async () => {}, getLastAssistantText: () => "done", subscribe: () => () => {}, dispose: () => {}, abort: async () => {} })
    const runner = new PiRunner(factory, new EventBus(), "s1")
    await runner.run({ objective: "fix", constraints: [], artifacts: [], system: "rules", project: "local", memory: ["remember"], skills: ["test"], toolResults: ["output"] })

    expect(runner.contextSnapshot()).toMatchObject({ sources: { system: { injectedBytes: 5 }, project: { injectedBytes: 5 }, memory: { injectedBytes: 8 }, skills: { injectedBytes: 4 }, task: { injectedBytes: 3 }, toolResults: { injectedBytes: 6 } }, total: { injectedBytes: 31 } })
  })

  it("renders memory artifacts with their provenance", () => {
    const prompt = renderContext({ objective: "fix", constraints: [], artifacts: [], memoryArtifacts: memoryArtifacts([{ id: "m1", content: "Do not delete data", priority: "critical", provenance: { source: "operator", capturedAt: 1 }, confidence: 1, state: "active", locked: true }]) })

    expect(prompt).toContain("# Memory")
    expect(prompt).toContain("Source: operator")
    expect(prompt).toContain("Locked: true")
  })

  it("passes task model configuration to the session factory", async () => {
    let context: unknown
    const factory: PiSessionFactory = async (value) => {
      context = value
      return { prompt: async () => {}, getLastAssistantText: () => "done", subscribe: () => () => {}, dispose: () => {}, abort: async () => {} }
    }
    const runner = new PiRunner(factory, new EventBus(), "s1")
    await runner.run({ objective: "fix", constraints: [], artifacts: [], model: { provider: "openai", model: "gpt-5", reasoning: "high", contextLimit: 8000 } })

    expect(context).toMatchObject({ model: { provider: "openai", model: "gpt-5", reasoning: "high", contextLimit: 8000 } })
  })

  it("publishes redacted Pi session observability events", async () => {
    let listener: ((value: unknown) => void) | undefined
    const received: Array<{ type: string; payload: unknown }> = []
    const events = new EventBus()
    events.subscribe((value) => received.push({ type: value.type, payload: value.payload }))
    const factory: PiSessionFactory = async () => ({
      prompt: async () => {
        listener?.({ type: "agent_start" })
        listener?.({ type: "tool_execution_start", toolName: "bash", args: { command: "cat .env" } })
        listener?.({ type: "tool_execution_end", toolName: "bash", result: "secret=value", isError: false })
        listener?.({ type: "message_end", message: { role: "assistant", content: "private response", usage: { inputTokens: 10, outputTokens: 5, cost: 0.01 } } })
        listener?.({ type: "compaction_end", reason: "threshold", result: { summary: "private summary" }, aborted: false })
        listener?.({ type: "agent_end", messages: [{ content: "private response" }] })
      },
      getLastAssistantText: () => "done",
      subscribe: (value) => { listener = value; return () => { listener = undefined } },
      dispose: () => {},
      abort: async () => {}
    })
    const runner = new PiRunner(factory, events, "s1")

    await runner.run({ objective: "fix", constraints: [], artifacts: [], model: { provider: "openai", model: "gpt-5" } })

    expect(received).toEqual([
      { type: "model.selected", payload: { provider: "openai", model: "gpt-5", source: "configured" } },
      { type: "agent.started", payload: {} },
      { type: "tool.started", payload: { tool: "bash" } },
      { type: "tool.completed", payload: { tool: "bash", success: true } },
      { type: "usage.updated", payload: { input: 10, output: 5, cachedInput: undefined, reasoning: undefined, cost: 0.01 } },
      { type: "checkpoint.created", payload: { kind: "compaction", reason: "threshold", aborted: false } },
      { type: "agent.completed", payload: {} }
    ])
    expect(JSON.stringify(received)).not.toContain("secret=value")
    expect(JSON.stringify(received)).not.toContain("private response")
    expect(JSON.stringify(received)).not.toContain("private summary")
  })

  it("selects only tools allowed by autonomy and role", () => {
    expect(selectPiTools("inspector", { autonomy: "full", policy: { allowed: ["safe_write"] } })).toEqual(["read", "grep", "find", "ls"])
    expect(selectPiTools("builder", { autonomy: "ask", policy: { allowed: ["safe_write"] } })).toEqual([])
  })

  it("rechecks policy at interception time", () => {
    expect(toolDecision("write", "inspector", { autonomy: "full", policy: { allowed: ["safe_write"] } })).toBe("deny")
    expect(toolDecision("write", "builder", { autonomy: "ask", policy: { allowed: ["safe_write"] } })).toBe("deny")
    expect(toolDecision("fetch", "builder", { autonomy: "auto", policy: { allowed: ["external_side_effect"] } })).toBe("deny")
  })

  it("blocks forbidden tool calls after selection", () => {
    let handler: ((event: { toolName: string }) => unknown) | undefined
    installToolPolicy({ on: (_event: string, value: (event: { toolName: string }) => unknown) => { handler = value } } as never, "builder", { autonomy: "auto", policy: { allowed: ["external_side_effect"] } })
    expect(handler?.({ toolName: "fetch" })).toMatchObject({ block: true })
  })

  it("truncates oversized tool results before reinjection and leaves small results untouched", () => {
    let handler: ((event: { content: Array<{ type: string; text?: string; source?: string }> }) => unknown) | undefined
    installToolProxy({ on: (_event: string, value: NonNullable<typeof handler>) => { handler = value } } as never, new ToolProxy(), { maxBytes: 50 })

    const result = handler?.({ content: [{ type: "text", text: `head\n${"x".repeat(200)}\ntail` }, { type: "image", source: "binary" }] }) as { content: Array<{ type: string; text?: string; source?: string }> }
    expect(result.content[0].text).toContain("head")
    expect(result.content[0].text).toContain("tail")
    expect(result.content[0].text?.length ?? 0).toBeLessThan(210)
    expect(result.content[1]).toEqual({ type: "image", source: "binary" })
    expect(handler?.({ content: [{ type: "text", text: "small" }] })).toBeUndefined()
  })
})
