# Architecture

## Monorepo structure
```txt
familyco/
├─ apps/
│  ├─ electron/
│  ├─ web/
│  └─ server/
│     └─ src/
│        ├─ app.ts
│        ├─ bootstrap/
│        ├─ modules/
│        ├─ runtime/
│        └─ repositories/
├─ packages/
│  ├─ ui/
│  ├─ core/
│  ├─ db/
│  ├─ agent-runtime/
│  └─ shared/
├─ skills/
├─ docs/
└─ pnpm-workspace.yaml
```

## Runtime responsibilities
### apps/electron
- Electron shell.
- Vue 3 renderer app.
- Best UX for Founder.
- Local-first access to settings, chat, approvals, reporting.

### apps/web
- Vue 3 SPA.
- Lightweight operational client.
- Read-heavy workflows with approvals and monitoring.
- Chat session selection persistence in browser state for fast session restore.

### apps/server
- API layer.
- Agent orchestration.
- Background jobs and scheduled runs.
- Budget metering.
- Audit log writer.
- Skill discovery and activation service.
- Plugin discovery/enablement and plugin capability registration.
- Tool policy service (enable/disable + custom fields) synchronized to tool executor.
- Chat session and message orchestration for multi-session agent chat.
- `src/app.ts` is the composition root: it wires dependencies and delegates setup to bootstrap modules.
- Startup migration safety can switch server into read-only mode for write operations.

### apps/server bootstrap composition
- `bootstrap/repositories.ts`: repository driver wiring (`memory` / `prisma`).
- `bootstrap/queue-handlers.ts`: queue lane handlers for agent/tool/task execution.
- `bootstrap/lifecycle.ts`: startup/shutdown hooks (migration safety, bootstrap API key, schedulers, plugin discovery).
- `bootstrap/routes.ts`: `/api/v1` route/controller registration and request guards.
- `bootstrap/http.ts`: health endpoint and global error handler.
- `bootstrap/helpers.ts`: server bootstrap helper utilities (CORS matcher, concurrency defaults, queue stats, trace helpers).

### apps/server async execution lanes
- `agent.run`: executes agent workflows and updates run lifecycle state.
- `tool.execute`: executes tool calls through runtime policy and audit pipeline.
- `task.execute`: executes ready tasks (single task or agent batch) with heartbeat/audit integration.

### packages/ui
- Shared design tokens.
- Shared components.
- Shared layout primitives.

### packages/core
- Domain types.
- Validation schemas.
- business policies.
- enums and DTOs.

### packages/db
- Prisma schema.
- migrations.
- seed scripts.
- db access wrappers.

### packages/agent-runtime
- planner.
- task decomposer.
- approval gate.
- skill router.
- usage meter.
- run state machine.

## High-level flow
1. Founder sends a directive in Chat.
2. Server creates an AgentRun.
3. Executive Agent interprets intent.
4. Planner creates or updates Projects and Tasks.
5. Agent Router selects enabled Skills.
6. If approval is needed, an ApprovalRequest is created and run pauses in `waiting_approval`.
7. When approved, execution continues.
8. BudgetUsage and AuditLog are written throughout.

## Tool policy flow
1. Runtime tool definitions are collected from built-in tools and enabled plugins.
2. Tool policy state is persisted in settings keys:
   - `tools.registry` for enabled/disabled plugin tools.
   - `tools.customFields` for per-tool custom field values.
3. Required custom fields are validated before enabling plugin tools.
4. Chat engine receives filtered tool list by level, while enabled plugin tools remain available in prompt/tool context.
5. Executor injects persisted custom field values into plugin tool execution arguments.

## Runtime safeguards
- Migration safety runs during startup before normal mutation traffic.
- Health endpoint reports queue stats, migration status, and read-only mode.
- Heartbeat runtime polls due agents and enqueues heartbeat runs with cooldown/in-flight protections.
- Cron runtime polls due jobs, records run history, and persists last/next schedule markers.

## Design constraints
- Business rules should live in `packages/core` or `packages/agent-runtime`, not duplicated in UI.
- UI apps should call use-cases or service methods instead of embedding orchestration logic.
- Prisma schema is the contract for persistence.
- Event names must be explicit and past-tense or command-like, not vague.

## Recommended UI navigation
- Chat
- Inbox
- Agents
- Projects
- Tasks
- Budget
- Audit Log
- Skills
- Settings

## Suggested state boundaries
- UI state: filters, panel open/close, selected entity.
- Domain state: projects, tasks, agents, inbox items.
- Runtime state: active runs, queued jobs, provider connectivity.
- Reporting state: aggregated budget and logs.
