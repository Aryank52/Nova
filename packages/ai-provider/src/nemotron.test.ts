import { describe, it, expect, vi, beforeEach } from "vitest";
import { NemotronProvider } from "./nemotron.js";
import { AIProviderConfig } from "./provider.js";

describe("NemotronProvider", () => {
  let provider: NemotronProvider;
  const mockConfig: AIProviderConfig = {
    apiKey: "test-key",
    baseUrl: "https://test.api.com/v1",
    model: "test-model",
  };

  beforeEach(() => {
    provider = new NemotronProvider(mockConfig);
    vi.resetAllMocks();
  });

  it("should have correct name", () => {
    expect(provider.name).toBe("Nemotron");
  });

  it("should throw on missing API key when fallbackToMock is false", async () => {
    const { createNemotronProvider } = await import("./nemotron.js");
    expect(() => createNemotronProvider({ ...mockConfig, apiKey: "", fallbackToMock: false })).toThrow(
      "NVIDIA_API_KEY environment variable is required"
    );
  });

  it("should enable mock mode when API key is missing and fallbackToMock is true", async () => {
    const { createNemotronProvider } = await import("./nemotron.js");
    const provider = createNemotronProvider({ ...mockConfig, apiKey: "", fallbackToMock: true });
    expect(provider.isMockMode()).toBe(true);
  });

  describe("makeRequest", () => {
    it("should make request to correct endpoint", async () => {
      const mockResponse = {
        choices: [{ message: { content: "test response" } }],
      };
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await (provider as any).makeRequest([
        { role: "user", content: "test" },
      ]);

      expect(global.fetch).toHaveBeenCalledWith(
        "https://test.api.com/v1/chat/completions",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            Authorization: "Bearer test-key",
          }),
          body: expect.stringContaining("test"),
        })
      );
      expect(result).toBe("test response");
    });

    it("should throw on API error", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        text: () => Promise.resolve("API Error"),
      });

      await expect(
        (provider as any).makeRequest([{ role: "user", content: "test" }])
      ).rejects.toThrow("Nemotron API error");
    });

    it("should handle empty response", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ choices: [] }),
      });

      const result = await (provider as any).makeRequest([
        { role: "user", content: "test" },
      ]);
      expect(result).toBe("");
    });
  });

  describe("generatePlan", () => {
    it("should call makeRequest and parse plan", async () => {
      const mockPlan = {
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
      };

      vi.spyOn(provider as any, "makeRequest").mockResolvedValue(
        JSON.stringify(mockPlan)
      );

      const result = await provider.generatePlan({
        goal: "Test goal",
        context: {},
        availableTools: [],
        memory: [],
      });

      expect(result.goal).toBe("Test goal");
      expect(result.steps).toHaveLength(1);
    });
  });

  describe("understandIntent", () => {
    it("should extract goal from user message", async () => {
      const mockResponse = {
        goal: "Schedule a meeting",
        extractedEntities: { time: "tomorrow", people: ["John"] },
        confidence: 0.9,
      };

      vi.spyOn(provider as any, "makeRequest").mockResolvedValue(
        JSON.stringify(mockResponse)
      );

      const result = await provider.understandIntent({
        userMessage: "Schedule a meeting with John tomorrow",
        conversationHistory: [],
      });

      expect(result.goal).toBe("Schedule a meeting");
      expect(result.extractedEntities).toEqual({
        time: "tomorrow",
        people: ["John"],
      });
      expect(result.confidence).toBe(0.9);
    });
  });

  describe("verifyResult", () => {
    it("should verify successful execution", async () => {
      const mockResponse = {
        success: true,
        summary: "All steps completed successfully",
        missingSteps: [],
      };

      vi.spyOn(provider as any, "makeRequest").mockResolvedValue(
        JSON.stringify(mockResponse)
      );

      const result = await provider.verifyResult({
        goal: "Test goal",
        plan: { goal: "Test goal", steps: [], createdAt: 0, updatedAt: 0 },
        results: [{ success: true, data: {}, error: null, timestamp: 0, callId: "test-call-id" }],
      });

      expect(result.success).toBe(true);
      expect(result.summary).toBe("All steps completed successfully");
      expect(result.missingSteps).toEqual([]);
    });
  });
});