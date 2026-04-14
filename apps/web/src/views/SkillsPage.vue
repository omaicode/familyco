<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { RefreshCw, Sparkles, AlertTriangle } from 'lucide-vue-next';

import { uiRuntime } from '../runtime';
import SkeletonList from '../components/SkeletonList.vue';
import { useI18n } from '../composables/useI18n';
import type { SkillListItem } from '@familyco/ui';

const { t } = useI18n();
const isRefreshing = ref(false);
const pendingSkillId = ref<string | null>(null);
const selectedSkill = ref<SkillListItem | null>(null);

const state = computed(() => uiRuntime.stores.skills.state);
const skills = computed(() => state.value.data.items);
const invalidSkills = computed(() => state.value.data.invalidSkills);

const refresh = async (): Promise<void> => {
  isRefreshing.value = true;
  try {
    await uiRuntime.stores.skills.load();
  } finally {
    isRefreshing.value = false;
  }
};

const toggleSkill = async (skill: SkillListItem): Promise<void> => {
  pendingSkillId.value = skill.id;
  try {
    if (skill.enabled) {
      await uiRuntime.stores.skills.disable(skill.id);
    } else {
      await uiRuntime.stores.skills.enable(skill.id);
    }
  } finally {
    pendingSkillId.value = null;
  }
};

const viewSkill = (skill: SkillListItem): void => {
  selectedSkill.value = skill;
};

const closeSkillModal = (): void => {
  selectedSkill.value = null;
};

onMounted(() => {
  void uiRuntime.stores.skills.load();
});
</script>

<template>
  <section>
    <div class="fc-page-header">
      <div>
        <h3>{{ t('Skills') }}</h3>
        <p>{{ t('Manage local SKILL.md adapters and enable only what your company uses.') }}</p>
      </div>
      <button class="fc-btn-primary" :disabled="isRefreshing" @click="refresh">
        <RefreshCw :size="14" :class="{ 'fc-spin': isRefreshing }" />
        {{ isRefreshing ? t('Refreshing…') : t('Refresh skills') }}
      </button>
    </div>

    <div v-if="state.isLoading" class="fc-loading">
      <p style="margin:0 0 10px;font-size:0.875rem;color:var(--fc-text-muted);">{{ t('Loading skills…') }}</p>
      <SkeletonList />
    </div>

    <div v-else-if="state.errorMessage" class="fc-error">
      <p>{{ state.errorMessage }}</p>
      <button class="fc-btn-secondary" @click="refresh">{{ t('Retry') }}</button>
    </div>

    <template v-else>
      <article v-if="invalidSkills.length > 0" class="fc-warning" style="margin-bottom: 14px;">
        <AlertTriangle :size="16" />
        <div style="display:flex; flex-direction:column; gap:6px;">
          <strong>{{ t('Invalid skills') }}</strong>
          <span>{{ t('Some SKILL.md files could not be parsed.') }}</span>
          <ul style="margin:0; padding-left: 18px;">
            <li v-for="item in invalidSkills" :key="item.path">
              {{ item.path }} — {{ item.reason }}
            </li>
          </ul>
        </div>
      </article>

      <div v-if="skills.length === 0" class="fc-empty">
        <Sparkles :size="22" class="fc-empty-icon" />
        <h4>{{ t('No local skills found') }}</h4>
        <p>{{ t('Create a folder in skills path with a SKILL.md file to register a new skill.') }}</p>
      </div>

      <article v-else class="fc-card">
        <table class="fc-budget-table">
          <thead>
            <tr>
              <th>{{ t('Name') }}</th>
              <th>{{ t('Actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="skill in skills" :key="skill.id">
              <td>
                <div style="display:flex; flex-direction:column; gap:4px;">
                  <strong>{{ skill.name }}</strong>
                  <span class="fc-list-meta skills-description">{{ skill.description }}</span>
                </div>
              </td>
              <td>
                <div class="fc-inline-actions">
                  <button class="fc-btn-secondary" @click="viewSkill(skill)">
                    {{ t('View') }}
                  </button>
                  <button
                    class="fc-btn-secondary"
                    :disabled="pendingSkillId === skill.id"
                    @click="toggleSkill(skill)"
                  >
                    {{
                      pendingSkillId === skill.id
                        ? t('Refreshing…')
                        : skill.enabled
                          ? t('Disable')
                          : t('Enable')
                    }}
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

      </article>

      <div
        v-if="selectedSkill"
        class="skills-modal-wrap"
        @click.self="closeSkillModal"
      >
        <div class="skills-modal" role="dialog" aria-modal="true" :aria-label="selectedSkill.name">
          <div class="skills-modal-header">
            <div>
              <h4 class="fc-card-title">{{ selectedSkill.name }}</h4>
              <p class="fc-list-meta">{{ t('Details') }}</p>
            </div>
            <button class="fc-btn-secondary" @click="closeSkillModal">{{ t('Close') }}</button>
          </div>

          <p class="skills-modal-description">{{ selectedSkill.description }}</p>

          <dl class="fc-list-meta" style="display:grid; grid-template-columns: auto 1fr; gap:4px 10px; margin-top: 10px;">
            <dt>{{ t('ID') }}</dt><dd>{{ selectedSkill.id }}</dd>
            <dt>{{ t('Version') }}</dt><dd>{{ selectedSkill.version ?? '—' }}</dd>
            <dt>{{ t('Source') }}</dt><dd>{{ selectedSkill.source }}</dd>
            <dt>{{ t('Path') }}</dt><dd>{{ selectedSkill.path }}</dd>
            <dt>{{ t('Tags') }}</dt><dd>{{ selectedSkill.tags.length > 0 ? selectedSkill.tags.join(', ') : '—' }}</dd>
            <dt>{{ t('Status') }}</dt>
            <dd>{{ selectedSkill.enabled ? t('Enabled') : t('Disabled') }}</dd>
          </dl>
        </div>
      </div>
    </template>
  </section>
</template>

<style scoped>
.skills-description {
  max-width: 620px;
  white-space: normal;
  overflow-wrap: anywhere;
}

.skills-modal-wrap {
  position: fixed;
  inset: 0;
  z-index: 60;
  background: rgba(15, 23, 42, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.skills-modal {
  width: min(760px, 100%);
  max-height: min(85vh, 760px);
  overflow: auto;
  border: 1px solid var(--fc-border);
  border-radius: 12px;
  background: var(--fc-surface);
  padding: 16px;
}

.skills-modal-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.skills-modal-description {
  margin-top: 10px;
  max-width: 640px;
  white-space: normal;
  overflow-wrap: anywhere;
}
</style>
