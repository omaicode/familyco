import type { FamilyCoApiContracts, SkillListItem, SkillsListResponse } from '../api/contracts.js';
import { createAsyncState, type AsyncState } from './async-state.js';

const EMPTY_SKILLS_RESPONSE: SkillsListResponse = {
  items: [],
  invalidSkills: []
};

export class SkillsStore {
  state: AsyncState<SkillsListResponse>;

  constructor(private readonly api: FamilyCoApiContracts) {
    this.state = createAsyncState<SkillsListResponse>(EMPTY_SKILLS_RESPONSE);
  }

  async load(): Promise<void> {
    this.state.isLoading = true;
    this.state.errorMessage = null;

    try {
      const response = await this.api.listSkills();
      this.state.data = response;
      this.state.isEmpty = response.items.length === 0;
    } catch (error) {
      this.state.errorMessage = error instanceof Error ? error.message : 'Failed to load skills';
    } finally {
      this.state.isLoading = false;
    }
  }

  async enable(skillId: string): Promise<SkillListItem> {
    const updated = await this.api.enableSkill(skillId);
    this.applyUpdate(updated);
    return updated;
  }

  async disable(skillId: string): Promise<SkillListItem> {
    const updated = await this.api.disableSkill(skillId);
    this.applyUpdate(updated);
    return updated;
  }

  private applyUpdate(skill: SkillListItem): void {
    const exists = this.state.data.items.some((item) => item.id === skill.id);
    const nextItems = exists
      ? this.state.data.items.map((item) => (item.id === skill.id ? skill : item))
      : [skill, ...this.state.data.items];

    this.state.data = {
      ...this.state.data,
      items: nextItems
    };
    this.state.isEmpty = this.state.data.items.length === 0;
  }
}

export function createSkillsStore(api: FamilyCoApiContracts): SkillsStore {
  return new SkillsStore(api);
}

