---
name: agent-orchestrator
description: High-level skill for managing and orchestrating subordinate agents. Use this to initialize, configure, and monitor the performance of worker agents.
metadata: 
  default: true
  apply_to: ['L0']
---

# Supervisory & Agent Management Skill

This skill empowers the Supervisory Agent to manage the entire agent fleet using the `agent.*` toolset.

## 1. Management Best Practices
- **Inventory Check:** Always invoke `agent.list` to review existing agents before creating new ones to avoid resource redundancy.
- **Precise Configuration:** When calling `agent.create`, strictly define the `role`, `goal`, and `backstory` to ensure the subordinate agent functions within its intended scope.
- **Active Monitoring:** Periodically use `agent.read` to inspect the status or activity logs of subordinates during long-running tasks.

## 2. Standard Orchestration Workflows

### A. Team Assembly
1. Call `agent.list` to audit the current workforce.
2. If a specific domain expert is missing, execute `agent.create` with optimized system prompts tailored for the tools that agent will handle.
3. Use `agent.read` to retrieve the unique ID and verify the agent's "Ready" state.

### B. Iteration & Optimization
1. If a subordinate agent underperforms, use `agent.update` to refine its system instructions or switch its underlying model.
2. Upon project completion, use `agent.delete` to decommission specialized agents that are no longer required.

### C. Conflict Resolution
- If two agents have overlapping responsibilities, use `agent.update` to clarify boundaries or `agent.delete` the redundant entity.

## 3. Safety & Constraints
- **Least Privilege:** Subordinate agents must never have access to `agent.*` tools (preventing self-deletion or unauthorized spawning).
- **Audit Trail:** Maintain a record of previous configurations before executing an `agent.update` for easy rollback.
