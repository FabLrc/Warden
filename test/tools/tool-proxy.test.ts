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
})
