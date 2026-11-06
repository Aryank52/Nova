import { mkdirSync } from "fs";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATA_DIR = `${__dirname}/../../../data`;
mkdirSync(DATA_DIR, { recursive: true });

interface PreparedStatement {
  all(...params: unknown[]): Record<string, unknown>[];
  get(...params: unknown[]): Record<string, unknown> | undefined;
  run(...params: unknown[]): { changes: number; lastInsertRowid: number | bigint };
}

interface DatabaseInterface {
  prepare(sql: string): PreparedStatement;
  exec(sql: string): void;
  close(): void;
}

interface InMemoryTable {
  columns: string[];
  rows: Record<string, unknown>[];
}

interface WhereParam {
  column: string;
  index: number;
}

class InMemoryDatabase implements DatabaseInterface {
  private tables = new Map<string, { columns: string[]; rows: Record<string, unknown>[] }>();
  private pragmas = new Map<string, string>();

  constructor() {
    this.initializeSchema();
    this.seedData();
  }

  private initializeSchema() {
    this.createTable("users", ["user_id", "name", "preferences", "timezone", "location", "created_at"]);
    this.createTable("calendar_events", ["id", "user_id", "title", "start_time", "end_time", "location", "attendees", "created_at"]);
    this.createTable("weather_forecasts", ["id", "location", "date", "temperature_min", "temperature_max", "temperature_unit", "conditions", "precipitation", "humidity", "created_at"]);
    this.createTable("tasks", ["id", "user_id", "title", "description", "status", "priority", "due_date", "created_at", "updated_at"]);
    this.createTable("shopping_lists", ["id", "user_id", "updated_at"]);
    this.createTable("shopping_items", ["id", "list_id", "name", "quantity", "unit", "category", "purchased"]);
    this.createTable("reminders", ["id", "user_id", "title", "description", "due_date", "recurrence", "created_at"]);
    this.createTable("memories", ["id", "user_id", "category", "key", "value", "created_at", "updated_at", "expires_at"]);
    this.createTable("goals", ["id", "user_id", "description", "context", "created_at", "updated_at"]);
    this.createTable("executions", ["id", "goal_id", "plan_id", "state", "current_step_index", "started_at", "completed_at", "error"]);
    this.createTable("execution_steps", ["id", "execution_id", "step_id", "tool", "arguments", "result", "status", "started_at", "completed_at"]);
    this.createTable("approvals", ["id", "execution_id", "step_id", "tool", "arguments", "risk", "reason", "created_at", "expires_at", "decided_at", "approved", "decided_by"]);
    this.createTable("agent_events", ["id", "execution_id", "type", "message", "data", "timestamp"]);
  }

  private createTable(name: string, columns: string[]) {
    this.tables.set(name, { columns, rows: [] });
  }

  private seedData() {
    const now = new Date();
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    tomorrow.setHours(18, 0, 0, 0);

    this.insert("users", {
      user_id: "user_001",
      name: "Alex",
      preferences: JSON.stringify({ dietaryRestrictions: ["vegetarian"] }),
      timezone: "America/Los_Angeles",
      location: "San Francisco, CA",
      created_at: now.toISOString(),
    });

    this.insert("calendar_events", {
      id: "cal_1",
      user_id: "user_001",
      title: "Team standup",
      start_time: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      end_time: new Date(Date.now() + 2.5 * 60 * 60 * 1000).toISOString(),
      location: "Conference Room A",
      attendees: JSON.stringify(["team"]),
      created_at: now.toISOString(),
    });
    this.insert("calendar_events", {
      id: "cal_2",
      user_id: "user_001",
      title: "Dinner with guests",
      start_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      end_time: new Date(Date.now() + 27 * 60 * 60 * 1000).toISOString(),
      location: "Home",
      attendees: JSON.stringify(["guest1", "guest2", "guest3", "guest4", "guest5", "guest6"]),
      created_at: new Date().toISOString(),
    });

    this.insert("weather_forecasts", {
      id: "w_1",
      location: "San Francisco, CA",
      date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      temperature_min: 15,
      temperature_max: 22,
      temperature_unit: "C",
      conditions: "Partly cloudy",
      precipitation: 10,
      humidity: 65,
      created_at: new Date().toISOString(),
    });

    this.insert("tasks", {
      id: "task_1",
      user_id: "user_001",
      title: "Clean living room",
      description: "Vacuum and dust before guests arrive",
      status: "pending",
      priority: "high",
      due_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    this.insert("tasks", {
      id: "task_2",
      user_id: "user_001",
      title: "Prepare guest bedrooms",
      description: "Fresh linens and towels",
      status: "pending",
      priority: "high",
      due_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    this.insert("tasks", {
      id: "task_3",
      user_id: "user_001",
      title: "Buy groceries",
      description: "Ingredients for dinner",
      status: "pending",
      priority: "high",
      due_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    this.insert("tasks", {
      id: "task_4",
      user_id: "user_001",
      title: "Set up outdoor seating",
      description: "Arrange chairs and lighting",
      status: "pending",
      priority: "medium",
      due_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const listId = "shopping_1";
    this.insert("shopping_lists", {
      id: listId,
      user_id: "user_001",
      updated_at: new Date().toISOString(),
    });

    this.insert("shopping_items", { id: "si_1", list_id: listId, name: "Chicken breasts", quantity: 2, unit: "kg", category: "Meat", purchased: 0 });
    this.insert("shopping_items", { id: "si_2", list_id: listId, name: "Mixed vegetables", quantity: 1, unit: "bag", category: "Produce", purchased: 0 });
    this.insert("shopping_items", { id: "si_3", list_id: listId, name: "Rice", quantity: 1, unit: "kg", category: "Pantry", purchased: 0 });
    this.insert("shopping_items", { id: "si_4", list_id: listId, name: "Wine (red)", quantity: 2, unit: "bottles", category: "Beverages", purchased: 0 });
    this.insert("shopping_items", { id: "si_5", list_id: listId, name: "Dessert", quantity: 1, unit: "cake", category: "Bakery", purchased: 0 });

    console.log("[InMemoryDatabase] Initialized with seed data");
  }

  pragma(key: string, value?: string): any {
    if (value !== undefined) {
      this.pragmas.set(key, value);
      return;
    }
    return this.pragmas.get(key);
  }

  prepare(sql: string): PreparedStatement {
    const normalized = sql.trim().toLowerCase();

    if (normalized.startsWith("select")) {
      return this.prepareSelect(sql);
    }
    if (normalized.startsWith("insert")) {
      return this.prepareInsert(sql);
    }
    if (normalized.startsWith("update")) {
      return this.prepareUpdate(sql);
    }
    if (normalized.startsWith("delete")) {
      return this.prepareDelete(sql);
    }
    if (normalized.startsWith("create table")) {
      return this.prepareCreateTable(sql);
    }
    if (normalized.startsWith("pragma")) {
      return this.preparePragma(sql);
    }

    return {
      all: () => [],
      get: () => undefined,
      run: () => ({ changes: 0, lastInsertRowid: 0 }),
    };
  }

  prepareSelect(sql: string): PreparedStatement {
    const match = sql.match(/select\s+(.+)\s+from\s+(\w+)(?:\s+where\s+(.+))?(?:\s+order\s+by\s+(.+))?(?:\s+limit\s+(\d+))?/i);
    if (!match) return { all: () => [], get: () => undefined, run: () => ({ changes: 0, lastInsertRowid: 0 }) };

    const columnsStr = match[1];
    const tableName = match[2];
    const whereClause = match[3];
    const orderBy = match[4];
    const limitStr = match[5];
    const table = this.tables.get(tableName);
    if (!table) return { all: () => [], get: () => undefined, run: () => ({ changes: 0, lastInsertRowid: 0 }) };

    // Pre-parse WHERE clause to identify parameter positions
    const whereParams: WhereParam[] = [];
    if (whereClause) {
      const parts = whereClause.split(/(\s+(?:and|or)\s+)/i);
      let paramIndex = 0;
      for (const part of parts) {
        const trimmed = part.trim();
        if (!trimmed || /^(and|or)$/i.test(trimmed)) continue;
        const match = trimmed.match(/^(\w+)\s*=\s*\?$/);
        if (match) {
          whereParams.push({ column: match[1], index: paramIndex++ });
        }
      }
    }

    const self = this;

    function executeSelect(...params: unknown[]) {
      let rows = self.tables.get(tableName)?.rows || [];

      if (whereClause && whereParams.length > 0) {
        rows = rows.filter((row) => {
          return whereParams.every((wp) => {
            const paramValue = params[wp.index];
            return row[wp.column] === paramValue;
          });
        });
      }

      if (orderBy) {
        const parts = orderBy.trim().split(/\s+/);
        const col = parts[0];
        const dir = parts[1];
        const descending = dir?.toLowerCase() === "desc";
        rows = [...rows].sort((a, b) => {
          const av = a[col] as string | number;
          const bv = b[col] as string | number;
          if (av < bv) return descending ? 1 : -1;
          if (av > bv) return descending ? -1 : 1;
          return 0;
        });
      }

      if (limitStr) {
        rows = rows.slice(0, parseInt(limitStr, 10));
      }

      if (columnsStr.trim() !== "*") {
        const columns = columnsStr.split(",").map((c) => c.trim());
        rows = rows.map((row) => {
          const selected: Record<string, unknown> = {};
          for (let i = 0; i < columns.length; i++) {
            selected[columns[i]] = row[columns[i]];
          }
          return selected;
        });
      }

      return rows;
    }

    return {
      all: (...params: unknown[]) => executeSelect(...params),
      get: (...params: unknown[]) => {
        const rows = executeSelect(...params);
        return rows[0];
      },
      run: () => ({ changes: 0, lastInsertRowid: 0 }),
    };
  }

  prepareInsert(sql: string): PreparedStatement {
    const match = sql.match(/insert\s+into\s+(\w+)\s*\(([^)]+)\)\s+values\s*\(([^)]+)\)/i);
    if (!match) return { all: () => [], get: () => undefined, run: () => ({ changes: 0, lastInsertRowid: 0 }) };

    const tableName = match[1];
    const columnsStr = match[2];
    const valuesStr = match[3];
    const columns = columnsStr.split(",").map((c) => c.trim());
    const valuePlaceholders = this.parseValues(valuesStr);

    const self = this;

    return {
      all: () => [],
      get: () => undefined,
      run: (...params: unknown[]) => {
        const row: Record<string, unknown> = {};
        columns.forEach((col, i) => {
          const paramProvided = i < params.length && params[i] !== undefined;
          const val = paramProvided ? params[i] : valuePlaceholders[i];
          row[col] = val === '?' ? null : val;
        });
        self.insert(tableName, row);
        return { changes: 1, lastInsertRowid: 1 };
      },
    };
  }

  parseValues(valuesStr: string): unknown[] {
    return valuesStr.split(",").map((v) => {
      v = v.trim();
      if (v === "?") return '?';
      if (v.startsWith("'") && v.endsWith("'")) return v.slice(1, -1);
      if (v === "null") return null;
      const num = Number(v);
      return isNaN(num) ? v : num;
    });
  }

  prepareUpdate(sql: string): PreparedStatement {
    const match = sql.match(/update\s+(\w+)\s+set\s+([^where]+)(?:\s+where\s+(.+))?/i);
    if (!match) return { all: () => [], get: () => undefined, run: () => ({ changes: 0, lastInsertRowid: 0 }) };

    const tableName = match[1];
    const setClause = match[2];
    const whereClause = match[3];
    const sets = setClause.split(",").map((s) => s.trim());
    const assignments = sets.map((s) => {
      const parts = s.split("=").map((s) => s.trim());
      return { col: parts[0], val: parts[1] };
    });

    const whereParams: WhereParam[] = [];
    if (whereClause) {
      const parts = whereClause.split(/(\s+(?:and|or)\s+)/i);
      let paramIndex = 0;
      for (const part of parts) {
        const trimmed = part.trim();
        if (!trimmed || /^(and|or)$/i.test(trimmed)) continue;
        const match = trimmed.match(/^(\w+)\s*=\s*\?$/);
        if (match) {
          whereParams.push({ column: match[1], index: paramIndex++ });
        }
      }
    }

    const self = this;

    return {
      all: () => [],
      get: () => undefined,
      run: (...params: unknown[]) => {
        const table = self.tables.get(tableName);
        if (!table) return { changes: 0, lastInsertRowid: 0 };

        let rows = table.rows;
        if (whereClause && whereParams.length > 0) {
          rows = rows.filter((row) => {
            return whereParams.every((wp) => {
              const paramValue = params[wp.index];
              return row[wp.column] === paramValue;
            });
          });
        }

        let changes = 0;
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          assignments.forEach((a, i) => {
            const val = a.val === "?" ? params[i] : a.val;
            if (val !== "?") {
              row[a.col] = val;
            }
          });
          changes++;
        }
        return { changes: changes, lastInsertRowid: 0 };
      },
    };
  }

  prepareDelete(sql: string): PreparedStatement {
    const match = sql.match(/delete\s+from\s+(\w+)(?:\s+where\s+(.+))?/i);
    if (!match) return { all: () => [], get: () => undefined, run: () => ({ changes: 0, lastInsertRowid: 0 }) };

    const tableName = match[1];
    const whereClause = match[2];

    const whereParams: WhereParam[] = [];
    if (whereClause) {
      const parts = whereClause.split(/(\s+(?:and|or)\s+)/i);
      let paramIndex = 0;
      for (const part of parts) {
        const trimmed = part.trim();
        if (!trimmed || /^(and|or)$/i.test(trimmed)) continue;
        const match = trimmed.match(/^(\w+)\s*=\s*\?$/);
        if (match) {
          whereParams.push({ column: match[1], index: paramIndex++ });
        }
      }
    }

    const self = this;

    return {
      all: () => [],
      get: () => undefined,
      run: (...params: unknown[]) => {
        const table = self.tables.get(tableName);
        if (!table) return { changes: 0, lastInsertRowid: 0 };

        let rows = table.rows;
        if (whereClause && whereParams.length > 0) {
          rows = rows.filter((row) => {
            return whereParams.every((wp) => {
              const paramValue = params[wp.index];
              return row[wp.column] === paramValue;
            });
          });
        }

        const originalLength = table.rows.length;
        table.rows = table.rows.filter((row) => !rows.includes(row));
        return { changes: originalLength - table.rows.length, lastInsertRowid: 0 };
      },
    };
  }

  prepareCreateTable(sql: string): PreparedStatement {
    return { all: () => [], get: () => undefined, run: () => ({ changes: 0, lastInsertRowid: 0 }) };
  }

  preparePragma(sql: string): PreparedStatement {
    return { all: () => [], get: () => undefined, run: () => ({ changes: 0, lastInsertRowid: 0 }) };
  }

  private insert(tableName: string, row: Record<string, unknown>) {
    const table = this.tables.get(tableName);
    if (!table) return;
    table.rows.push(row);
  }

  exec(sql: string): void {
    const statements = sql.split(";").filter((s) => s.trim());
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      const prepared = this.prepare(stmt);
      if (prepared.run) {
        prepared.run();
      }
    }
  }

  close(): void {
    // No-op for in-memory database
  }
}

const database = new InMemoryDatabase();

export const db = database as any;
export { InMemoryDatabase };
export type { DatabaseInterface, PreparedStatement };