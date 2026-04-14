export interface SkillItem {
  id: string;
  name: string;
  description: string;
  version: string | null;
  tags: string[];
  path: string;
  content?: string;
  source: 'local';
  enabled: boolean;
}

export interface InvalidSkillItem {
  id: string;
  path: string;
  reason: string;
}

export interface SkillsListResponse {
  items: SkillItem[];
  invalidSkills: InvalidSkillItem[];
}

export interface DiscoveredSkillItem {
  id: string;
  name: string;
  description: string;
  version: string | null;
  tags: string[];
  path: string;
  source: 'local';
  defaultEnabled: boolean;
  applyTo: string[];
}

export interface SkillAgentTarget {
  level?: string | null;
  id?: string | null;
  name?: string | null;
}

export interface SkillsRegistry {
  enabled: string[];
  disabled: string[];
  updatedAt: string;
}
