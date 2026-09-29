import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { SessionStore } from "../../src/persistence/session-store.js"

describe("SessionStore", () => {
  it("writes state atomically and reloads it", async () => {
    const root = await mkdtemp(join(tmpdir(), "warden-"))
    const store = await SessionStore.create(root, "s1")
    await store.saveState({ sessionId: "s1", tasks: [], updatedAt: 1 })
    await expect(store.loadState()).resolves.toEqual({ sessionId: "s1", tasks: [], updatedAt: 1 })
  })

  it("ignores a truncated final JSONL event during recovery", async () => {
    const root = await mkdtemp(join(tmpdir(), "warden-"))
    const store = await SessionStore.create(root, "s1")
    await writeFile(join(root, ".warden/sessions/s1/events.jsonl"), '{"type":"session.started"}\n{"type":')
    await expect(store.readEvents()).resolves.toEqual([{ type: "session.started" }])
  })

  it("discovers checkpointed sessions and identifies ones that can resume", async () => {
    const root = await mkdtemp(join(tmpdir(), "warden-"))
    const incomplete = await SessionStore.create(root, "incomplete")
    const complete = await SessionStore.create(root, "complete")
    await incomplete.saveState({ sessionId: "incomplete", tasks: [{ id: "t1", objective: "resume", agent: "builder", state: "running" }], updatedAt: 1 })
    await complete.saveState({ sessionId: "complete", tasks: [{ id: "t2", objective: "done", agent: "builder", state: "completed" }], updatedAt: 2 })

    await expect(SessionStore.list(root)).resolves.toEqual([
      { state: { sessionId: "complete", tasks: [{ id: "t2", objective: "done", agent: "builder", state: "completed" }], updatedAt: 2 }, status: "complete" },
      { state: { sessionId: "incomplete", tasks: [{ id: "t1", objective: "resume", agent: "builder", state: "running" }], updatedAt: 1 }, status: "incomplete" }
    ])
    await expect(SessionStore.open(root, "incomplete").read()).resolves.toMatchObject({ status: "incomplete" })
  })

  it("recovers events when the trailing partial record ends with a newline", async () => {
    const root = await mkdtemp(join(tmpdir(), "warden-"))
    const store = await SessionStore.create(root, "s1")
    await writeFile(join(root, ".warden/sessions/s1/events.jsonl"), '{"type":"session.started"}\n{"type":\n')
    await expect(store.readEvents()).resolves.toEqual([{ type: "session.started" }])
  })

  it("rejects invalid state without overwriting it", async () => {
    const root = await mkdtemp(join(tmpdir(), "warden-"))
    const path = join(root, ".warden/sessions/s1/state.json")
    const store = await SessionStore.create(root, "s1")
    await writeFile(path, '{"sessionId":1,"tasks":[]}')
    await expect(store.loadState()).rejects.toThrow("invalid Warden state")
    await expect(readFile(path, "utf8")).resolves.toContain("sessionId")
  })

  it("skips session directories without readable state when listing", async () => {
    const root = await mkdtemp(join(tmpdir(), "warden-"))
    const valid = await SessionStore.create(root, "valid")
    await valid.saveState({ sessionId: "valid", tasks: [], updatedAt: 1 })
    await SessionStore.create(root, "abandoned")
    await mkdir(join(root, ".warden/sessions/corrupt"), { recursive: true })
    await writeFile(join(root, ".warden/sessions/corrupt/state.json"), "{")

    await expect(SessionStore.list(root)).resolves.toMatchObject([{ state: { sessionId: "valid" } }])
  })
})
