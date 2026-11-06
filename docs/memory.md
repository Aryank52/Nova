# NOVA Memory System

## Overview

NOVA implements a two-tier memory architecture for context-aware operation:

1. **Session Memory** - In-memory, per-execution context
2. **Persistent Memory** - SQLite-backed, structured categories

## Memory Categories

| Category | Description | Retention | Example Keys |
|----------|-------------|-----------|--------------|
| `preferences` | User settings and preferences | Permanent | `theme`, `dietaryRestrictions`, `language` |
| `routines` | Recurring patterns and habits | Long-term | `morningRoutine`, `weeklyReview` |
| `active_goals` | Currently tracked objectives | Until completed | `projectX`, `vacationPlanning` |
| `commitments` | Promises made to others | Until fulfilled | `meetingWithClient`, `callMom` |
| `recent_actions` | History of recent executions | 30 days (TTL) | `goal_2024-01-15`, `execution_abc123` |

## Data Model

```typescript
interface MemoryRecord {
  id: string (UUID);
  userId: string (UUID);
  category: MemoryCategory;
  key: string;
  value: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date | null;
}

type MemoryCategory = 
  | "preferences"
  | "routines"
  | "active_goals"
  | "commitments"
  | "recent_actions";
```

## Storage

- **Database**: SQLite (`data/nova.db`)
- **Table**: `memories`
- **Indexes**: `user_id + category`, `user_id + category + key`
- **TTL Support**: `expiresAt` column with cleanup job

## API

```typescript
// Store a memory record
await memoryStore.set({
  userId: "user_001",
  category: "preferences",
  key: "theme",
  value: { theme: "dark", fontSize: 14 },
  expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year
});

// Retrieve by ID
const record = await memoryStore.get("record-id");

// Get all memories for user + category
const prefs = await memoryStore.getByUserAndCategory("user_001", "preferences");

// Get specific memory by user + category + key
const theme = await memoryStore.getByUserAndKey("user_001", "preferences", "theme");

// Delete
await memoryStore.delete("record-id");

// Find relevant memories (query-based retrieval)
const relevant = await memoryStore.getRelevant("user_001", "theme", 10);
```

## Retrieval Strategy

Memory retrieval is **query-based**, not exhaustive:

1. Agent extracts keywords from goal/context
2. `getRelevant(userId, query, limit)` searches across all categories
3. Returns top N matching records (default: 10)
4. Only relevant context passed to AI provider

This prevents context window bloat and improves relevance.

## Usage in Agent Flow

```
User Goal → Understanding → Context Loading
                    ↓
            Load Relevant Memory
                    ↓
            Plan Generation (includes memory)
                    ↓
            Execution
                    ↓
            Save to recent_actions
                    ↓
            Update active_goals/commitments
```

## Seeding

Default memory seeded via `packages/tools/src/seed.ts`:

```typescript
// User preferences
{ category: "preferences", key: "dietary", value: { restrictions: ["vegetarian"] } }
```

## Cleanup

- Expired records cleaned via `memoryStore.deleteExpired()`
- Run periodically or on startup
- `recent_actions` auto-expire after 30 days

## Extending Categories

To add a new memory category:

1. Add to `MemoryCategorySchema` in `@nova/shared/src/index.ts`
2. Update `MemoryRecordSchema` 
3. Add migration for `memories` table CHECK constraint
4. Update retrieval logic in `MemoryStore.getRelevant()`
5. Add tests