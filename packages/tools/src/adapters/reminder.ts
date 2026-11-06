import { ReminderAdapter, CreateReminderInput, Reminder } from "@nova/shared";
import { db } from "../db.js";
import { randomUUID } from "crypto";

export class SqliteReminderAdapter implements ReminderAdapter {
  constructor(private db: any) {}

  async createReminder(userId: string, input: CreateReminderInput): Promise<Reminder> {
    const id = randomUUID();
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO reminders (id, user_id, title, description, due_date, recurrence, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, userId, input.title, input.description || null, input.dueDate.toISOString(), input.recurrence || "none", now);

    return {
      id,
      userId,
      title: input.title,
      description: input.description,
      dueDate: input.dueDate,
      recurrence: input.recurrence || "none",
      createdAt: new Date(now),
    };
  }
}