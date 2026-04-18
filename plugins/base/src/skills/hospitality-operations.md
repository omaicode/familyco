# Hospitality Operations

Use this skill for hospitality operations where occupancy, service quality, and guest recovery must be coordinated across front-office and service teams.

## When To Use

- Improve occupancy and average daily rate outcomes.
- Coordinate reservation, guest experience, and event execution.
- Reduce service recovery time after incidents.

## Operating Model

1. Define service objective and guest segment focus.
2. Use `plugin.base.suggest_industry_playbook` with `industry=hospitality`.
3. Build workflow checklist through `plugin.base.generate_operating_checklist`.
4. Assign owners for reservation operations, service delivery, and issue recovery.
5. Review guest feedback trends and close corrective actions quickly.

## Suggested KPI Set

- occupancy-rate
- average-daily-rate
- guest-satisfaction-index
- service-recovery-time

## Execution Guardrails

- Require approval before major rate policy changes.
- Escalate overbooking patterns immediately.
- Keep high-priority guest incidents logged with clear handoff owner.
- Protect service standards during peak demand.

## Capability Planning

Use `plugin.base.map_capability_gaps` to validate front office, guest experience, and revenue management role coverage.
