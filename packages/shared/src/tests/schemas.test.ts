import { describe, it, expect } from "vitest";
import {
  AgentState,
  RiskLevel,
  PlanSchema,
  GoalSchema,
  ToolCallSchema,
  ToolResultSchema,
  ApprovalRequestSchema,
  MemoryRecordSchema,
  AgentEventSchema,
} from "../index.js";

describe("Shared Schemas", () => {
  it("should have correct AgentState values", () => {
    expect(AgentState.IDLE).toBe("IDLE");
    expect(AgentState.UNDERSTANDING).toBe("UNDERSTANDING");
    expect(AgentState.CONTEXT_LOADING).toBe("CONTEXT_LOADING");
    expect(AgentState.PLANNING).toBe("PLANNING");
    expect(AgentState.EXECUTING).toBe("EXECUTING");
    expect(AgentState.WAITING_FOR_APPROVAL).toBe("WAITING_FOR_APPROVAL");
    expect(AgentState.VERIFYING).toBe("VERIFYING");
    expect(AgentState.COMPLETED).toBe("COMPLETED");
    expect(AgentState.FAILED).toBe("FAILED");
    expect(AgentState.CANCELLED).toBe("CANCELLED");
  });

  it("should have correct RiskLevel values", () => {
    expect(RiskLevel.READ_ONLY).toBe("READ_ONLY");
    expect(RiskLevel.LOW_RISK_WRITE).toBe("LOW_RISK_WRITE");
    expect(RiskLevel.CONSEQUENTIAL).toBe("CONSEQUENTIAL");
  });

  it("should validate a valid plan", () => {
    const plan = {
      goal: "Test goal",
      steps: [
        {
          id: "step_1",
          description: "Check calendar",
          tool: "get_calendar_context",
          risk: RiskLevel.READ_ONLY,
          arguments: {},
        },
      ],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    expect(() => PlanSchema.parse(plan)).not.toThrow();
  });

  it("should validate a valid goal", () => {
    const goal = {
      id: "123e4567-e89b-12d3-a456-426614174000",
      userId: "123e4567-e89b-12d3-a456-426614174001",
      description: "Test goal",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    expect(() => GoalSchema.parse(goal)).not.toThrow();
  });

  it("should validate a tool call", () => {
    const call = {
      id: "123e4567-e89b-12d3-a456-426614174000",
      tool: "get_calendar_context",
      arguments: { userId: "123e4567-e89b-12d3-a456-426614174001" },
      risk: RiskLevel.READ_ONLY,
      timestamp: Date.now(),
    };
    expect(() => ToolCallSchema.parse(call)).not.toThrow();
  });

  it("should validate a tool result", () => {
    const result = {
      callId: "123e4567-e89b-12d3-a456-426614174000",
      success: true,
      data: { test: "data" },
      error: null,
      timestamp: Date.now(),
    };
    expect(() => ToolResultSchema.parse(result)).not.toThrow();
  });

  it("should validate an approval request", () => {
    const request = {
      id: "123e4567-e89b-12d3-a456-426614174000",
      executionId: "123e4567-e89b-12d3-a456-426614174001",
      stepId: "step_1",
      tool: "create_reminder",
      arguments: { title: "Test" },
      risk: RiskLevel.CONSEQUENTIAL,
      reason: "Needs approval",
      createdAt: Date.now(),
    };
    expect(() => ApprovalRequestSchema.parse(request)).not.toThrow();
  });

  it("should validate a memory record", () => {
    const memory = {
      id: "123e4567-e89b-12d3-a456-426614174000",
      userId: "123e4567-e89b-12d3-a456-426614174001",
      category: "preferences",
      key: "theme",
      value: { theme: "dark" },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      expiresAt: null,
    };
    expect(() => MemoryRecordSchema.parse(memory)).not.toThrow();
  });

  it("should validate an agent event", () => {
    const event = {
      id: "123e4567-e89b-12d3-a456-426614174000",
      executionId: "123e4567-e89b-12d3-a456-426614174001",
      type: "execution_started",
      message: "Starting execution",
      timestamp: Date.now(),
    };
    expect(() => AgentEventSchema.parse(event)).not.toThrow();
  });
});