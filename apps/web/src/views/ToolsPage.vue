<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { RefreshCw, Wrench, Lock } from 'lucide-vue-next';

import { uiRuntime } from '../runtime';
import FcBanner from '../components/FcBanner.vue';
import FcPagination from '../components/FcPagination.vue';
import SkeletonList from '../components/SkeletonList.vue';
import { useI18n } from '../composables/useI18n';
import type { ToolListItem } from '@familyco/ui';
import { parseApiError } from '../utils/api-error';
import { useToast } from '../plugins/toast.plugin';

const { t } = useI18n();
const toast = useToast();
const isRefreshing = ref(false);
const pendingToolName = ref<string | null>(null);
const selectedTool = ref<ToolListItem | null>(null);
const isSavingCustomFields = ref(false);
const customFieldDraft = ref<Record<string, string | number | boolean>>({});
const customFieldError = ref<string | null>(null);
const feedback = ref<{ type: 'success' | 'error'; text: string } | null>(null);
const currentPage = ref(1);
const pageSize = ref(10);

type ToolSourceFilter = 'all' | 'built-in' | 'plugin';
type ToolStatusFilter = 'all' | 'enabled' | 'disabled';

const filters = reactive<{ query: string; source: ToolSourceFilter; status: ToolStatusFilter }>({
  query: '',
  source: 'all',
  status: 'all'
});

const state = computed(() => uiRuntime.stores.tools.state);
const tools = computed(() => state.value.data.items);
const normalizedQuery = computed(() => filters.query.trim().toLowerCase());
const hasActiveFilters = computed(
  () => normalizedQuery.value.length > 0 || filters.source !== 'all' || filters.status !== 'all'
);
const filteredTools = computed(() => {
  const query = normalizedQuery.value;
  const items = tools.value.filter((tool) => {
    if (filters.source !== 'all' && tool.source !== filters.source) {
      return false;
    }

    if (filters.status !== 'all') {
      const expectedEnabled = filters.status === 'enabled';
      if (tool.enabled !== expectedEnabled) {
        return false;
      }
    }

    if (!query) {
      return true;
    }

    const searchable = `${tool.name}\n${tool.description}\n${tool.pluginId ?? ''}`.toLowerCase();
    return searchable.includes(query);
  });

  return items.sort((left, right) => {
    if (left.enabled !== right.enabled) {
      return left.enabled ? -1 : 1;
    }

    if (left.source !== right.source) {
      return left.source === 'built-in' ? -1 : 1;
    }

    return left.name.localeCompare(right.name);
  });
});
const totalPages = computed(() => Math.max(1, Math.ceil(filteredTools.value.length / pageSize.value)));
const paginatedTools = computed(() => {
  const offset = (currentPage.value - 1) * pageSize.value;
  return filteredTools.value.slice(offset, offset + pageSize.value);
});
const selectedToolCustomFieldEntries = computed(() => Object.entries(selectedTool.value?.customFields ?? {}));

const setFeedback = (type: 'success' | 'error', text: string): void => {
  feedback.value = { type, text };
  setTimeout(() => {
    if (feedback.value?.text === text) {
      feedback.value = null;
    }
  }, 4000);
};

const formatMissingRequiredFields = (tool: ToolListItem): string => {
  return tool.missingRequiredCustomFields
    .map((fieldKey) => tool.customFields[fieldKey]?.name ?? fieldKey)
    .join(', ');
};

const getMissingConfigMessage = (tool: ToolListItem): string => {
  return t('Missing config: {{fields}}', { fields: formatMissingRequiredFields(tool) });
};

const getMissingRequiredFieldsMessage = (tool: ToolListItem): string => {
  return t('Missing required fields: {{fields}}', { fields: formatMissingRequiredFields(tool) });
};

const initializeCustomFieldDraft = (tool: ToolListItem): void => {
  const nextDraft: Record<string, string | number | boolean> = {};

  for (const [fieldKey, definition] of Object.entries(tool.customFields)) {
    const currentValue = tool.customFieldValues[fieldKey];

    if (typeof currentValue === 'undefined') {
      nextDraft[fieldKey] = definition.type === 'boolean' ? false : '';
      continue;
    }

    if (definition.type === 'boolean') {
      nextDraft[fieldKey] = currentValue === true;
      continue;
    }

    if (definition.type === 'number') {
      nextDraft[fieldKey] = typeof currentValue === 'number' ? currentValue : String(currentValue);
      continue;
    }

    nextDraft[fieldKey] = String(currentValue);
  }

  customFieldDraft.value = nextDraft;
  customFieldError.value = null;
};

const refresh = async (): Promise<void> => {
  isRefreshing.value = true;
  try {
    await uiRuntime.stores.tools.load();
  } finally {
    isRefreshing.value = false;
  }
};

const toggleTool = async (tool: ToolListItem): Promise<void> => {
  if (!tool.togglable) return;

  pendingToolName.value = tool.name;
  try {
    let updated: ToolListItem;
    if (tool.enabled) {
      updated = await uiRuntime.stores.tools.disable(tool.name);
      toast.success(t('Tool "{{name}}" has been disabled.', { name: tool.name }));
    } else {
      updated = await uiRuntime.stores.tools.enable(tool.name);
      toast.success(t('Tool "{{name}}" has been enabled.', { name: tool.name }));
    }

    if (selectedTool.value?.name === updated.name) {
      selectedTool.value = updated;
      initializeCustomFieldDraft(updated);
    }
  } catch (error) {
    const parsed = parseApiError(error);
    toast.error(parsed.message || t('Failed to update tool status.'));
  } finally {
    pendingToolName.value = null;
  }
};

const viewTool = (tool: ToolListItem): void => {
  selectedTool.value = tool;
  initializeCustomFieldDraft(tool);
};

const closeToolModal = (): void => {
  selectedTool.value = null;
  customFieldError.value = null;
};

const setDraftField = (fieldKey: string, value: string): void => {
  customFieldDraft.value = {
    ...customFieldDraft.value,
    [fieldKey]: value
  };
};

const setDraftBoolean = (fieldKey: string, value: boolean): void => {
  customFieldDraft.value = {
    ...customFieldDraft.value,
    [fieldKey]: value
  };
};

const saveCustomFields = async (): Promise<void> => {
  if (!selectedTool.value) {
    return;
  }

  const payload: Record<string, string | number | boolean | null> = {};
  for (const [fieldKey, definition] of Object.entries(selectedTool.value.customFields)) {
    const draftValue = customFieldDraft.value[fieldKey];

    if (definition.type === 'boolean') {
      payload[fieldKey] = draftValue === true;
      continue;
    }

    if (definition.type === 'number') {
      if (typeof draftValue === 'number' && Number.isFinite(draftValue)) {
        payload[fieldKey] = draftValue;
        continue;
      }

      const normalized = typeof draftValue === 'string' ? draftValue.trim() : '';
      if (!normalized) {
        payload[fieldKey] = null;
        continue;
      }

      const parsed = Number(normalized);
      payload[fieldKey] = Number.isFinite(parsed) ? parsed : null;
      continue;
    }

    const normalized = typeof draftValue === 'string' ? draftValue.trim() : '';
    payload[fieldKey] = normalized.length > 0 ? normalized : null;
  }

  isSavingCustomFields.value = true;
  customFieldError.value = null;

  try {
    const updated = await uiRuntime.stores.tools.updateCustomFields(selectedTool.value.name, payload);
    selectedTool.value = updated;
    initializeCustomFieldDraft(updated);
    setFeedback('success', t('Tool configuration saved.'));
  } catch (error) {
    const parsed = parseApiError(error);
    const message = parsed.message || t('Failed to save tool configuration.');
    customFieldError.value = message;
    setFeedback('error', message);
  } finally {
    isSavingCustomFields.value = false;
  }
};

const resetFilters = (): void => {
  filters.query = '';
  filters.source = 'all';
  filters.status = 'all';
};

watch(
  () => [filters.query, filters.source, filters.status],
  () => {
    currentPage.value = 1;
  }
);

watch(pageSize, () => {
  currentPage.value = 1;
});

watch(totalPages, (value) => {
  if (currentPage.value > value) {
    currentPage.value = value;
  }
});

onMounted(() => {
  void uiRuntime.stores.tools.load();
});
</script>

<template>
  <section>
    <Transition name="fc-banner">
      <FcBanner
        v-if="feedback"
        :type="feedback.type"
        closable
        style="margin-bottom:14px;"
        @close="feedback = null"
      >
        {{ feedback.text }}
      </FcBanner>
    </Transition>

    <div class="fc-page-header">
      <div>
        <h3>{{ t('Tools') }}</h3>
        <p>{{ t('Manage tool availability. Built-in tools remain fixed while plugin tools can be toggled.') }}</p>
      </div>
      <button class="fc-btn-primary" :disabled="isRefreshing" @click="refresh">
        <RefreshCw :size="14" :class="{ 'fc-spin': isRefreshing }" />
        {{ isRefreshing ? t('Refreshing…') : t('Refresh tools') }}
      </button>
    </div>

    <div v-if="state.isLoading" class="fc-loading">
      <p style="margin:0 0 10px;font-size:0.875rem;color:var(--fc-text-muted);">{{ t('Loading tools…') }}</p>
      <SkeletonList />
    </div>

    <div v-else-if="state.errorMessage" class="fc-error">
      <p>{{ state.errorMessage }}</p>
      <button class="fc-btn-secondary" @click="refresh">{{ t('Retry') }}</button>
    </div>

    <template v-else>
      <div v-if="tools.length === 0" class="fc-empty">
        <Wrench :size="22" class="fc-empty-icon" />
        <h4>{{ t('No tools found') }}</h4>
      </div>

      <article v-else class="fc-card">
        <div class="tools-filters">
          <input
            v-model="filters.query"
            class="fc-input"
            type="search"
            :placeholder="t('Search tools…')"
          />
          <select v-model="filters.source" class="fc-input">
            <option value="all">{{ t('All sources') }}</option>
            <option value="built-in">{{ t('Built-in') }}</option>
            <option value="plugin">{{ t('Plugin') }}</option>
          </select>
          <select v-model="filters.status" class="fc-input">
            <option value="all">{{ t('All statuses') }}</option>
            <option value="enabled">{{ t('Enabled') }}</option>
            <option value="disabled">{{ t('Disabled') }}</option>
          </select>
          <button class="fc-btn-ghost" :disabled="!hasActiveFilters" @click="resetFilters">
            {{ t('Reset filters') }}
          </button>
        </div>

        <div v-if="filteredTools.length === 0" class="fc-empty" style="margin-top: 8px;">
          <Wrench :size="22" class="fc-empty-icon" />
          <h4>{{ t('No matches for this filter') }}</h4>
          <p>{{ t('Try a wider search or clear the active filters.') }}</p>
          <button class="fc-btn-secondary" @click="resetFilters">{{ t('Reset filters') }}</button>
        </div>

        <table class="fc-budget-table">
          <template v-if="filteredTools.length > 0">
          <thead>
            <tr>
              <th>{{ t('Name') }}</th>
              <th>{{ t('Source') }}</th>
              <th>{{ t('Status') }}</th>
              <th>{{ t('Actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="tool in paginatedTools" :key="tool.name">
              <td>
                <div style="display:flex; flex-direction:column; gap:4px;">
                  <strong>{{ tool.name }}</strong>
                  <span class="fc-list-meta tools-description">{{ tool.description }}</span>
                </div>
              </td>
              <td>
                {{ tool.source === 'plugin' ? t('Plugin') : t('Built-in') }}
              </td>
              <td>
                {{ tool.enabled ? t('Enabled') : t('Disabled') }}
                <p v-if="tool.missingRequiredCustomFields.length > 0" class="fc-list-meta" style="margin:4px 0 0;">
                  {{ getMissingConfigMessage(tool) }}
                </p>
              </td>
              <td>
                <div class="fc-inline-actions">
                  <button class="fc-btn-secondary" @click="viewTool(tool)">
                    {{ t('View') }}
                  </button>
                  <button
                    class="fc-btn-secondary"
                    :disabled="pendingToolName === tool.name || !tool.togglable || (!tool.enabled && tool.missingRequiredCustomFields.length > 0)"
                    :title="
                      !tool.togglable
                        ? t('Built-in tools are always enabled.')
                        : (!tool.enabled && tool.missingRequiredCustomFields.length > 0)
                          ? t('Configure required fields before enabling this tool.')
                          : undefined
                    "
                    @click="toggleTool(tool)"
                  >
                    <template v-if="pendingToolName === tool.name">
                      {{ t('Refreshing…') }}
                    </template>
                    <template v-else-if="!tool.togglable">
                      <Lock :size="12" style="vertical-align:middle; margin-right:4px;" />
                      {{ t('Built-in') }}
                    </template>
                    <template v-else>
                      {{ tool.enabled ? t('Disable') : t('Enable') }}
                    </template>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
          </template>
        </table>

        <FcPagination
          v-if="filteredTools.length > 0"
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :total-items="filteredTools.length"
        />
      </article>

      <div
        v-if="selectedTool"
        class="tools-modal-wrap"
        @click.self="closeToolModal"
      >
        <div class="tools-modal" role="dialog" aria-modal="true" :aria-label="selectedTool.name">
          <div class="tools-modal-header">
            <div>
              <h4 class="fc-card-title">{{ selectedTool.name }}</h4>
              <p class="fc-list-meta">{{ t('Details') }}</p>
            </div>
            <button class="fc-btn-secondary" @click="closeToolModal">{{ t('Close') }}</button>
          </div>

          <p class="tools-modal-description">{{ selectedTool.description }}</p>

          <dl class="fc-list-meta" style="display:grid; grid-template-columns: auto 1fr; gap:4px 10px; margin-top: 10px;">
            <dt>{{ t('Source') }}</dt><dd>{{ selectedTool.source === 'plugin' ? t('Plugin') : t('Built-in') }}</dd>
            <dt>{{ t('Status') }}</dt><dd>{{ selectedTool.enabled ? t('Enabled') : t('Disabled') }}</dd>
            <dt>{{ t('ID') }}</dt><dd>{{ selectedTool.name }}</dd>
            <dt>{{ t('Plugin') }}</dt><dd>{{ selectedTool.pluginId ?? '—' }}</dd>
          </dl>

          <div style="margin-top: 12px;">
            <strong class="fc-list-meta">{{ t('Configuration') }}</strong>
            <p class="fc-list-meta" style="margin:6px 0 10px;">
              {{ t('Provide values for custom fields before enabling this tool.') }}
            </p>

            <p v-if="selectedToolCustomFieldEntries.length === 0" class="fc-list-meta" style="margin:0;">
              {{ t('No custom fields required for this tool.') }}
            </p>

            <div v-else class="tool-custom-fields-grid">
              <div
                v-for="[fieldKey, field] in selectedToolCustomFieldEntries"
                :key="fieldKey"
                class="tool-custom-field-item"
              >
                <label class="fc-label" :for="`tool-custom-field-${fieldKey}`" style="margin-bottom:4px; display:block;">
                  {{ field.name }}
                  <span v-if="field.required" style="color:var(--fc-error);">*</span>
                </label>
                <p v-if="field.description" class="fc-list-meta" style="margin:0 0 6px;">{{ field.description }}</p>

                <template v-if="field.type === 'boolean'">
                  <label class="fc-list-meta" style="display:flex; align-items:center; gap:8px; margin:0;">
                    <input
                      :id="`tool-custom-field-${fieldKey}`"
                      type="checkbox"
                      :checked="customFieldDraft[fieldKey] === true"
                      @change="setDraftBoolean(fieldKey, ($event.target as HTMLInputElement).checked)"
                    />
                    {{ t('Enabled') }}
                  </label>
                </template>

                <template v-else-if="field.type === 'select'">
                  <select
                    :id="`tool-custom-field-${fieldKey}`"
                    class="fc-input"
                    :value="typeof customFieldDraft[fieldKey] === 'string' ? customFieldDraft[fieldKey] : ''"
                    @change="setDraftField(fieldKey, ($event.target as HTMLSelectElement).value)"
                  >
                    <option value="">{{ t('Select an option') }}</option>
                    <option v-for="option in field.options ?? []" :key="option" :value="option">{{ option }}</option>
                  </select>
                </template>

                <template v-else>
                  <input
                    :id="`tool-custom-field-${fieldKey}`"
                    class="fc-input"
                    :type="field.type === 'number' ? 'number' : 'text'"
                    :value="String(customFieldDraft[fieldKey] ?? '')"
                    :placeholder="field.required ? t('Required') : t('Optional')"
                    @input="setDraftField(fieldKey, ($event.target as HTMLInputElement).value)"
                  />
                </template>
              </div>

              <div class="fc-toolbar" style="margin-top: 4px;">
                <button class="fc-btn-primary" :disabled="isSavingCustomFields" @click="saveCustomFields">
                  {{ isSavingCustomFields ? t('Saving…') : t('Save configuration') }}
                </button>
              </div>

              <p v-if="selectedTool.missingRequiredCustomFields.length > 0" class="fc-list-meta" style="margin:0; color:var(--fc-warning);">
                {{ getMissingRequiredFieldsMessage(selectedTool) }}
              </p>
              <p v-if="customFieldError" class="fc-list-meta" style="margin:0; color:var(--fc-error);">{{ customFieldError }}</p>
            </div>
          </div>

          <div style="margin-top: 12px;">
            <strong class="fc-list-meta">{{ t('Parameters') }}</strong>
            <ul>
              <li class="text-sm" v-for="param in selectedTool.parameters" :key="param.name">
                <strong>{{ param.name }}</strong>
                ({{ param.type }}{{ param.required ? ', *' : '' }})
                — {{ param.description }}
              </li>
              <li v-if="selectedTool.parameters.length === 0">—</li>
            </ul>
          </div>
        </div>
      </div>
    </template>
  </section>
</template>

<style scoped>
.tools-filters {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) 180px 180px auto;
  gap: 8px;
  margin-bottom: 12px;
}

.tools-description {
  max-width: 620px;
  white-space: normal;
  overflow-wrap: anywhere;
}

.tool-custom-fields-grid {
  display: grid;
  gap: 10px;
}

.tool-custom-field-item {
  border: 1px solid var(--fc-border-subtle);
  border-radius: 8px;
  padding: 10px;
}

@media (max-width: 980px) {
  .tools-filters {
    grid-template-columns: 1fr;
  }
}

.tools-modal-wrap {
  position: fixed;
  inset: 0;
  z-index: 60;
  background: rgba(15, 23, 42, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.tools-modal {
  width: min(760px, 100%);
  max-height: min(85vh, 760px);
  overflow: auto;
  border: 1px solid var(--fc-border);
  border-radius: 12px;
  background: var(--fc-surface);
  padding: 16px;
}

.tools-modal-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.tools-modal-description {
  margin-top: 10px;
  max-width: 640px;
  white-space: normal;
  overflow-wrap: anywhere;
}
</style>
