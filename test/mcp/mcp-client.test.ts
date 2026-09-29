import { fileURLToPath } from "node:url"
import { afterAll, describe, expect, it } from "vitest"
import { McpClient } from "../../src/mcp/mcp-client.js"

const server = { command: process.execPath, args: [fileURLToPath(new URL("fixtures/fake-mcp-server.mjs", import.meta.url))] }

describe("McpClient", () => {
  const clients: McpClient[] = []
  afterAll(() => { for (const client of clients) client.close() })

  it("connects, lists tools and calls them over stdio", async () => {
    const client = await McpClient.connect(server)
    clients.push(client)

    await expect(client.listTools()).resolves.toMatchObject([{ name: "echo", description: "Echo the text back" }, { name: "danger" }])
    await expect(client.callTool("echo", { text: "hi" })).resolves.toBe("echo:hi")
    client.close()
  })

  it("fails fast when the server cannot start", async () => {
    await expect(McpClient.connect({ command: "definitely-not-a-command-warden" })).rejects.toThrow()
  })
})
