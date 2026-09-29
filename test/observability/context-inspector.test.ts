import { describe, expect, it } from "vitest"
import { ContextInspector, renderContextInspector } from "../../src/observability/context-inspector.js"

describe("ContextInspector", () => {
  it("accounts for each source and totals raw, injected, and saved bytes", () => {
    const inspector = new ContextInspector()
    inspector.record("system", "rules")
    inspector.record("memory", "abcdef", "abc")
    inspector.record("task", "fix it")

    expect(inspector.snapshot()).toMatchObject({
      sources: { system: { rawBytes: 5, injectedBytes: 5, savedBytes: 0 }, memory: { rawBytes: 6, injectedBytes: 3, savedBytes: 3 }, task: { rawBytes: 6, injectedBytes: 6, savedBytes: 0 } },
      total: { rawBytes: 17, injectedBytes: 14, savedBytes: 3 }
    })
    expect(renderContextInspector(inspector.snapshot())).toContain("Total  14 B")
  })
})
