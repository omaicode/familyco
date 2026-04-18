# Retail Operations

Use this skill for retail and e-commerce operations where inventory, promotions, and category performance must be coordinated with low execution drift.

## When To Use

- Improve inventory turn and reduce stockout/overstock.
- Plan promotions with margin protection.
- Coordinate merchandising, store operations, and supply planning agents.

## Operating Model

1. Identify target category and baseline sell-through data.
2. Use `plugin.base.suggest_industry_playbook` with `industry=retail`.
3. Build an operating checklist via `plugin.base.generate_operating_checklist`.
4. Assign one owner per workstream: demand planning, replenishment, campaign execution.
5. Review exceptions daily and update corrective actions.

## Suggested KPI Set

- stockout-rate
- sell-through-rate
- gross-margin-return-on-inventory
- promotion-lift

## Execution Guardrails

- Require approval before bulk purchase commitments.
- Avoid promotion plans without inventory readiness checks.
- Protect margin floors before launching discount campaigns.
- Escalate supplier risk when lead-time variance rises.

## Capability Planning

Use `plugin.base.map_capability_gaps` to check if current agent roles cover merchandising, inventory planning, and store operations.
