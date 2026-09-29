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

export const defaultToolOutputBytes = 65536

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
  const buffer = Buffer.from(output)
  if (buffer.byteLength <= maxBytes) return output
  const marker = "\n[... output truncated by Warden ...]\n"
  if (maxBytes <= marker.length) return new TextDecoder().decode(buffer.subarray(0, maxBytes))
  const budget = maxBytes - marker.length
  const head = Math.ceil(budget / 2)
  return new TextDecoder().decode(buffer.subarray(0, head)) + marker + new TextDecoder().decode(buffer.subarray(buffer.byteLength - (budget - head)))
}
