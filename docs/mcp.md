# NOVA MCP Implementation

## Overview

NOVA uses a real MCP (Model Context Protocol) implementation with Streamable HTTP transport, following the MCP specification 2025-11-25. The implementation uses the official `@modelcontextprotocol/sdk` TypeScript package.

## Architecture

```
┌──────────────┐     Streamable HTTP      ┌──────────────┐
│  MCP Client  │ ◄──────────────────────► │  MCP Server  │
│  (@nova/     │      /mcp endpoint       │  (@nova/     │
│   mcp-client)│                           │   mcp-server)│
└──────────────┘                           └──────────────┘
                                                  │
                                                  ▼
                                          ┌──────────────┐
                                          │   Tools      │
                                          │  (7 tools)   │
                                          └──────────────┘
```

## MCP Server

### Endpoint

- **URL**: `http://localhost:3001/mcp`
- **Transport**: Streamable HTTP
- **Protocol Version**: 2025-11-25

### Capabilities

```json
{
  "capabilities": {
    "tools": {}
  }
}
```

### Methods Implemented

#### initialize

Handles protocol initialization and capability negotiation.

```typescript
mcpServer.setRequestHandler(InitializeRequestSchema, async () => {
  return {
    protocolVersion: "2025-11-25",
    capabilities: { tools: {} },
    serverInfo: { name: "nova-mcp-server", version: "0.1.0" }
  };
});
```

#### tools/list

Returns all available tools with their schemas.

```typescript
mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: TOOLS.map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema
    }))
  };
});
```

#### tools/call

Executes a tool with validated arguments.

```typescript
mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const tool = TOOLS.find(t => t.name === name);
  if (!tool) throw new Error(`Tool not found: ${name}`);

  const call: ToolCall = {
    id: randomUUID(),
    tool: name,
    arguments: args,
    risk: tool.risk,
    timestamp: Date.now()
  };

  const result = await executeTool(call);
  if (!result.success) throw new Error(result.error);

  return {
    content: [{ type: "text", text: JSON.stringify(result.data) }],
    isError: false
  };
});
```

### Running the Server

```bash
# From repository root
npm run mcp:server

# Or directly
cd packages/mcp-server
npm run mcp:server
```

Server starts on `http://localhost:3001/mcp`

## MCP Client

The client connects to the MCP server and provides a typed interface for tool invocation.

```typescript
import { createMCPClient } from "@nova/mcp-client";

const client = createMCPClient({ serverUrl: "http://localhost:3001/mcp" });
await client.connect();

const tools = client.getTools();
// [
//   { name: "get_calendar_context", ... },
//   { name: "get_weather_context", ... },
//   ...
// ]

const result = await client.callTool({
  id: "call-123",
  tool: "get_calendar_context",
  arguments: { userId: "user-123" },
  risk: RiskLevel.READ_ONLY,
  timestamp: Date.now()
});
```

### Connection Lifecycle

1. `connect()` - Establishes Streamable HTTP connection
2. `refreshTools()` - Fetches tool list from server
3. `callTool()` - Invokes tool via server
4. `disconnect()` - Closes connection

## Tool Definitions

All 7 tools are registered with strict input/output schemas:

### get_calendar_context

```typescript
input: { userId: string, dateRange?: { start: string, end: string } }
output: { events: CalendarEvent[], dateRange: { start: string, end: string } }
risk: READ_ONLY
```

### get_weather_context

```typescript
input: { location: string, date?: string }
output: { location: string, date: string, forecast: WeatherForecast }
risk: READ_ONLY
```

### get_tasks

```typescript
input: { userId: string, status?: "pending" | "in_progress" | "completed" | "cancelled" }
output: { tasks: Task[] }
risk: READ_ONLY
```

### update_task

```typescript
input: { taskId: string, updates: { title?, description?, status?, priority?, dueDate? } }
output: { task: Task }
risk: LOW_RISK_WRITE
```

### manage_shopping_list

```typescript
input: { userId: string, action: "add" | "remove" | "update", items: ShoppingItem[] }
output: { list: ShoppingList }
risk: LOW_RISK_WRITE
```

### create_reminder

```typescript
input: { userId: string, title: string, description?: string, dueDate: string, recurrence?: "none" | "daily" | "weekly" | "monthly" }
output: { reminder: Reminder }
risk: LOW_RISK_WRITE
```

### get_user_context

```typescript
input: { userId: string }
output: { userId: string, name?: string, preferences: Record<string, unknown>, timezone: string, location?: string }
risk: READ_ONLY
```

## Verification

Test MCP server independently:

```bash
# Start server
npm run mcp:server

# In another terminal, test with curl
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}'

curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'

curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"get_user_context","arguments":{"userId":"user_001"}}}'
```

## Error Handling

- Invalid tool name → `Tool not found` error
- Invalid arguments → Zod validation error
- Tool execution failure → Structured error response
- Connection failure → Client reconnection logic
- Timeout → Configurable per-request timeout

## Security

- No authentication in prototype (add for production)
- Input validation on all tool calls
- Output sanitization
- Rate limiting (TODO)
- CORS configured for web origin