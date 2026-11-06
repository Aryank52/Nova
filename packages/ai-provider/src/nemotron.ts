import { BaseAIProvider, AIProviderConfig } from "./provider.js";
import { Plan, PlanGenerationInput, IntentUnderstandingInput, IntentUnderstandingOutput, VerificationInput, VerificationOutput, Tool, MemoryRecord } from "@nova/shared";
import { PlanSchema } from "@nova/shared";

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableStatusCodes: number[];
}

export interface NemotronProviderConfig extends AIProviderConfig {
  retryConfig?: Partial<RetryConfig>;
  fallbackToMock?: boolean;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  retryableStatusCodes: [429, 500, 502, 503, 504],
};

export class NemotronProvider extends BaseAIProvider {
  readonly name = "Nemotron";

  private config: NemotronProviderConfig;
  private retryConfig: RetryConfig;
  private fallbackToMock: boolean;
  private mockMode: boolean = false;

  constructor(config: NemotronProviderConfig) {
    super();
    this.config = config;
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config.retryConfig };
    this.fallbackToMock = config.fallbackToMock ?? false;
    
    // Enable mock mode immediately if fallbackToMock is true and no API key provided
    if (this.fallbackToMock && (!config.apiKey || config.apiKey === "")) {
      this.mockMode = true;
    }
  }

  enableMockMode(): void {
    this.mockMode = true;
  }

  disableMockMode(): void {
    this.mockMode = false;
  }

  isMockMode(): boolean {
    return this.mockMode;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private calculateBackoff(attempt: number): number {
    const { baseDelayMs, maxDelayMs, backoffMultiplier } = this.retryConfig;
    const delay = Math.min(
      baseDelayMs * Math.pow(backoffMultiplier, attempt),
      maxDelayMs
    );
    const jitter = delay * 0.25 * (Math.random() * 2 - 1);
    return Math.floor(delay + jitter);
  }

  private isRetryableError(error: unknown): { retryable: boolean; statusCode?: number } {
    if (error instanceof Response) {
      const statusCode = error.status;
      return {
        retryable: this.retryConfig.retryableStatusCodes.includes(statusCode),
        statusCode,
      };
    }
    if (error instanceof Error && 'status' in error) {
      const statusCode = (error as { status: number }).status;
      return {
        retryable: this.retryConfig.retryableStatusCodes.includes(statusCode),
        statusCode,
      };
    }
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return { retryable: true };
    }
    return { retryable: false };
  }

  protected async makeRequest(messages: Array<{ role: string; content: string }>): Promise<string> {
    if (this.mockMode) {
      return this.getMockResponse();
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${this.config.apiKey}`,
          },
          body: JSON.stringify({
            model: this.config.model,
            messages,
            temperature: 0.1,
            max_tokens: 4096,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          const error = new Error(`Nemotron API error: ${response.status} - ${errorText}`);
          (error as Error & { status: number }).status = response.status;

          const { retryable, statusCode } = this.isRetryableError(response);

          if (retryable && attempt < this.retryConfig.maxRetries) {
            const delay = this.calculateBackoff(attempt);
            console.warn(
              `[NemotronProvider] Attempt ${attempt + 1}/${this.retryConfig.maxRetries + 1} failed with status ${statusCode}. ` +
              `Retrying in ${delay}ms...`
            );
            await this.sleep(this.calculateBackoff(attempt));
            continue;
          }

          if (this.fallbackToMock) {
            console.warn(
              `[NemotronProvider] All retries exhausted or non-retryable error (status: ${statusCode}). ` +
              `Falling back to mock mode.`
            );
            this.mockMode = true;
            return this.getMockResponse();
          }

          throw error;
        }

        const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
        return data.choices?.[0]?.message?.content || "";
      } catch (error: unknown) {
        lastError = error as Error;

        const { retryable } = this.isRetryableError(error);
        const errorMessage = error instanceof Error ? error.message : String(error);

        if (retryable && attempt < this.retryConfig.maxRetries) {
          const delay = this.calculateBackoff(attempt);
          console.warn(
            `[NemotronProvider] Attempt ${attempt + 1}/${this.retryConfig.maxRetries + 1} failed: ${errorMessage}. ` +
            `Retrying in ${delay}ms...`
          );
          await this.sleep(this.calculateBackoff(attempt));
          continue;
        }

        if (this.fallbackToMock) {
          console.warn(
            `[NemotronProvider] All retries exhausted or non-retryable error. ` +
            `Falling back to mock mode.`
          );
          this.mockMode = true;
          return this.getMockResponse();
        }

        throw error;
      }
    }

    if (this.fallbackToMock) {
      console.warn(
        `[NemotronProvider] All ${this.retryConfig.maxRetries + 1} attempts failed. Falling back to mock mode.`
      );
      this.mockMode = true;
      return this.getMockResponse();
    }

    throw lastError || new Error("NemotronProvider: All retries exhausted");
  }

  private getMockResponse(): string {
    return JSON.stringify({
      goal: "Mock goal",
      steps: [
        {
          id: "mock_step_1",
          description: "Mock step 1: Check calendar",
          tool: "get_calendar_context",
          risk: "READ_ONLY",
          arguments: {},
          dependsOn: []
        },
        {
          id: "mock_step_2",
          description: "Mock step 2: Check weather",
          tool: "get_weather_context",
          risk: "READ_ONLY",
          arguments: {},
          dependsOn: []
        },
        {
          id: "mock_step_3",
          description: "Mock step 3: Check tasks",
          tool: "get_tasks",
          risk: "READ_ONLY",
          arguments: {},
          dependsOn: []
        }
      ],
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
  }

  private buildSystemPrompt(tools: Tool[]): string {
    const toolDescriptions = tools.map((t) => `- ${t.name}: ${t.description} (risk: ${t.risk})`).join("\n");

    return `You are NOVA, a context-aware goal-to-action agent. Your job is to convert user goals into structured execution plans.

Available tools:
${toolDescriptions}

Rules:
1. Only use tools from the available list
2. Create plans with minimal steps
3. Each step must have a clear description and tool
4. Risk levels: READ_ONLY (safe), LOW_RISK_WRITE (modifies local data), CONSEQUENTIAL (requires approval)
4. Output valid JSON only - no markdown, no explanations
5. Validate all tool arguments against schemas`;
  }

  async generatePlan(input: PlanGenerationInput): Promise<Plan> {
    const systemPrompt = this.buildSystemPrompt(input.availableTools);
    const contextSummary = JSON.stringify(input.context, null, 2);
    const memorySummary = input.memory.map((m: MemoryRecord) => `${m.category}:${m.key}=${JSON.stringify(m.value)}`).join("; ");

    const userPrompt = `Goal: ${input.goal}

Context:
${contextSummary}

Memory:
${memorySummary}

Generate a structured plan as JSON matching this schema:
{
  "goal": "string",
  "steps": [
    {
      "id": "string",
      "description": "string",
      "tool": "string",
      "risk": "READ_ONLY|LOW_RISK_WRITE|CONSEQUENTIAL",
      "arguments": {},
      "dependsOn": []
    }
  ],
  "createdAt": number,
  "updatedAt": number
}`;

    const response = await this.makeRequest([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ]);

    const parsed = JSON.parse(response);
    return PlanSchema.parse({
      ...parsed,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }

  async understandIntent(input: IntentUnderstandingInput): Promise<IntentUnderstandingOutput> {
    const systemPrompt = `You are NOVA's intent understanding module. Extract the user's goal and key entities from their message.

Output JSON only:
{
  "goal": "string",
  "extractedEntities": {},
  "confidence": number
}`;

    const history = input.conversationHistory.map((m: { role: string; content: string }) => `${m.role}: ${m.content}`).join("\n");

    const userPrompt = `Conversation history:
${history}

Current message: ${input.userMessage}

Extract the primary goal and entities.`;

    const response = await this.makeRequest([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ]);

    return JSON.parse(response);
  }

  async verifyResult(input: VerificationInput): Promise<VerificationOutput> {
    const systemPrompt = `You are NOVA's verification module. Determine if the goal was achieved based on the plan and tool results.

Output JSON only:
{
  "success": boolean,
  "summary": "string",
  "missingSteps": []
}`;

    const resultsSummary = input.results.map((r: { success: boolean; error: string | null; data?: unknown }, i: number) =>
      `Step ${i + 1}: ${r.success ? "SUCCESS" : "FAILED"} - ${r.error || JSON.stringify(r.data)}`
    ).join("\n");

    const userPrompt = `Goal: ${input.goal}

Plan:
${JSON.stringify(input.plan, null, 2)}

Results:
${resultsSummary}

Verify if the goal was achieved.`;

    const response = await this.makeRequest([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ]);

    return JSON.parse(response);
  }
}

export function createNemotronProvider(config?: Partial<NemotronProviderConfig>): NemotronProvider {
  const apiKey = process.env.NVIDIA_API_KEY;
  const baseUrl = process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1";
  const model = process.env.NVIDIA_MODEL || "nvidia/nemotron-3-super-120b-a12b";

  if (!apiKey && !config?.fallbackToMock) {
    throw new Error("NVIDIA_API_KEY environment variable is required (or set fallbackToMock: true)");
  }

  return new NemotronProvider({
    apiKey: apiKey ?? "",
    baseUrl,
    model,
    ...config
  });
}