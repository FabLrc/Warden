import { mkdir, mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it, vi } from "vitest"
import { detectSkills, SkillRegistry } from "../../src/skills/skill-registry.js"

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

  it("registers skill directories from manifests and loads content on demand", async () => {
    const root = await mkdtemp(join(tmpdir(), "warden-"))
    const directory = join(root, "skills")
    await mkdir(join(directory, "nestjs"), { recursive: true })
    await writeFile(join(directory, "nestjs/manifest.yaml"), "name: nestjs\ndescription: Patterns and practices for NestJS applications\nestimatedContextTokens: 3400\ncompatibleAgents:\n  - builder\n")
    await writeFile(join(directory, "nestjs/SKILL.md"), "# NestJS\nUse dependency injection.")
    const registry = new SkillRegistry()

    await registry.loadFrom(directory)

    expect(registry.list()).toEqual([{ id: "nestjs", name: "nestjs", description: "Patterns and practices for NestJS applications", estimatedContextTokens: 3400, compatibleAgents: ["builder"] }])
    await expect(registry.load("nestjs")).resolves.toBe("# NestJS\nUse dependency injection.")
  })

  it("treats a missing skills directory as no skills", async () => {
    const root = await mkdtemp(join(tmpdir(), "warden-"))
    const registry = new SkillRegistry()

    await registry.loadFrom(join(root, "missing"))
    expect(registry.list()).toEqual([])
  })

  it("rejects invalid skill manifests", async () => {
    const root = await mkdtemp(join(tmpdir(), "warden-"))
    const directory = join(root, "skills")
    await mkdir(join(directory, "bad"), { recursive: true })
    await writeFile(join(directory, "bad/manifest.yaml"), "name: ''\ndescription: no name")
    const registry = new SkillRegistry()

    await expect(registry.loadFrom(directory)).rejects.toThrow("invalid Warden skill")
  })

  it("rejects a skill directory without content", async () => {
    const root = await mkdtemp(join(tmpdir(), "warden-"))
    const directory = join(root, "skills")
    await mkdir(join(directory, "orphan"), { recursive: true })
    await writeFile(join(directory, "orphan/manifest.yaml"), "name: orphan\ndescription: no body")
    const registry = new SkillRegistry()

    await expect(registry.loadFrom(directory)).rejects.toThrow("missing SKILL.md")
  })
})

describe("detectSkills", () => {
  const skills = [
    { id: "nestjs", name: "nestjs", description: "Patterns and practices for NestJS applications" },
    { id: "review", name: "review", description: "Review checklist", compatibleAgents: ["reviewer"] }
  ]

  it("detects skills by objective keywords and agent compatibility", () => {
    expect(detectSkills(skills, "add nestjs authentication", "builder").map(({ id }) => id)).toEqual(["nestjs"])
    expect(detectSkills(skills, "review this change", "builder")).toEqual([])
    expect(detectSkills(skills, "review this change", "reviewer").map(({ id }) => id)).toEqual(["review"])
    expect(detectSkills(skills, "summarize the project").map(({ id }) => id)).toEqual([])
  })
})
