import { mkdir, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { mkdtemp } from "node:fs/promises"
import { describe, expect, it } from "vitest"
import { loadConfig, parseConfig } from "../../src/config/config.js"

describe("configuration", () => {
  it("validates model and category configuration", () => {
    expect(parseConfig({ version: 1, models: { fast: { provider: "openai", model: "gpt-5" } }, categories: { fix: { model: "fast", reasoning: "low", contextLimit: 8000, validation: ["npm test"] } } })).toMatchObject({ categories: { fix: { model: "fast" } } })
    expect(() => parseConfig({ version: 1, categories: { fix: { model: "missing" } } })).toThrow("unknown model")
  })

  it("merges global and project config, with project values taking precedence", async () => {
    const root = await mkdtemp(join(tmpdir(), "warden-config-"))
    const home = join(root, "home")
    const project = join(root, "project")
    await mkdir(join(home, ".warden"), { recursive: true })
    await mkdir(join(project, ".warden"), { recursive: true })
    await writeFile(join(home, ".warden", "config.yaml"), "version: 1\nautonomy: guided\nmodels:\n  fast:\n    provider: openai\n    model: gpt-5-mini\ncategories:\n  fix:\n    model: fast\n    validation: [npm test]\nmcp:\n  github:\n    command: npx\n    args: [github-mcp]\n    agents:\n      warden:\n        allowedTools: [search]\n")
    await writeFile(join(project, ".warden", "config.yaml"), "version: 1\nautonomy: auto\nmodels:\n  fast:\n    model: gpt-5\ncategories:\n  fix:\n    reasoning: high\nmcp:\n  github:\n    agents:\n      warden:\n        allowedTools: [repository.read]\n      builder: {}\n")

    await expect(loadConfig(project, home)).resolves.toMatchObject({ autonomy: "auto", models: { fast: { provider: "openai", model: "gpt-5" } }, categories: { fix: { model: "fast", reasoning: "high", validation: ["npm test"] } }, mcp: { github: { command: "npx", args: ["github-mcp"], agents: { warden: { allowedTools: ["repository.read"] }, builder: {} } } } })
  })

  it("rejects invalid configuration files", async () => {
    const project = await mkdtemp(join(tmpdir(), "warden-config-"))
    await mkdir(join(project, ".warden"))
    await writeFile(join(project, ".warden", "config.yaml"), "{")
    await expect(loadConfig(project, join(project, "no-home"))).rejects.toThrow("invalid Warden config")
  })
})
