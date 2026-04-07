export interface FamilyCoEvents {
  'agent.created': { agentId: string };
  'agent.paused': { agentId: string };
  'agent.updated': { agentId: string };
  'task.created': { taskId: string; projectId: string };
  'task.updated': { taskId: string; projectId: string };
  'task.status.updated': { taskId: string; status: string };
  'task.priority.updated': { taskId: string; priority: string };
  'task.deleted': { taskId: string; projectId: string };
  'approval.requested': { actorId: string; action: string };
  'approval.decided': { approvalId: string; status: string };
}
