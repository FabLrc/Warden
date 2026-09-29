let buffer = ""

process.stdin.on("data", (chunk) => {
  buffer += chunk.toString("utf8")
  let index = buffer.indexOf("\n")
  while (index >= 0) {
    const line = buffer.slice(0, index).trim()
    buffer = buffer.slice(index + 1)
    if (line) onMessage(JSON.parse(line))
    index = buffer.indexOf("\n")
  }
})

function onMessage(message) {
  if (message.method === "initialize") respond(message.id, { protocolVersion: "2024-11-05", capabilities: {}, serverInfo: { name: "fake", version: "0" } })
  else if (message.method === "tools/list") respond(message.id, {
    tools: [
      { name: "echo", description: "Echo the text back", inputSchema: { type: "object", properties: { text: { type: "string" } } } },
      { name: "danger", description: "Not granted" }
    ]
  })
  else if (message.method === "tools/call") respond(message.id, { content: [{ type: "text", text: `echo:${message.params.arguments.text}` }] })
}

function respond(id, result) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, result })}\n`)
}
