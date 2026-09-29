export const contextSources = ["system", "project", "memory", "skills", "task", "toolResults"] as const
export type ContextSource = typeof contextSources[number]

export interface ContextSize {
  rawBytes: number
  injectedBytes: number
  savedBytes: number
}

export interface ContextSnapshot {
  sources: Record<ContextSource, ContextSize>
  total: ContextSize
}

export class ContextInspector {
  private readonly sources = new Map<ContextSource, ContextSize>()

  constructor() { this.reset() }

  record(source: ContextSource, raw: string, injected = raw): void {
    const current = this.sources.get(source)!
    const rawBytes = Buffer.byteLength(raw)
    const injectedBytes = Buffer.byteLength(injected)
    this.sources.set(source, { rawBytes: current.rawBytes + rawBytes, injectedBytes: current.injectedBytes + injectedBytes, savedBytes: current.savedBytes + Math.max(0, rawBytes - injectedBytes) })
  }

  reset(): void {
    for (const source of contextSources) this.sources.set(source, { rawBytes: 0, injectedBytes: 0, savedBytes: 0 })
  }

  snapshot(): ContextSnapshot {
    const sources = Object.fromEntries(contextSources.map((source) => [source, { ...this.sources.get(source)! }])) as Record<ContextSource, ContextSize>
    const total = contextSources.reduce((sum, source) => ({ rawBytes: sum.rawBytes + sources[source].rawBytes, injectedBytes: sum.injectedBytes + sources[source].injectedBytes, savedBytes: sum.savedBytes + sources[source].savedBytes }), { rawBytes: 0, injectedBytes: 0, savedBytes: 0 })
    return { sources, total }
  }
}

export function renderContextInspector(snapshot: ContextSnapshot): string {
  const label: Record<ContextSource, string> = { system: "System", project: "Project", memory: "Memory", skills: "Skills", task: "Task", toolResults: "Tool results" }
  return [...contextSources.map((source) => `${label[source]}  ${snapshot.sources[source].injectedBytes} B`), `Total  ${snapshot.total.injectedBytes} B`].join("\n")
}
