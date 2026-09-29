import { readFile, stat } from "node:fs/promises"
import { homedir } from "node:os"
import { join } from "node:path"
import { loadConfig } from "../config/config.js"
import { priceCachePath, priceCacheTtlMs } from "../models/pricing.js"

export interface DoctorCheck {
  name: "node" | "config" | "sessions" | "prices" | "quota"
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
  let config: Awaited<ReturnType<typeof loadConfig>> | undefined
  try {
    config = await loadConfig(project, home)
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
  checks.push(await checkPrices(home))
  if (config) checks.push(checkQuota(config))
  return { ok: checks.every(({ status }) => status !== "error"), checks }
}

async function checkPrices(home: string): Promise<DoctorCheck> {
  try {
    const cache = JSON.parse(await readFile(priceCachePath(home), "utf8")) as { fetchedAt?: unknown }
    if (typeof cache.fetchedAt !== "number") throw new Error("invalid cache")
    const ageMs = Date.now() - cache.fetchedAt
    const age = ageMs < 3_600_000 ? `${Math.round(ageMs / 60_000)}m` : `${Math.round(ageMs / 3_600_000)}h`
    return { name: "prices", status: ageMs < priceCacheTtlMs ? "ok" : "warning", message: `model price cache ${age} old: ${priceCachePath(home)}` }
  } catch {
    return { name: "prices", status: "warning", message: "no model price cache; estimated costs unavailable until the next online run" }
  }
}

function checkQuota(config: Awaited<ReturnType<typeof loadConfig>>): DoctorCheck {
  const openrouter = Object.values(config.models).some(({ provider }) => provider === "openrouter")
  if (!openrouter) return { name: "quota", status: "ok", message: "no openrouter models configured" }
  return process.env.OPENROUTER_API_KEY
    ? { name: "quota", status: "ok", message: "OPENROUTER_API_KEY configured; live quota shown at the end of runs" }
    : { name: "quota", status: "warning", message: "openrouter models configured but OPENROUTER_API_KEY is missing" }
}

function checkNode(version: string): DoctorCheck {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(version)
  const supported = match !== null && (Number(match[1]) > 22 || Number(match[1]) === 22 && (Number(match[2]) > 19 || Number(match[2]) === 19 && Number(match[3]) >= 0))
  return { name: "node", status: supported ? "ok" : "error", message: supported ? `Node ${version} supported` : `Node ${version} unsupported; requires >=22.19.0` }
}
