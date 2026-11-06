// Type declarations for @modelcontextprotocol/sdk (server)
declare module "@modelcontextprotocol/sdk/server/index.js" {
  export interface ServerOptions {
    name: string;
    version: string;
    capabilities?: Record<string, unknown>;
  }

  export class Server {
    constructor(options: ServerOptions);
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