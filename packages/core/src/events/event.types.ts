export interface FamilyCoEvents {
  'agent.created': { agentId: string };
  'agent.paused': { agentId: string };
  'agent.updated': { agentId: string };
  'agent.deleted': { agentId: string };
  'task.created': { taskId: string; projectId: string };
  'task.updated': { taskId: string; projectId: string };
  'task.status.updated': { taskId: string; status: string };
  'task.priority.updated': { taskId: string; priority: string };
  'task.deleted': { taskId: string; projectId: string };
  'approval.requested': { actorId: string; action: string };
  'approval.decided': { approvalId: string; status: string };
  'agent.run.started': { agentId: string; agentName: string; taskId: string; sessionId: string; taskTitle: string };
  'agent.run.step': { agentId: string; taskId: string; sessionId: string; step: number; toolName: string; summary: string };
  'agent.run.completed': { agentId: string; taskId: string; sessionId: string; status: string; summary: string };
  'agent.run.failed': { agentId: string; taskId: string; sessionId: string; error: string };
}
