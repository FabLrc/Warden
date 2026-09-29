import { randomUUID } from "node:crypto"

export interface Usage {
  input?: number
  output?: number
  cachedInput?: number
  reasoning?: number
  cost?: number
  estimatedCost?: number
}

export type EventType =
  | "session.started"
  | "task.created"
  | "task.started"
  | "task.completed"
  | "task.failed"
  | "agent.started"
  | "agent.completed"
  | "validation.completed"
  | "tool.started"
  | "tool.completed"
  | "model.selected"
  | "usage.updated"
  | "checkpoint.created"

export interface WardenEvent<T = unknown> {
  id: string
  sessionId: string
  timestamp: number
  type: EventType
  parentId?: string
  payload: T
}

export function event<T>(sessionId: string, type: EventType, payload: T, parentId?: string): WardenEvent<T> {
  return { id: randomUUID(), sessionId, timestamp: Date.now(), type, payload, parentId }
}

export class EventBus {
  private readonly listeners = new Set<(value: WardenEvent) => void>()

  subscribe(listener: (value: WardenEvent) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  publish(value: WardenEvent): void {
    for (const listener of this.listeners) listener(value)
  }
}
