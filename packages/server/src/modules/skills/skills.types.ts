export interface SkillItem {
  id: string;
  name: string;
  description: string;
  version: string | null;
  tags: string[];
  path: string;
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

export interface SkillsRegistry {
  enabled: string[];
  updatedAt: string;
}

