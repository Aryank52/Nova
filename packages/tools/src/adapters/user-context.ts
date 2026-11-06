import { UserContextAdapter, UserContext } from "@nova/shared";
import { db } from "../db.js";

export class SqliteUserContextAdapter implements UserContextAdapter {
  constructor(private db: any) {}

  async getContext(userId: string): Promise<UserContext> {
    const stmt = this.db.prepare(
      "SELECT user_id, name, preferences, timezone, location FROM users WHERE user_id = ?"
    );
    const row = stmt.get(userId) as
      | {
          user_id: string;
          name: string | null;
          preferences: string | null;
          timezone: string;
          location: string | null;
        }
      | undefined;

    if (!row) {
      return {
        userId,
        preferences: {},
        timezone: "UTC",
      };
    }

    return {
      userId: row.user_id,
      name: row.name || undefined,
      preferences: row.preferences ? JSON.parse(row.preferences) : {},
      timezone: row.timezone,
      location: row.location || undefined,
    };
  }
}