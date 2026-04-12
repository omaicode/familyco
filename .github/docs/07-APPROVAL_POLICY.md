# Approval Policy

## Purpose
Protect Founder control while preserving AI autonomy.

## Approval categories
### AP-01 Required before action
- create agent
- delete agent
- archive active project
- spend above hard cap
- rotate provider credentials
- modify company-wide defaults
- perform destructive bulk changes

### AP-02 Required unless policy override exists
- create project with high risk
- create recurring automation
- assign critical task to new agent
- call external APIs with side effects
- use premium model above cost threshold

### AP-03 Clarification instead of approval
- vague founder intent
- missing deadline
- missing budget cap
- conflicting project ownership
- unclear acceptance criteria

## Inbox item template
- type
- title
- why blocked
- recommendation
- impact if approved
- impact if rejected
- deadline if any
- related entities

## Resolution behavior
- approve: continue run from checkpoint.
- reject: cancel or re-plan.
- request change: create follow-up planning step.
- clarification answer: inject answer into run context and resume.

## Default budget policy
- soft cap: create warning inbox item.
- hard cap: block execution and require approval.