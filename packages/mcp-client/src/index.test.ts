import { describe, it, expect, vi, beforeEach } from "vitest";
import { MCPClient } from "./index.js";

describe("MCPClient", () => {
  let client: MCPClient;
  const mockConfig = { serverUrl: "http://localhost:3001/mcp" };

  beforeEach(() => {
    vi.resetAllMocks();
    client = new MCPClient(mockConfig);
  });

  it("should create client with config", () => {
    expect(client).toBeInstanceOf(MCPClient);
    expect(client.isConnected()).toBe(false);
  });

  describe("connect", () => {
    it("should create client instance", () => {
      const client = new MCPClient({ serverUrl: "http://localhost:3001/mcp" });
      expect(client).toBeInstanceOf(MCPClient);
      expect(client.isConnected()).toBe(false);
    });
  });

  describe("getTools", () => {
    it("should return empty array when not connected", () => {
      const client = new MCPClient({ serverUrl: "http://localhost:3001/mcp" });
      const tools = client.getTools();
      expect(tools).toEqual([]);
    });
  });

  describe("isConnected", () => {
    it("should return false initially", () => {
      const client = new MCPClient({ serverUrl: "http://localhost:3001/mcp" });
      expect(client.isConnected()).toBe(false);
    });
  });
});