import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { isMcpToolName, mcpToolName, openMcpTools } from "../../src/mcp/mcp-bridge.js"

const serverSpec = { command: process.execPath, args: [fileURLToPath(new URL("fixtures/fake-mcp-server.mjs", import.meta.url))] }

describe("mcp-bridge", () => {
  it("names and detects MCP tools", () => {
    expect(mcpToolName("github", "search")).toBe("mcp__github__search")
    expect(isMcpToolName("mcp__github__search")).toBe(true)
    expect(isMcpToolName("bash")).toBe(false)
  })

  it("registers granted tools only and executes them against the server", async () => {
    const { tools, close } = await openMcpTools([{ id: "demo", ...serverSpec, allowedTools: ["echo"] }])
    try {
      expect(tools.map(({ name }) => name)).toEqual(["mcp__demo__echo"])
      expect(tools[0].description).toBe("Echo the text back")
      await expect(tools[0].execute("t1", { text: "x" } as never, undefined, undefined, undefined as never)).resolves.toMatchObject({
        content: [{ type: "text", text: "echo:x" }]
      })
    } finally {
      close()
    }
  })

  it("registers every tool when no allowlist is configured", async () => {
    const { tools, close } = await openMcpTools([{ id: "demo", ...serverSpec }])
    try {
      expect(tools.map(({ name }) => name)).toEqual(["mcp__demo__echo", "mcp__demo__danger"])
    } finally {
      close()
    }
  })
})
