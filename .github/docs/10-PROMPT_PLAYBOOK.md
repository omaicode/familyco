# Prompt Playbook for AI Coding

## Purpose
Provide concise prompts that keep AI coding aligned to FamilyCo docs.

## Master prompt for implementation
```md
You are implementing FamilyCo.
Read docs in this order:
1. 01-PROJECT_BRIEF.md
2. 02-PRD.md
3. relevant feature docs only
4. 09-CODING_RULES.md

Task:
[DESCRIBE THE IMPLEMENTATION TASK]

Constraints:
- Tech stack: Electron, Vue 3, PNPM monorepo, Prisma, SQLite.
- Do not change unrelated files.
- Reuse existing patterns before inventing new ones.
- If requirements are unclear, state assumptions explicitly.

Output format:
1. Files to change
2. Implementation plan
3. Code
4. Edge cases handled
5. Tests
```

## Prompt for building a new module screen
```md
Implement the [MODULE] screen for FamilyCo.
Read:
- 02-PRD.md
- 05-MODULE_SPECS.md
- 09-CODING_RULES.md

Goal:
[GOAL]

Deliver:
- page component
- child components
- composable/service layer if needed
- typed mock data or real data adapter
- loading, empty, error states
```

## Prompt for server use-case
```md
Implement the server use-case: [USE_CASE].
Read:
- 03-ARCHITECTURE.md
- 04-DOMAIN_MODEL.md
- 06-AGENT_OPERATING_MODEL.md
- 07-APPROVAL_POLICY.md
- 09-CODING_RULES.md

Requirements:
- emit audit log,
- enforce approval policy,
- track budget impact if provider call exists,
- return typed result.
```

## Prompt for Prisma schema changes
```md
Update Prisma schema for [FEATURE].
Read:
- 04-DOMAIN_MODEL.md
- 09-CODING_RULES.md

Deliver:
- schema changes,
- migration,
- seed adjustment if required,
- note about affected services.
```

## Prompt for refactor without drift
```md
Refactor [TARGET] in FamilyCo.
Do not change behavior.
Read only the minimum relevant docs and current implementation.
Keep public contracts stable unless explicitly requested.
Return a short drift-risk checklist before code.
```

## Token-saving advice
- Quote only the exact requirement lines needed.
- Prefer referencing file names over pasting whole docs repeatedly.
- Work one feature at a time.
- Summarize prior context every 3 to 5 turns.
- Move long examples into files rather than prompt body.