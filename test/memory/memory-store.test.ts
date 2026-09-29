import { mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { MemoryStore } from "../../src/memory/memory-store.js"

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
