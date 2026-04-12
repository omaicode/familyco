# Coding Rules for AI Agents

## Primary objective
Generate production-minded code that matches the documented product, respects the monorepo boundaries, and minimizes unnecessary rewrites.

## General rules
- Do not rewrite unrelated files.
- Do not rename public interfaces without updating all usages.
- Prefer small composable functions.
- Prefer explicit types over implicit behavior.
- Keep side effects isolated.
- Avoid hidden global state.
- Add comments only where intent is not obvious.

## Monorepo rules
- Shared domain logic belongs in `packages/core` or `packages/agent-runtime`.
- Shared DB logic belongs in `packages/db`.
- Shared UI belongs in `packages/ui`.
- App-specific adapters belong in each app.

## UI rules
- Vue 3 Composition API only.
- Build reusable primitives for status badges, entity links, approval cards, and log entries.
- Keep pages thin; move logic into composables/services.
- Use route-level pages and feature folders.

## Server rules
- Separate API handlers from use-case logic.
- All workflow side effects must create audit entries.
- Budget tracking should happen through a single service.
- Provider calls should be wrapped behind adapters.

## Database rules
- Prisma schema is the source of truth.
- Never access SQLite directly from scattered raw queries unless justified.
- Add migrations for schema changes.
- Seed only minimal demo data.

## Logging and observability rules
- Human-facing summaries go to audit metadata or summaries.
- Avoid dumping full prompt contents into logs by default.
- Store token and cost numbers on every provider call.
- Use trace ids to connect runs, logs, and budget usage.

## Testing rules
- Add unit tests for policies and state transitions.
- Add component tests for critical UI states if test stack exists.
- Add integration tests for approval, budget, and run lifecycle.

## Definition of done for each implementation task
- code compiles,
- types pass,
- relevant tests pass,
- audit behavior considered,
- budget behavior considered,
- docs updated if contract changed.