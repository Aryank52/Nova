import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { AgentState, RiskLevel, AgentEvent } from "@nova/shared";

let NovaAgent: any;

describe("NovaAgent", () => {
  let agent: any;
  let mockMCPClient: any;
  let mockAIProvider: any;
  let mockActionPolicy: any;

  beforeAll(async () => {
    const { NovaAgent: AgentClass } = await import("./index.js");
    NovaAgent = AgentClass;
  });

  beforeEach(() => {
    vi.resetAllMocks();

    mockMCPClient = {
      connect: vi.fn().mockResolvedValue(undefined),
      getTools: vi.fn().mockReturnValue([]),
      callTool: vi.fn().mockResolvedValue({
        callId: "call-123",
        success: true,
        data: { events: [], dateRange: { start: "", end: "" } },
        error: null,
        timestamp: Date.now(),
      }),
    };

    mockAIProvider = {
      understandIntent: vi.fn().mockResolvedValue({
        goal: "Test goal",
        extractedEntities: {},
        confidence: 0.9,
      }),
      generatePlan: vi.fn().mockResolvedValue({
        goal: "Test goal",
        steps: [
          {
            id: "step_1",
            description: "Test step",
            tool: "get_user_context",
            risk: "READ_ONLY",
            arguments: {},
          },
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
      verifyResult: vi.fn().mockResolvedValue({
        success: true,
        summary: "Test completed",
        missingSteps: [],
      }),
    };

    mockActionPolicy = {
      requiresApproval: vi.fn().mockReturnValue(false),
      requestApproval: vi.fn().mockResolvedValue({
        requestId: "req-123",
        approved: true,
        decidedAt: Date.now(),
        decidedBy: "system",
      }),
    };

    const mockMemoryStore = {
      getByUserAndCategory: vi.fn().mockResolvedValue([]),
      getByUserAndKey: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue({}),
      getRelevant: vi.fn().mockResolvedValue([]),
    };

    vi.doMock("@nova/memory", () => ({
      memoryStore: mockMemoryStore,
    }));

    vi.doMock("@nova/policy", () => ({
      actionPolicy: mockActionPolicy,
    }));

    vi.doMock("@nova/ai-provider", () => ({
      createNemotronProvider: () => mockAIProvider,
    }));

    agent = new NovaAgent({
      aiProvider: mockAIProvider,
      mcpClient: mockMCPClient,
      userId: "user_001",
      maxIterations: 10,
      stepTimeout: 30000,
    });
  });

  it("should create agent with correct initial state", () => {
    expect(agent.getState()).toBe("IDLE");
    expect(agent.getCurrentExecution()).toBeNull();
  });

  describe("executeGoal", () => {
    it("should execute goal and return success", async () => {
      const result = await agent.executeGoal("Test goal");

      expect(result.success).toBe(true);
      expect(result.executionId).toBeDefined();
      expect(agent.getState()).toBe("COMPLETED");
    });

    it("should return failure on error", async () => {
      const mockAIProvider = {
        understandIntent: vi.fn().mockRejectedValue(new Error("AI error")),
        generatePlan: vi.fn(),
        verifyResult: vi.fn(),
      };

      const testAgent = new NovaAgent({
        aiProvider: mockAIProvider,
        mcpClient: mockMCPClient,
        userId: "user_001",
      });

      const result = await testAgent.executeGoal("Test goal");

      expect(result.success).toBe(false);
      expect(result.summary).toContain("AI error");
      expect(testAgent.getState()).toBe("FAILED");
    });

    it("should go through all states in order", async () => {
      const states: string[] = [];
      const unsubscribe = agent.onEvent((event: AgentEvent) => {
        states.push(event.type);
      });

      await agent.executeGoal("Test goal");
      unsubscribe();

      expect(states).toContain("understanding_started");
      expect(states).toContain("understanding_completed");
      expect(states).toContain("planning_started");
      expect(states).toContain("planning_completed");
      expect(states).toContain("execution_started");
      expect(states).toContain("execution_completed");
    });
  });

  describe("cancel", () => {
    it("should cancel execution", async () => {
      const longRunningProvider = {
        understandIntent: vi.fn().mockResolvedValue({
          goal: "Long running goal",
          extractedEntities: {},
          confidence: 0.9,
        }),
        generatePlan: vi.fn().mockResolvedValue({
          goal: "Long running goal",
          steps: Array(20)
            .fill(0)
            .map((_, i) => ({
              id: `step_${i}`,
              description: `Step ${i}`,
              tool: "get_user_context",
              risk: "READ_ONLY",
              arguments: {},
            })),
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }),
        verifyResult: vi.fn().mockResolvedValue({
          success: true,
          summary: "Test completed",
          missingSteps: [],
        }),
      };

      const testAgent = new NovaAgent({
        aiProvider: longRunningProvider,
        mcpClient: mockMCPClient,
        userId: "user_001",
        maxIterations: 5,
      });

      const executionPromise = testAgent.executeGoal("Long running goal");
      await new Promise((resolve) => setTimeout(resolve, 100));
      testAgent.cancel();

      await expect(executionPromise).resolves.toMatchObject({
        success: false,
        summary: expect.stringContaining("cancelled"),
      });
    });
  });

  describe("event emission", () => {
    it("should emit events during execution", async () => {
      const events: string[] = [];
      const unsubscribe = agent.onEvent((event: AgentEvent) => {
        events.push(event.type);
      });

      await agent.executeGoal("Test goal");

      expect(events).toContain("understanding_started");
      expect(events).toContain("understanding_completed");
      expect(events).toContain("context_loading_started");
      expect(events).toContain("context_loading_completed");
      expect(events).toContain("planning_started");
      expect(events).toContain("planning_completed");
      expect(events).toContain("execution_started");
      expect(events).toContain("execution_completed");
    });
  });
});