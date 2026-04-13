import type { AgentService, ProjectService, SettingsService } from '@familyco/core';
import { ensureProjectWorkspaceDir } from '../project/workspace-dir';
import { asNonEmptyString } from '../../tools/tool.helpers';

interface ResolveExecutiveAgentIdInput {
  agentService: AgentService;
  settingsService: SettingsService;
}

interface ResolveDefaultProjectIdInput extends ResolveExecutiveAgentIdInput {
  projectService: ProjectService;
}

export async function resolveExecutiveAgentId(
  input: ResolveExecutiveAgentIdInput
): Promise<string> {
  const storedExecutiveAgentId = await input.settingsService.get('defaults.executiveAgentId');
  if (typeof storedExecutiveAgentId?.value === 'string' && storedExecutiveAgentId.value.length > 0) {
    try {
      const existingAgent = await input.agentService.getAgentById(storedExecutiveAgentId.value);
      return existingAgent.id;
    } catch {
      // Ignore stale stored defaults and resolve from live data below.
    }
  }

  const executiveAgent = await input.agentService.findExecutiveAgent();
  if (!executiveAgent) {
    throw new Error('SETUP_REQUIRED:No executive agent is available yet');
  }

  await input.settingsService.upsert({
    key: 'defaults.executiveAgentId',
    value: executiveAgent.id
  });

  return executiveAgent.id;
}

export async function resolveDefaultProjectId(
  input: ResolveDefaultProjectIdInput
): Promise<string> {
  const storedDefaultProjectId = await input.settingsService.get('defaults.projectId');
  const knownProjects = await input.projectService.listProjects();

  if (typeof storedDefaultProjectId?.value === 'string' && storedDefaultProjectId.value.length > 0) {
    const existing = knownProjects.find((project) => project.id === storedDefaultProjectId.value);
    if (existing) {
      return existing.id;
    }
  }

  const executiveAgentId = await resolveExecutiveAgentId(input);
  const companyNameSetting = await input.settingsService.get('company.name');
  const companyName =
    typeof companyNameSetting?.value === 'string' && companyNameSetting.value.trim().length > 0
      ? companyNameSetting.value.trim()
      : 'FamilyCo';

  const existingDefaultProject = knownProjects.find(
    (project) => project.ownerAgentId === executiveAgentId && project.name === `Default`
  );

  if (existingDefaultProject) {
    await input.settingsService.upsert({
      key: 'defaults.projectId',
      value: existingDefaultProject.id
    });

    return existingDefaultProject.id;
  }

  let projectDirPath: string | null = null;
  const workspaceSetting = await input.settingsService.get('workspace.path').catch(() => null);
  const dirPath = await ensureProjectWorkspaceDir(
    typeof workspaceSetting?.value === 'string' ? workspaceSetting.value : null,
    'default'
  ).catch(() => null);

  if (dirPath) {
    projectDirPath = dirPath;
  }  

  const createdProject = await input.projectService.createProject({
    name: `Default`,
    description: 'Default project for founder requests that are routed to the L0 executive agent.',
    ownerAgentId: executiveAgentId,
    dirPath: projectDirPath
  });

  await input.settingsService.upsert({
    key: 'defaults.projectId',
    value: createdProject.id
  });

  return createdProject.id;
}
