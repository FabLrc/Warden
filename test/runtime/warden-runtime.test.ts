import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { planTasks, routeTask, WardenRuntime } from "../../src/runtime/warden-runtime.js"
import { EventBus } from "../../src/core/events.js"
import { SessionStore } from "../../src/persistence/session-store.js"

describe("WardenRuntime", () => {
  it("runs one Builder task and checkpoints its completed result", async () => {
    const root = await mkdtemp(join(tmpdir(), "warden-"))
    const store = await SessionStore.create(root, "s1")
    const runtime = new WardenRuntime(store, new EventBus(), { run: async () => ({ status: "completed", text: "done" }) }, "s1")
    await expect(runtime.start("rename a variable")).resolves.toMatchObject({ state: "completed", result: "done" })
    await expect(store.loadState()).resolves.toMatchObject({ tasks: [expect.objectContaining({ result: "done" })] })
  })

  it("records task lifecycle events in the session audit log", async () => {
    const root = await mkdtemp(join(tmpdir(), "warden-"))
    const store = await SessionStore.create(root, "s1")
    const runtime = new WardenRuntime(store, new EventBus(), { run: async () => ({ status: "completed", text: "done" }) }, "s1")
    await runtime.start("rename a variable")
    await expect(store.readEvents()).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "task.created" }),
      expect.objectContaining({ type: "task.completed" })
    ]))
  })

  it("notifies subscribers as the task state changes", async () => {
    const root = await mkdtemp(join(tmpdir(), "warden-"))
    const store = await SessionStore.create(root, "s1")
    const states: string[] = []
    const runtime = new WardenRuntime(store, new EventBus(), { run: async () => ({ status: "completed", text: "done" }) }, "s1")
    runtime.subscribe((snapshot) => states.push(snapshot.tasks[0]?.state ?? "empty"))
    await runtime.start("rename a variable")
    expect(states).toContain("running")
    expect(states).toContain("completed")
  })

  it("routes configured categories deterministically and supplies validation constraints", async () => {
    const root = await mkdtemp(join(tmpdir(), "warden-"))
    const store = await SessionStore.create(root, "s1")
    const constraints: Record<string, string[]> = {}
    const models: Record<string, unknown> = {}
    const runtime = new WardenRuntime(store, new EventBus(), { run: async (context) => { constraints[context.role ?? "none"] = context.constraints; models[context.role ?? "none"] = context.model; return { status: "completed", text: "done" } } }, "s1", {
      models: { fast: { provider: "openai", model: "gpt-5-mini", reasoning: "low", contextLimit: 4000 } },
      categories: { debug: { model: "fast", reasoning: "high", contextLimit: 8000, validation: ["npm test"] }, implementation: { model: "fast" } }
    }, [], async (commands) => [{ command: commands[0], code: 0, output: "" }])

    await expect(runtime.start("fix authentication failure")).resolves.toMatchObject({ agent: "builder", category: "debug", validation: "important", validationCommands: ["npm test"] })
    expect(constraints.builder).toEqual(expect.arrayContaining(["You are the only role allowed to modify source files.", "Important task: review the change and run validation.", "Validation: npm test"]))
    expect(models.builder).toEqual({ provider: "openai", model: "gpt-5-mini", reasoning: "high", contextLimit: 8000 })
  })

  it("runs configured validation after Builder completion and records its summary", async () => {
    const root = await mkdtemp(join(tmpdir(), "warden-"))
    const store = await SessionStore.create(root, "s1")
    const validated: string[][] = []
    const runtime = new WardenRuntime(store, new EventBus(), { run: async () => ({ status: "completed", text: "built" }) }, "s1", {
      models: {}, categories: { implementation: { model: "", validation: ["npm test"] } }, autonomy: "guided", policy: {}
    }, [], async (commands) => { validated.push(commands); return [{ command: commands[0], code: 0, output: "passed" }] })

    await expect(runtime.start("implement feature")).resolves.toMatchObject({ state: "completed", result: "built" })
    expect(validated).toEqual([["npm test"]])
    await expect(store.readEvents()).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "validation.completed", payload: { taskId: expect.any(String), results: [{ command: "npm test", code: 0, output: "passed" }] } })
    ]))
  })

  it("fails the task when configured validation fails", async () => {
    const root = await mkdtemp(join(tmpdir(), "warden-"))
    const store = await SessionStore.create(root, "s1")
    const runtime = new WardenRuntime(store, new EventBus(), { run: async () => ({ status: "completed", text: "built" }) }, "s1", {
      models: {}, categories: { implementation: { model: "", validation: ["node -e 'process.exit(1)'"] } }, autonomy: "guided", policy: {}
    })

    await expect(runtime.start("implement feature")).resolves.toMatchObject({ state: "failed", error: expect.stringContaining("Validation failed: node -e 'process.exit(1)'") })
  })

  it("does not execute validation blocked by policy", async () => {
    const root = await mkdtemp(join(tmpdir(), "warden-"))
    const store = await SessionStore.create(root, "s1")
    let ran = false
    const runtime = new WardenRuntime(store, new EventBus(), { run: async () => ({ status: "completed", text: "built" }) }, "s1", {
      models: {}, categories: { implementation: { model: "", validation: ["npm test"] } }, autonomy: "full", policy: { denied: ["dangerous"] }
    }, [], async () => { ran = true; return [] })

    await expect(runtime.start("implement feature")).resolves.toMatchObject({ state: "failed", error: expect.stringContaining("Validation blocked by policy") })
    expect(ran).toBe(false)
  })

  it("keeps read-only work out of the Builder role", () => {
    expect(routeTask("research external documentation")).toMatchObject({ agent: "navigator", validation: "simple" })
    expect(routeTask("inspect the project architecture")).toMatchObject({ agent: "inspector", validation: "important" })
  })

  it("serializes Builder writes", async () => {
    const root = await mkdtemp(join(tmpdir(), "warden-"))
    const store = await SessionStore.create(root, "s1")
    let active = 0
    let maximum = 0
    const runtime = new WardenRuntime(store, new EventBus(), { run: async () => {
      maximum = Math.max(maximum, ++active)
      await new Promise((resolve) => setTimeout(resolve, 5))
      active--
      return { status: "completed", text: "done" }
    } }, "s1")

    await Promise.all([runtime.start("rename x"), runtime.start("fix y")])
    expect(maximum).toBe(1)
  })

  it("resumes an interrupted task from its checkpoint without a Pi transcript", async () => {
    const root = await mkdtemp(join(tmpdir(), "warden-"))
    const store = await SessionStore.create(root, "s1")
    await store.saveState({ sessionId: "s1", tasks: [{ id: "t1", objective: "fix the bug", agent: "builder", category: "debug", validation: "important", validationCommands: [], dependencies: [], state: "running" }], updatedAt: 1 })
    let constraints: string[] = []
    const runtime = new WardenRuntime(store, new EventBus(), { run: async (context) => { constraints = context.constraints; return { status: "completed", text: "done" } } }, "s1", undefined, (await store.loadState()).tasks)

    await expect(runtime.resume()).resolves.toMatchObject({ id: "t1", state: "completed", result: "done" })
    expect(constraints).toContain("This task was interrupted. Inspect the current workspace before continuing; no prior Pi transcript is available.")
    await expect(store.loadState()).resolves.toMatchObject({ tasks: [expect.objectContaining({ id: "t1", state: "completed" })] })
  })

  it("plans a single step for simple and read-only work", () => {
    expect(planTasks("rename a variable")).toHaveLength(1)
    expect(planTasks("research external documentation")).toMatchObject([{ agent: "navigator", validation: "simple" }])
    expect(planTasks("rename a variable")).toMatchObject([{ agent: "builder", validation: "simple" }])
  })

  it("plans inspect → build → review for important Builder work", async () => {
    const root = await mkdtemp(join(tmpdir(), "warden-"))
    const store = await SessionStore.create(root, "s1")
    const runtime = new WardenRuntime(store, new EventBus(), { run: async () => ({ status: "completed", text: "done" }) }, "s1")

    await expect(runtime.start("implement authentication feature")).resolves.toMatchObject({ agent: "builder", state: "completed" })
    const { tasks } = runtime.snapshot()
    expect(tasks.map((task) => task.agent)).toEqual(["inspector", "builder", "reviewer"])
    expect(tasks[1].dependencies).toEqual([tasks[0].id])
    expect(tasks[2].dependencies).toEqual([tasks[1].id])
    expect(tasks.every((task) => task.state === "completed")).toBe(true)
    await expect(store.readEvents()).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "task.created" }),
      expect.objectContaining({ type: "task.completed" })
    ]))
  })

  it("passes completed dependency results as isolated artifacts", async () => {
    const root = await mkdtemp(join(tmpdir(), "warden-"))
    const store = await SessionStore.create(root, "s1")
    const artifacts: Record<string, unknown[]> = {}
    const runtime = new WardenRuntime(store, new EventBus(), {
      run: async (context) => {
        artifacts[context.role ?? "none"] = context.artifacts
        return { status: "completed", text: `${context.role} output` }
      }
    }, "s1")

    await runtime.start("implement authentication feature")
    expect(artifacts.inspector).toEqual([])
    expect(artifacts.builder).toEqual([{ label: expect.stringContaining("inspector"), content: "inspector output" }])
    expect(artifacts.reviewer).toEqual([{ label: expect.stringContaining("builder"), content: "builder output" }])
  })

  it("blocks downstream tasks when a dependency fails", async () => {
    const root = await mkdtemp(join(tmpdir(), "warden-"))
    const store = await SessionStore.create(root, "s1")
    let calls = 0
    const runtime = new WardenRuntime(store, new EventBus(), { run: async () => (++calls === 1 ? { status: "failed", text: "inspect exploded" } : { status: "completed", text: "done" }) }, "s1")

    await expect(runtime.start("implement authentication feature")).resolves.toMatchObject({ agent: "inspector", state: "failed", error: "inspect exploded" })
    const { tasks } = runtime.snapshot()
    expect(tasks.map((task) => task.state)).toEqual(["failed", "blocked", "blocked"])
    await expect(store.readEvents()).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "task.failed", payload: { task: expect.objectContaining({ state: "blocked" }) } })
    ]))
  })

  it("records session.started once per runtime", async () => {
    const root = await mkdtemp(join(tmpdir(), "warden-"))
    const store = await SessionStore.create(root, "s1")
    const runtime = new WardenRuntime(store, new EventBus(), { run: async () => ({ status: "completed", text: "done" }) }, "s1")
    await runtime.start("rename x")
    await runtime.start("fix y")
    const events = await store.readEvents() as Array<{ type: string }>
    expect(events.filter(({ type }) => type === "session.started")).toHaveLength(1)
  })
})
