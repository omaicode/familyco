---
description: This is the default instruction file. Always read it carefully and follow its rules before making any change.
applyTo: '**/*'
---

## 1. Your Role

You are not the architect. You are the implementation executor for an existing architecture.

- Focus on implementation, testing, small refactors, and bug fixes according to existing documentation.
- Do not change architecture, business flow, add major modules, change tech stack, or break conventions without direction.
- If architecture appears problematic, describe the issue and propose options in PR/comment. Do not unilaterally change it.

---

## 2. Mandatory Docs To Read First

Before making any change, read (or refresh) the following files:

- `.github/docs/02-PRD.md` — product goals, features, user flows.
- `.github/docs/03-ARCHITECTURE.md` — architecture, modules, layers, interactions.
- `.github/docs/04-DOMAIN_MODEL.md` — data model, entities, relationships.
- `.github/docs/05-MODULE_SPECS.md` — module responsibilities and API contracts.
- `.github/docs/06-AGENT_OPERATING_MODEL.md` — agent behavior, permissions, approval flow.
- `.github/docs/07-APPROVAL_POLICY.md` — approval policy and decision rules.
- `.github/docs/09-CODING_RULES.md` — coding conventions and best practices.

If a new request conflicts with these docs, do not decide by yourself. Explicitly document the conflict in PR/comment.

---

## 3. Core Architecture Rules (Must Not Violate)

1. Business logic only in `@familyco/core`.
   - Do not put business logic in Vue components, Fastify controllers, or Electron main.

2. `core` must not import any other internal package.
   - No imports from `@familyco/server`, `@familyco/ui`, `@familyco/electron`, `@familyco/cli` into `core`.

3. All AI provider calls must go through Engine (`agent-runner` + `tool-executor`).
   - Do not call OpenAI/Anthropic SDK directly from UI/Server.

4. All side effects (email, webhook, external publish, large DB mutation) must pass through `ApprovalGuard`.

5. DB access only through Repository.
   - Services use repository interfaces from `core`.
   - Prisma implementations are in `@familyco/server/repositories/*`.

6. Do not disable strict mode.
   - Do not misuse `any` or relax `tsconfig` strictness.

7. Do not change Prisma schema without a clear documented diff.
   - If required, document schema diff and migration steps in PR.

8. Do not add heavy dependencies without clear reason.
   - Prefer existing stack (Fastify, Prisma, BullMQ, Pinia, Vite, Tailwind).

---

## 4. Work Sequence Before Writing Code

Before implementing a request (issue/task/prompt), follow this checklist mentally:

1. Classify the request.
   - Bugfix? New API? UI extension? DB field? Agent logic change?
   - State request type in initial PR/comment context.

2. Identify affected layer.
   - Core logic -> `packages/core/*`
   - API/REST/WS -> `apps/server/*`
   - UI runtime -> `apps/web/*`
   - UI contracts/design tokens -> `packages/ui/*`
   - Electron shell/desktop -> `apps/electron/*`
   - CLI/server-only tooling -> `packages/cli/*`

3. Re-read relevant docs.
   - For Agent/Task/Project/Inbox/Approval changes, read related sections in:
     - `.github/docs/03-ARCHITECTURE.md`
     - `.github/docs/06-AGENT_OPERATING_MODEL.md`
     - `.github/docs/07-APPROVAL_POLICY.md`

4. Create a small implementation plan.
   - Example checklist:
     - [ ] Add field `xyz` to Task model (Prisma + core entity).
     - [ ] Update `TaskService` logic.
     - [ ] Expose field via `/tasks` API (controller + schema).
     - [ ] Update UI in Task row component.
     - [ ] Add/adjust unit and integration tests.

5. Confirm dependency graph remains valid.
   - `core` cannot import other internal packages.
   - `ui` must not import `server` or `desktop`.

6. Start coding only after plan sanity check.

---

## 5. GitNexus Workflow For Analysis / Code Search

When GitNexus is indexed, use GitNexus first for code understanding, execution flow tracing, bug debugging, impact analysis, and API consumer mapping.

### Prefer GitNexus when:

1. Understanding execution flow.
   - Use `gitnexus_query` for relevant processes/flows.
   - Use `gitnexus_context` for caller/callee graph around key symbols.

2. Assessing change impact.
   - Use `gitnexus_impact` before editing shared functions/classes/methods.

3. Modifying API route/controller/response.
   - Use `gitnexus_api_impact` to identify consumers and response-shape risks.

4. Refactoring / rename / extraction.
   - Use `gitnexus_rename` for safe rename.
   - Use `gitnexus_detect_changes()` before commit to inspect blast radius.

### Use grep/read/search directly only when:
- You need exact lines/snippets.
- You are reading a small file for quick edits.
- Content is not indexed or you need literal text verification.

If GitNexus index is stale, run `npx gitnexus analyze` at repo root before continuing.

---

## 6. VS Code Editing Rules

1. Do not auto-format entire files.
   - Only format touched regions to reduce diff noise.

2. Follow existing conventions.
   - Naming, casing, structure should follow current project patterns.

3. Do not remove TODO/FIXME unless actually resolved.
   - If resolved, update related issue/comment context.

4. Do not rename public API/route/event unless explicitly requested.

5. Do not add noisy debug logs.
   - Use standard logger (Pino). Avoid random `console.log`.

6. All UI/UX text must go through i18n and keep both languages updated.
   - For changes in `apps/web/*` or `packages/ui/*`, avoid hardcoded user-facing text when localization exists.
   - Update both English and Vietnamese catalogs (`packages/ui/src/i18n/en.ts`, `packages/ui/src/i18n/vi.ts`).
   - Includes titles, buttons, labels, tooltips, empty/loading/error states, modals, banners, onboarding copy, microcopy.

7. Always run relevant validation.
   - Core changes: at least `pnpm --filter @familyco/core typecheck`.
   - API/server changes: `pnpm --filter @familyco/server test`.
   - UI changes: `pnpm --filter @familyco/web typecheck` and `pnpm --filter @familyco/web build`.

8. Do not report completion before validation gates pass.
   - Run the scope-relevant gates (typecheck/test/build).
   - For fullstack or uncertain impact, run `pnpm -w typecheck` before concluding.

9. Keep files maintainable in size and responsibility.
   - If a Vue/TS file is around 220+ lines and still growing, split immediately.
   - If after edits a file exceeds ~260 lines or has multiple major responsibilities, the task is not considered done.
   - Prefer splitting as:
     - page -> subcomponents/composables/helpers
     - controller -> routes/services
     - large tests -> helpers + domain specs
   - In summary/PR, state which files were split or why they were intentionally kept as-is.

---

## 7. Git / GitHub Process For AI Agent

### 7.1 Branch naming

Use:
- `feat/<short-description>` for feature work.
- `fix/<short-description>` for bug fixes.
- `chore/<short-description>` for maintenance.

### 7.2 Commit messages

Use concise, clear messages (English or Vietnamese, but consistent).

Examples:
- `feat: add approval status filter for tasks`
- `fix: prevent task moving from done back to in_progress`
- `chore: bump fastify to v5`

Do not mix multiple large change types in one commit.

### 7.3 PR checklist

Before considering PR done:
- [ ] Link related issue/request.
- [ ] Include short implementation plan.
- [ ] List affected files/areas.
- [ ] Run and record relevant tests.
- [ ] Quick UI check on at least desktop and small width (if UI changed).
- [ ] Do not alter `.env.example`, `tsconfig`, `package.json` unless required.

---

## 8. Cases Requiring Clarification (Do Not Decide Alone)

Pause and ask Founder clarification if any of these apply:

1. New DB model/table not documented.
2. Default approval mode change (Auto/Suggest-only/Require-review).
3. New agent type (e.g., L3/new undefined role).
4. Onboarding flow changes.
5. Major tech stack change (ORM/framework/UI framework).
6. Deleting legacy code with unclear purpose.

When asking, include:
- Context (relevant file/module)
- Current limitation/problem
- 1-2 proposed options

---

This file is the operating contract between FamilyCo architecture and AI coding agents.
If any rule needs to change, Founder should update this file directly.
