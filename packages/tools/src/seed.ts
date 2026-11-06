import { db } from "./db.js";
import { randomUUID } from "crypto";

function seed() {
  console.log("Seeding database...");

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      user_id TEXT PRIMARY KEY,
      name TEXT,
      preferences TEXT,
      timezone TEXT DEFAULT 'UTC',
      location TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS calendar_events (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      location TEXT,
      attendees TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(user_id)
    );

    CREATE TABLE IF NOT EXISTS weather_forecasts (
      id TEXT PRIMARY KEY,
      location TEXT NOT NULL,
      date TEXT NOT NULL,
      temperature_min REAL NOT NULL,
      temperature_max REAL NOT NULL,
      temperature_unit TEXT NOT NULL CHECK (temperature_unit IN ('C', 'F')),
      conditions TEXT NOT NULL,
      precipitation REAL NOT NULL,
      humidity REAL NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(location, date)
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
      priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
      due_date TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(user_id)
    );

    CREATE TABLE IF NOT EXISTS shopping_lists (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(user_id)
    );

    CREATE TABLE IF NOT EXISTS shopping_items (
      id TEXT PRIMARY KEY,
      list_id TEXT NOT NULL,
      name TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit TEXT,
      category TEXT,
      purchased INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (list_id) REFERENCES shopping_lists(id)
    );

    CREATE TABLE IF NOT EXISTS reminders (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      due_date TEXT NOT NULL,
      recurrence TEXT NOT NULL DEFAULT 'none' CHECK (recurrence IN ('none', 'daily', 'weekly', 'monthly')),
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(user_id)
    );

    CREATE TABLE IF NOT EXISTS memories (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      category TEXT NOT NULL CHECK (category IN ('preferences', 'routines', 'active_goals', 'commitments', 'recent_actions')),
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      expires_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(user_id)
    );

    CREATE TABLE IF NOT EXISTS goals (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      description TEXT NOT NULL,
      context TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(user_id)
    );

    CREATE TABLE IF NOT EXISTS executions (
      id TEXT PRIMARY KEY,
      goal_id TEXT NOT NULL,
      plan_id TEXT NOT NULL,
      state TEXT NOT NULL,
      current_step_index INTEGER NOT NULL DEFAULT 0,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      error TEXT,
      FOREIGN KEY (goal_id) REFERENCES goals(id)
    );

    CREATE TABLE IF NOT EXISTS execution_steps (
      id TEXT PRIMARY KEY,
      execution_id TEXT NOT NULL,
      step_id TEXT NOT NULL,
      tool TEXT NOT NULL,
      arguments TEXT NOT NULL,
      result TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'skipped')),
      started_at TEXT,
      completed_at TEXT,
      FOREIGN KEY (execution_id) REFERENCES executions(id)
    );

    CREATE TABLE IF NOT EXISTS approvals (
      id TEXT PRIMARY KEY,
      execution_id TEXT NOT NULL,
      step_id TEXT NOT NULL,
      tool TEXT NOT NULL,
      arguments TEXT NOT NULL,
      risk TEXT NOT NULL,
      reason TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT,
      decided_at TEXT,
      approved INTEGER,
      decided_by TEXT,
      FOREIGN KEY (execution_id) REFERENCES executions(id)
    );

    CREATE TABLE IF NOT EXISTS agent_events (
      id TEXT PRIMARY KEY,
      execution_id TEXT NOT NULL,
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      data TEXT,
      timestamp TEXT NOT NULL,
      FOREIGN KEY (execution_id) REFERENCES executions(id)
    );
  `);

  const userId = "user_001";
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  tomorrow.setHours(18, 0, 0, 0);

  const userStmt = db.prepare("SELECT user_id FROM users WHERE user_id = ?");
  if (!userStmt.get(userId)) {
    db.prepare(
      "INSERT INTO users (user_id, name, preferences, timezone, location) VALUES (?, ?, ?, ?, ?)"
    ).run(userId, "Alex", JSON.stringify({ dietaryRestrictions: ["vegetarian"] }), "America/Los_Angeles", "San Francisco, CA");
  }

  const calStmt = db.prepare("SELECT COUNT(*) as count FROM calendar_events WHERE user_id = ?");
  if ((calStmt.get(userId) as { count: number }).count === 0) {
    const insertCal = db.prepare(
      "INSERT INTO calendar_events (id, user_id, title, start_time, end_time, location, attendees) VALUES (?, ?, ?, ?, ?, ?, ?)"
    );
    insertCal.run(randomUUID(), userId, "Team standup", new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(), new Date(now.getTime() + 2.5 * 60 * 60 * 1000).toISOString(), "Conference Room A", JSON.stringify(["team"]));
    insertCal.run(randomUUID(), userId, "Dinner with guests", tomorrow.toISOString(), new Date(tomorrow.getTime() + 3 * 60 * 60 * 1000).toISOString(), "Home", JSON.stringify(["guest1", "guest2", "guest3", "guest4", "guest5", "guest6"]));
  }

  const weatherStmt = db.prepare("SELECT COUNT(*) as count FROM weather_forecasts WHERE location = ?");
  if ((weatherStmt.get("San Francisco, CA") as { count: number }).count === 0) {
    const insertWeather = db.prepare(
      "INSERT INTO weather_forecasts (id, location, date, temperature_min, temperature_max, temperature_unit, conditions, precipitation, humidity) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );
    const tomorrowStr = tomorrow.toISOString().split("T")[0];
    insertWeather.run(randomUUID(), "San Francisco, CA", tomorrowStr, 15, 22, "C", "Partly cloudy", 10, 65);
  }

  const taskStmt = db.prepare("SELECT COUNT(*) as count FROM tasks WHERE user_id = ?");
  if ((taskStmt.get(userId) as { count: number }).count === 0) {
    const insertTask = db.prepare(
      "INSERT INTO tasks (id, user_id, title, description, status, priority, due_date) VALUES (?, ?, ?, ?, ?, ?, ?)"
    );
    insertTask.run(randomUUID(), userId, "Clean living room", "Vacuum and dust before guests arrive", "pending", "high", tomorrow.toISOString());
    insertTask.run(randomUUID(), userId, "Prepare guest bedrooms", "Fresh linens and towels", "pending", "high", tomorrow.toISOString());
    insertTask.run(randomUUID(), userId, "Buy groceries", "Ingredients for dinner", "pending", "high", tomorrow.toISOString());
    insertTask.run(randomUUID(), userId, "Set up outdoor seating", "Arrange chairs and lighting", "pending", "medium", tomorrow.toISOString());
  }

  const shoppingStmt = db.prepare("SELECT COUNT(*) as count FROM shopping_lists WHERE user_id = ?");
  if ((shoppingStmt.get(userId) as { count: number }).count === 0) {
    const listId = randomUUID();
    const nowStr = new Date().toISOString();
    db.prepare("INSERT INTO shopping_lists (id, user_id, updated_at) VALUES (?, ?, ?)").run(listId, userId, nowStr);

    const insertItem = db.prepare(
      "INSERT INTO shopping_items (id, list_id, name, quantity, unit, category, purchased) VALUES (?, ?, ?, ?, ?, ?, ?)"
    );
    insertItem.run(randomUUID(), listId, "Chicken breasts", 2, "kg", "Meat", 0);
    insertItem.run(randomUUID(), listId, "Mixed vegetables", 1, "bag", "Produce", 0);
    insertItem.run(randomUUID(), listId, "Rice", 1, "kg", "Pantry", 0);
    insertItem.run(randomUUID(), listId, "Wine (red)", 2, "bottles", "Beverages", 0);
    insertItem.run(randomUUID(), listId, "Dessert", 1, "cake", "Bakery", 0);
  }

  console.log("Database seeded successfully!");
}

seed();