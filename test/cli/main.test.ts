import { mkdir, mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it, vi } from "vitest"

const pi = vi.hoisted(() => ({ prompts: [] as string[], sessions: [] as Array<Record<string, unknown>> }))

vi.mock("@earendil-works/pi-coding-agent", () => ({
  DefaultResourceLoader: class { async reload() {} },
  ModelRuntime: { create: vi.fn(async () => ({ getModel: (provider: string, model: string) => ({ id: model, provider, contextWindow: 8000 }) })) },
  SessionManager: { inMemory: vi.fn() },
  createAgentSession: vi.fn(async (options: Record<string, unknown>) => {
    pi.sessions.push(options)
    return {
      session: {
        prompt: async (text: string) => { pi.prompts.push(text) },
        getLastAssistantText: () => "done",
        subscribe: () => () => undefined,
        dispose: () => undefined,
        abort: async () => undefined
      }
    }
  })
}))

import * as cli from "../../src/cli/main.js"
import { SessionStore } from "../../src/persistence/session-store.js"

describe("run", () => {
  it("prints usage when invoked without a request", async () => {
    await expect((cli as { run: (argv: string[]) => Promise<string> }).run([])).resolves.toContain("Usage: warden")
  })

  it("runs credential-free diagnostics", async () => {
    await expect(cli.run(["doctor"])).resolves.toContain("node:")
  })

  it("summarizes effective configuration without exposing MCP environment values", async () => {
    const root = await mkdtemp(join(tmpdir(), "warden-cli-"))
    const home = join(root, "home")
    const project = join(root, "project")
    await mkdir(join(project, ".warden"), { recursive: true })
    await writeFile(join(project, ".warden", "config.yaml"), JSON.stringify({
      version: 1,
      autonomy: "auto",
      models: { fast: { provider: "openai", model: "gpt-5-mini" } },
      categories: { fix: { model: "fast" } },
      policy: { allowed: ["read"], denied: ["write"] },
      mcp: { github: { command: "npx", env: { TOKEN: "secret" } } }
    }))

    await expect(cli.run(["config"], undefined, { project, home })).resolves.toBe([
      "version: 1",
      "autonomy: auto",
      "models: fast (openai/gpt-5-mini)",
      "categories: fix (fast)",
      "policy: 1 allowed, 1 denied",
      "mcp: github (enabled)"
    ].join("\n"))
  })

  it("lists saved sessions and their resumability", async () => {
    const project = await mkdtemp(join(tmpdir(), "warden-cli-"))
    const complete = await SessionStore.create(project, "complete")
    const incomplete = await SessionStore.create(project, "incomplete")
    await complete.saveState({ sessionId: "complete", tasks: [], updatedAt: 1 })
    await incomplete.saveState({ sessionId: "incomplete", tasks: [{ id: "t1", objective: "resume", agent: "builder", state: "running" }], updatedAt: 2 })

    await expect(cli.run(["sessions"], undefined, { project })).resolves.toBe("complete: complete, 0 tasks, updated 1\nincomplete: incomplete, 1 task, updated 2")
    await expect(cli.run(["sessions"], undefined, { project: join(project, "empty") })).resolves.toBe("No sessions.")
  })

  it("runs a request through the injected runtime", async () => {
    const output = await cli.run(["run", "rename", "x"], {
      start: async () => ({ state: "completed", result: "done" })
    })
    expect(output).toContain("completed")
    expect(output).toContain("done")
  })

  it("resumes a checkpointed session through the injected runtime", async () => {
    const project = await mkdtemp(join(tmpdir(), "warden-cli-"))
    const store = await SessionStore.create(project, "s1")
    await store.saveState({ sessionId: "s1", tasks: [{ id: "t1", objective: "resume", agent: "builder", state: "running" }], updatedAt: 1 })
    await expect(cli.run(["resume", "s1"], { start: async () => ({ state: "completed" }), resume: async () => ({ state: "completed", result: "continued" }) }, { project })).resolves.toContain("completed: continued")
  })

  it("recalls project memory into the agent prompt and audits the recall", async () => {
    const root = await mkdtemp(join(tmpdir(), "warden-cli-"))
    const home = join(root, "home")
    const project = join(root, "project")
    await mkdir(join(project, ".warden"), { recursive: true })
    await writeFile(join(project, ".warden/memory.json"), JSON.stringify([
      { id: "m1", content: "Never delete production data", priority: "critical", provenance: { source: "operator", capturedAt: 1 }, confidence: 1, state: "active", locked: true }
    ]))
    pi.prompts.length = 0

    await expect(cli.run(["run", "fix", "the", "bug"], undefined, { project, home })).resolves.toContain("completed: done")
    expect(pi.prompts[0]).toContain("Never delete production data")

    const [session] = await SessionStore.list(project)
    await expect(SessionStore.open(project, session.state.sessionId).readEvents()).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "memory.recalled", payload: { count: 1, ids: ["m1"] } })
    ]))
  })

  it("loads detected project skills into the agent prompt and audits the load", async () => {
    const root = await mkdtemp(join(tmpdir(), "warden-cli-"))
    const home = join(root, "home")
    const project = join(root, "project")
    await mkdir(join(project, ".warden/skills/nestjs"), { recursive: true })
    await writeFile(join(project, ".warden/skills/nestjs/manifest.yaml"), "name: nestjs\ndescription: Patterns and practices for NestJS applications\nestimatedContextTokens: 3400\n")
    await writeFile(join(project, ".warden/skills/nestjs/SKILL.md"), "Use dependency injection.")
    pi.prompts.length = 0

    await expect(cli.run(["run", "add", "nestjs", "authentication"], undefined, { project, home })).resolves.toContain("completed: done")
    expect(pi.prompts[0]).toContain("nestjs (+3400 tokens)")
    expect(pi.prompts[0]).toContain("Use dependency injection.")

    const [session] = await SessionStore.list(project)
    await expect(SessionStore.open(project, session.state.sessionId).readEvents()).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "skill.loaded", payload: { id: "nestjs", estimatedContextTokens: 3400 } })
    ]))
  })

  it("exposes configured MCP tools to the agent session", async () => {
    const root = await mkdtemp(join(tmpdir(), "warden-cli-"))
    const home = join(root, "home")
    const project = join(root, "project")
    await mkdir(join(project, ".warden"), { recursive: true })
    await writeFile(join(project, ".warden/config.yaml"), JSON.stringify({
      version: 1,
      mcp: { demo: { command: process.execPath, args: [fileURLToPath(new URL("../mcp/fixtures/fake-mcp-server.mjs", import.meta.url))], agents: { builder: {} } } }
    }))
    pi.sessions.length = 0

    await expect(cli.run(["run", "fix", "the", "bug"], undefined, { project, home })).resolves.toContain("completed: done")

    const options = pi.sessions[0]
    expect(options.tools).toContain("mcp__demo__echo")
    expect((options.customTools as Array<{ name: string }>).map(({ name }) => name)).toEqual(["mcp__demo__echo", "mcp__demo__danger"])
  })

  it("shows live OpenRouter quota and audits the usage.limits event", async () => {
    const root = await mkdtemp(join(tmpdir(), "warden-cli-"))
    const home = join(root, "home")
    const project = join(root, "project")
    await mkdir(join(project, ".warden"), { recursive: true })
    await writeFile(join(project, ".warden", "config.yaml"), JSON.stringify({
      version: 1,
      models: { router: { provider: "openrouter", model: "anthropic/claude-haiku-4.5" } },
      categories: { implementation: { model: "router" } }
    }))
    vi.stubEnv("OPENROUTER_API_KEY", "test-key")
    const fetchImpl = async (url: string | URL | Request) => {
      const target = String(url)
      if (target.includes("models.dev")) return { ok: true, status: 200, json: async () => ({}) } as Response
      if (target.endsWith("/key")) return { ok: true, status: 200, json: async () => ({ data: { usage: 25, limit: 100 } }) } as Response
      return { ok: true, status: 200, json: async () => ({ total_credits: 120, total_usage: 45.5 }) } as Response
    }

    try {
      const output = await cli.run(["run", "fix", "the", "bug"], undefined, { project, home, fetchImpl })
      expect(output).toContain("quota: openrouter 25% of plan, $74.50 remaining")

      const [session] = await SessionStore.list(project)
      await expect(SessionStore.open(project, session.state.sessionId).readEvents()).resolves.toEqual(expect.arrayContaining([
        expect.objectContaining({ type: "usage.limits", payload: expect.objectContaining({ provider: "openrouter", planPercentUsed: 25, creditsRemaining: 74.5 }) })
      ]))
    } finally {
      vi.unstubAllEnvs()
    }
  })
})
