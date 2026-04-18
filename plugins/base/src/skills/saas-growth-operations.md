# SaaS Growth Operations

Use this skill for SaaS product teams that need predictable growth execution across acquisition, activation, retention, and expansion.

## When To Use

- Improve lead-to-paid conversion.
- Reduce churn and increase net revenue retention.
- Coordinate Product, Growth, and Customer Success agents.
- Run recurring growth experiments with auditable outcomes.

## Operating Model

1. Start with a measurable objective and a baseline metric.
2. Use `plugin.base.suggest_industry_playbook` with `industry=saas` to pick the workflow.
3. Break work into short experiment cycles with clear owners.
4. Track movement in activation, adoption, and churn indicators.
5. Escalate for approval before irreversible pricing or contract changes.

## Suggested KPI Set

- mrr-growth
- trial-to-paid-rate
- activation-rate
- logo-churn
- net-revenue-retention

Use `plugin.base.build_kpi_scorecard` to draft metric definitions and directions.

## Execution Guardrails

- Keep experiments small and reversible.
- Do not commit paid channels without budget check.
- Separate hypothesis, action, and observed impact in every report.
- If data quality is unclear, ask for clarification before attribution decisions.

## Handoff Standard

Use `plugin.base.compose_handoff_brief` to pass context between Growth, Product, and Success agents.
