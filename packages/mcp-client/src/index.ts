import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { Tool, ToolCall, ToolResult, RiskLevel } from "@nova/shared";

export interface MCPClientConfig {
  serverUrl: string;
}

export class MCPClient {
  private client: Client;
  private transport: StreamableHTTPClientTransport;
  private connected: boolean = false;
  private toolsCache: Tool[] = [];

  constructor(private config: MCPClientConfig) {
    this.client = new Client({
      name: "nova-mcp-client",
      version: "0.1.0",
      capabilities: {
        tools: {},
      },
    });

    this.transport = new StreamableHTTPClientTransport(new URL(config.serverUrl));
  }

  async connect(): Promise<void> {
    if (this.connected) return;

    await this.client.connect(this.transport);
    this.connected = true;

    await this.refreshTools();
  }

  async disconnect(): Promise<void> {
    if (!this.connected) return;

    await this.transport.close();
    this.connected = false;
  }

  async refreshTools(): Promise<Tool[]> {
    const response = await this.client.listTools();
    this.toolsCache = response.tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema as Record<string, unknown>,
      outputSchema: {},
      risk: RiskLevel.READ_ONLY,
    }));
    return this.toolsCache;
  }

  getTools(): Tool[] {
    return this.toolsCache;
  }

  async callTool(call: ToolCall): Promise<ToolResult> {
    if (!this.connected) {
      await this.connect();
    }

    const result = await this.client.callTool({
      name: call.tool,
      arguments: call.arguments,
    });

    let data: unknown = null;
    let error: string | null = null;
    let success = true;

    if (result.isError) {
      success = false;
      error = result.content[0]?.type === "text" ? result.content[0].text : "Tool execution failed";
    } else if (result.content[0]?.type === "text") {
      try {
        data = JSON.parse(result.content[0].text);
      } catch {
        data = result.content[0].text;
      }
    }

    return {
      callId: call.id,
      success,
      data,
      error,
      timestamp: Date.now(),
    };
  }

  isConnected(): boolean {
    return this.connected;
  }
}

export function createMCPClient(config: MCPClientConfig): MCPClient {
  return new MCPClient(config);
}