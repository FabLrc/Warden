import { event, type EventBus, type EventType } from "../core/events.js"
import { recallMemory, type MemoryStore } from "../memory/memory-store.js"
import type { SessionStore } from "../persistence/session-store.js"
import { detectSkills, type SkillRegistry } from "../skills/skill-registry.js"
import { memoryArtifacts, type TaskContext } from "./pi-runner.js"

export type ContextEnricher = (context: TaskContext) => Promise<TaskContext>

export interface ContextEnricherOptions {
  events: EventBus
  sessionId: string
  memory?: MemoryStore
  skills?: SkillRegistry
  store?: SessionStore
}

export function createContextEnricher(options: ContextEnricherOptions): ContextEnricher {
  const record = async (type: EventType, payload: unknown): Promise<void> => {
    const value = event(options.sessionId, type, payload)
    options.events.publish(value)
    await options.store?.appendEvent(value)
  }

  return async (context) => {
    const enriched: TaskContext = { ...context }
    if (options.memory) {
      const records = recallMemory(await options.memory.list(), context.objective)
      if (records.length > 0) {
        await record("memory.recalled", { count: records.length, ids: records.map(({ id }) => id) })
        enriched.memoryArtifacts = [...(context.memoryArtifacts ?? []), ...memoryArtifacts(records)]
      }
    }
    if (options.skills) {
      for (const metadata of detectSkills(options.skills.list(), context.objective, context.role)) {
        const content = await options.skills.load(metadata.id)
        await record("skill.loaded", { id: metadata.id, estimatedContextTokens: metadata.estimatedContextTokens })
        const body = typeof content === "string" ? content : JSON.stringify(content)
        const label = metadata.estimatedContextTokens === undefined ? metadata.name : `${metadata.name} (+${metadata.estimatedContextTokens} tokens)`
        enriched.skills = [...(enriched.skills ?? []), `### ${label}\n${body}`]
      }
    }
    return enriched
  }
}
