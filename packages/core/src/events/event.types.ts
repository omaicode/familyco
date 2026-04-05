export interface FamilyCoEvents {
  'agent.created': { agentId: string };
  'agent.paused': { agentId: string };
  'task.created': { taskId: string; projectId: string };
  'task.status.updated': { taskId: string; status: string };
  'approval.requested': { actorId: string; action: string };
}
