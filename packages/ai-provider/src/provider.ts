import { AIProvider, PlanGenerationInput, IntentUnderstandingInput, IntentUnderstandingOutput, VerificationInput, VerificationOutput, Tool, MemoryRecord, Plan } from "@nova/shared";

export interface AIProviderConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export abstract class BaseAIProvider implements AIProvider {
  abstract readonly name: string;

  abstract generatePlan(input: PlanGenerationInput): Promise<Plan>;
  abstract understandIntent(input: IntentUnderstandingInput): Promise<IntentUnderstandingOutput>;
  abstract verifyResult(input: VerificationInput): Promise<VerificationOutput>;

  protected abstract makeRequest(messages: Array<{ role: string; content: string }>): Promise<string>;
}