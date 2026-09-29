import { appendFile, mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { randomUUID } from "node:crypto"
import type { Task } from "../core/task.js"
import type { WardenEvent } from "../core/events.js"

export interface SessionState { sessionId: string; tasks: Task[]; updatedAt: number }
export type SessionStatus = "incomplete" | "complete"
export interface SessionDescriptor { state: SessionState; status: SessionStatus }

export class SessionStore {
  private constructor(private readonly directory: string) {}

  static async create(project: string, sessionId: string): Promise<SessionStore> {
    const directory = join(project, ".warden", "sessions", sessionId)
    await mkdir(directory, { recursive: true })
    return new SessionStore(directory)
  }

  static open(project: string, sessionId: string): SessionStore {
    return new SessionStore(join(project, ".warden", "sessions", sessionId))
  }

  static async list(project: string): Promise<SessionDescriptor[]> {
    const directory = join(project, ".warden", "sessions")
    let entries
    try { entries = await readdir(directory, { withFileTypes: true }) } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return []
      throw error
    }
    const descriptors = await Promise.all(entries.filter((entry) => entry.isDirectory()).sort((a, b) => a.name.localeCompare(b.name)).map(async (entry) => {
      try {
        return await SessionStore.open(project, entry.name).read()
      } catch {
        return undefined
      }
    }))
    return descriptors.filter((descriptor): descriptor is SessionDescriptor => descriptor !== undefined)
  }

  async saveState(state: SessionState): Promise<void> {
    const path = join(this.directory, "state.json")
    const temp = `${path}.${randomUUID()}.tmp`
    await writeFile(temp, JSON.stringify(state))
    await rename(temp, path)
  }

  async loadState(): Promise<SessionState> {
    const path = join(this.directory, "state.json")
    let value: unknown
    try { value = JSON.parse(await readFile(path, "utf8")) } catch { throw new Error(`invalid Warden state: ${path}`) }
    if (!isState(value)) throw new Error(`invalid Warden state: ${path}`)
    return value
  }

  async read(): Promise<SessionDescriptor> {
    const state = await this.loadState()
    return { state, status: state.tasks.some((task) => !isFinished(task)) ? "incomplete" : "complete" }
  }

  async appendEvent(event: WardenEvent): Promise<void> { await appendFile(join(this.directory, "events.jsonl"), `${JSON.stringify(event)}\n`) }

  async readEvents(): Promise<unknown[]> {
    try {
      const lines = (await readFile(join(this.directory, "events.jsonl"), "utf8")).split("\n")
      return lines.flatMap((line, index) => {
        if (!line) return []
        try { return [JSON.parse(line)] } catch {
          if (index === lines.length - 1 || (index === lines.length - 2 && lines.at(-1) === "")) return []
          throw new Error("invalid Warden event log")
        }
      })
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return []
      throw error
    }
  }
}

function isFinished(task: Task): boolean { return task.state === "completed" || task.state === "failed" || task.state === "cancelled" }

function isState(value: unknown): value is SessionState {
  return typeof value === "object" && value !== null && typeof (value as SessionState).sessionId === "string" && Array.isArray((value as SessionState).tasks) && typeof (value as SessionState).updatedAt === "number"
}
