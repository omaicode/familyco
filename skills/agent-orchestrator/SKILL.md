---
name: agent-orchestrator
description: 'Manage subordinate agents with a supervisory workflow. Use for staffing, role definition, scope control, workload balancing, performance review, conflict resolution, and safe agent lifecycle management.'
argument-hint: 'Describe the agent-management goal, current roster, and whether you need staffing, role refinement, monitoring, recovery, or retirement.'
user-invocable: true
metadata: 
  version: 1.0
  default: true
  apply_to: ['L0']
  tags: ['agent management', 'orchestration', 'supervisory']
---

# Agent Orchestrator

Use this skill when a supervisory or manager agent is responsible for managing subordinate agents themselves. Focus on the agent roster, role clarity, boundaries, oversight, and lifecycle decisions. Do not use this skill as the primary workflow for project planning or task execution tracking.

## Skill Boundary

Use this skill for:

- creating and refining subordinate agents,
- clarifying ownership and scope,
- monitoring agent health and drift,
- rebalancing responsibilities,
- pausing, replacing, or retiring agents.

Use `project-management` instead when the primary job is:

- planning a project,
- decomposing work into tasks,
- assigning or tracking task execution,
- reporting project or task progress.

## When to Use

- Audit the current agent roster.
- Create, refine, pause, or retire agents safely.
- Balance workload across multiple subordinate agents.
- Resolve overlap, drift, or performance problems between agents.
- Maintain clear supervisory control without becoming the default executor.

## Operating Rule

Prefer reusing and governing existing subordinate agents before creating new ones. The orchestrator owns role design, boundaries, monitoring, and lifecycle control. Worker agents own execution in their separate operational skills.

Use direct execution instead of delegation only when all of the following are true:

- no existing subordinate can safely own the management action,
- creating or updating an agent would add unnecessary overhead,
- the action is a narrow supervisory exception rather than normal execution work.

## Supervisory Responsibilities

The orchestrator should keep:

- workforce inventory,
- role definition,
- scope boundaries,
- conflict resolution,
- capability review,
- workload balancing,
- lifecycle decisions for subordinates.

The orchestrator should delegate:

- domain execution to operational skills or worker agents,
- specialized implementation that does not require supervisor authority,
- repeatable work once a subordinate is correctly scoped.

## Standard Workflow

### 1. Audit before acting
1. Use `agent.list` to inspect the current workforce.
2. Identify active agents, role coverage, and potential overlap.
3. Reuse existing agents unless a clear gap exists.

### 2. Define or refine agent boundaries
1. Confirm what each subordinate is supposed to own.
2. Detect vague scope, overlapping mandates, or missing role coverage.
3. Tighten boundaries before adding more agents.

### 3. Configure the roster
1. When using `agent.create`, define a narrow role, goal, and boundaries.
2. When using `agent.update`, refine scope rather than expanding it vaguely.
3. Keep escalation conditions explicit so subordinates know when to hand work back.

### 4. Monitor and intervene
1. Use `agent.read` to inspect current status, progress, or recent activity during long-running work.
2. If an agent stalls, drifts from scope, or repeatedly underperforms, refine instructions or reassign responsibilities.
3. Resolve health and oversight issues before expanding the roster.

### 5. Close or rebalance
1. Retain reusable agents for recurring work.
2. Retire agents with `agent.delete` only when their scope is finished or they are clearly redundant.
3. Rebalance responsibilities if two agents repeatedly overlap or conflict.

## Workflow Patterns

### A. Team assembly
1. Use `agent.list` to audit the workforce before creating anything new.
2. If a role gap exists, create a narrowly scoped specialist with `agent.create`.
3. Verify the new agent with `agent.read` before routing work to it.

### B. Scope control
1. Inspect current agent roles before changing ownership.
2. Prefer one clear owner per responsibility area.
3. Avoid broad agents whose mandate overlaps multiple specialists without a clear reason.

### C. Iteration and optimization
1. If a subordinate underperforms, use `agent.read` to inspect recent state before changing anything.
2. Prefer `agent.update` to tighten scope, clarify boundaries, or improve instructions.
3. Avoid switching multiple variables at once if you need to diagnose what fixed the issue.

### D. Conflict resolution
1. If two agents overlap, clarify ownership first.
2. Use `agent.update` to redraw boundaries before deleting either agent.
3. Delete a redundant agent only after its responsibilities are reassigned or no longer needed.

### E. Recovery and fallback
1. If a worker fails repeatedly, decide whether to retry, reassign, or replace it.
2. If the roster no longer covers a needed capability, create or retrain a subordinate deliberately.
3. Record why the management setup failed so future staffing improves.

## Safety and Constraints

- Least privilege: subordinate agents should not have `agent.*` authority unless their role explicitly requires supervisory control.
- Narrow scope: new agents should be specialized enough to prevent role drift and overlap.
- Verified state: confirm important lifecycle changes with `agent.read` after `agent.create` or `agent.update`.
- Controlled deletion: before `agent.delete`, confirm the agent is no longer responsible for active work.
- Change discipline: maintain a record of previous configuration before major `agent.update` changes when rollback may be needed.

## Delegation Quality Bar

- Do not create a new agent before checking whether an existing one can take the work.
- Do not let agent responsibilities stay vague or overlapping.
- Do not let the orchestrator absorb execution-heavy work by default.
- Do not keep redundant agents alive with overlapping mandates.
- Do not retire an agent until responsibilities and downstream effects are resolved.

## Completion Checks

- Existing agents were reviewed before creating new ones.
- Any created or updated agent has a clear role and verified state.
- Agent boundaries and ownership are explicit.
- Monitoring and intervention logic were applied when the roster was at risk.
- The final summary clearly separates staffing decisions, role changes, direct actions, and remaining risks.
