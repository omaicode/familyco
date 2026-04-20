# FamilyCo - Your own “AI family business”


<p align="center">
    <picture>
        <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/omaicode/familyco/refs/heads/master/thumbnail.png">
        <img src="https://raw.githubusercontent.com/omaicode/familyco/refs/heads/master/thumbnail.png" alt="FamilyCo" width="500">
    </picture>
</p>

<p align="center">
  <a href="https://github.com/omaicode/familyco/actions/workflows/ci.yml?branch=master"><img src="https://img.shields.io/github/actions/workflow/status/omaicode/familyco/ci.yml?branch=master&style=for-the-badge" alt="CI status"></a>
  <a href="https://github.com/omaicode/familyco/releases"><img src="https://img.shields.io/github/v/release/omaicode/familyco?include_prereleases&style=for-the-badge" alt="GitHub release"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge" alt="MIT License"></a>
</p>

FamilyCo is an operating system for your own “AI family business” — each agent works like a member of the company, collaborating, sharing the workload, and handling day-to-day operations so you can stay focused on the bigger decisions.

## Start Here (Non-Technical Users)

If you just want to use FamilyCo, install a release build.

- You do not need Node.js, pnpm, or terminal commands.
- Download from: https://github.com/omaicode/familyco/releases

### 1. Pick your installer

- Windows: download the `.exe` file.
- macOS: download the `.dmg` file.
- Linux: download the `.AppImage` file.

### 2. Install and open

- Windows: run the installer and follow the setup wizard.
- macOS: open `.dmg`, drag FamilyCo to Applications, then open it.
- Linux: make the `.AppImage` executable, then run it.

### 3. First launch tips

- If your OS shows a security warning, choose the option to continue/open anyway.
- Keep the app connected to the internet for AI provider features.
- You can update later by downloading a newer release from the same page.

## What You Get

- Chat-first directive to execution flow.
- Agent hierarchy (executive, manager, worker) with controllable autonomy.
- Structured operations across Projects, Tasks, and Inbox approvals.
- Full Audit Log and token/cost Budget tracking.
- Desktop-first local runtime (SQLite + Prisma) with web client support.

## Monorepo Overview

```txt
apps/
	electron/           Desktop shell
	server/             Fastify API + orchestration + runtime modules
	web/                Vue 3 operational client
packages/
	core/               Domain rules, DTOs, validation contracts
	agent-runtime/      Planner, tool execution flow, approval gate
	db/                 Prisma schema, migrations, DB wrappers
	ui/                 Shared UI contracts, stores, i18n
plugins/                Plugins, each plugin included tools & skills
	base/               
```

## Architecture Guardrails

- Business logic belongs in `packages/core`.
- `packages/core` must not import other internal packages.
- Side effects with significant impact must go through approval flow.
- Database access should go through repository abstractions.
- Prisma schema is the persistence contract.

## Developer Quickstart (5 Minutes)

If you are not developing the codebase, use the release install steps above instead.

### 1. Prerequisites

- Node.js 22 LTS
- pnpm 10

### 2. Install dependencies

```bash
pnpm install
```

### 3. Configure environment

```bash
cp .env.example .env
cp apps/web/.env.example apps/web/.env
```

Notes:
- `apps/web/.env` is primarily needed when running web standalone.
- Default local server URL is `http://127.0.0.1:4000`.

### 4. Start development mode (server + web)

```bash
pnpm dev
```

Default local endpoints:
- Web: `http://127.0.0.1:5173`
- Server: `http://127.0.0.1:4000`

### 5. Start desktop mode (Electron)

```bash
pnpm dev:electron
```

This command builds required workspace packages and starts web + electron runtime.

## Common Commands

| Goal | Command |
| --- | --- |
| Run server + web | `pnpm dev` |
| Run web + electron | `pnpm dev:electron` |
| Build all packages | `pnpm build` |
| Build electron     | `pnpm build:electron` |
| Run all tests | `pnpm test` |
| Typecheck all packages | `pnpm typecheck` |
| Generate Prisma client | `pnpm prisma:generate` |
| Run Prisma migration | `pnpm prisma:migrate` |

Package-scoped examples:

```bash
pnpm --filter @familyco/server dev
pnpm --filter @familyco/web dev
pnpm --filter @familyco/electron dev
```

## Validation Gates (Before Merge)

Run these checks at minimum:

```bash
pnpm -w typecheck
pnpm --filter @familyco/server test
pnpm --filter @familyco/web build
```

If your change has broader impact, run:

```bash
pnpm build
pnpm test
```

## Environment Highlights

Key variables in `.env`:

- `PORT`: Fastify HTTP port (default `4000`).
- `API_PREFIX`: API namespace (default `/api/v1`).
- `FAMILYCO_REPOSITORY_DRIVER`: `prisma` or `memory`.
- `DATABASE_URL`: SQLite path used by Prisma.
- `FAMILYCO_QUEUE_DRIVER`: queue mode (default `memory`).
- `FAMILYCO_API_KEY`, `JWT_SECRET`, `API_KEY_SALT`: security secrets.

Renderer-related variables are in `apps/web/.env` (`VITE_API_BASE_URL`, `VITE_API_KEY`, `VITE_BEARER_TOKEN`).

## Product Flow (At A Glance)

1. Founder sends a directive in Chat.
2. Server creates an agent run.
3. Executive Agent creates or updates Projects/Tasks.
4. Skills are selected from enabled toolset.
5. Risky or ambiguous actions pause into Inbox approval.
6. Approved runs continue; Budget and Audit are recorded end-to-end.

## Documentation Map

- Product goals: `.github/docs/02-PRD.md`
- Architecture: `.github/docs/03-ARCHITECTURE.md`
- Domain entities: `.github/docs/04-DOMAIN_MODEL.md`
- Module contracts: `.github/docs/05-MODULE_SPECS.md`
- Agent behavior: `.github/docs/06-AGENT_OPERATING_MODEL.md`
- Approval policy: `.github/docs/07-APPROVAL_POLICY.md`
- Coding rules: `.github/docs/09-CODING_RULES.md`

## Troubleshooting

- If port `4000` is in use, stop stale server processes and rerun `pnpm dev`.
- If Electron native modules mismatch appears after Node/runtime changes, run `pnpm --filter @familyco/electron rebuild:native` and restart desktop mode.