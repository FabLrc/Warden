import { expect, it } from "vitest"
import { renderDashboard } from "../../src/tui/app.js"

it("renders runtime tasks with session metrics and context details", () => {
  expect(renderDashboard(
    { tasks: [{ id: "1", objective: "rename x", agent: "builder", state: "running" }, { id: "2", objective: "test x", agent: "builder", state: "pending" }] },
    { project: "/work/warden", sessionId: "s1", metrics: { durationMs: 250, usage: { input: 10, output: 4, cachedInput: 2, reasoning: 1 }, providerCost: 0.02, estimatedCost: 0.03 }, context: { tokens: 16, limit: 128 } }
  )).toBe(`WARDEN
Session
Project: /work/warden
ID: s1
Duration: 250ms
Tasks
Builder  running  rename x
Builder  pending  test x
Metrics
Tokens: input 10  output 4  cached 2  reasoning 1
Cost: provider 0.02  estimated 0.03
Context
Tokens: 16 / 128 tokens`)
})

it("renders unavailable session telemetry deterministically", () => {
  expect(renderDashboard({ tasks: [] })).toBe(`WARDEN
Session
Project: unknown
ID: unknown
Duration: unknown
Tasks
No tasks
Metrics
Tokens: unknown
Cost: unknown
Context
Tokens: unknown`)
})
