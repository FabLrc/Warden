import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process"

export interface McpServerSpec {
  command: string
  args?: string[]
  env?: Record<string, string>
}

export interface McpToolDefinition {
  name: string
  description?: string
  inputSchema?: Record<string, unknown>
}

const handshakeTimeoutMs = 15000
const requestTimeoutMs = 60000

interface Pending {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
}

// ponytail: minimal stdio JSON-RPC MCP client (initialize, tools/list, tools/call); no streaming, notifications or resources
export class McpClient {
  private nextId = 1
  private readonly pending = new Map<number, Pending>()
  private buffer = ""

  private constructor(private readonly child: ChildProcessWithoutNullStreams) {}

  static async connect(spec: McpServerSpec): Promise<McpClient> {
    const child = spawn(spec.command, spec.args ?? [], { env: { ...process.env, ...spec.env }, stdio: ["pipe", "pipe", "pipe"] })
    const client = new McpClient(child)
    child.stdout.on("data", (chunk: Buffer) => client.onData(chunk))
    child.stderr.on("data", () => undefined)
    child.on("error", (error: Error) => client.failAll(error))
    child.on("close", () => client.failAll(new Error("MCP server disconnected")))
    await client.request("initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "warden", version: "0.1.0" } }, handshakeTimeoutMs)
    client.send({ jsonrpc: "2.0", method: "notifications/initialized" })
    return client
  }

  async listTools(): Promise<McpToolDefinition[]> {
    const result = (await this.request("tools/list", {}, requestTimeoutMs)) as { tools?: McpToolDefinition[] } | undefined
    return Array.isArray(result?.tools) ? result.tools : []
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<string> {
    const result = (await this.request("tools/call", { name, arguments: args }, requestTimeoutMs)) as { content?: Array<{ type?: string; text?: string }>; isError?: boolean } | undefined
    const text = (result?.content ?? []).filter((part) => part?.type === "text").map((part) => String(part.text ?? "")).join("\n")
    if (result?.isError) throw new Error(text || `MCP tool failed: ${name}`)
    return text
  }

  close(): void {
    this.failAll(new Error("MCP client closed"))
    this.child.stdin.end()
    this.child.kill()
  }

  private request(method: string, params: unknown, timeoutMs: number): Promise<unknown> {
    const id = this.nextId++
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`MCP request timed out: ${method}`))
      }, timeoutMs)
      this.pending.set(id, {
        resolve: (value) => { clearTimeout(timer); resolve(value) },
        reject: (error) => { clearTimeout(timer); reject(error) }
      })
      this.send({ jsonrpc: "2.0", id, method, params })
    })
  }

  private send(message: unknown): void {
    this.child.stdin.write(`${JSON.stringify(message)}\n`)
  }

  private onData(chunk: Buffer): void {
    this.buffer += chunk.toString("utf8")
    let index = this.buffer.indexOf("\n")
    while (index >= 0) {
      const line = this.buffer.slice(0, index).trim()
      this.buffer = this.buffer.slice(index + 1)
      if (line) this.onMessage(line)
      index = this.buffer.indexOf("\n")
    }
  }

  private onMessage(line: string): void {
    let message: { id?: number; error?: { message?: string }; result?: unknown }
    try { message = JSON.parse(line) } catch { return }
    if (typeof message.id !== "number") return
    const pending = this.pending.get(message.id)
    if (!pending) return
    this.pending.delete(message.id)
    if (message.error) pending.reject(new Error(message.error.message ?? "MCP error"))
    else pending.resolve(message.result)
  }

  private failAll(error: Error): void {
    for (const pending of this.pending.values()) pending.reject(error)
    this.pending.clear()
  }
}
