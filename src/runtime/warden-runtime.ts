import { spawn } from "node:child_process"
import { EventBus, event } from "../core/events.js"
import { validateTaskDag } from "../core/dag.js"
import { createTask, transitionTask, type Task } from "../core/task.js"
import { canWrite, type AgentRole } from "../core/roles.js"
import type { ModelConfig, WardenConfig } from "../config/config.js"
import { SessionStore, type SessionState } from "../persistence/session-store.js"
import type { PiRunResult, TaskContext } from "./pi-runner.js"

export interface AgentRunner { run(context: TaskContext, options?: { signal?: AbortSignal }): Promise<PiRunResult> }
export interface RuntimeSnapshot { tasks: Task[] }
export interface ValidationResult { command: string; code: number | null; output: string }
export type ValidationRunner = (commands: string[]) => Promise<ValidationResult[]>

type TaskRoute = Pick<Task, "agent" | "category" | "validation" | "validationCommands">

export function routeTask(objective: string, config?: Pick<WardenConfig, "categories">): TaskRoute {
  const normalized = objective.toLowerCase()
  const category = selectCategory(normalized, config?.categories ?? {})
  const validation = /\b(auth|authentication|security|permission|migration|database|payment|billing|api|architecture|refactor|feature)\b/.test(normalized) ? "important" : "simple"
  return { agent: selectAgent(normalized), category, validation, validationCommands: config?.categories[category]?.validation ?? [] }
}

export class WardenRuntime {
  private tasks: Task[] = []
  private queue = Promise.resolve()
  private readonly listeners = new Set<(snapshot: RuntimeSnapshot) => void>()
  constructor(private readonly store: SessionStore, private readonly events: EventBus, private readonly runner: AgentRunner, private readonly sessionId: string, private readonly config?: Pick<WardenConfig, "categories" | "models" | "autonomy" | "policy">, tasks: Task[] = [], private readonly validate: ValidationRunner = runValidationCommands) {
    this.tasks = [...tasks]
  }

  start(objective: string, options: { signal?: AbortSignal } = {}): Promise<Task> {
    let task = createTask(objective, routeTask(objective, this.config))
    validateTaskDag([...this.tasks, task])
    this.tasks.push(task)
    this.notify()
    const run = this.queue.then(async () => {
      await this.record("task.created", { task })
      await this.checkpoint()
      return this.runTask(task, options)
    })
    this.queue = run.then(() => undefined, () => undefined)
    return run
  }

  resume(options: { signal?: AbortSignal } = {}): Promise<Task> {
    const run = this.queue.then(async () => {
      const task = this.tasks.find((value) => !isFinished(value))
      if (!task) throw new Error("session has no incomplete tasks")
      return this.runTask(task, options, true)
    })
    this.queue = run.then(() => undefined, () => undefined)
    return run
  }

  snapshot(): RuntimeSnapshot { return { tasks: [...this.tasks] } }
  subscribe(listener: (snapshot: RuntimeSnapshot) => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener) }
  private replace(previous: Task, next: Task): Task { this.tasks = this.tasks.map((task) => task.id === previous.id ? next : task); this.notify(); return next }
  private checkpoint(): Promise<void> { return this.store.saveState({ sessionId: this.sessionId, tasks: this.tasks, updatedAt: Date.now() } satisfies SessionState) }
  private notify(): void { for (const listener of this.listeners) listener(this.snapshot()) }
  private async runTask(task: Task, options: { signal?: AbortSignal }, resumed = false): Promise<Task> {
    if (task.state === "running") task = this.replace(task, transitionTask(task, "blocked"))
    if (task.state === "pending" || task.state === "blocked") task = this.replace(task, transitionTask(task, "ready"))
    if (task.state !== "ready") throw new Error(`task ${task.id} cannot resume from ${task.state}`)
    task = this.replace(task, transitionTask(task, "running"))
    await this.record("task.started", { task })
    await this.checkpoint()
    const result = await this.runner.run({ objective: task.objective, constraints: taskConstraints(task, resumed), artifacts: [], role: task.agent, model: modelConfig(task.category, this.config) }, options)
    if (result.status === "completed" && task.agent === "builder" && task.validationCommands.length > 0) {
      const validation = await this.runValidation(task.validationCommands)
      await this.record("validation.completed", { taskId: task.id, results: validation })
      const failed = validation.find((value) => value.code !== 0)
      task = failed
        ? this.replace(task, { ...transitionTask(task, "failed"), error: `Validation failed: ${failed.command}${failed.output ? `\n${failed.output}` : ""}` })
        : this.replace(task, { ...transitionTask(task, "completed"), result: result.text })
    } else if (result.status === "completed") task = this.replace(task, { ...transitionTask(task, "completed"), result: result.text })
    else if (result.status === "cancelled") task = this.replace(task, transitionTask(task, "cancelled"))
    else task = this.replace(task, { ...transitionTask(task, "failed"), error: result.text })
    await this.record(task.state === "completed" ? "task.completed" : "task.failed", { task })
    await this.checkpoint()
    return task
  }
  private async runValidation(commands: string[]): Promise<ValidationResult[]> {
    if (this.config?.policy?.denied?.includes("dangerous")) return commands.map((command) => ({ command, code: null, output: "Validation blocked by policy" }))
    return this.validate(commands)
  }
  private async record(type: "task.created" | "task.started" | "task.completed" | "task.failed" | "validation.completed", payload: unknown): Promise<void> {
    const value = event(this.sessionId, type, payload)
    this.events.publish(value)
    await this.store.appendEvent(value)
  }
}

export async function runValidationCommands(commands: string[]): Promise<ValidationResult[]> {
  const results: ValidationResult[] = []
  for (const command of commands) {
    results.push(await new Promise((resolve) => {
      // Commands are configured by the user and execute only in the local shell.
      const child = spawn(command, { shell: true, stdio: ["ignore", "pipe", "pipe"] })
      let output = ""
      child.stdout.on("data", (value: Buffer) => { output += value })
      child.stderr.on("data", (value: Buffer) => { output += value })
      child.on("error", (error) => resolve({ command, code: null, output: error.message }))
      child.on("close", (code) => resolve({ command, code, output: output.trim() }))
    }))
    if (results.at(-1)?.code !== 0) break
  }
  return results
}

function selectCategory(objective: string, categories: WardenConfig["categories"]): string {
  const preferred = /\b(research|documentation|docs|external)\b/.test(objective) ? "research"
    : /\b(fix|bug|error|failure|debug)\b/.test(objective) ? "debug"
    : /\b(review)\b/.test(objective) ? "review"
    : /\b(rename|typo|format)\b/.test(objective) ? "quick"
    : "implementation"
  if (preferred in categories) return preferred
  return Object.keys(categories).sort()[0] ?? "default"
}

function selectAgent(objective: string): AgentRole {
  if (/\b(fix|implement|add|create|update|change|refactor|rename|remove|delete|write|test)\b/.test(objective)) return "builder"
  if (/\b(research|documentation|docs|external|web)\b/.test(objective)) return "navigator"
  if (/\b(review|audit)\b/.test(objective)) return "reviewer"
  if (/\b(inspect|find|locate|explore|architecture|where|what)\b/.test(objective)) return "inspector"
  return "builder"
}

function isFinished(task: Task): boolean { return task.state === "completed" || task.state === "failed" || task.state === "cancelled" }

function taskConstraints(task: Task, resumed = false): string[] {
  const role = canWrite(task.agent) ? "You are the only role allowed to modify source files." : "Read-only role: do not modify source files."
  const validation = task.validation === "important" ? "Important task: review the change and run validation." : "Simple task: verify the change."
  const recovery = resumed ? "This task was interrupted. Inspect the current workspace before continuing; no prior Pi transcript is available." : undefined
  return [role, validation, recovery, ...task.validationCommands.map((command) => `Validation: ${command}`)].filter((value): value is string => Boolean(value))
}

function modelConfig(category: string, config?: Pick<WardenConfig, "categories" | "models">): ModelConfig | undefined {
  const selected = config?.categories[category]
  const model = selected && config?.models[selected.model]
  return model && { ...model, reasoning: selected.reasoning ?? model.reasoning, contextLimit: selected.contextLimit ?? model.contextLimit }
}
