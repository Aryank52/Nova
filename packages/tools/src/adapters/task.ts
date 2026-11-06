import { TaskAdapter, Task } from "@nova/shared";
import { db } from "../db.js";

export class SqliteTaskAdapter implements TaskAdapter {
  constructor(private db: any) {}

  async getTasks(userId: string, status?: string): Promise<Task[]> {
    let query = `
      SELECT id, user_id, title, description, status, priority, due_date, created_at, updated_at
      FROM tasks
      WHERE user_id = ?
    `;
    const params: (string | number)[] = [userId];

    if (status) {
      query += " AND status = ?";
      params.push(status);
    }

    query += " ORDER BY priority DESC, due_date ASC, created_at ASC";

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as Array<{
      id: string;
      user_id: string;
      title: string;
      description: string | null;
      status: "pending" | "in_progress" | "completed" | "cancelled";
      priority: "low" | "medium" | "high";
      due_date: string | null;
      created_at: string;
      updated_at: string;
    }>;

    return rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      title: row.title,
      description: row.description || undefined,
      status: row.status,
      priority: row.priority,
      dueDate: row.due_date ? new Date(row.due_date) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }));
  }

  async updateTask(taskId: string, updates: Partial<Task>): Promise<Task> {
    const setClause: string[] = [];
    const params: (string | number)[] = [];

    if (updates.title !== undefined) {
      setClause.push("title = ?");
      params.push(updates.title);
    }
    if (updates.description !== undefined) {
      setClause.push("description = ?");
      params.push(updates.description);
    }
    if (updates.status !== undefined) {
      setClause.push("status = ?");
      params.push(updates.status);
    }
    if (updates.priority !== undefined) {
      setClause.push("priority = ?");
      params.push(updates.priority);
    }
    if (updates.dueDate !== undefined) {
      setClause.push("due_date = ?");
      params.push(updates.dueDate.toISOString());
    }

    setClause.push("updated_at = ?");
    params.push(new Date().toISOString());

    params.push(taskId);

    const stmt = this.db.prepare(`
      UPDATE tasks SET ${setClause.join(", ")} WHERE id = ?
    `);
    stmt.run(...params);

    const getStmt = this.db.prepare("SELECT * FROM tasks WHERE id = ?");
    const row = getStmt.get(taskId) as {
      id: string;
      user_id: string;
      title: string;
      description: string | null;
      status: "pending" | "in_progress" | "completed" | "cancelled";
      priority: "low" | "medium" | "high";
      due_date: string | null;
      created_at: string;
      updated_at: string;
    };

    return {
      id: row.id,
      userId: row.user_id,
      title: row.title,
      description: row.description || undefined,
      status: row.status,
      priority: row.priority,
      dueDate: row.due_date ? new Date(row.due_date) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}