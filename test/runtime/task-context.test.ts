import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it, vi } from "vitest"

vi.mock("@earendil-works/pi-coding-agent", () => ({
  DefaultResourceLoader: class {},
  SessionManager: { inMemory: vi.fn() },
  createAgentSession: vi.fn()
}))

import { EventBus } from "../../src/core/events.js"
import { MemoryStore } from "../../src/memory/memory-store.js"
import { SessionStore } from "../../src/persistence/session-store.js"
import { createContextEnricher } from "../../src/runtime/task-context.js"
import { SkillRegistry } from "../../src/skills/skill-registry.js"

describe("createContextEnricher", () => {
  it("injects recalled memory as artifacts and audits the recall", async () => {
    const root = await mkdtemp(join(tmpdir(), "warden-"))
    const memory = await MemoryStore.create(root)
    await memory.remember({ content: "Never delete production data", priority: "critical", provenance: { source: "operator", capturedAt: 1 }, confidence: 1, state: "active", locked: true })
    const store = await SessionStore.create(root, "s1")
    const events: string[] = []
    const bus = new EventBus()
    bus.subscribe((value) => events.push(value.type))
    const enrich = createContextEnricher({ events: bus, sessionId: "s1", memory, store })

    const context = await enrich({ objective: "fix the bug", constraints: [], artifacts: [] })

    expect(context.memoryArtifacts).toMatchObject([{ label: "critical memory: active", content: expect.stringContaining("Never delete production data") }])
    expect(events).toEqual(["memory.recalled"])
    await expect(store.readEvents()).resolves.toEqual([
      expect.objectContaining({ type: "memory.recalled", payload: { count: 1, ids: [expect.any(String)] } })
    ])
  })

  it("leaves the context untouched when nothing is recalled", async () => {
    const root = await mkdtemp(join(tmpdir(), "warden-"))
    const memory = await MemoryStore.create(root)
    const enrich = createContextEnricher({ events: new EventBus(), sessionId: "s1", memory })
    const context = { objective: "fix the bug", constraints: [], artifacts: [] }

    await expect(enrich(context)).resolves.toEqual(context)
  })

  it("loads detected skills into the context and audits each load", async () => {
    const root = await mkdtemp(join(tmpdir(), "warden-"))
    const skills = new SkillRegistry()
    skills.register({ id: "nestjs", name: "nestjs", description: "NestJS patterns", estimatedContextTokens: 3400 }, async () => "Use dependency injection.")
    const store = await SessionStore.create(root, "s1")
    const enrich = createContextEnricher({ events: new EventBus(), sessionId: "s1", skills, store })

    const context = await enrich({ objective: "add nestjs authentication", constraints: [], artifacts: [], role: "builder" })

    expect(context.skills).toEqual(["### nestjs (+3400 tokens)\nUse dependency injection."])
    await expect(store.readEvents()).resolves.toEqual([
      expect.objectContaining({ type: "skill.loaded", payload: { id: "nestjs", estimatedContextTokens: 3400 } })
    ])
  })
})
