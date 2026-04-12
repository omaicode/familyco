# Module Specifications

## 1. Chat
### Purpose
Primary command center for the Founder.

### Main UI areas
- conversation list
- message timeline
- context sidebar
- quick actions

### Required behaviors
- Founder can send a directive.
- Messages may reference projects, tasks, agents, and inbox items.
- AI replies should contain structured sections: understanding, plan, approvals, next steps.
- Chat should display when an action created or updated entities.
- Chat should link to related project/task/inbox items.

## 2. Agents
### Required views
- agent list
- agent detail
- hierarchy tree
- create/edit form

### Required actions
- create
- edit
- archive
- pause/resume
- assign manager
- assign skills
- inspect budget usage

## 3. Projects
### Required views
- list with filters
- board or status columns
- detail page
- milestone summary

### Required actions
- create project
- edit scope and status
- assign owner agent
- link tasks
- review risk and budget cap

## 4. Tasks
### Required views
- list
- kanban or grouped list
- detail panel

### Required actions
- create task
- assign assignee agent
- update status
- add dependencies
- add acceptance criteria
- send for approval

## 5. Inbox
### Purpose
Founder handles approval and clarification without reading the full audit trail.

### Required actions
- approve
- reject
- request change
- answer clarification
- jump to related entity

### Display priorities
- newest critical first
- show why execution is blocked
- show effect of approve vs reject

## 6. Audit Log
### Required filters
- time range
- actor type
- action
- entity type
- entity id
- trace id

### Required entry content
- actor
- action
- target
- timestamp
- human-readable summary
- raw metadata drawer

## 7. Budget
### Required cards
- total spend
- total tokens
- monthly trend
- top costly agents
- top costly projects
- cap warnings

### Required drill-downs
- by provider
- by model
- by run
- by day/week/month

## 8. Skills
### Required views
- skill inventory
- enable/disable toggle
- metadata preview
- compatibility display
- file path display

### Required actions
- rescan skills folder
- enable skill
- disable skill
- inspect skill detail

## 9. Settings
### Required sections
- company profile
- appearance
- providers
- defaults
- approvals and budget guardrails

### Provider fields
- provider name
- api key
- base url optional
- default model
- connection status