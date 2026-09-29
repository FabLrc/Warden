import { stat } from "node:fs/promises"
import { homedir } from "node:os"
import { join } from "node:path"
import { loadConfig } from "../config/config.js"

export interface DoctorCheck {
  name: "node" | "config" | "sessions"
  status: "ok" | "warning" | "error"
  message: string
}

export interface DoctorReport {
  ok: boolean
  checks: DoctorCheck[]
}

export async function doctor(project: string, options: { home?: string; nodeVersion?: string } = {}): Promise<DoctorReport> {
  const home = options.home ?? homedir()
  const nodeVersion = options.nodeVersion ?? process.version
  const checks: DoctorCheck[] = [checkNode(nodeVersion)]
  try {
    await loadConfig(project, home)
    checks.push({ name: "config", status: "ok", message: `configuration valid: ${join(home, ".warden", "config.yaml")}, ${join(project, ".warden", "config.yaml")}` })
  } catch (error) {
    checks.push({ name: "config", status: "error", message: error instanceof Error ? error.message : String(error) })
  }
  const sessions = join(project, ".warden", "sessions")
  try {
    if (!(await stat(sessions)).isDirectory()) throw new Error("not a directory")
    checks.push({ name: "sessions", status: "ok", message: `session path available: ${sessions}` })
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    checks.push({ name: "sessions", status: code === "ENOENT" ? "warning" : "error", message: code === "ENOENT" ? `session path not created yet: ${sessions}` : `invalid session path: ${sessions}` })
  }
  return { ok: checks.every(({ status }) => status !== "error"), checks }
}

function checkNode(version: string): DoctorCheck {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(version)
  const supported = match !== null && (Number(match[1]) > 22 || Number(match[1]) === 22 && (Number(match[2]) > 19 || Number(match[2]) === 19 && Number(match[3]) >= 0))
  return { name: "node", status: supported ? "ok" : "error", message: supported ? `Node ${version} supported` : `Node ${version} unsupported; requires >=22.19.0` }
}
