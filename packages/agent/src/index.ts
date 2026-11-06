import {
  AgentState,
  Goal,
  Plan,
  PlanStep,
  ToolCall,
  ToolResult,
  Execution,
  ExecutionStep,
  ApprovalRequest,
  AgentEvent,
  AgentEventType,
  MemoryRecord,
  Tool,
  RiskLevel,
  randomUUID,
  AIProvider,
} from "@nova/shared";
import { MCPClient } from "@nova/mcp-client";
import { memoryStore } from "@nova/memory";
import { actionPolicy } from "@nova/policy";
import Database from "better-sqlite3";
import { mkdirSync } from "fs";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATA_DIR = `${__dirname}/../../../data`;
mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(`${DATA_DIR}/nova.db`);

export interface AgentConfig {
  aiProvider: AIProvider;
  mcpClient: MCPClient;
  userId: string;
  maxIterations?: number;
  stepTimeout?: number;
}

export class NovaAgent {
  private state: AgentState = AgentState.IDLE;
  private currentExecution: Execution | null = null;
  private currentPlan: Plan | null = null;
  private currentGoal: Goal | null = null;
  private iterationCount: number = 0;
  private cancelled: boolean = false;

  private readonly maxIterations: number;
  private readonly stepTimeout: number;

  private eventListeners: Array<(event: AgentEvent) => void> = [];

  constructor(private config: AgentConfig) {
    this.maxIterations = config.maxIterations || 20;
    this.stepTimeout = config.stepTimeout || 60000;
  }

  getState(): AgentState {
    return this.state;
  }

  getCurrentExecution(): Execution | null {
    return this.currentExecution;
  }

  onEvent(listener: (event: AgentEvent) => void): () => void {
    this.eventListeners.push(listener);
    return () => {
      const idx = this.eventListeners.indexOf(listener);
      if (idx >= 0) this.eventListeners.splice(idx, 1);
    };
  }

  private emit(event: Omit<AgentEvent, "id" | "executionId" | "timestamp">): void {
    if (!this.currentExecution) return;
    const fullEvent: AgentEvent = {
      id: randomUUID(),
      executionId: this.currentExecution.id,
      timestamp: Date.now(),
      ...event,
    };
    this.saveEvent(fullEvent);
    this.eventListeners.forEach((l) => l(fullEvent));
  }

  private async saveEvent(event: AgentEvent): Promise<void> {
    db.prepare(
      "INSERT INTO agent_events (id, execution_id, type, message, data, timestamp) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(event.id, event.executionId, event.type, event.message, JSON.stringify(event.data || {}), event.timestamp);
  }

  private async saveExecution(execution: Execution): Promise<void> {
    db.prepare(
      `INSERT INTO executions (id, goal_id, plan_id, state, current_step_index, started_at, completed_at, error)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET state=?, current_step_index=?, completed_at=?, error=?`
    ).run(
      execution.id,
      execution.goalId,
      execution.planId,
      execution.state,
      execution.currentStepIndex,
      execution.startedAt,
      execution.completedAt,
      execution.error,
      execution.state,
      execution.currentStepIndex,
      execution.completedAt,
      execution.error
    );
  }

  private async saveExecutionStep(step: ExecutionStep): Promise<void> {
    db.prepare(
      `INSERT INTO execution_steps (id, execution_id, step_id, tool, arguments, result, status, started_at, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET result=?, status=?, completed_at=?`
    ).run(
      step.id,
      step.executionId,
      step.stepId,
      step.tool,
      JSON.stringify(step.arguments),
      step.result ? JSON.stringify(step.result) : null,
      step.status,
      step.startedAt,
      step.completedAt,
      step.result ? JSON.stringify(step.result) : null,
      step.status,
      step.completedAt
    );
  }

  private async saveGoal(goal: Goal): Promise<void> {
    db.prepare(
      `INSERT INTO goals (id, user_id, description, context, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET description=?, context=?, updated_at=?`
    ).run(goal.id, goal.userId, goal.description, JSON.stringify(goal.context || {}), goal.createdAt, goal.updatedAt,
      goal.description, JSON.stringify(goal.context || {}), goal.updatedAt);
  }

  private async savePlan(plan: Plan): Promise<void> {
    // Plan is saved as part of execution
  }

  async executeGoal(userMessage: string): Promise<{ success: boolean; summary: string; executionId: string }> {
    this.cancelled = false;
    this.iterationCount = 0;

    try {
      this.state = AgentState.UNDERSTANDING;
      this.emit({ type: "understanding_started", message: "Understanding your request..." });

      const intent = await this.config.aiProvider.understandIntent({
        userMessage,
        conversationHistory: [],
      });

      this.currentGoal = {
        id: randomUUID(),
        userId: this.config.userId,
        description: intent.goal,
        context: intent.extractedEntities,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await this.saveGoal(this.currentGoal);

      this.emit({ type: "understanding_completed", message: `Goal identified: ${intent.goal}` });

      this.state = AgentState.CONTEXT_LOADING;
      this.emit({ type: "context_loading_started", message: "Loading relevant context..." });

      const context = await this.loadContext();
      const memory = await this.loadMemory();

      this.emit({ type: "context_loading_completed", message: "Context loaded" });

      this.state = AgentState.PLANNING;
      this.emit({ type: "planning_started", message: "Creating execution plan..." });

      const tools = this.config.mcpClient.getTools();
      this.currentPlan = await this.config.aiProvider.generatePlan({
        goal: intent.goal,
        context,
        availableTools: tools,
        memory,
      });

      this.emit({ type: "planning_completed", message: `Plan created with ${this.currentPlan!.steps.length} steps` });

      this.currentExecution = {
        id: randomUUID(),
        goalId: this.currentGoal.id,
        planId: randomUUID(),
        state: AgentState.EXECUTING,
        currentStepIndex: 0,
        startedAt: Date.now(),
        completedAt: null,
        error: null,
      };
      await this.saveExecution(this.currentExecution);

      this.state = AgentState.EXECUTING;
      this.emit({ type: "execution_started", message: "Starting execution..." });

      const result = await this.executePlan();

      this.currentExecution.state = result.success ? AgentState.COMPLETED : AgentState.FAILED;
      this.currentExecution.completedAt = Date.now();
      if (!result.success) this.currentExecution.error = result.summary;
      await this.saveExecution(this.currentExecution);

      this.state = result.success ? AgentState.COMPLETED : AgentState.FAILED;
      this.emit({
        type: result.success ? "execution_completed" : "execution_failed",
        message: result.summary,
      });

      await this.saveMemory(intent.goal, context);

      return { success: result.success, summary: result.summary, executionId: this.currentExecution.id };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      this.state = AgentState.FAILED;
      if (this.currentExecution) {
        this.currentExecution.state = AgentState.FAILED;
        this.currentExecution.completedAt = Date.now();
        this.currentExecution.error = message;
        await this.saveExecution(this.currentExecution);
      }
      this.emit({ type: "execution_failed", message });
      return { success: false, summary: message, executionId: this.currentExecution?.id || "" };
    }
  }

  private async loadContext(): Promise<Record<string, unknown>> {
    const context: Record<string, unknown> = {};

    try {
      const calendarResult = await this.config.mcpClient.callTool({
        id: randomUUID(),
        tool: "get_calendar_context",
        arguments: { userId: this.config.userId },
        risk: RiskLevel.READ_ONLY,
        timestamp: Date.now(),
      });
      if (calendarResult.success) context.calendar = calendarResult.data;
    } catch {}

    try {
      const userContextResult = await this.config.mcpClient.callTool({
        id: randomUUID(),
        tool: "get_user_context",
        arguments: { userId: this.config.userId },
        risk: RiskLevel.READ_ONLY,
        timestamp: Date.now(),
      });
      if (userContextResult.success) context.user = userContextResult.data;
    } catch {}

    try {
      const tasksResult = await this.config.mcpClient.callTool({
        id: randomUUID(),
        tool: "get_tasks",
        arguments: { userId: this.config.userId, status: "pending" },
        risk: RiskLevel.READ_ONLY,
        timestamp: Date.now(),
      });
      if (tasksResult.success) context.tasks = tasksResult.data;
    } catch {}

    return context;
  }

  private async loadMemory(): Promise<MemoryRecord[]> {
    return memoryStore.getByUserAndCategory(this.config.userId, "preferences");
  }

  private async saveMemory(goal: string, context: Record<string, unknown>): Promise<void> {
    await memoryStore.set({
      userId: this.config.userId,
      category: "recent_actions",
      key: `goal_${Date.now()}`,
      value: { goal, context, timestamp: Date.now() },
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).getTime(),
    });
  }

  private async executePlan(): Promise<{ success: boolean; summary: string }> {
    if (!this.currentPlan || !this.currentExecution) {
      return { success: false, summary: "No plan or execution" };
    }

    const results: ToolResult[] = [];

    for (let i = this.currentExecution.currentStepIndex; i < this.currentPlan.steps.length; i++) {
      if (this.cancelled) {
        this.currentExecution.state = AgentState.CANCELLED;
        await this.saveExecution(this.currentExecution);
        return { success: false, summary: "Execution cancelled" };
      }

      if (this.iterationCount >= this.maxIterations) {
        return { success: false, summary: "Max iterations exceeded" };
      }

      const step = this.currentPlan.steps[i];
      this.currentExecution.currentStepIndex = i;
      await this.saveExecution(this.currentExecution);

      this.emit({ type: "step_started", message: `Executing: ${step.description}`, data: { stepId: step.id, tool: step.tool } });

      const stepRecord: ExecutionStep = {
        id: randomUUID(),
        executionId: this.currentExecution.id,
        stepId: step.id,
        tool: step.tool,
        arguments: step.arguments || {},
        result: null,
        status: "running",
        startedAt: Date.now(),
        completedAt: null,
      };
      await this.saveExecutionStep(stepRecord);

      const approvalNeeded = actionPolicy.requiresApproval(step.risk);
      let approved = true;

      if (approvalNeeded) {
        this.state = AgentState.WAITING_FOR_APPROVAL;
        this.emit({ type: "approval_required", message: `Approval required for: ${step.description}`, data: { stepId: step.id, tool: step.tool } });

        const approvalRequest: ApprovalRequest = {
          id: randomUUID(),
          executionId: this.currentExecution.id,
          stepId: step.id,
          tool: step.tool,
          arguments: step.arguments || {},
          risk: step.risk,
          reason: `Step requires ${step.risk} approval: ${step.description}`,
          createdAt: Date.now(),
        };

        const decision = await actionPolicy.requestApproval(approvalRequest);
        approved = decision.approved;

        if (!approved) {
          stepRecord.status = "skipped";
          stepRecord.completedAt = Date.now();
          stepRecord.result = { callId: randomUUID(), success: false, data: null, error: "Approval denied", timestamp: Date.now() };
          await this.saveExecutionStep(stepRecord);
          this.emit({ type: "step_failed", message: `Step skipped: approval denied`, data: { stepId: step.id } });
          continue;
        }

        this.emit({ type: "approval_received", message: `Approval granted for: ${step.description}`, data: { stepId: step.id } });
        this.state = AgentState.EXECUTING;
      }

      const call: ToolCall = {
        id: randomUUID(),
        tool: step.tool,
        arguments: step.arguments || {},
        risk: step.risk,
        timestamp: Date.now(),
      };

      const timeoutPromise = new Promise<ToolResult>((_, reject) =>
        setTimeout(() => reject(new Error("Step timeout")), this.stepTimeout)
      );

      let result: ToolResult;
      try {
        result = await Promise.race([this.config.mcpClient.callTool(call), timeoutPromise]);
      } catch (error) {
        result = {
          callId: call.id,
          success: false,
          data: null,
          error: error instanceof Error ? error.message : "Unknown error",
          timestamp: Date.now(),
        };
      }

      stepRecord.result = result;
      stepRecord.status = result.success ? "completed" : "failed";
      stepRecord.completedAt = Date.now();
      await this.saveExecutionStep(stepRecord);

      results.push(result);

      if (result.success) {
        this.emit({ type: "step_completed", message: `Completed: ${step.description}`, data: { stepId: step.id, result: result.data } });
      } else {
        this.emit({ type: "step_failed", message: `Failed: ${step.description} - ${result.error}`, data: { stepId: step.id, error: result.error } });
      }

      this.iterationCount++;
    }

    this.state = AgentState.VERIFYING;
    this.emit({ type: "verification_started", message: "Verifying results..." });

    const verification = await this.config.aiProvider.verifyResult({
      goal: this.currentGoal!.description,
      plan: this.currentPlan,
      results,
    });

    this.emit({ type: "verification_completed", message: verification.summary });

    return { success: verification.success, summary: verification.summary };
  }

  cancel(): void {
    this.cancelled = true;
  }
}

export function createAgent(config: AgentConfig): NovaAgent {
  return new NovaAgent(config);
}