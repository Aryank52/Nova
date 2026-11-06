# NOVA Security Guide

## Overview

This document outlines the security measures implemented in NOVA to protect user data, API keys, and system integrity.

## Secrets Management

### Environment Variables

- All secrets stored in `.env` file (never committed)
- `.env.example` provided for reference
- Runtime access via `process.env` only in Node.js backend
- **Never** exposed to browser/client

```bash
# .env.example
NVIDIA_API_KEY=your_nvidia_api_key_here
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
NVIDIA_MODEL=nvidia/nemotron-3-super-120b-a12b
MCP_SERVER_PORT=3001
DATABASE_PATH=./data/nova.db
```

### Git Ignore

```gitignore
.env
.env.local
.env.*.local
*.db
*.sqlite
*.sqlite3
```

## API Key Protection

- NVIDIA API key only used in `@nova/ai-provider` package
- Server-side only (Next.js API routes, MCP server)
- Never passed to frontend
- Never logged

## Input Validation

All tool inputs validated with Zod schemas before execution:

```typescript
// Example: get_calendar_context input validation
const GetCalendarContextInputSchema = z.object({
  userId: z.string().uuid(),
  dateRange: z.object({
    start: z.string().datetime(),
    end: z.string().datetime(),
  }).optional(),
});

// Validated in tool implementation
const input = GetCalendarContextInputSchema.parse(call.arguments);
```

## Output Validation

Model-generated plans validated before execution:

```typescript
const plan = PlanSchema.parse(modelOutput);
// Only executes if validation passes
```

## Tool Allowlist

Only pre-registered tools can be invoked:

```typescript
const ALLOWED_TOOLS = [
  "get_calendar_context",
  "get_weather_context",
  "get_tasks",
  "update_task",
  "manage_shopping_list",
  "create_reminder",
  "get_user_context",
];

// MCP server only exposes these tools
// Agent can only call these tools
```

## No Arbitrary Code Execution

- No `eval()`, `Function()`, or dynamic code execution
- No shell command execution from model output
- Tool arguments strictly typed and validated
- MCP protocol enforces structured tool calls

## Approval Enforcement

Server-side approval for CONSEQUENTIAL actions:

```typescript
// ActionPolicy enforces on backend
if (risk === RiskLevel.CONSEQUENTIAL) {
  const decision = await actionPolicy.requestApproval(request);
  if (!decision.approved) throw new Error("Approval denied");
}
```

- UI cannot bypass approval
- Decisions persisted in database
- Audit trail in `approvals` table

## Database Security

- SQLite file permissions: owner read/write only
- WAL mode for consistency
- Foreign key constraints enabled
- Parameterized queries (no SQL injection)
- No user input in raw SQL

## Transport Security

### MCP Communication

- Streamable HTTP over localhost (prototype)
- Production: TLS required
- CORS restricted to web origin
- No authentication in prototype (add for production)

### Web Application

- Next.js default security headers
- CSRF protection via SameSite cookies
- Content Security Policy (configure for production)

## Data Privacy

- User data stored locally (SQLite)
- No telemetry or analytics by default
- Memory TTL limits retention
- User can delete data via tool calls

## Logging

- Structured logging (no secrets)
- Error messages sanitized
- Audit trail for approvals
- No PII in logs

```typescript
// Safe logging
logger.info("Tool executed", { tool: "get_tasks", userId: "user_001" });

// Unsafe - never do this
logger.info("API call", { apiKey: process.env.NVIDIA_API_KEY });
```

## Production Checklist

- [ ] Enable TLS for MCP server
- [ ] Add authentication (OAuth/JWT)
- [ ] Implement rate limiting
- [ ] Add request/response size limits
- [ ] Configure CSP headers
- [ ] Enable audit logging
- [ ] Set up secrets rotation
- [ ] Database encryption at rest
- [ ] Regular dependency updates
- [ ] Security scanning in CI/CD

## Threat Model

| Threat | Mitigation |
|--------|------------|
| API key leakage | Server-only, env vars, .gitignore |
| Injection attacks | Zod validation, parameterized queries |
| Unauthorized tool use | Allowlist, MCP protocol |
| Bypass approval | Server-side enforcement |
| Data exposure | Local SQLite, no external services |
| CSRF | SameSite cookies, API route validation |
| XSS | React auto-escaping, CSP |

## Incident Response

1. Rotate compromised API keys immediately
2. Review audit logs (`approvals`, `agent_events`)
3. Check database for unauthorized modifications
4. Update dependencies if vulnerability found
5. Document and improve mitigations