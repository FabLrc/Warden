import { randomUUID } from "node:crypto"
import { homedir } from "node:os"
import { join } from "node:path"
import { loadConfig, type WardenConfig } from "../config/config.js"
import { EventBus, type WardenEvent } from "../core/events.js"
import type { Task } from "../core/task.js"
import { doctor } from "../diagnostics/doctor.js"
import { MemoryStore } from "../memory/memory-store.js"
import { aggregateSessionMetrics, type SessionMetrics } from "../observability/metrics.js"
import { SessionStore, type SessionDescriptor } from "../persistence/session-store.js"
import { createPiRunner } from "../runtime/pi-runner.js"
import { createContextEnricher } from "../runtime/task-context.js"
import { WardenRuntime } from "../runtime/warden-runtime.js"
import { SkillRegistry } from "../skills/skill-registry.js"

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
    if (!runtime) runtime = await buildRuntime(project, home, sessionId, store, state.tasks)
    if (!runtime.resume) throw new Error("runtime does not support resume")
    return formatResult(await runtime.resume(), store)
  }
  if (argv[0] !== "run" || argv.length === 1) return usage()
  const request = argv.slice(1).join(" ")
  let store: SessionStore | undefined
  if (!runtime) {
    const sessionId = randomUUID()
    store = await SessionStore.create(project, sessionId)
    runtime = await buildRuntime(project, home, sessionId, store)
  }
  const task = await runtime.start(request)
  return formatResult(task, store)
}

async function formatResult(task: { state: string; result?: string; error?: string }, store?: SessionStore): Promise<string> {
  const body = formatTask(task)
  if (!store) return body
  const metrics = aggregateSessionMetrics(await store.readEvents() as WardenEvent[])
  return `${body}\n${formatMetrics(metrics)}`
}

function formatMetrics(metrics: SessionMetrics): string {
  const { input, output, cachedInput, reasoning } = metrics.usage
  const tokens = input + output + cachedInput + reasoning
  const cost = metrics.providerCost + metrics.estimatedCost
  return `metrics: ${tokens} tokens (in ${input}, out ${output}, cached ${cachedInput}, reasoning ${reasoning}), $${cost.toFixed(4)}, ${(metrics.durationMs / 1000).toFixed(1)}s`
}

async function buildRuntime(project: string, home: string, sessionId: string, store: SessionStore, tasks: Task[] = []): Promise<WardenRuntime> {
  const events = new EventBus()
  const config = await loadConfig(project, home)
  const memory = await MemoryStore.create(project)
  const skills = new SkillRegistry()
  await skills.loadFrom(join(project, ".warden", "skills"))
  const runner = createPiRunner(project, events, sessionId, config)
  const enrich = createContextEnricher({ events, sessionId, memory, skills, store })
  return new WardenRuntime(store, events, { run: (context, options) => enrich(context).then((enriched) => runner.run(enriched, options)) }, sessionId, config, tasks)
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
  void run(process.argv.slice(2)).then(
    (output) => process.stdout.write(`${output}\n`),
    (error) => {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
      process.exitCode = 1
    }
  )
}
