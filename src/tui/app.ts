import type { RuntimeSnapshot } from "../runtime/warden-runtime.js"
import type { SessionMetrics } from "../observability/metrics.js"

export interface DashboardDetails {
  project?: string
  sessionId?: string
  metrics?: SessionMetrics
  context?: { tokens: number; limit?: number }
}

export function renderDashboard(snapshot: RuntimeSnapshot, details: DashboardDetails = {}): string {
  const { metrics } = details
  const tasks = snapshot.tasks.map((task) => `${task.agent.charAt(0).toUpperCase()}${task.agent.slice(1)}  ${task.state}  ${task.objective}`).join("\n") || "No tasks"
  const usage = metrics ? `input ${metrics.usage.input}  output ${metrics.usage.output}  cached ${metrics.usage.cachedInput}  reasoning ${metrics.usage.reasoning}` : "unknown"
  const cost = metrics ? `provider ${metrics.providerCost}  estimated ${metrics.estimatedCost}` : "unknown"
  const context = details.context ? `${details.context.tokens}${details.context.limit === undefined ? "" : ` / ${details.context.limit}`} tokens` : "unknown"
  return [
    "WARDEN",
    "Session",
    `Project: ${details.project ?? "unknown"}`,
    `ID: ${details.sessionId ?? "unknown"}`,
    `Duration: ${metrics ? `${metrics.durationMs}ms` : "unknown"}`,
    "Tasks",
    tasks,
    "Metrics",
    `Tokens: ${usage}`,
    `Cost: ${cost}`,
    "Context",
    `Tokens: ${context}`
  ].join("\n")
}
