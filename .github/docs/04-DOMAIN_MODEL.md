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
- level enum: L0, L1, L2
- status enum: active, idle, running, error, paused, terminated, archived
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
- ownerAgentId
- name
- description
- parentProjectId nullable
- dirPath nullable
- createdAt
- updatedAt

### Task
- id
- projectId
- assigneeAgentId nullable
- title
- description
- status enum: pending, in_progress, review, done, blocked, cancelled
- priority enum: low, medium, high, urgent
- createdBy
- dependsOnTaskIds
- readinessRules
- createdAt
- updatedAt

### InboxMessage
- id
- recipientId
- senderId
- type enum: approval, report, alert, info
- title
- body
- status enum: unread, read, archived
- payload nullable
- createdAt
- updatedAt

### ApprovalRequest
- id
- actorId
- action
- targetId nullable
- status enum: pending, approved, rejected
- payload nullable
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

### CronJob
- id
- name
- prompt
- schedule
- agentId
- enabled
- sessionId nullable
- lastRunAt nullable
- nextRunAt nullable
- createdAt
- updatedAt

### CronRunRecord
- id
- cronId
- status enum: success, failed
- scheduledAt
- startedAt
- finishedAt
- input
- output nullable
- error nullable

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

### ApiKeyRecord
- id
- name
- keyHash
- active
- createdAt
- updatedAt

Common keys used by tools/chat UX:
- `tools.registry`: plugin tool enable/disable policy.
- `tools.customFields`: per-plugin-tool custom field values.

## Key relationships
- One Company has many Agents, Projects, Tasks, Skills, InboxMessages, ApprovalRequests, Runs, BudgetUsage rows, AuditLogs, and CronJobs.
- One Agent has many ChatSessions.
- One ChatSession has many ChatMessages.
- One Agent may manage many Agents.
- One Project has many Tasks.
- One Run may produce many BudgetUsage rows and many AuditLogs.
- One ApprovalRequest may block an AgentRun while waiting for review.
- One CronJob produces many CronRunRecord entries.

## Invariants
- There is exactly one active Executive Agent per company.
- Terminated or archived agents cannot receive new tasks.
- Disabled skills cannot be selected for new runs.
- A plugin tool with missing required custom fields cannot be enabled.
- Any run in `waiting_approval` should map to at least one pending ApprovalRequest.
- `totalTokens = promptTokens + completionTokens`.
- A task is execution-ready only when every `dependsOnTaskIds` entry resolves to a completed task and all supported `readinessRules` are satisfied.

## Prisma notes
- Use enum types for statuses where stable.
- Use JSON fields sparingly for metadata and snapshots.
- Keep money fields as decimal strings or Prisma Decimal.
- Add indexes for `createdAt`, status fields, foreign keys, and reporting filters.
