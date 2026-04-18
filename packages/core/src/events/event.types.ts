export interface FamilyCoEvents {
  'agent.created': { agentId: string };
  'agent.paused': { agentId: string };
  'agent.updated': { agentId: string };
  'agent.deleted': { agentId: string };
  'task.created': { taskId: string; projectId: string };
  'task.updated': { taskId: string; projectId: string };
  'task.status.updated': {
    taskId: string;
    status: string;
    source?: 'agent' | 'human' | 'system';
    actorId?: string;
  };
  'task.comment.added': {
    taskId: string;
    authorId: string;
    authorType: 'agent' | 'human';
    authorLabel?: string;
    body: string;
    commentId?: string;
  };
  'task.priority.updated': { taskId: string; priority: string };
  'task.deleted': { taskId: string; projectId: string };
  'approval.requested': { actorId: string; action: string };
  'approval.decided': { approvalId: string; status: string };
  'agent.run.started': { agentId: string; agentName: string; taskId: string; sessionId: string; taskTitle: string };
  'agent.run.step': { agentId: string; agentName: string; taskId: string; sessionId: string; step: number; toolName: string; summary: string };
  'agent.run.completed': { agentId: string; agentName: string; taskId: string; sessionId: string; status: string; summary: string };
  'agent.run.failed': { agentId: string; agentName: string; taskId: string; sessionId: string; error: string };
  'notification.created': {
    notificationId: string;
    recipientId: string;
    trigger: 'task.status.agent' | 'task.comment.agent' | 'inbox.approval.required' | 'budget.near.limit';
    severity: 'info' | 'warning' | 'alert';
    title: string;
    body: string;
    route: string;
    createdAt: string;
    payload?: Record<string, unknown>;
  };
}
