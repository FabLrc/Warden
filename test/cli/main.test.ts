import { mkdir, mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it, vi } from "vitest"

const pi = vi.hoisted(() => ({ prompts: [] as string[] }))

vi.mock("@earendil-works/pi-coding-agent", () => ({
  DefaultResourceLoader: class { async reload() {} },
  ModelRuntime: { create: vi.fn() },
  SessionManager: { inMemory: vi.fn() },
  createAgentSession: vi.fn(async () => ({
    session: {
      prompt: async (text: string) => { pi.prompts.push(text) },
      getLastAssistantText: () => "done",
      subscribe: () => () => undefined,
      dispose: () => undefined,
      abort: async () => undefined
    }
  }))
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
    await expect(cli.run(["resume", "s1"], { start: async () => ({ state: "completed" }), resume: async () => ({ state: "completed", result: "continued" }) }, { project })).resolves.toBe("completed: continued")
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

    await expect(cli.run(["run", "fix", "the", "bug"], undefined, { project, home })).resolves.toBe("completed: done")
    expect(pi.prompts[0]).toContain("Never delete production data")

    const [session] = await SessionStore.list(project)
    await expect(SessionStore.open(project, session.state.sessionId).readEvents()).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "memory.recalled", payload: { count: 1, ids: ["m1"] } })
    ]))
  })
})
