---
name: project-management
description: Comprehensive skill for managing projects and tasks. Use this to list, create, read, and delete project or task entities systematically.
metadata: 
  version: 1.0
  default: true
  apply_to: ['L0', 'L1', 'L2']
  tags: ['project management', 'task management', 'workflow']
---

# Project Management Guide

This skill provides standardized protocols for the Agent to interact with the project management system using the `project.*` and `task.*` toolsets.

## 1. Tool Usage Best Practices

- **Verify Before Action:** Always invoke `project.list` or `task.list` to confirm the exact ID/Entity before performing `read`, `update`, or `delete`. Never assume or hallucinate IDs.
- **State Validation:** Immediately after a `project.create` or `task.create` call, execute a `*.read` command to verify that data was persisted correctly.
- **Safety First:** Before executing `project.delete`, warn the user about potential cascading effects (e.g., losing all associated tasks).

## 2. Standard Workflows

Follow these structured workflows for common project and task management scenarios to ensure consistency and reliability in operations.

### A. New Project Initialization
1. Call `project.list` to ensure the project name is unique and avoid duplicates.
2. Execute `project.create` with required parameters (name, description, etc.).
3. Use `project.read` to retrieve the system-generated ID and metadata.
4. (Optional) Chain with `task.create` to set up initial milestones for the new project.

### B. Querying & Reporting
1. Use `project.list` to identify the target project ID.
2. Call `task.list` filtered by `project_id` to gather all related work items.
3. If detailed status is needed, use `task.read` on key tasks to compile a summary report.

### C. Error Handling & Recovery
- **Missing Info:** If `task.create` fails due to missing fields, stop and prompt the user for specific details (e.g., deadline, assignee).
- **ID Not Found:** If a specific ID lookup fails, re-run the `list` command to refresh the local cache before reporting an error.

## 3. Task Handle Workflows

Follow these specific protocols when managing tasks to ensure consistency and reliability in task handling.

### A. Task Update & Progression
1. Use `task.read` to confirm the current status and assignee of the task.
2. If updating status, ensure the new status follows the allowed workflow (e.g., `in_progress` → `review` → `blocked` (optional) → `done`).
3. When reassigning, verify the new assignee's agent ID exists and is active before updating.
4. After any update, log a comment on the task.

### B. Task Completion & Closure
1. Before marking a task as `done`, ensure all subtasks (if any) are also completed.
2. Use `task.read` to confirm no blockers are present. If blockers exist, update the status to `blocked` and notify the manager.
3. Upon successful completion, add a final comment summarizing the work done and any relevant outcomes.

### C. Task Deletion Protocol
1. Before deleting a task, check for dependencies (e.g., linked subtasks or project associations).
2. If dependencies exist, either reassign them or warn the user about potential data loss.
3. After deletion, confirm the task is removed by attempting a `task.read` and handling the expected "not found" response gracefully.

## 4. Constraints & Guidelines
- **Privacy:** Do not expose sensitive tokens or system-level metadata from `project.read` unless explicitly requested.
- **Efficiency:** Minimize redundant `list` calls within a single session if the state hasn't changed.
- **Consistency:** Follow the project’s naming convention (e.g., kebab-case or Title Case) as defined in the project settings.