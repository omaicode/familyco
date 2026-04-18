<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { RefreshCw, Wrench, Lock } from 'lucide-vue-next';

import { uiRuntime } from '../runtime';
import FcPagination from '../components/FcPagination.vue';
import SkeletonList from '../components/SkeletonList.vue';
import { useI18n } from '../composables/useI18n';
import type { ToolListItem } from '@familyco/ui';

const { t } = useI18n();
const isRefreshing = ref(false);
const pendingToolName = ref<string | null>(null);
const selectedTool = ref<ToolListItem | null>(null);
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
    if (tool.enabled) {
      await uiRuntime.stores.tools.disable(tool.name);
    } else {
      await uiRuntime.stores.tools.enable(tool.name);
    }
  } finally {
    pendingToolName.value = null;
  }
};

const viewTool = (tool: ToolListItem): void => {
  selectedTool.value = tool;
};

const closeToolModal = (): void => {
  selectedTool.value = null;
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
              </td>
              <td>
                <div class="fc-inline-actions">
                  <button class="fc-btn-secondary" @click="viewTool(tool)">
                    {{ t('View') }}
                  </button>
                  <button
                    class="fc-btn-secondary"
                    :disabled="pendingToolName === tool.name || !tool.togglable"
                    :title="!tool.togglable ? t('Built-in tools are always enabled.') : undefined"
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
