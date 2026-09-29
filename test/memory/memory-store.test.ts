import { mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { MemoryStore, recallMemory, type MemoryRecord } from "../../src/memory/memory-store.js"

describe("MemoryStore", () => {
  it("persists critical and lazy records with their provenance", async () => {
    const root = await mkdtemp(join(tmpdir(), "warden-"))
    const store = await MemoryStore.create(root)

    await store.remember({ content: "Never delete production data", priority: "critical", provenance: { source: "operator", capturedAt: 1 }, confidence: 1, state: "active", locked: true })
    await store.remember({ content: "Prefer concise summaries", priority: "lazy", provenance: { source: "session:s1", capturedAt: 2 }, confidence: 0.8, state: "candidate", locked: false })

    const restored = await MemoryStore.create(root)
    await expect(restored.list()).resolves.toMatchObject([
      { content: "Never delete production data", priority: "critical", provenance: { source: "operator", capturedAt: 1 }, confidence: 1, state: "active", locked: true },
      { content: "Prefer concise summaries", priority: "lazy", provenance: { source: "session:s1", capturedAt: 2 }, confidence: 0.8, state: "candidate", locked: false }
    ])
    await expect(restored.list("critical")).resolves.toHaveLength(1)
  })

  it("returns a bounded critical memory slice", async () => {
    const root = await mkdtemp(join(tmpdir(), "warden-"))
    const store = await MemoryStore.create(root)
    for (const content of ["first", "second"]) await store.remember({ content, priority: "critical", provenance: { source: "operator", capturedAt: 1 }, confidence: 1, state: "active", locked: true })

    await expect(store.listCritical(1)).resolves.toMatchObject([{ content: "first" }])
    await expect(store.listCritical(-1)).rejects.toThrow("critical memory limit")
  })

  it("rejects malformed stored memory", async () => {
    const root = await mkdtemp(join(tmpdir(), "warden-"))
    const store = await MemoryStore.create(root)
    await writeFile(join(root, ".warden/memory.json"), '[{"content": 1}]')

    await expect(store.list()).rejects.toThrow("invalid Warden memory")
  })
})

function record(overrides: Partial<MemoryRecord>): MemoryRecord {
  return {
    id: "id",
    content: "",
    priority: "lazy",
    provenance: { source: "test", capturedAt: 1 },
    confidence: 1,
    state: "active",
    locked: false,
    ...overrides
  }
}

describe("recallMemory", () => {
  it("always recalls active critical memory and keyword-matched lazy memory", () => {
    const records = [
      record({ id: "c1", content: "Never delete production data", priority: "critical" }),
      record({ id: "l1", content: "Tests use vitest with tmpdir fixtures", priority: "lazy" }),
      record({ id: "l2", content: "Prefer concise summaries", priority: "lazy" })
    ]

    expect(recallMemory(records, "fix the vitest failure").map(({ id }) => id)).toEqual(["c1", "l1"])
  })

  it("skips superseded, deprecated and archived records", () => {
    const records = [
      record({ id: "c1", content: "old rule", priority: "critical", state: "superseded" }),
      record({ id: "l1", content: "jest is the test runner", priority: "lazy", state: "deprecated" }),
      record({ id: "l2", content: "vitest failure again", priority: "lazy", state: "active" })
    ]

    expect(recallMemory(records, "fix the vitest failure").map(({ id }) => id)).toEqual(["l2"])
  })

  it("bounds critical and lazy recall", () => {
    const critical = Array.from({ length: 3 }, (_, index) => record({ id: `c${index}`, content: `rule ${index}`, priority: "critical" }))
    const lazy = Array.from({ length: 4 }, (_, index) => record({ id: `l${index}`, content: `shared keyword here ${index}`, priority: "lazy" }))

    expect(recallMemory([...critical, ...lazy], "shared keyword", { criticalLimit: 2, lazyLimit: 2 }).map(({ id }) => id)).toEqual(["c0", "c1", "l0", "l1"])
  })
})
