import { describe, expect, it } from "vitest"
import { agentRoles, canWrite, roleConstraints } from "../../src/core/roles.js"

describe("role constraints", () => {
  it("allows source writes only for Builder", () => {
    expect(agentRoles.filter(canWrite)).toEqual(["builder"])
    expect(roleConstraints.warden.read).toBe(true)
  })
})
