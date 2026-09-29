import type { ContextInspector } from "../observability/context-inspector.js"

export interface ToolProxyOptions {
  filter?: (output: string) => string
  maxBytes?: number
}

export interface ToolOutput {
  raw: string
  injected: string
  rawBytes: number
  injectedBytes: number
  savedBytes: number
}

export class ToolProxy {
  constructor(private readonly inspector?: ContextInspector) {}

  process(raw: string, options: ToolProxyOptions = {}): ToolOutput {
    const filtered = options.filter ? options.filter(raw) : raw
    const injected = options.maxBytes === undefined ? filtered : truncate(filtered, options.maxBytes)
    const rawBytes = Buffer.byteLength(raw)
    const injectedBytes = Buffer.byteLength(injected)
    this.inspector?.record("toolResults", raw, injected)
    return { raw, injected, rawBytes, injectedBytes, savedBytes: Math.max(0, rawBytes - injectedBytes) }
  }
}

function truncate(output: string, maxBytes: number): string {
  if (!Number.isInteger(maxBytes) || maxBytes < 0) throw new Error("maxBytes must be a non-negative integer")
  if (Buffer.byteLength(output) <= maxBytes) return output
  return new TextDecoder().decode(Buffer.from(output).subarray(0, maxBytes))
}
