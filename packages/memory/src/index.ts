import { mkdirSync } from "fs";
import { dirname } from "path";
import { fileURLToPath } from "url";
import { MemoryRecord, MemoryCategory, randomUUID } from "@nova/shared";
import { createDatabase, DatabaseInterface } from "@nova/policy";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATA_DIR = `${__dirname}/../../../data`;
mkdirSync(DATA_DIR, { recursive: true });

const db = createDatabase(true);

export class MemoryStore {
  private getStmt = db.prepare("SELECT * FROM memories WHERE id = ?");
  private getByUserAndCategoryStmt = db.prepare("SELECT * FROM memories WHERE user_id = ? AND category = ?");
  private getByUserAndKeyStmt = db.prepare("SELECT * FROM memories WHERE user_id = ? AND category = ? AND key = ?");
  private insertStmt = db.prepare("INSERT INTO memories (id, user_id, category, key, value, created_at, updated_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
  private updateStmt = db.prepare("UPDATE memories SET value = ?, updated_at = ?, expires_at = ? WHERE id = ?");
  private deleteStmt = db.prepare("DELETE FROM memories WHERE id = ?");
  private deleteExpiredStmt = db.prepare("DELETE FROM memories WHERE expires_at IS NOT NULL AND expires_at < ?");

  async get(id: string): Promise<MemoryRecord | null> {
    const row = this.getStmt.get(id) as any;
    return row ? this.rowToRecord(row) : null;
  }

  async getByUserAndCategory(userId: string, category: MemoryCategory): Promise<MemoryRecord[]> {
    const rows = this.getByUserAndCategoryStmt.all(userId, category) as any[];
    return rows.map(this.rowToRecord);
  }

  async getByUserAndKey(userId: string, category: MemoryCategory, key: string): Promise<MemoryRecord | null> {
    const row = this.getByUserAndKeyStmt.get(userId, category, key) as any;
    return row ? this.rowToRecord(row) : null;
  }

  async set(record: Omit<MemoryRecord, "id" | "createdAt" | "updatedAt"> & { id?: string }): Promise<MemoryRecord> {
    const now = Date.now();
    const id = record.id || randomUUID();
    const expiresAt = record.expiresAt ? new Date(record.expiresAt).toISOString() : null;

    const existing = this.getStmt.get(id);
    if (existing) {
      this.updateStmt.run(JSON.stringify(record.value), now, expiresAt, id);
    } else {
      this.insertStmt.run(id, record.userId, record.category, record.key, JSON.stringify(record.value), now, now, expiresAt);
    }

    return {
      id,
      userId: record.userId,
      category: record.category,
      key: record.key,
      value: record.value,
      createdAt: existing ? (existing as any).created_at : now,
      updatedAt: now,
      expiresAt: record.expiresAt ? new Date(record.expiresAt).getTime() : null,
    };
  }

  async delete(id: string): Promise<void> {
    this.deleteStmt.run(id);
  }

  async deleteExpired(): Promise<number> {
    const result = this.deleteExpiredStmt.run(new Date().toISOString());
    return result.changes;
  }

  async getRelevant(userId: string, query: string, limit: number = 10): Promise<MemoryRecord[]> {
    const categories: MemoryCategory[] = ["preferences", "routines", "active_goals", "commitments", "recent_actions"];
    const allRecords: MemoryRecord[] = [];

    for (const category of categories) {
      const records = await this.getByUserAndCategory(userId, category);
      allRecords.push(...records);
    }

    return allRecords
      .filter((r) => {
        const searchText = `${r.category} ${r.key} ${JSON.stringify(r.value)}`.toLowerCase();
        return searchText.includes(query.toLowerCase());
      })
      .slice(0, limit);
  }

  private rowToRecord(row: any): MemoryRecord {
    return {
      id: row.id,
      userId: row.user_id,
      category: row.category,
      key: row.key,
      value: JSON.parse(row.value),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      expiresAt: row.expires_at ? new Date(row.expires_at).getTime() : null,
    };
  }
}

export const memoryStore = new MemoryStore();