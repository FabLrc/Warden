import type { Usage, WardenEvent } from "../core/events.js"

export interface SessionMetrics {
  durationMs: number
  usage: Required<Omit<Usage, "cost" | "estimatedCost">>
  providerCost: number
  estimatedCost: number
}

export function aggregateSessionMetrics(events: readonly WardenEvent[]): SessionMetrics {
  const timestamps = events.map(({ timestamp }) => timestamp)
  const metrics: SessionMetrics = { durationMs: timestamps.length ? Math.max(...timestamps) - Math.min(...timestamps) : 0, usage: { input: 0, output: 0, cachedInput: 0, reasoning: 0 }, providerCost: 0, estimatedCost: 0 }
  for (const { type, payload } of events) {
    if (type !== "usage.updated" || !isUsage(payload)) continue
    metrics.usage.input += payload.input ?? 0
    metrics.usage.output += payload.output ?? 0
    metrics.usage.cachedInput += payload.cachedInput ?? 0
    metrics.usage.reasoning += payload.reasoning ?? 0
    metrics.providerCost += payload.cost ?? 0
    metrics.estimatedCost += payload.estimatedCost ?? 0
  }
  return metrics
}

function isUsage(value: unknown): value is Usage {
  return typeof value === "object" && value !== null
}
