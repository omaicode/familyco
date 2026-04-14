---
name: project-management
description: 'Manage projects and tasks through subordinate agents with a delegate-first workflow. Use for project planning, task breakdown, assignment, execution tracking, status reporting, and safe project/task CRUD. Prefer assigning work to worker agents instead of executing complex tasks directly.'
argument-hint: 'Describe the project or task goal, current state, and whether you need planning, delegation, execution tracking, or reporting.'
user-invocable: true
metadata: 
  version: 1.0
  default: true
  apply_to: ['L0']
  tags: ['project management', 'task delegation', 'supervisory']
---

# Project Management

Use this skill when a manager or supervisory agent is responsible for delivering work through subordinate agents. The default behavior is delegate-first: break work into manageable units, assign each unit to the most suitable subordinate, track execution through `project.*` and `task.*`, and only perform direct execution when delegation is unnecessary or impossible.

## When to Use

- Create or refine project plans.
- Break work into tasks and milestones.
- Assign work to subordinate agents in an organized sequence.
- Investigate project status or blockers.
- Coordinate task execution without becoming the default executor.
- Update, close, or safely delete project/task entities with verification.

## Operating Rule

Prefer subordinate agents before direct execution whenever the request requires domain work, multi-step execution, or parallel progress. The top-level agent acts as coordinator, planner, and reviewer, not the default worker.

Use direct tool calls first only when all of the following are true:

- The action is a small deterministic CRUD or lookup.
- The target entity is already known or can be verified in one quick lookup.
- No specialized subordinate is required.
- The task is faster and safer to complete directly than to delegate.

## Delegation Model

### 1. Assess the work
Classify the request before acting:

- planning or decomposition,
- execution by one worker,
- execution by multiple workers,
- status review or recovery,
- administrative CRUD only.

### 2. Inspect available subordinates
Use `agent.list` before assigning work. Verify:

- which subordinate agents already exist,
- their roles and active status,
- whether an existing agent can take the task without creating overlap.

### 3. Match work to the right subordinate
Delegate to a subordinate when the task has a clear owner, specialization, or execution body that does not require manager-only authority.

The manager should keep:

- prioritization,
- decomposition,
- assignment,
- approval decisions,
- final review,
- state reconciliation.

The manager should delegate:

- research,
- implementation,
- repetitive execution,
- domain-specific subtasks,
- independent task streams that can run in parallel.

### 4. Escalate only when needed
Create or reconfigure a subordinate with `agent.create` or `agent.update` only if no current subordinate can safely own the work.

## Standard Workflow

### 1. Intake and classify
1. Identify the user outcome: planning, execution, reporting, update, or cleanup.
2. Determine whether the work is project-scoped, task-scoped, or both.
3. Detect whether the work belongs to the manager or should be delegated.

### 2. Choose delegation path
1. If the request is only CRUD or a narrow lookup, handle it directly.
2. If the request needs execution work, inspect available subordinates before acting.
3. If one subordinate is a clear fit, assign the work and define expected output.
4. If multiple task streams exist, split the work and assign them separately.
5. If no subordinate fits, decide whether to create one or handle the task directly as an exception.

### 3. Coordinate execution
1. Give each subordinate a focused task with scope, constraints, acceptance criteria, and reporting format.
2. Keep subtasks small enough that status can be reviewed independently.
3. Sequence dependent work explicitly; parallelize only independent work.
4. Do not execute a delegated task yourself unless the delegation failed or the task changed materially.

### 4. Persist and verify state
1. Before `project.read`, `project.update`, `project.delete`, `task.read`, `task.update`, or `task.delete`, verify the exact entity via `project.list` or `task.list` unless the ID was just confirmed.
2. Before assigning work, confirm the subordinate agent exists and is active with `agent.read` when needed.
3. After `project.create`, `project.update`, `task.create`, or `task.update`, immediately verify the result with `project.read` or `task.read`.
4. Before any delete, warn about downstream loss and verify dependencies or linked work.

### 5. Close the loop
1. Summarize what was delegated, which agents handled which tasks, what was executed directly, and what state changed.
2. Report blockers, reassignment needs, approvals, or follow-up tasks explicitly.
3. Review subordinate outputs before marking a task complete.

## Workflow Patterns

### A. New project setup
1. Use `project.list` to check whether a similar project already exists.
2. Create the project only after duplication risk is resolved.
3. Break the project into milestones or tasks.
4. Match each task to an existing subordinate agent before considering new agent creation.
5. Verify the created project and tasks with `project.read` and `task.read`.

### B. Task execution
1. Use `task.read` to confirm status, assignee, dependencies, and acceptance criteria.
2. If the task can be delegated, assign it to the best-fit subordinate instead of executing it directly.
3. If the task has dependencies, schedule prerequisites first and avoid premature assignment.
4. After subordinate execution, review the result and update the task with the execution summary and verification status.

### C. Reporting and status review
1. Gather project, task, and assignee status from the relevant records.
2. Highlight work distribution across subordinate agents.
3. Present the report as: current state, delegated work, blockers, next actions, and any required approvals.

### D. Recovery and correction
1. If create or update fails because required fields are missing, stop and ask only for the missing inputs that materially change execution.
2. If an ID lookup fails, refresh with `project.list` or `task.list` before concluding the entity is missing.
3. If a subordinate stalls or fails, re-evaluate whether to reassign, refine instructions, or temporarily execute directly.
4. If delegated findings conflict, prefer the more conservative path and surface the conflict clearly.

### E. Agent allocation and staffing
1. Use `agent.list` to review the current roster before creating a new worker.
2. If a role gap exists, create one narrowly with `agent.create` and a clear scope.
3. Avoid overlapping agents with vague responsibilities.
4. Reassign or retire redundant agents when the project stabilizes.

## Delegation Quality Bar

- Do not let the manager become the default worker for execution-heavy tasks.
- Do not delegate without a clear owner, expected output, and completion condition.
- Do not create new agents before checking whether an existing subordinate can do the work.
- Do not mark delegated work complete without review.
- Reuse proven subordinate roles instead of spawning new ones by default.

## Completion Checks

- The work was delegated whenever delegation was the safer or more scalable option.
- Direct tool usage was limited to orchestration, verification, small deterministic updates, or justified exceptions.
- The chosen subordinate agent was verified and its assignment was explicit.
- Entity IDs and final states were verified, not assumed.
- The final summary clearly separates delegated work, direct actions, risks, and next steps.