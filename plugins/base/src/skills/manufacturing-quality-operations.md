# Manufacturing Quality Operations

Use this skill for manufacturing environments where throughput and quality must improve together without uncontrolled risk.

## When To Use

- Improve line throughput and first-pass yield.
- Reduce defects and unplanned downtime.
- Coordinate production, quality, and maintenance agents.

## Operating Model

1. Define target output and quality threshold.
2. Use `plugin.base.suggest_industry_playbook` with `industry=manufacturing`.
3. Generate execution checklist with `plugin.base.generate_operating_checklist`.
4. Assign owners for planning, quality validation, and maintenance response.
5. Run shift-level review loops for deviations and containment actions.

## Suggested KPI Set

- overall-equipment-effectiveness
- first-pass-yield
- defect-rate
- downtime-minutes

## Execution Guardrails

- Require approval before process changes on critical lines.
- Do not skip root-cause logging for repeated defects.
- Escalate supplier quality drift before production impact compounds.
- Keep containment and corrective actions explicitly separated.

## Handoff Standard

Use `plugin.base.compose_handoff_brief` when handing unresolved quality issues to the next shift or specialist team.
