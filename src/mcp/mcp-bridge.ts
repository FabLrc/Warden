import type { ToolDefinition } from "@earendil-works/pi-coding-agent"
import { McpClient } from "./mcp-client.js"
import type { AgentMcpServer } from "./mcp-registry.js"

export const mcpToolPrefix = "mcp__"

export function mcpToolName(serverId: string, tool: string): string {
  return `${mcpToolPrefix}${serverId}__${tool}`
}

export function isMcpToolName(name: string): boolean {
  return name.startsWith(mcpToolPrefix)
}

export interface McpTools {
  tools: ToolDefinition[]
  close: () => void
}

export async function openMcpTools(servers: readonly AgentMcpServer[]): Promise<McpTools> {
  const clients: McpClient[] = []
  const tools: ToolDefinition[] = []
  try {
    for (const server of servers) {
      const client = await McpClient.connect(server)
      clients.push(client)
      for (const tool of await client.listTools()) {
        if (server.allowedTools && !server.allowedTools.includes(tool.name)) continue
        tools.push(mcpToolDefinition(server.id, tool, client))
      }
    }
    return { tools, close: () => { for (const client of clients) client.close() } }
  } catch (error) {
    for (const client of clients) client.close()
    throw error
  }
}

function mcpToolDefinition(serverId: string, tool: { name: string; description?: string; inputSchema?: Record<string, unknown> }, client: McpClient): ToolDefinition {
  return {
    name: mcpToolName(serverId, tool.name),
    label: `${serverId}/${tool.name}`,
    description: tool.description ?? `MCP tool ${tool.name} from ${serverId}`,
    parameters: (tool.inputSchema ?? { type: "object" }) as ToolDefinition["parameters"],
    execute: async (_toolCallId, params) => {
      const text = await client.callTool(tool.name, (params ?? {}) as Record<string, unknown>)
      return { content: [{ type: "text", text }], details: undefined }
    }
  } as ToolDefinition
}
