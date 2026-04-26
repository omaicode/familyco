---
name: "FamilyCo Source Standards"
description: "Use when implementing, fixing bugs, refactoring, reviewing, or testing FamilyCo source code in apps, packages, plugins, or scripts. Covers core-vs-app boundaries, approval and audit invariants, repository-only persistence, i18n requirements, thin controllers and pages, plugin tool policy, and mandatory validation gates."
applyTo: "apps/**/src/**/*.{ts,tsx,vue}, packages/**/src/**/*.{ts,tsx,vue}, plugins/**/src/**/*.ts, scripts/**/*.ts"
---

# FamilyCo Source Standards

## Scope

- Apply these rules when changing runtime or product source code in `apps`, `packages`, `plugins`, or `scripts`.
- Treat this file as implementation guidance. Do not use it to redesign architecture that already belongs to the default project instructions and docs.

## Architecture First

- Classify the change before editing: `core`, `server`, `web`, `electron`, `ui`, `db`, `agent-runtime`, `plugin`, or `script`.
- Keep business rules in `packages/core` or approved runtime layers such as `packages/agent-runtime`.
- Do not move domain policy into Vue components, Electron main or shell code, Fastify routes, or controller glue.
- If a request conflicts with documented architecture, do not invent a new pattern locally. Make the smallest compliant change and surface the conflict clearly.

## Dependency Boundaries

- `packages/core` must not import any other internal app or package.
- Web and UI code must not import server-only or desktop-only modules.
- Server adapters may depend inward on core and runtime contracts; core must remain dependency-free from apps.
- When changing cross-layer behavior, update the owning contract or type at the inner layer first, then adapt outward callers.

## Domain And Persistence Rules

- Preserve repository-backed data access. Services should depend on repository interfaces or approved abstractions, not scattered direct database calls.
- Keep Prisma as schema authority and avoid ad hoc persistence shortcuts.
- Do not add schema or contract drift silently. If persistence shape, API shape, or plugin tool fields change, update the matching types, validators, and affected tests in the same slice.

## Approval, Audit, And Budget Safeguards

- Any change that can trigger external side effects, approval pauses, or high-cost execution must preserve `ApprovalGuard`, inbox blocking behavior, audit trail creation, and usage metering.
- Do not bypass approval policy from UI code, route handlers, workers, or plugins.
- Maintain traceable summaries and metadata for meaningful workflow side effects.
- When touching runs, tasks, inbox, tools, or provider execution, check that approval and budget behavior still matches the documented lifecycle.

## Web And UI Rules

- Keep pages and components thin. Move orchestration and derived business behavior into composables, services, or shared layers.
- Reuse shared UI primitives and established patterns instead of adding one-off status, badge, link, or approval widgets.
- Route all user-facing text through i18n and update both English and Vietnamese catalogs when localized text exists.
- Preserve responsive behavior and avoid broad restyling unless the task explicitly asks for visual changes.

## Server And Runtime Rules

- Keep routes, controllers, and transport handlers thin; push workflow logic into services or runtime layers.
- Preserve explicit audit logging for meaningful actions and keep provider calls behind approved runtime or adapter layers.
- For agent, tool, plugin, or run-lifecycle changes, preserve namespacing, enablement policy, required custom-field validation, and resumable approval behavior.

## Change Discipline

- Prefer the smallest reviewable change that fixes the root cause.
- Do not rename public APIs, events, routes, or exported types unless the task requires it and all callers are updated.
- Do not reformat unrelated files or broaden scope for opportunistic cleanup.
- If a touched file becomes too large or accumulates multiple responsibilities, split the new logic into a nearby helper, composable, service, or component instead of expanding the blob.

## Validation Gates

- Run the narrowest relevant validation before considering the work done.
- Use `pnpm --filter @familyco/core typecheck` for core changes.
- Use `pnpm --filter @familyco/server test` for server changes.
- Use `pnpm --filter @familyco/web typecheck` and `pnpm --filter @familyco/web build` for web or shared UI changes.
- Use `pnpm -w typecheck` when a change crosses layers or the blast radius is unclear.
- If you change approval, budget, audit, or lifecycle behavior, prefer adding or updating a targeted test instead of relying on manual inspection.