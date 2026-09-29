import { describe, expect, it } from "vitest"
import { ContextInspector } from "../../src/observability/context-inspector.js"
import { ToolProxy } from "../../src/tools/tool-proxy.js"

describe("ToolProxy", () => {
  it("filters and safely truncates injected output while preserving raw metrics", () => {
    const inspector = new ContextInspector()
    const result = new ToolProxy(inspector).process("keep\nignore\n\u00e9\u00e9", { filter: (output) => output.split("\n").filter((line) => line !== "ignore").join("\n"), maxBytes: 7 })

    expect(result).toEqual({ raw: "keep\nignore\n\u00e9\u00e9", injected: "keep\n\u00e9", rawBytes: 16, injectedBytes: 7, savedBytes: 9 })
    expect(inspector.snapshot().sources.toolResults).toEqual({ rawBytes: 16, injectedBytes: 7, savedBytes: 9 })
  })

  it("rejects invalid truncation limits", () => {
    expect(() => new ToolProxy().process("output", { maxBytes: -1 })).toThrow("maxBytes")
  })

  it("keeps the head and tail of oversized output with a truncation marker", () => {
    const raw = `head-start\n${"x".repeat(400)}\ntail-end`
    const result = new ToolProxy().process(raw, { maxBytes: 80 })

    expect(result.injected.startsWith("head-start")).toBe(true)
    expect(result.injected.endsWith("tail-end")).toBe(true)
    expect(result.injected).toContain("[... output truncated by Warden ...]")
    expect(result.injectedBytes).toBeLessThanOrEqual(80)
    expect(result.savedBytes).toBe(result.rawBytes - result.injectedBytes)
  })
})
