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
})
