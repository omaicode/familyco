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

const state = computed(() => uiRuntime.stores.skills.state);
const skills = computed(() => state.value.data.items);
const invalidSkills = computed(() => state.value.data.invalidSkills);
const localSkillsPath = '/skills';

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
        <p>{{ t('Create a folder in skills path with a SKILL.md file to register a new skill.', { path: localSkillsPath }) }}</p>
      </div>

      <div v-else class="fc-budget-grid">
        <article v-for="skill in skills" :key="skill.id" class="fc-card">
          <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:10px;">
            <div>
              <h4 class="fc-card-title">{{ skill.name }}</h4>
              <p class="fc-card-desc">{{ skill.description }}</p>
            </div>
            <span class="fc-badge" :class="skill.enabled ? 'is-success' : 'is-muted'">
              {{ skill.enabled ? t('Enabled') : t('Disabled') }}
            </span>
          </div>

          <dl class="fc-list-meta" style="display:grid; grid-template-columns: auto 1fr; gap:4px 10px; margin-top: 10px;">
            <dt>{{ t('ID') }}</dt><dd>{{ skill.id }}</dd>
            <dt>{{ t('Version') }}</dt><dd>{{ skill.version ?? '—' }}</dd>
            <dt>{{ t('Source') }}</dt><dd>{{ skill.source }}</dd>
            <dt>{{ t('Path') }}</dt><dd>{{ skill.path }}</dd>
            <dt>{{ t('Tags') }}</dt><dd>{{ skill.tags.length > 0 ? skill.tags.join(', ') : '—' }}</dd>
          </dl>

          <div style="margin-top: 12px;">
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
        </article>
      </div>
    </template>
  </section>
</template>
