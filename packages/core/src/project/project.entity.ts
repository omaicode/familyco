export interface Project {
  id: string;
  name: string;
  description: string;
  ownerAgentId: string;
  parentProjectId: string | null;
  dirPath: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProjectInput {
  name: string;
  description: string;
  ownerAgentId: string;
  parentProjectId?: string | null;
  dirPath?: string | null;
}

export interface UpdateProjectInput {
  name: string;
  description: string;
  ownerAgentId: string;
  parentProjectId?: string | null;
}
