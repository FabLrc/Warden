import { event, type EventBus } from "../core/events.js"
import { recallMemory, type MemoryStore } from "../memory/memory-store.js"
import type { SessionStore } from "../persistence/session-store.js"
import { memoryArtifacts, type TaskContext } from "./pi-runner.js"

export type ContextEnricher = (context: TaskContext) => Promise<TaskContext>

export interface ContextEnricherOptions {
  events: EventBus
  sessionId: string
  memory?: MemoryStore
  store?: SessionStore
}

export function createContextEnricher(options: ContextEnricherOptions): ContextEnricher {
  return async (context) => {
    if (!options.memory) return context
    const records = recallMemory(await options.memory.list(), context.objective)
    if (records.length === 0) return context
    const recalled = event(options.sessionId, "memory.recalled", { count: records.length, ids: records.map(({ id }) => id) })
    options.events.publish(recalled)
    await options.store?.appendEvent(recalled)
    return { ...context, memoryArtifacts: [...(context.memoryArtifacts ?? []), ...memoryArtifacts(records)] }
  }
}
