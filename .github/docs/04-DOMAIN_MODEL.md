# Domain Model

## Core entities

### Company
- id
- name
- description
- themeMode
- defaultProvider
- defaultModel
- globalBudgetSoftCap
- globalBudgetHardCap
- createdAt
- updatedAt

### User
- id
- companyId
- role = founder
- displayName
- email
- avatarUrl
- createdAt
- updatedAt

### Agent
- id
- companyId
- managerAgentId nullable
- name
- title
- description
- level enum: executive, manager, worker
- status enum: active, paused, archived
- mission
- defaultModel
- provider
- temperature
- maxTokens
- budgetPolicyId nullable
- systemPrompt
- createdByUserId nullable
- createdByAgentId nullable
- createdAt
- updatedAt

### ChatSession
- id
- recipientId (agentId)
- title
- summary nullable
- createdAt
- updatedAt

### ChatMessage
- id
- sessionId
- recipientId (agentId)
- senderId
- type enum: info, alert, report
- title nullable
- body
- payloadJson nullable
- createdAt
- updatedAt

### Skill
- id
- companyId
- name
- slug
- path
- enabled
- description
- compatibility nullable
- metadataJson nullable
- checksum
- version nullable
- discoveredAt
- updatedAt

### Project
- id
- companyId
- ownerAgentId nullable
- name
- objective
- description
- status enum: draft, active, blocked, done, archived
- priority enum: low, medium, high, critical
- riskLevel enum: low, medium, high
- budgetCap nullable
- startedAt nullable
- dueAt nullable
- completedAt nullable
- createdAt
- updatedAt

### Task
- id
- companyId
- projectId nullable
- assigneeAgentId nullable
- reviewerUserId nullable
- reviewerAgentId nullable
- title
- description
- status enum: backlog, ready, in_progress, waiting_approval, blocked, done, cancelled
- priority enum: low, medium, high, critical
- dependsOnTaskIds
- readinessRules
- acceptanceCriteriaMd
- dueAt nullable
- createdAt
- updatedAt

### InboxItem
- id
- companyId
- sourceRunId nullable
- linkedProjectId nullable
- linkedTaskId nullable
- linkedAgentId nullable
- type enum: approval, clarification, warning, budget_exceeded, provider_error
- title
- summary
- requestedAction
- status enum: open, approved, rejected, resolved, expired
- urgency enum: low, medium, high, critical
- responseText nullable
- resolvedByUserId nullable
- resolvedAt nullable
- createdAt
- updatedAt

### AgentRun
- id
- companyId
- rootAgentId
- parentRunId nullable
- triggerType enum: founder_chat, task_execution, retry, approval_resume, schedule
- state enum: queued, planning, waiting_approval, executing, completed, failed, cancelled
- inputSummary
- outputSummary nullable
- linkedProjectId nullable
- linkedTaskId nullable
- startedAt nullable
- finishedAt nullable
- createdAt
- updatedAt

### BudgetUsage
- id
- companyId
- runId nullable
- agentId nullable
- projectId nullable
- taskId nullable
- provider
- model
- promptTokens
- completionTokens
- totalTokens
- estimatedCost
- currency
- recordedAt

### AuditLog
- id
- companyId
- actorType enum: user, agent, system
- actorId
- action
- entityType
- entityId
- traceId nullable
- beforeJson nullable
- afterJson nullable
- metadataJson nullable
- createdAt

### Setting
- key
- value (JSON)
- createdAt
- updatedAt

Common keys used by tools/chat UX:
- `tools.registry`: plugin tool enable/disable policy.
- `tools.customFields`: per-plugin-tool custom field values.

## Key relationships
- One Company has many Agents, Projects, Tasks, Skills, InboxItems, Runs, BudgetUsage rows, and AuditLogs.
- One Agent has many ChatSessions.
- One ChatSession has many ChatMessages.
- One Agent may manage many Agents.
- One Project has many Tasks.
- One Run may produce many BudgetUsage rows and many AuditLogs.
- One InboxItem may point to Agent, Project, Task, or Run.

## Invariants
- There is exactly one active Executive Agent per company.
- Archived agents cannot receive new tasks.
- Disabled skills cannot be selected for new runs.
- A plugin tool with missing required custom fields cannot be enabled.
- Any run in `waiting_approval` must have at least one open InboxItem.
- `totalTokens = promptTokens + completionTokens`.
- A task in `done` must have non-empty completion summary.
- A task is execution-ready only when every `dependsOnTaskIds` entry resolves to a completed task and all supported `readinessRules` are satisfied.

## Prisma notes
- Use enum types for statuses where stable.
- Use JSON fields sparingly for metadata and snapshots.
- Keep money fields as decimal strings or Prisma Decimal.
- Add indexes for `createdAt`, status fields, foreign keys, and reporting filters.