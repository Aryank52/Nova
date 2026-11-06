import { describe, it, expect, vi, beforeEach } from "vitest";
import { TOOLS } from "@nova/tools";

describe("MCP Server", () => {
  it("should have all 7 tools registered", () => {
    expect(TOOLS).toHaveLength(7);
    const toolNames = TOOLS.map((t) => t.name);
    expect(toolNames).toContain("get_calendar_context");
    expect(toolNames).toContain("get_weather_context");
    expect(toolNames).toContain("get_tasks");
    expect(toolNames).toContain("update_task");
    expect(toolNames).toContain("manage_shopping_list");
    expect(toolNames).toContain("create_reminder");
    expect(toolNames).toContain("get_user_context");
  });

  it("should have correct risk levels for each tool", () => {
    const riskLevels = TOOLS.reduce((acc, tool) => {
      acc[tool.name] = tool.risk;
      return acc;
    }, {} as Record<string, string>);

    expect(riskLevels["get_calendar_context"]).toBe("READ_ONLY");
    expect(riskLevels["get_weather_context"]).toBe("READ_ONLY");
    expect(riskLevels["get_tasks"]).toBe("READ_ONLY");
    expect(riskLevels["get_user_context"]).toBe("READ_ONLY");
    expect(riskLevels["update_task"]).toBe("LOW_RISK_WRITE");
    expect(riskLevels["manage_shopping_list"]).toBe("LOW_RISK_WRITE");
    expect(riskLevels["create_reminder"]).toBe("LOW_RISK_WRITE");
  });

  it("should have valid tool schemas", () => {
    TOOLS.forEach((tool) => {
      expect(tool.name).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(tool.inputSchema).toBeDefined();
      expect(tool.outputSchema).toBeDefined();
      expect(["READ_ONLY", "LOW_RISK_WRITE", "CONSEQUENTIAL"]).toContain(
        tool.risk
      );
    });
  });
});