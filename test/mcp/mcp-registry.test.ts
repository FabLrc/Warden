import { describe, expect, it } from "vitest"
import { parseConfig } from "../../src/config/config.js"
import { McpRegistry } from "../../src/mcp/mcp-registry.js"

describe("McpRegistry", () => {
  it("only exposes enabled servers to explicitly enabled agents with their tool allowlist", () => {
    const registry = new McpRegistry(parseConfig({
      mcp: {
        github: { command: "npx", args: ["github-mcp"], env: { TOKEN: "${GITHUB_TOKEN}" }, agents: { warden: { allowedTools: ["search", "repository.read"] }, builder: { enabled: false } } },
        disabled: { command: "npx", enabled: false, agents: { warden: {} } }
      }
    }).mcp)

    expect(registry.forAgent("warden")).toEqual([{ id: "github", command: "npx", args: ["github-mcp"], env: { TOKEN: "${GITHUB_TOKEN}" }, allowedTools: ["search", "repository.read"] }])
    expect(registry.forAgent("builder")).toEqual([])
    expect(registry.forAgent("reviewer")).toEqual([])
  })

  it("rejects malformed definitions and unknown agents", () => {
    expect(() => parseConfig({ mcp: { bad: { command: 1 } } })).toThrow("invalid MCP server bad")
    expect(() => parseConfig({ mcp: { bad: { command: "npx", agents: { unknown: {} } } } })).toThrow("invalid MCP server bad")
    expect(() => parseConfig({
      mcp: { bad: { command: "npx", env: { PORT: 3000 } } }
    })).toThrow("invalid MCP server bad")
  })
})
