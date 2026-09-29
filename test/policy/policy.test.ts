import { describe, expect, it } from "vitest"
import { classifyTool, decidePolicy } from "../../src/policy/policy.js"

describe("policy", () => {
  it("classifies common tool operations conservatively", () => {
    expect(classifyTool("read_file")).toBe("read")
    expect(classifyTool("write_file")).toBe("safe_write")
    expect(classifyTool("rm")).toBe("dangerous")
    expect(classifyTool("fetch")).toBe("external_side_effect")
    expect(classifyTool("unknown_tool")).toBe("dangerous")
  })

  it("applies autonomy modes without allowing external effects silently", () => {
    expect(decidePolicy("ask", "read")).toBe("confirm")
    expect(decidePolicy("guided", "safe_write")).toBe("allow")
    expect(decidePolicy("guided", "dangerous")).toBe("confirm")
    expect(decidePolicy("auto", "safe_write")).toBe("allow")
    expect(decidePolicy("auto", "external_side_effect")).toBe("deny")
    expect(decidePolicy("full", "external_side_effect")).toBe("confirm")
  })

  it("enforces policy allow and deny lists within autonomy limits", () => {
    expect(decidePolicy("full", "safe_write", { denied: ["safe_write"] })).toBe("deny")
    expect(decidePolicy("ask", "read", { allowed: ["read"] })).toBe("allow")
    expect(decidePolicy("ask", "safe_write", { allowed: ["safe_write"] })).toBe("deny")
    expect(decidePolicy("auto", "external_side_effect", { allowed: ["external_side_effect"] })).toBe("deny")
  })
})
