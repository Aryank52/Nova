# NOVA Implementation Checklist

## Phase 1: Project Foundation
- [x] Initialize monorepo with package.json and workspaces
- [x] Create tsconfig.json (root and per-package)
- [x] Set up ESLint, Prettier, Vitest
- [x] Create directory structure (apps/web, packages/*, data/seed, tests/*, docs/*)
- [x] Create .env.example and .gitignore
- [x] Verify build, lint, test commands work (core packages)

## Phase 2: Shared Types & Domain Models
- [x] Goal, Plan, PlanStep
- [x] ToolCall, ToolResult
- [x] ApprovalRequest, ApprovalDecision
- [x] Execution, ExecutionStep
- [x] MemoryRecord, AgentEvent
- [x] AgentState enum
- [x] RiskLevel enum
- [x] Zod schemas for validation

## Phase 3: MCP Server (Streamable HTTP)
- [x] Initialize MCP server with @modelcontextprotocol/sdk
- [x] Implement Streamable HTTP transport at /mcp endpoint
- [x] Handle initialize, tools/list, tools/call
- [x] Register all 7 tools
- [x] Independent verification script

## Phase 4: Tools & Adapters
- [x] CalendarAdapter + get_calendar_context (READ_ONLY)
- [x] WeatherAdapter + get_weather_context (READ_ONLY)
- [x] TaskAdapter + get_tasks, update_task (READ_ONLY, LOW_RISK_WRITE)
- [x] ShoppingAdapter + manage_shopping_list (LOW_RISK_WRITE)
- [x] ReminderAdapter + create_reminder (LOW_RISK_WRITE)
- [x] UserContextAdapter + get_user_context (READ_ONLY)
- [x] SQLite persistence layer
- [x] Seed data for deterministic testing
- [x] Unit tests for each tool

## Phase 5: AI Provider Abstraction
- [x] AIProvider interface
- [x] NemotronProvider implementation
- [x] Environment variable configuration
- [x] Independent provider tests

## Phase 6: NOVA Agent
- [x] Agent orchestration loop
- [x] State machine (IDLE → UNDERSTANDING → CONTEXT_LOADING → PLANNING → EXECUTING → WAITING_FOR_APPROVAL → VERIFYING → COMPLETED/FAILED/CANCELLED)
- [x] Intent understanding
- [x] Context retrieval
- [x] Plan generation with Zod validation
- [x] Tool selection & invocation via MCP client
- [x] Result processing & re-planning
- [x] Approval integration
- [x] Verification & summarization
- [x] Max iterations, timeouts, cancellation

## Phase 7: Memory System
- [x] Session memory
- [x] Persistent memory (preferences, routines, active_goals, commitments, recent_actions)
- [x] Retrieval logic (relevant only)
- [x] SQLite tables

## Phase 8: ActionPolicy & Approval Engine
- [x] ActionPolicy service
- [x] Risk classification enforcement
- [x] Server-side approval flow
- [x] Approval persistence

## Phase 9: End-to-End Guest Workflow
- [ ] Complete flow: browser → backend → model → MCP → tools → approval → result
- [ ] Test with "I have six guests coming tomorrow at 6 PM. Get everything ready."

## Phase 10: Web UI (Next.js)
- [x] Conversation panel
- [x] Goal/Plan panel
- [x] Execution Timeline
- [x] Approval Panel
- [x] Final Result panel
- [x] Status indicators
- [x] NOVA branding
- [ ] Build passes (Next.js build needs PATH fix)

## Phase 11: Automated Testing
- [x] Unit tests: schemas, tools, policy, memory, state transitions
- [ ] Integration tests: MCP initialize, tools/list, tools/call, Streamable HTTP, Nemotron provider
- [ ] E2E tests: complete guest workflow (Playwright)

## Phase 12: Documentation
- [x] README.md (will create)
- [x] architecture.md
- [x] mcp.md
- [x] tools.md
- [x] memory.md
- [x] security.md
- [ ] demo.md

## Phase 13: Final Quality Pass
- [ ] Build passes (core packages pass, web needs PATH fix)
- [ ] Lint passes
- [ ] All tests pass
- [ ] MCP server works
- [ ] Streamable HTTP works
- [ ] Nemotron provider works
- [ ] Agent works
- [ ] Tools work
- [ ] Memory works
- [ ] Approval works
- [ ] UI works
- [ ] Error handling works
- [ ] No secrets exposed
- [ ] README complete