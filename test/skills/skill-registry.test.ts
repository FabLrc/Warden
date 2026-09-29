import { describe, expect, it, vi } from "vitest"
import { SkillRegistry } from "../../src/skills/skill-registry.js"

describe("SkillRegistry", () => {
  it("lists metadata without loading skills and loads each skill once on demand", async () => {
    const load = vi.fn(async () => ({ run: () => "done" }))
    const registry = new SkillRegistry()
    registry.register({ id: "summarize", name: "Summarize", description: "Creates concise summaries" }, load)

    expect(registry.list()).toEqual([{ id: "summarize", name: "Summarize", description: "Creates concise summaries" }])
    expect(load).not.toHaveBeenCalled()
    await expect(registry.load("summarize")).resolves.toEqual({ run: expect.any(Function) })
    await registry.load("summarize")
    expect(load).toHaveBeenCalledTimes(1)
  })

  it("rejects duplicate and unknown skill ids", async () => {
    const registry = new SkillRegistry()
    registry.register({ id: "summarize", name: "Summarize", description: "Creates concise summaries" }, async () => ({}))

    expect(() => registry.register({ id: "summarize", name: "Again", description: "Duplicate" }, async () => ({}))).toThrow("already registered")
    await expect(registry.load("missing")).rejects.toThrow("unknown skill")
  })

  it("retries a skill load after a failure instead of caching it", async () => {
    let attempts = 0
    const registry = new SkillRegistry()
    registry.register({ id: "flaky", name: "Flaky", description: "Fails once" }, async () => {
      if (++attempts === 1) throw new Error("boom")
      return { ok: true }
    })

    await expect(registry.load("flaky")).rejects.toThrow("boom")
    await expect(registry.load("flaky")).resolves.toEqual({ ok: true })
    expect(attempts).toBe(2)
  })
})
