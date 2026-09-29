import { randomUUID } from "node:crypto"
import type { AgentRole } from "./roles.js"

export type TaskState = "pending" | "ready" | "running" | "completed" | "failed" | "blocked" | "cancelled"

export interface Task {
  id: string
  objective: string
  agent: AgentRole
  category: string
  validation: "simple" | "important"
  validationCommands: string[]
  dependencies: string[]
  state: TaskState
  result?: string
  error?: string
}

const transitions: Record<TaskState, readonly TaskState[]> = {
  pending: ["ready"], ready: ["running"], running: ["completed", "failed", "blocked", "cancelled"],
  completed: [], failed: [], blocked: ["ready", "cancelled"], cancelled: []
}

export function createTask(objective: string, options: Partial<Pick<Task, "agent" | "category" | "validation" | "validationCommands" | "dependencies">> = {}): Task {
  return {
    id: randomUUID(), objective, agent: options.agent ?? "builder", category: options.category ?? "default",
    validation: options.validation ?? "simple", validationCommands: options.validationCommands ?? [], dependencies: options.dependencies ?? [], state: "pending"
  }
}

export function transitionTask(task: Task, state: TaskState): Task {
  if (!transitions[task.state].includes(state)) throw new Error(`Invalid task transition: ${task.state} -> ${state}`)
  return { ...task, state }
}
