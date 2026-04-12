# Product Requirements Document

## Goal
Build a product that lets a Founder run a company composed of AI agents through a single operating platform.

## Success criteria
- Founder can issue a directive in chat and receive a structured execution plan.
- Executive Agent can create projects, tasks, and subordinate agents.
- Agents can pause for approval using Inbox items.
- Founder can inspect audit history and token/cost usage.
- Founder can enable or disable skills.
- Founder can configure company settings and model providers.

## Functional requirements

### FR-01 Chat
- Founder can start a conversation with the Executive Agent.
- Messages can include plain text and references to projects, tasks, agents, and inbox items.
- Chat messages can trigger workflows.
- Chat transcript must preserve agent decisions and clarifications.
- AI responses should be structured, concise, and operational.

### FR-02 Agent Management
- Founder can view all agents.
- Founder can create, edit, archive, pause, resume, and delete agents.
- Founder can assign manager relationships between agents.
- Each agent has role, mission, tools/skills, status, budget policy, and model settings.
- Executive Agent may create subordinate agents, but creation requires founder approval unless policy says otherwise.

### FR-03 Project Management
- Founder and Executive Agent can create projects.
- A project contains objective, scope, owner, status, milestones, risk level, and budget cap.
- Projects can be linked to tasks, inbox items, and audit logs.
- Projects support status lifecycle: draft, active, blocked, done, archived.

### FR-04 Task Management
- Tasks belong to a project or exist standalone.
- Tasks have assignee agent, reviewer, status, due date, priority, dependencies, and acceptance criteria.
- Tasks support status lifecycle: backlog, ready, in_progress, waiting_approval, blocked, done, cancelled.
- Agents can update task progress.
- Tasks can generate inbox items when clarification or approval is needed.

### FR-05 Inbox
- Inbox is the Founder’s approval and clarification queue.
- Inbox items include type, title, summary, requested action, linked entities, urgency, and deadline.
- Founder can approve, reject, request changes, or answer a clarification.
- AI execution resumes based on inbox resolution.

### FR-06 Audit Log
- The system records meaningful actions across chat, agents, projects, tasks, skills, settings, and budget.
- Audit entries must include actor, action, entity type, entity id, timestamp, and metadata.
- Important changes should store before/after snapshots when practical.
- Audit entries should be filterable by date, module, actor, and entity.

### FR-07 Budget
- Track prompt tokens, completion tokens, total tokens, estimated cost, model, and provider.
- Aggregate usage by company, agent, project, task, run, day, week, and month.
- Show trend reporting and top spenders.
- Support soft and hard budget caps.
- Exceeding a cap can create an inbox item instead of continuing execution.

### FR-08 Skills
- Founder can view all detected skills.
- Founder can enable or disable a skill.
- Skills are stored at `{CODEBASE}/skills/{SKILL_NAME}/SKILL.md`.
- Skills should support metadata, description, compatibility, and optional supporting files.
- Agent assignment logic should only use enabled skills.

### FR-09 Settings
- Founder can change company name and description.
- Founder can switch light or dark mode.
- Founder can configure AI providers such as OpenAI and Claude using API keys.
- Founder can define global defaults for model, temperature, cost guardrails, and approval behavior.

## Non-functional requirements
- Desktop-first experience.
- Shared business logic across web and desktop.
- SQLite for v1 local persistence.
- Prisma as ORM and schema authority.
- Monorepo with PNPM.
- UI must feel fast and operational.
- Core flows must work offline on desktop except provider-dependent executions.
- Every feature must be auditable.

## Acceptance criteria by milestone
### M1 Foundation
- Repo boots for desktop, web, and server.
- Prisma schema works.
- Authentication can be mocked locally.
- Basic layout and navigation exist.

### M2 Company operations
- Chat, Agents, Projects, Tasks, Inbox CRUD working.
- Executive Agent orchestration stub working.
- Audit log and budget ingestion pipeline working.

### M3 System intelligence
- Skill detection and toggling working.
- Approval flow blocks risky actions.
- Budget caps and reporting working.
- Provider settings working.

### M4 Production hardening
- Better error handling.
- Retry logic.
- Better filtering and reporting.
- Packaging for desktop.