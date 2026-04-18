# Education Program Operations

Use this skill for education and training programs that need consistent curriculum delivery, learner support, and measurable outcome improvements.

## When To Use

- Improve cohort completion and assessment outcomes.
- Coordinate curriculum, facilitation, and learner support agents.
- Detect and respond to dropout risk early.

## Operating Model

1. Set program objective and learner outcome target.
2. Use `plugin.base.suggest_industry_playbook` with `industry=education`.
3. Build KPI scorecard using `plugin.base.build_kpi_scorecard`.
4. Run weekly intervention cycles with clear ownership.
5. Close each cycle with outcome summary and next-step adjustments.

## Suggested KPI Set

- completion-rate
- assessment-improvement
- attendance-rate
- intervention-closure-time

## Execution Guardrails

- Escalate policy or grading changes for approval.
- Keep support interventions learner-specific and measurable.
- Avoid broad changes without cohort-level impact evidence.
- Log assumptions when learner context is incomplete.

## Capability Planning

Use `plugin.base.map_capability_gaps` to validate role coverage for program manager, instructional designer, and student success roles.
