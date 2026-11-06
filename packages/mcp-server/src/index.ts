import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  InitializeRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { TOOLS, executeTool, validateTool } from "@nova/tools";
import { ToolCall, randomUUID } from "@nova/shared";

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const PORT = Number(process.env.MCP_SERVER_PORT) || 3001;
const HOST = process.env.MCP_SERVER_HOST || "0.0.0.0";

const mcpServer = new McpServer(
  {
    name: "nova-mcp-server",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {
        listChanged: true,
      },
    },
  }
);

// Register all tools
for (const tool of TOOLS) {
  mcpServer.registerTool(
    tool.name,
    {
      title: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema as any,
    },
    async (args: any) => {
      const call: ToolCall = {
        id: randomUUID(),
        tool: tool.name,
        arguments: args,
        risk: tool.risk,
        timestamp: Date.now(),
      };

      const result = await executeTool(call);

      if (!result.success) {
        throw new Error(result.error || "Tool execution failed");
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result.data, null, 2),
          },
        ],
        isError: !result.success,
      };
    }
  );
}

const transport = new StreamableHTTPServerTransport({
  sessionIdGenerator: () => randomUUID(),
});

async function setupServer() {
  await mcpServer.connect(transport as any);
}

app.all("/mcp", async (req: Request, res: Response) => {
  console.log("Received MCP request:", req.method, req.url);
  await transport.handleRequest(req, res, req.body);
});

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error("MCP Server Error:", err);
  res.status(500).json({ error: err.message });
});

setupServer().then(() => {
  console.log("Starting HTTP server...");
  const server = app.listen(PORT, HOST, () => {
    console.log(`MCP Server running at http://${HOST}:${PORT}/mcp`);
  });
  server.on('error', (err) => {
    console.error("Server error:", err);
  });
  server.on('listening', () => {
    console.log("Server is listening on port", PORT);
  });
}).catch((err) => {
  console.error("Failed to start MCP server:", err);
  process.exit(1);
});

process.on("SIGINT", async () => {
  await transport.close();
  process.exit(0);
});