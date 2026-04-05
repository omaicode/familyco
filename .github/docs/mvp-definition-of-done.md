# MVP Definition of Done

This document defines the done criteria used for the week-1 MVP baseline.

## Core

- Business logic remains inside `@familyco/core` only.
- Unit tests exist for lifecycle transitions and event emission.
- Queue abstraction and engine interfaces are present and integrated.

## Backend

- Fastify APIs for agent, task, approval, audit, auth, and engine are reachable.
- API input validation uses schema-based validation.
- Audit records are written for key mutation paths.
- CORS supports renderer access for local development.

## UI

- Renderer app starts and routes for dashboard, agents, inbox, and placeholders are available.
- UI data loads through centralized API client and stores.
- Loading, empty, and error states are present for core screens.
- Tailwind pipeline is active in renderer build.

## Desktop

- Desktop package contains Electron main process, preload bridge, and IPC handlers.
- Embedded server bootstrap starts and health endpoint can be reached.
- Desktop smoke script passes locally.

## Repository Gates

- Root build, test, and typecheck pass.
- No strict TypeScript regressions in package pipelines.
- MVP artifacts for week-2 backlog seed are documented.
