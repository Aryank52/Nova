import { describe, it, expect, beforeEach, vi } from "vitest";
import { ActionPolicy } from "../index.js";
import { ApprovalRequest, RiskLevel, ApprovalDecision } from "@nova/shared";

describe("ActionPolicy", () => {
  let policy: ActionPolicy;

  beforeEach(() => {
    policy = new ActionPolicy();
  });

  it("should require approval for CONSEQUENTIAL risk", () => {
    expect(policy.requiresApproval(RiskLevel.CONSEQUENTIAL)).toBe(true);
    expect(policy.requiresApproval(RiskLevel.READ_ONLY)).toBe(false);
    expect(policy.requiresApproval(RiskLevel.LOW_RISK_WRITE)).toBe(false);
  });

  it("should call approval handler for CONSEQUENTIAL risk", async () => {
    const mockHandler = vi.fn().mockResolvedValue({
      requestId: "test-id",
      approved: true,
      decidedAt: Date.now(),
      decidedBy: "user",
    } as ApprovalDecision);

    policy.setApprovalHandler({ onApprovalRequired: mockHandler });

    const request: ApprovalRequest = {
      id: "test-id",
      executionId: "exec-id",
      stepId: "step-id",
      tool: "test_tool",
      arguments: {},
      risk: RiskLevel.CONSEQUENTIAL,
      reason: "Test",
      createdAt: Date.now(),
    };

    const decision = await policy.requestApproval(request);

    expect(mockHandler).toHaveBeenCalledWith(request);
    expect(decision.approved).toBe(true);
  });

  it("should auto-approve non-CONSEQUENTIAL risk", async () => {
    const request: ApprovalRequest = {
      id: "test-id",
      executionId: "exec-id",
      stepId: "step-id",
      tool: "test_tool",
      arguments: {},
      risk: RiskLevel.READ_ONLY,
      reason: "Test",
      createdAt: Date.now(),
    };

    const decision = await policy.requestApproval(request);

    expect(decision.approved).toBe(true);
    expect(decision.decidedBy).toBe("system");
  });
});