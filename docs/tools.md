# NOVA Tools Reference

## Overview

NOVA includes 7 built-in tools covering calendar, weather, tasks, shopping, reminders, and user context. Each tool has a strict input/output schema validated with Zod, a risk classification, and deterministic behavior.

## Tool Specifications

### 1. get_calendar_context

**Risk Level**: READ_ONLY

**Description**: Retrieve calendar events for a user within a date range.

**Input Schema**:
```typescript
{
  userId: string (UUID),
  dateRange?: {
    start: string (ISO 8601),
    end: string (ISO 8601)
  }
}
```

**Output Schema**:
```typescript
{
  events: [
    {
      id: string,
      title: string,
      start: string (ISO 8601),
      end: string (ISO 8601),
      location?: string,
      attendees?: string[]
    }
  ],
  dateRange: {
    start: string (ISO 8601),
    end: string (ISO 8601)
  }
}
```

**Adapter**: `SqliteCalendarAdapter` → `calendar_events` table

---

### 2. get_weather_context

**Risk Level**: READ_ONLY

**Description**: Retrieve weather forecast for a location and date.

**Input Schema**:
```typescript
{
  location: string,
  date?: string (ISO 8601)
}
```

**Output Schema**:
```typescript
{
  location: string,
  date: string (ISO 8601),
  forecast: {
    temperature: { min: number, max: number, unit: "C" | "F" },
    conditions: string,
    precipitation: number (percentage),
    humidity: number (percentage)
  }
}
```

**Adapter**: `SqliteWeatherAdapter` → `weather_forecasts` table

---

### 3. get_tasks

**Risk Level**: READ_ONLY

**Description**: Retrieve tasks for a user, optionally filtered by status.

**Input Schema**:
```typescript
{
  userId: string (UUID),
  status?: "pending" | "in_progress" | "completed" | "cancelled"
}
```

**Output Schema**:
```typescript
{
  tasks: [
    {
      id: string,
      userId: string (UUID),
      title: string,
      description?: string,
      status: "pending" | "in_progress" | "completed" | "cancelled",
      priority: "low" | "medium" | "high",
      dueDate?: string (ISO 8601),
      createdAt: string (ISO 8601),
      updatedAt: string (ISO 8601)
    }
  ]
}
```

**Adapter**: `SqliteTaskAdapter` → `tasks` table

---

### 4. update_task

**Risk Level**: LOW_RISK_WRITE

**Description**: Update a task's properties (status, priority, due date, etc.).

**Input Schema**:
```typescript
{
  taskId: string (UUID),
  updates: {
    title?: string,
    description?: string,
    status?: "pending" | "in_progress" | "completed" | "cancelled",
    priority?: "low" | "medium" | "high",
    dueDate?: string (ISO 8601)
  }
}
```

**Output Schema**:
```typescript
{
  task: {
    id: string,
    userId: string (UUID),
    title: string,
    description?: string,
    status: "pending" | "in_progress" | "completed" | "cancelled",
    priority: "low" | "medium" | "high",
    dueDate?: string (ISO 8601),
    createdAt: string (ISO 8601),
    updatedAt: string (ISO 8601)
  }
}
```

**Adapter**: `SqliteTaskAdapter` → `tasks` table

---

### 5. manage_shopping_list

**Risk Level**: LOW_RISK_WRITE

**Description**: Add, remove, or update items in a user's shopping list.

**Input Schema**:
```typescript
{
  userId: string (UUID),
  action: "add" | "remove" | "update",
  items: [
    {
      id?: string,
      name: string,
      quantity: number,
      unit?: string,
      category?: string,
      purchased?: boolean
    }
  ]
}
```

**Output Schema**:
```typescript
{
  list: {
    id: string,
    userId: string (UUID),
    items: [
      {
        id: string,
        name: string,
        quantity: number,
        unit?: string,
        category?: string,
        purchased: boolean
      }
    ],
    updatedAt: string (ISO 8601)
  }
}
```

**Adapter**: `SqliteShoppingAdapter` → `shopping_lists` + `shopping_items` tables

---

### 6. create_reminder

**Risk Level**: LOW_RISK_WRITE

**Description**: Create a new reminder for a user.

**Input Schema**:
```typescript
{
  userId: string (UUID),
  title: string,
  description?: string,
  dueDate: string (ISO 8601),
  recurrence?: "none" | "daily" | "weekly" | "monthly"
}
```

**Output Schema**:
```typescript
{
  reminder: {
    id: string,
    userId: string (UUID),
    title: string,
    description?: string,
    dueDate: string (ISO 8601),
    recurrence: "none" | "daily" | "weekly" | "monthly",
    createdAt: string (ISO 8601)
  }
}
```

**Adapter**: `SqliteReminderAdapter` → `reminders` table

---

### 7. get_user_context

**Risk Level**: READ_ONLY

**Description**: Retrieve user profile and preferences.

**Input Schema**:
```typescript
{
  userId: string (UUID)
}
```

**Output Schema**:
```typescript
{
  userId: string (UUID),
  name?: string,
  preferences: Record<string, unknown>,
  timezone: string,
  location?: string
}
```

**Adapter**: `SqliteUserContextAdapter` → `users` table

---

## Risk Classification

| Level | Tools | Approval Required |
|-------|-------|-------------------|
| READ_ONLY | get_calendar_context, get_weather_context, get_tasks, get_user_context | No |
| LOW_RISK_WRITE | update_task, manage_shopping_list, create_reminder | No |
| CONSEQUENTIAL | (future: purchases, external comms, destructive ops) | Yes |

---

## Adapter Pattern

Each tool uses an adapter interface for data access:

```typescript
// Calendar
interface CalendarAdapter {
  getContext(userId: string, dateRange?: { start: Date; end: Date }): Promise<CalendarContext>
}

// Weather
interface WeatherAdapter {
  getContext(location: string, date?: Date): Promise<WeatherContext>
}

// Tasks
interface TaskAdapter {
  getTasks(userId: string, status?: string): Promise<Task[]>
  updateTask(taskId: string, updates: Partial<Task>): Promise<Task>
}

// Shopping
interface ShoppingAdapter {
  getList(userId: string): Promise<ShoppingList>
  manageList(userId: string, action: "add" | "remove" | "update", items: ShoppingItem[]): Promise<ShoppingList>
}

// Reminders
interface ReminderAdapter {
  createReminder(userId: string, input: CreateReminderInput): Promise<Reminder>
}

// User Context
interface UserContextAdapter {
  getContext(userId: string): Promise<UserContext>
}
```

Current implementation: `Sqlite*Adapter` classes in `@nova/tools/src/adapters/`

---

## Testing

```bash
# Run unit tests for tools
cd packages/tools
npm run test:unit

# Run all unit tests
npm run test:unit
```

---

## Extending Tools

To add a new tool:

1. Define schemas in `@nova/tools/src/tools/index.ts`
2. Implement logic in `@nova/tools/src/tools/implementations.ts`
3. Add adapter if needed in `@nova/tools/src/adapters/`
4. Register in MCP server (`@nova/mcp-server/src/index.ts`)
5. Add unit tests
6. Update documentation