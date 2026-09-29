import { randomUUID } from "node:crypto"
import { homedir } from "node:os"
import { loadConfig, type WardenConfig } from "../config/config.js"
import { EventBus } from "../core/events.js"
import { doctor } from "../diagnostics/doctor.js"
import { SessionStore, type SessionDescriptor } from "../persistence/session-store.js"
import { createPiRunner } from "../runtime/pi-runner.js"
import { WardenRuntime } from "../runtime/warden-runtime.js"

interface RuntimeLike {
  start(objective: string): Promise<{ state: string; result?: string; error?: string }>
  resume?(): Promise<{ state: string; result?: string; error?: string }>
}
interface RunOptions { project?: string; home?: string }

export async function run(argv: string[], runtime?: RuntimeLike, options: RunOptions = {}): Promise<string> {
  const project = options.project ?? process.cwd()
  const home = options.home ?? homedir()
  if (argv.length === 0) {
    return usage()
  }
  if (argv[0] === "doctor" && argv.length === 1) return formatDoctor(await doctor(project, { home }))
  if (argv[0] === "config" && argv.length === 1) return formatConfig(await loadConfig(project, home))
  if (argv[0] === "sessions" && argv.length === 1) return formatSessions(await SessionStore.list(project))
  if (argv[0] === "resume" && argv.length === 2) {
    const sessionId = argv[1]
    const store = SessionStore.open(project, sessionId)
    const state = await store.loadState()
    if (state.sessionId !== sessionId) throw new Error(`invalid Warden state: session ID does not match ${sessionId}`)
    if (!runtime) {
      const events = new EventBus()
      runtime = new WardenRuntime(store, events, createPiRunner(project, events, sessionId), sessionId, await loadConfig(project, home), state.tasks)
    }
    if (!runtime.resume) throw new Error("runtime does not support resume")
    return formatTask(await runtime.resume())
  }
  if (argv[0] !== "run" || argv.length === 1) return usage()
  const request = argv.slice(1).join(" ")
  if (!runtime) {
    const sessionId = randomUUID()
    const events = new EventBus()
    const store = await SessionStore.create(project, sessionId)
    const config = await loadConfig(project, home)
    runtime = new WardenRuntime(store, events, createPiRunner(project, events, sessionId, config), sessionId, config)
  }
  const task = await runtime.start(request)
  return formatTask(task)
}

function usage(): string { return "Usage: warden run <request> | resume <session-id> | doctor | config | sessions" }
function formatTask(task: { state: string; result?: string; error?: string }): string { return `${task.state}${task.result ? `: ${task.result}` : task.error ? `: ${task.error}` : ""}` }

function formatDoctor(report: Awaited<ReturnType<typeof doctor>>): string {
  return report.checks.map(({ status, name, message }) => `${status}: ${name}: ${message}`).join("\n")
}

function formatConfig(config: WardenConfig): string {
  const models = Object.entries(config.models).map(([name, model]) => `${name} (${model.provider}/${model.model})`).join(", ") || "none"
  const categories = Object.entries(config.categories).map(([name, category]) => `${name} (${category.model})`).join(", ") || "none"
  const mcp = Object.entries(config.mcp).map(([name, server]) => `${name} (${server.enabled === false ? "disabled" : "enabled"})`).join(", ") || "none"
  return [
    `version: ${config.version}`,
    `autonomy: ${config.autonomy}`,
    `models: ${models}`,
    `categories: ${categories}`,
    `policy: ${config.policy.allowed?.length ?? 0} allowed, ${config.policy.denied?.length ?? 0} denied`,
    `mcp: ${mcp}`
  ].join("\n")
}

function formatSessions(sessions: SessionDescriptor[]): string {
  if (sessions.length === 0) return "No sessions."
  return sessions.map(({ state, status }) => `${state.sessionId}: ${status}, ${state.tasks.length} task${state.tasks.length === 1 ? "" : "s"}, updated ${state.updatedAt}`).join("\n")
}

if (process.argv[1]?.endsWith("main.ts") || process.argv[1]?.endsWith("main.js")) {
  void run(process.argv.slice(2)).then((output) => process.stdout.write(`${output}\n`))
}
