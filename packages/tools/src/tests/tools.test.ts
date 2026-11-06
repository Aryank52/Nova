import { describe, it, expect } from "vitest";
import { TOOLS, validateTool, GetCalendarContextInputSchema } from "../index.js";

describe("Tools", () => {
  it("should have all 7 tools defined", () => {
    expect(TOOLS).toHaveLength(7);
    const toolNames = TOOLS.map((t: { name: string }) => t.name);
    expect(toolNames).toContain("get_calendar_context");
    expect(toolNames).toContain("get_weather_context");
    expect(toolNames).toContain("get_tasks");
    expect(toolNames).toContain("update_task");
    expect(toolNames).toContain("manage_shopping_list");
    expect(toolNames).toContain("create_reminder");
    expect(toolNames).toContain("get_user_context");
  });

  it("should validate tool schemas", () => {
    TOOLS.forEach((tool: { name: string }) => {
      expect(() => validateTool(tool)).not.toThrow();
    });
  });

  it("should validate get_calendar_context input", () => {
    const input = { userId: "123e4567-e89b-12d3-a456-426614174000" };
    expect(() => GetCalendarContextInputSchema.parse(input)).not.toThrow();
  });

  it("should reject invalid UUID", () => {
    const input = { userId: "invalid-uuid" };
    expect(() => GetCalendarContextInputSchema.parse(input)).toThrow();
  });
});