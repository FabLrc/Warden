import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import { randomUUID } from "node:crypto"
import { join } from "node:path"

export type MemoryPriority = "critical" | "lazy"
export const defaultCriticalMemoryLimit = 20

export interface MemoryProvenance {
  source: string
  capturedAt: number
}

export interface MemoryRecord {
  id: string
  content: string
  priority: MemoryPriority
  provenance: MemoryProvenance
  confidence: number
  state: string
  locked: boolean
}

export type NewMemoryRecord = Omit<MemoryRecord, "id">

export class MemoryStore {
  private constructor(private readonly path: string) {}

  static async create(project: string): Promise<MemoryStore> {
    const directory = join(project, ".warden")
    await mkdir(directory, { recursive: true })
    return new MemoryStore(join(directory, "memory.json"))
  }

  async remember(memory: NewMemoryRecord): Promise<MemoryRecord> {
    const record = { ...memory, id: randomUUID() }
    const records = await this.list()
    records.push(record)
    const temp = `${this.path}.${randomUUID()}.tmp`
    await writeFile(temp, JSON.stringify(records))
    await rename(temp, this.path)
    return record
  }

  async list(priority?: MemoryPriority): Promise<MemoryRecord[]> {
    const records = await this.read()
    return priority ? records.filter((record) => record.priority === priority) : records
  }

  async listCritical(limit = defaultCriticalMemoryLimit): Promise<MemoryRecord[]> {
    if (!Number.isSafeInteger(limit) || limit < 0) throw new Error("critical memory limit must be a non-negative integer")
    return (await this.list("critical")).slice(0, limit)
  }

  private async read(): Promise<MemoryRecord[]> {
    let value: unknown
    try {
      value = JSON.parse(await readFile(this.path, "utf8"))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return []
      throw new Error(`invalid Warden memory: ${this.path}`)
    }
    if (!Array.isArray(value) || !value.every(isMemoryRecord)) throw new Error(`invalid Warden memory: ${this.path}`)
    return value
  }
}

function isMemoryRecord(value: unknown): value is MemoryRecord {
  if (typeof value !== "object" || value === null) return false
  const record = value as MemoryRecord
  return typeof record.id === "string" && typeof record.content === "string" && (record.priority === "critical" || record.priority === "lazy") && typeof record.provenance === "object" && record.provenance !== null && typeof record.provenance.source === "string" && typeof record.provenance.capturedAt === "number" && typeof record.confidence === "number" && Number.isFinite(record.confidence) && record.confidence >= 0 && record.confidence <= 1 && typeof record.state === "string" && typeof record.locked === "boolean"
}

const deadStates = new Set(["superseded", "deprecated", "archived"])
const stopwords = new Set(["the", "and", "for", "with", "this", "that", "from", "into", "not", "are", "was", "has", "have", "can", "will", "your", "our", "their", "all", "any"])

export function recallMemory(records: readonly MemoryRecord[], objective: string, options: { criticalLimit?: number; lazyLimit?: number } = {}): MemoryRecord[] {
  const active = records.filter((record) => !deadStates.has(record.state))
  const critical = active.filter((record) => record.priority === "critical").slice(0, options.criticalLimit ?? defaultCriticalMemoryLimit)
  // ponytail: keyword recall, not embeddings; upgrade if relevance measurably poor
  const tokens = objective.toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length >= 3 && !stopwords.has(token))
  const lazy = active.filter((record) => record.priority === "lazy" && tokens.some((token) => record.content.toLowerCase().includes(token))).slice(0, options.lazyLimit ?? 5)
  return [...critical, ...lazy]
}
