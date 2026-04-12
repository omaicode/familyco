# FamilyCo AI Coding Docs

## Purpose
This folder is the canonical documentation bundle for AI coding agents building the FamilyCo product.

## Reading order for AI agents
1. `01-PROJECT_BRIEF.md`
2. `02-PRD.md`
3. `03-ARCHITECTURE.md`
4. `04-DOMAIN_MODEL.md`
5. `05-MODULE_SPECS.md`
6. `06-AGENT_OPERATING_MODEL.md`
7. `07-APPROVAL_POLICY.md`
8. `08-SKILLS_STANDARD.md`
9. `09-CODING_RULES.md`
10. `10-PROMPT_PLAYBOOK.md`

## How AI should use this bundle
- Treat this bundle as the source of truth unless code clearly contradicts it.
- Prefer exact requirements over assumptions.
- If a requirement is missing, create a clarification item instead of inventing behavior.
- Keep generated code aligned with Electron, Vue 3, PNPM monorepo, Prisma, and SQLite.
- Reuse existing modules before adding new abstractions.

## Token-saving rules for AI coding agents
- Read files in order and stop when enough context is available.
- Do not load every file into prompt at once.
- Summarize large docs into short working notes before coding.
- Only open the skills-related docs when implementing Skills features.
- Only open approval, budget, and audit docs when touching those features.

## Output expectations
When implementing any feature, the AI should produce:
- changed files list,
- short implementation summary,
- edge cases handled,
- follow-up items,
- test checklist.