import { describe, expect, it } from "vitest"
import { aggregateSessionMetrics } from "../../src/observability/metrics.js"

describe("aggregateSessionMetrics", () => {
  it("aggregates duration, usage, and distinct provider and estimated costs", () => {
    const metrics = aggregateSessionMetrics([
      { id: "1", sessionId: "s1", timestamp: 100, type: "session.started", payload: {} },
      { id: "2", sessionId: "s1", timestamp: 250, type: "usage.updated", payload: { input: 10, output: 4, cachedWrite: 3, cost: 0.02, estimatedCost: 0.03 } },
      { id: "3", sessionId: "s1", timestamp: 400, type: "usage.updated", payload: { input: 2, cachedInput: 5, reasoning: 1, cost: 0.01 } }
    ])

    expect(metrics).toEqual({ durationMs: 300, usage: { input: 12, output: 4, cachedInput: 5, cachedWrite: 3, reasoning: 1 }, providerCost: 0.03, estimatedCost: 0.03 })
  })
})
