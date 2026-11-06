// Type declarations for @modelcontextprotocol/sdk
declare module "@modelcontextprotocol/sdk/client/index.js" {
  export interface ClientOptions {
    name: string;
    version: string;
    capabilities?: Record<string, unknown>;
  }

  export interface Transport {
    send(message: unknown): Promise<void>;
    close(): Promise<void>;
    onmessage?: (message: unknown) => void;
    onclose?: () => void;
    onerror?: (error: Error) => void;
  }

  export class Client {
    constructor(options: ClientOptions);
    connect(transport: Transport): Promise<void>;
    close(): Promise<void>;
    listTools(): Promise<{ tools: Array<{ name: string; description: string; inputSchema: Record<string, unknown> }> }>;
    callTool(params: { name: string; arguments: Record<string, unknown> }): Promise<{
      content: Array<{ type: "text"; text: string }>;
      isError: boolean;
    }>;
  }
}

declare module "@modelcontextprotocol/sdk/client/streamableHttp.js" {
  export class StreamableHTTPClientTransport {
    constructor(url: URL);
    send(message: unknown): Promise<void>;
    close(): Promise<void>;
  }
}

declare module "@modelcontextprotocol/sdk/server/index.js" {
  export interface ServerOptions {
    name: string;
    version: string;
    capabilities?: Record<string, unknown>;
  }

  export class Server {
    constructor(info: { name: string; version: string }, options: ServerOptions);
    setRequestHandler<T>(schema: unknown, handler: (request: unknown) => Promise<T>): void;
    connect(transport: unknown): Promise<void>;
  }
}

declare module "@modelcontextprotocol/sdk/server/streamableHttp.js" {
  export interface StreamableHTTPServerTransportOptions {
    sessionIdGenerator?: () => string;
  }

  export class StreamableHTTPServerTransport {
    constructor(options: StreamableHTTPServerTransportOptions);
    handleRequest(req: unknown, res: unknown, body: unknown): Promise<void>;
    close(): Promise<void>;
  }
}

declare module "@modelcontextprotocol/sdk/types.js" {
  export const InitializeRequestSchema: unknown;
  export const ListToolsRequestSchema: unknown;
  export const CallToolRequestSchema: unknown;
}