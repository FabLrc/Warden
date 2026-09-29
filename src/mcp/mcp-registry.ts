export interface McpAgentAccess {
  enabled?: boolean
  allowedTools?: string[]
}

export interface McpServerDefinition {
  command: string
  args?: string[]
  env?: Record<string, string>
  enabled?: boolean
  agents?: Record<string, McpAgentAccess>
}

export interface AgentMcpServer {
  id: string
  command: string
  args?: string[]
  env?: Record<string, string>
  allowedTools?: string[]
}

export class McpRegistry {
  constructor(private readonly definitions: Record<string, McpServerDefinition>) {}

  forAgent(agent: string): AgentMcpServer[] {
    return Object.entries(this.definitions).flatMap(([id, definition]) => {
      const access = definition.agents?.[agent]
      if (definition.enabled === false || !access || access.enabled === false) return []
      return [{
        id,
        command: definition.command,
        ...(definition.args && { args: [...definition.args] }),
        ...(definition.env && { env: { ...definition.env } }),
        ...(access.allowedTools && { allowedTools: [...access.allowedTools] })
      }]
    })
  }
}
