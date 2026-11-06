import { mkdirSync } from "fs";
import { dirname } from "path";
import { fileURLToPath } from "url";
import { ApprovalRequest, ApprovalDecision, RiskLevel, randomUUID, AgentState } from "@nova/shared";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATA_DIR = `${__dirname}/../../../data`;
mkdirSync(DATA_DIR, { recursive: true });

// Database interface for pluggable backends
export interface DatabaseInterface {
  prepare(sql: string): PreparedStatement;
  exec(sql: string): void;
  close(): void;
}

export interface PreparedStatement {
  run(...params: unknown[]): { changes: number; lastInsertRowid: number | bigint };
  get(...params: unknown[]): Record<string, unknown> | undefined;
  all(...params: unknown[]): Record<string, unknown>[];
}

// Factory function to create database instance
export function createDatabase(useMemory: boolean = false): DatabaseInterface {
  if (useMemory) {
    return createMemoryDatabase();
  }
  return createBetterSqlite3Database();
}

function createBetterSqlite3Database(): DatabaseInterface {
  try {
    const Database = require("better-sqlite3");
    const __filename = require("url").fileURLToPath(import.meta.url);
    const __dirname = require("path").dirname(__filename);
    const DATA_DIR = `${__dirname}/../../../data`;
    require("fs").mkdirSync(DATA_DIR, { recursive: true });

    const db = new Database(`${DATA_DIR}/nova.db`);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");

    return {
      prepare: (sql: string) => {
        const stmt = db.prepare(sql);
        return {
          run: (...params: unknown[]) => stmt.run(...params),
          get: (...params: unknown[]) => stmt.get(...params),
          all: (...params: unknown[]) => stmt.all(...params),
        };
      },
      exec: (sql: string) => db.exec(sql),
      close: () => db.close(),
    };
  } catch (e) {
    // Fall back to in-memory database if better-sqlite3 is not available
    return createMemoryDatabase();
  }
}

function createMemoryDatabase(): DatabaseInterface {
  // Use dynamic import to load the InMemoryDatabase from tools package
  const { InMemoryDatabase } = require("@nova/tools");
  const db = new InMemoryDatabase();

  return {
    prepare: (sql: string) => {
      const stmt = db.prepare(sql);
      return {
        run: (...params: unknown[]) => stmt.run(...params),
        get: (...params: unknown[]) => stmt.get(...params),
        all: (...params: unknown[]) => stmt.all(...params),
      };
    },
    exec: (sql: string) => db.exec(sql),
    close: () => db.close(),
  };
}

export interface ApprovalHandler {
  onApprovalRequired: (request: ApprovalRequest) => Promise<ApprovalDecision>;
}

export class ActionPolicy {
  private approvalHandler: ApprovalHandler | null = null;
  private pendingApprovals = new Map<string, { request: ApprovalRequest; resolve: (decision: ApprovalDecision) => void }>();
  private db: DatabaseInterface;

  constructor(useMemory: boolean = true) {
    this.db = createDatabase(useMemory);
  }

  setApprovalHandler(handler: ApprovalHandler): void {
    this.approvalHandler = handler;
  }

  async requestApproval(request: ApprovalRequest): Promise<ApprovalDecision> {
    // Auto-approve non-CONSEQUENTIAL risk without requiring approval handler
    if (request.risk !== RiskLevel.CONSEQUENTIAL) {
      return {
        requestId: request.id,
        approved: true,
        decidedAt: Date.now(),
        decidedBy: "system",
      };
    }

    if (!this.approvalHandler) {
      throw new Error("No approval handler configured");
    }

    const stmt = this.db.prepare(`
      INSERT INTO approvals (id, execution_id, step_id, tool, arguments, risk, reason, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      request.id,
      request.executionId,
      request.stepId,
      request.tool,
      JSON.stringify(request.arguments),
      request.risk,
      request.reason,
      request.createdAt,
      request.expiresAt || null
    );

    return new Promise((resolve) => {
      this.pendingApprovals.set(request.id, { request, resolve });

      this.approvalHandler!.onApprovalRequired(request).then((decision) => {
        this.completeApproval(request.id, decision);
      }).catch((err) => {
        this.completeApproval(request.id, {
          requestId: request.id,
          approved: false,
          decidedAt: Date.now(),
          decidedBy: "system",
        });
      });
    });
  }

  private completeApproval(requestId: string, decision: ApprovalDecision): void {
    const pending = this.pendingApprovals.get(requestId);
    if (!pending) return;

    const stmt = this.db.prepare(`
      UPDATE approvals SET decided_at = ?, approved = ?, decided_by = ? WHERE id = ?
    `);
    stmt.run(decision.decidedAt, decision.approved ? 1 : 0, decision.decidedBy, requestId);

    this.pendingApprovals.delete(requestId);
    pending.resolve(decision);
  }

  async resolveApproval(requestId: string, decision: ApprovalDecision): Promise<void> {
    const pending = this.pendingApprovals.get(requestId);
    if (!pending) return;

    const stmt = this.db.prepare(`
      UPDATE approvals SET decided_at = ?, approved = ?, decided_by = ? WHERE id = ?
    `);
    stmt.run(decision.decidedAt, decision.approved ? 1 : 0, decision.decidedBy, requestId);

    this.pendingApprovals.delete(requestId);
    pending.resolve(decision);
  }

  async getPendingApprovals(): Promise<ApprovalRequest[]> {
    const stmt = this.db.prepare("SELECT * FROM approvals WHERE decided_at IS NULL AND (expires_at IS NULL OR expires_at > ?)");
    const rows = stmt.all(new Date().toISOString()) as any[];
    return rows.map(this.rowToRequest);
  }

  async getApprovalHistory(executionId: string): Promise<ApprovalRequest[]> {
    const stmt = this.db.prepare("SELECT * FROM approvals WHERE execution_id = ? ORDER BY created_at DESC");
    const rows = stmt.all(executionId) as any[];
    return rows.map(this.rowToRequest);
  }

  private rowToRequest(row: any): ApprovalRequest {
    return {
      id: row.id,
      executionId: row.execution_id,
      stepId: row.step_id,
      tool: row.tool,
      arguments: JSON.parse(row.arguments),
      risk: row.risk,
      reason: row.reason,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
    };
  }

  requiresApproval(risk: RiskLevel): boolean {
    return risk === RiskLevel.CONSEQUENTIAL;
  }
}

export const actionPolicy = new ActionPolicy();