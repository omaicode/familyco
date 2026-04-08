# FamilyCo

FamilyCo is an AI-native company operating system for founders.

It helps you run a small AI organization through role-based agents (L0/L1/L2), where the founder provides direction and approvals while agents handle planning and execution.

## What this repository contains

This monorepo includes:

- Core business logic
- Fastify backend services
- Vue renderer application
- Electron desktop shell

## Quickstart

### Prerequisites

- Node.js 22 LTS
- pnpm 10

### 1. Install dependencies

```bash
pnpm install
```

### 2. Run the backend

```bash
pnpm --filter @familyco/server dev
```

Default server URL: http://127.0.0.1:4000

### 3. Run the web renderer

```bash
pnpm --filter @familyco/web dev
```

### 4. Run the desktop app (optional)

Start the renderer first, then launch desktop:

```bash
pnpm --filter @familyco/web dev
pnpm --filter @familyco/desktop dev
```

### 5. Validate the workspace

```bash
pnpm build
pnpm test
pnpm typecheck
```
