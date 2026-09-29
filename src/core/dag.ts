import type { TaskState } from "./task.js"

export interface DagTask {
  id: string
  state: TaskState
  dependencies?: readonly string[]
}

export type DependencyStatus = "waiting" | "ready" | "blocked"

export function validateTaskDag(tasks: readonly DagTask[]): void {
  const taskIds = new Set<string>()
  for (const task of tasks) {
    if (taskIds.has(task.id)) throw new Error(`Duplicate task id: ${task.id}`)
    taskIds.add(task.id)
  }

  for (const task of tasks) {
    for (const dependency of task.dependencies ?? []) {
      if (!taskIds.has(dependency)) throw new Error(`Unknown dependency: ${task.id} -> ${dependency}`)
    }
  }

  const visiting = new Set<string>()
  const visited = new Set<string>()
  const byId = new Map(tasks.map((task) => [task.id, task]))
  const visit = (id: string): void => {
    if (visiting.has(id)) throw new Error(`Task dependency cycle: ${id}`)
    if (visited.has(id)) return
    visiting.add(id)
    for (const dependency of byId.get(id)?.dependencies ?? []) visit(dependency)
    visiting.delete(id)
    visited.add(id)
  }
  for (const task of tasks) visit(task.id)
}

export function dependencyStatus(task: DagTask, tasks: readonly DagTask[]): DependencyStatus {
  const byId = new Map(tasks.map((candidate) => [candidate.id, candidate]))
  const dependencies = (task.dependencies ?? []).map((id) => byId.get(id))
  if (dependencies.some((dependency) => dependency === undefined || dependency.state === "failed" || dependency.state === "blocked" || dependency.state === "cancelled")) return "blocked"
  return dependencies.every((dependency) => dependency?.state === "completed") ? "ready" : "waiting"
}

export function readyTasks<T extends DagTask>(tasks: readonly T[]): T[] {
  return tasks.filter((task) => task.state === "pending" && dependencyStatus(task, tasks) === "ready")
}
