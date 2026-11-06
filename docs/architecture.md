# NOVA Architecture

## Overview

NOVA is a context-aware goal-to-action AI agent that transforms high-level natural language goals into executable multi-step workflows. The system consists of a Next.js web interface, a Node.js backend with an agent orchestration layer, an AI provider abstraction, a real MCP client/server implementation, and SQLite persistence.

## Logical Layers

```
┌─────────────────────────────────────────────────────────────┐
│                    Browser (Next.js)                        │
├─────────────────────────────────────────────────────────────┤
│                      NOVA API / Backend                     │
├─────────────────────────────────────────────────────────────┤
│                      Agent Orchestration                    │
├─────────────────────────────────────────────────────────────┤
│                   AI Provider Abstraction                   │
│  ┌──────────────────┐    ┌──────────────────┐             │
│  │  AIProvider      │    │  NemotronProvider │             │
│  │  (interface)     │◄───│  (implementation) │             │
│  └──────────────────┘    └──────────────────┘             │
├─────────────────────────────────────────────────────────────┤
│                    Context / Memory System                  │
├─────────────────────────────────────────────────────────────┤
│                      MCP Client                             │
├─────────────────────────────────────────────────────────────┤
│              Streamable HTTP Transport                      │
├─────────────────────────────────────────────────────────────┤
│                      MCP Server                             │
├─────────────────────────────────────────────────────────────┤
│                    Tool Adapters                            │
│  Calendar │ Weather │ Tasks │ Shopping │ Reminders │ User │
├─────────────────────────────────────────────────────────────┤
│                    SQLite Persistence                       │
└─────────────────────────────────────────────────────────────┘
```

## Agent State Machine

The agent operates as a bounded execution loop with explicit states:

```
IDLE
  ▼
UNDERSTANDING ──► CONTEXT_LOADING ──► PLANNING ──► EXECUTING
                            ▲              │              │
                            │              ▼              ▼
                            │         WAITING_FOR_APPROVAL  │
                            │              │              │
                            │              ▼              │
                            │         VERIFYING ◄─────────┘
                            │              │
                            ▼              ▼
                        COMPLETED ◄── FAILED ◄── CANCELLED
```

### State Responsibilities

- **IDLE**: Initial state, waiting for user input
- **UNDERSTANDING**: Parse user message, extract goal and entities
- **CONTEXT_LOADING**: Retrieve calendar, weather, tasks, user context
- **PLANNING**: Generate structured plan via AI provider
- **EXECUTING**: Execute plan steps sequentially via MCP
- **WAITING_FOR_APPROVAL**: Pause for user approval on consequential actions
- **VERIFYING**: Validate results against original goal
- **COMPLETED**: Goal achieved successfully
- **FAILED**: Execution failed or goal not achieved
- **CANCELLED**: User or system cancelled execution

## AI Provider Abstraction

```typescript
interface AIProvider {
  readonly name: string;
  generatePlan(input: PlanGenerationInput): Promise<Plan>;
  understandIntent(input: IntentUnderstandingInput): Promise<IntentUnderstandingOutput>;
  verifyResult(input: VerificationInput): Promise<VerificationOutput>;
}
```

The abstraction allows swapping AI providers (Nemotron, OpenAI, Anthropic, etc.) without modifying the agent logic. Provider-specific code lives only in `@nova/ai-provider`.

## MCP Implementation

### Streamable HTTP Transport

NOVA uses the official MCP TypeScript SDK with Streamable HTTP transport (MCP spec 2025-11-25). The server exposes:

- `initialize` - Protocol initialization
- `tools/list` - Discover available tools
- `tools/call` - Execute tool with arguments

### Tool Definitions

| Tool | Risk Level | Description |
|------|------------|-------------|
| `get_calendar_context` | READ_ONLY | Retrieve calendar events |
| `get_weather_context` | READ_ONLY | Retrieve weather forecast |
| `get_tasks` | READ_ONLY | Retrieve pending tasks |
| `update_task` | LOW_RISK_WRITE | Update task properties |
| `manage_shopping_list` | LOW_RISK_WRITE | Add/remove/update shopping items |
| `create_reminder` | LOW_RISK_WRITE | Create new reminder |
| `get_user_context` | READ_ONLY | Retrieve user preferences |

## Tool Adapters

Each tool uses an adapter pattern for data access:

```typescript
interface CalendarAdapter { getContext(userId, dateRange): Promise<CalendarContext> }
interface WeatherAdapter { getContext(location, date): Promise<WeatherContext> }
interface TaskAdapter { getTasks(userId, status): Promise<Task[]>; updateTask(id, updates): Promise<Task> }
interface ShoppingAdapter { getList(userId): Promise<ShoppingList>; manageList(userId, action, items): Promise<ShoppingList> }
interface ReminderAdapter { createReminder(userId, input): Promise<Reminder> }
interface UserContextAdapter { getContext(userId): Promise<UserContext> }
```

Adapters are implemented against SQLite for the prototype but can be swapped for real services (Google Calendar, OpenWeather, etc.).

## Memory System

Two-tier memory architecture:

1. **Session Memory**: In-memory, per-execution context
2. **Persistent Memory** (SQLite): Structured categories
   - `preferences`: User settings (theme, dietary restrictions, etc.)
   - `routines`: Recurring patterns (morning coffee, weekly review)
   - `active_goals`: Currently tracked objectives
   - `commitments`: Promises made to others
   - `recent_actions`: History of recent executions

Memory retrieval is query-based, fetching only relevant records.

## Action Policy & Approval

Central `ActionPolicy` service enforces risk-based approval:

- **READ_ONLY**: Auto-approved
- **LOW_RISK_WRITE**: Auto-approved
- **CONSEQUENTIAL**: Requires explicit user approval

Approval flow:
```
Agent ──► ApprovalRequired ──► UI ──► User Decision ──► Backend Validation ──► Agent Resumes/Cancels
```

Approval decisions are persisted and cannot be bypassed by the UI.

## Database Schema

```sql
users: user_id, name, preferences, timezone, location
calendar_events: id, user_id, title, start_time, end_time, location, attendees
weather_forecasts: id, location, date, temperature_min, temperature_max, temperature_unit, conditions, precipitation, humidity
tasks: id, user_id, title, description, status, priority, due_date
shopping_lists: id, user_id, updated_at
shopping_items: id, list_id, name, quantity, unit, category, purchased
reminders: id, user_id, title, description, due_date, recurrence
memories: id, user_id, category, key, value, expires_at
goals: id, user_id, description, context
executions: id, goal_id, plan_id, state, current_step_index, started_at, completed_at, error
execution_steps: id, execution_id, step_id, tool, arguments, result, status, started_at, completed_at
approvals: id, execution_id, step_id, tool, arguments, risk, reason, created_at, expires_at, decided_at, approved, decided_by
agent_events: id, execution_id, type, message, data, timestamp
```

## Security

- NVIDIA_API_KEY never exposed to browser
- Environment variables via `.env` (not committed)
- `.env.example` provided for configuration
- All tool inputs validated with Zod schemas
- Model output validated before execution
- Tool allowlist enforced
- No arbitrary shell command execution
- Server-side approval enforcement
- No secrets returned from tools
- Secrets excluded from logs

## Failure Handling

| Failure Type | Handling |
|-------------|----------|
| Invalid input | Zod validation, clear error messages |
| Malformed tool args | Schema validation, step marked failed |
| Malformed tool results | Try-catch, structured error result |
| MCP connection failure | Retry with backoff, fallback to cached tools |
| MCP timeout | Configurable timeout, step marked failed |
| AI API timeout | Request timeout, retry logic |
| AI rate limiting | Exponential backoff, user notification |
| Model failure | Fallback to simpler plan, error reporting |
| Rejected approval | Step skipped, execution continues |
| Cancelled execution | State set to CANCELLED, cleanup |
| Database failure | Transaction rollback, error propagation |

## Extensibility Points

1. **New AI Provider**: Implement `AIProvider` interface
2. **New Tool**: Add to MCP server, create adapter, register in tools package
3. **New Adapter**: Implement adapter interface, swap in DI
4. **New Memory Category**: Add to `MemoryCategory` enum, update retrieval
5. **New Risk Level**: Extend `RiskLevel` enum, update policy