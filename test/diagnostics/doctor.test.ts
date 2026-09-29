import { mkdir, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { mkdtemp } from "node:fs/promises"
import { describe, expect, it } from "vitest"
import { doctor } from "../../src/diagnostics/doctor.js"

describe("doctor", () => {
  it("checks Node, valid configuration, and an existing session path without providers", async () => {
    const root = await mkdtemp(join(tmpdir(), "warden-doctor-"))
    const project = join(root, "project")
    const home = join(root, "home")
    await mkdir(join(project, ".warden", "sessions"), { recursive: true })

    await expect(doctor(project, { home, nodeVersion: "v22.19.0" })).resolves.toEqual({ ok: true, checks: [
      { name: "node", status: "ok", message: "Node v22.19.0 supported" },
      { name: "config", status: "ok", message: `configuration valid: ${join(home, ".warden/config.yaml")}, ${join(project, ".warden/config.yaml")}` },
      { name: "sessions", status: "ok", message: `session path available: ${join(project, ".warden/sessions")}` }
    ] })
  })

  it("reports unsupported Node, invalid config, and an absent session path", async () => {
    const project = await mkdtemp(join(tmpdir(), "warden-doctor-"))
    await mkdir(join(project, ".warden"))
    await writeFile(join(project, ".warden", "config.yaml"), "{")

    const report = await doctor(project, { home: join(project, "home"), nodeVersion: "v20.0.0" })
    expect(report.ok).toBe(false)
    expect(report.checks.map(({ name, status }) => [name, status])).toEqual([['node', 'error'], ['config', 'error'], ['sessions', 'warning']])
  })
})
