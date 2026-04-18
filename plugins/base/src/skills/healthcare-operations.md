# Healthcare Operations

Use this skill for healthcare delivery workflows where care quality, patient safety, and compliance are non-negotiable.

## When To Use

- Coordinate intake, care handoff, and follow-up workflows.
- Reduce wait time and readmission risk.
- Align clinical operations and compliance agents.

## Operating Model

1. Define patient impact objective and safety constraints.
2. Use `plugin.base.suggest_industry_playbook` with `industry=healthcare`.
3. Build checklist and escalation points with `plugin.base.generate_operating_checklist`.
4. Require explicit ownership for every handoff step.
5. Track incidents, blockers, and protocol deviations in structured logs.

## Suggested KPI Set

- patient-wait-time
- care-plan-adherence
- readmission-rate
- incident-rate

## Execution Guardrails

- Do not export sensitive data without approval.
- Escalate immediately on protocol conflict or safety ambiguity.
- Keep an auditable summary for each care coordination decision.
- Prefer conservative fallback actions when uncertainty affects safety.

## Handoff Standard

Use `plugin.base.compose_handoff_brief` for inter-team transfer between intake, care, and follow-up owners.
