# NOVA — Context-Aware Goal-to-Action Agent

> **NOVA** transforms high-level natural language goals into executable multi-step workflows with real MCP tool integration, context awareness, and approval-based safety.

## Quick Start

### Prerequisites

- Node.js 20+
- npm 10+
- NVIDIA API Key (for Nemotron provider)

### Installation

```bash
# Clone and install
git clone <repo>
cd nova
npm install

# Configure environment
cp .env.example .env
# Edit .env with your NVIDIA_API_KEY

# Seed database
npm run db:seed

# Start MCP server (terminal 1)
npm run mcp:server

# Start web app (terminal 2)
cd apps/web
npm run dev
```

Open http://localhost:3000

## Example Goal

> "I have six guests coming tomorrow at 6 PM. Get everything ready."

NOVA will:
1. 🧠 **Understand** the goal
2. 📅 **Load context** (calendar, weather, tasks, user preferences)
3. 📋 **Create plan** with structured steps
4. ⚡ **Execute** via MCP tools
5. ⚠️ **Request approval** for consequential actions
6. ✅ **Verify** results
7. 📝 **Summarize** outcome

## Architecture

```
Browser (Next.js)
    ▼
NOVA API / Backend
    ▼
Agent Orchestration (State Machine)
    ▼
AI Provider Abstraction (Nemotron)
    ▼
MCP Client → Streamable HTTP → MCP Server
    ▼
Tool Adapters (Calendar, Weather, Tasks, Shopping, Reminders, User)
    ▼
SQLite Persistence
```

## Core Packages

| Package | Description |
|---------|-------------|
| `@nova/shared` | Types, schemas, domain models |
| `@nova/agent` | Agent orchestration loop |
| `@nova/ai-provider` | AI provider abstraction + Nemotron |
| `@nova/mcp-client` | MCP Streamable HTTP client |
| `@nova/mcp-server` | MCP Streamable HTTP server |
| `@nova/tools` | 7 tools + SQLite adapters |
| `@nova/memory` | Two-tier memory system |
| `@nova/policy` | Action policy & approval engine |
| `@nova/web` | Next.js web interface |

## Available Tools

| Tool | Risk | Description |
|------|------|-------------|
| `get_calendar_context` | READ_ONLY | Check calendar events |
| `get_weather_context` | READ_ONLY | Check weather forecast |
| `get_tasks` | READ_ONLY | View pending tasks |
| `update_task` | LOW_RISK_WRITE | Update task status |
| `manage_shopping_list` | LOW_RISK_WRITE | Add/remove/update shopping items |
| `create_reminder` | LOW_RISK_WRITE | Create reminders |
| `get_user_context` | READ_ONLY | Get user preferences |

## Memory Categories

- `preferences` — User settings (theme, dietary restrictions)
- `routines` — Recurring patterns (morning coffee, weekly review)
- `active_goals` — Currently tracked objectives
- `commitments` — Promises made to others
- `recent_actions` — History of recent executions (30-day TTL)

## Agent States

```
IDLE → UNDERSTANDING → CONTEXT_LOADING → PLANNING → EXECUTING
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

## Security

- NVIDIA_API_KEY never exposed to browser
- All tool inputs validated with Zod
- Model output validated before execution
- Server-side approval enforcement
- No arbitrary code execution
- Local SQLite storage

## Development

```bash
# Build all packages
npm run build

# Run unit tests
npm run test:unit

# Lint
npm run lint

# Seed database
npm run db:seed
```

## Documentation

- [Architecture](docs/architecture.md)
- [MCP Implementation](docs/mcp.md)
- [Tools Reference](docs/tools.md)
- [Memory System](docs/memory.md)
- [Security Guide](docs/security.md)

## License

MIT