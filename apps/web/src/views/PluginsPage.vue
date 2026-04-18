<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { RefreshCw, Puzzle, Shield, Lock } from "lucide-vue-next";

import { uiRuntime } from "../runtime";
import SkeletonList from "../components/SkeletonList.vue";
import { useI18n } from "../composables/useI18n";
import type { PluginListItem, PluginApprovalMode } from "@familyco/ui";

const { t } = useI18n();
const isDiscovering = ref(false);
const pendingPluginId = ref<string | null>(null);
const selectedPlugin = ref<PluginListItem | null>(null);

const state = computed(() => uiRuntime.stores.plugins.state);
const plugins = computed(() => state.value.data.items);
const localPluginsPath = "/plugins";

const approvalOptions: { value: PluginApprovalMode; label: string }[] = [
  { value: "auto", label: "auto" },
  { value: "suggest-only", label: "suggest-only" },
  { value: "require-review", label: "require-review" },
];

const discover = async (): Promise<void> => {
  isDiscovering.value = true;
  try {
    await uiRuntime.stores.plugins.discover();
  } finally {
    isDiscovering.value = false;
  }
};

const togglePlugin = async (plugin: PluginListItem): Promise<void> => {
  if (plugin.isDefault) return;
  pendingPluginId.value = plugin.id;
  try {
    if (plugin.state === "enabled") {
      await uiRuntime.stores.plugins.disable(plugin.id);
    } else {
      await uiRuntime.stores.plugins.enable(plugin.id);
    }
  } finally {
    pendingPluginId.value = null;
  }
};

const viewPlugin = (plugin: PluginListItem): void => {
  selectedPlugin.value = plugin;
};

const closePluginModal = (): void => {
  selectedPlugin.value = null;
};

const changeApproval = async (
  plugin: PluginListItem,
  mode: PluginApprovalMode
): Promise<void> => {
  pendingPluginId.value = plugin.id;
  try {
    const updated = await uiRuntime.stores.plugins.updateApproval(plugin.id, mode);
    if (selectedPlugin.value?.id === updated.id) {
      selectedPlugin.value = updated;
    }
  } finally {
    pendingPluginId.value = null;
  }
};

const stateBadgeClass = (s: string): string => {
  switch (s) {
    case "enabled":
      return "plugins-state--enabled";
    case "disabled":
      return "plugins-state--disabled";
    case "error":
      return "plugins-state--error";
    default:
      return "plugins-state--discovered";
  }
};

onMounted(() => {
  void uiRuntime.stores.plugins.load();
});
</script>

<template>
  <section>
    <div class="fc-page-header">
      <div>
        <h3>{{ t("Plugins") }}</h3>
        <p>
          {{
            t("Discover, enable and configure plugins that extend agent capabilities.")
          }}
        </p>
      </div>
      <button class="fc-btn-primary" :disabled="isDiscovering" @click="discover">
        <RefreshCw :size="14" :class="{ 'fc-spin': isDiscovering }" />
        {{ isDiscovering ? t("Discovering…") : t("Discover plugins") }}
      </button>
    </div>

    <div v-if="state.isLoading" class="fc-loading">
      <p style="margin: 0 0 10px; font-size: 0.875rem; color: var(--fc-text-muted)">
        {{ t("Loading plugins…") }}
      </p>
      <SkeletonList />
    </div>

    <div v-else-if="state.errorMessage" class="fc-error">
      <p>{{ state.errorMessage }}</p>
      <button class="fc-btn-secondary" @click="discover">{{ t("Retry") }}</button>
    </div>

    <template v-else>
      <div v-if="plugins.length === 0" class="fc-empty">
        <Puzzle :size="22" class="fc-empty-icon" />
        <h4>{{ t("No plugins found") }}</h4>
        <p>
          {{
            t(
              "Create a folder in plugins path to register a new plugin.",
              { path: localPluginsPath }
            )
          }}
        </p>
      </div>

      <article v-else class="fc-card">
        <table class="fc-budget-table">
          <thead>
            <tr>
              <th>{{ t("Name") }}</th>
              <th>{{ t("State") }}</th>
              <th>{{ t("Actions") }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="plugin in plugins" :key="plugin.id">
              <td>
                <div style="display: flex; flex-direction: column; gap: 4px">
                  <div>
                    <strong>{{ plugin.name }}</strong>
                    <span v-if="plugin.isDefault" class="plugins-default-badge">
                      <Lock :size="10" style="vertical-align: middle" />
                      {{ t("Default") }}
                    </span>
                  </div>
                  <span class="fc-list-meta plugins-description">{{
                    plugin.description
                  }}</span>
                </div>
              </td>
              <td>
                <span class="plugins-state-badge" :class="stateBadgeClass(plugin.state)">
                  {{ plugin.state }}
                </span>
              </td>
              <td>
                <div class="fc-inline-actions">
                  <button class="fc-btn-secondary" @click="viewPlugin(plugin)">
                    {{ t("View") }}
                  </button>
                  <button
                    class="fc-btn-secondary"
                    :disabled="
                      pendingPluginId === plugin.id ||
                      plugin.state === 'error' ||
                      plugin.isDefault
                    "
                    :title="
                      plugin.isDefault
                        ? t('Default plugins cannot be disabled')
                        : undefined
                    "
                    @click="togglePlugin(plugin)"
                  >
                    {{
                      pendingPluginId === plugin.id
                        ? t("Refreshing…")
                        : plugin.state === "enabled"
                        ? t("Disable")
                        : t("Enable")
                    }}
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </article>

      <div
        v-if="selectedPlugin"
        class="plugins-modal-wrap"
        @click.self="closePluginModal"
      >
        <div
          class="plugins-modal"
          role="dialog"
          aria-modal="true"
          :aria-label="selectedPlugin.name"
        >
          <div class="plugins-modal-header">
            <div>
              <h4 class="fc-card-title">{{ selectedPlugin.name }}</h4>
              <span
                class="plugins-state-badge"
                :class="stateBadgeClass(selectedPlugin.state)"
              >
                {{ selectedPlugin.state }}
              </span>
              <span v-if="selectedPlugin.isDefault" class="plugins-default-badge">
                <Lock :size="10" style="vertical-align: middle" />
                {{ t("Default") }}
              </span>
            </div>
            <button class="fc-btn-secondary" @click="closePluginModal">
              {{ t("Close") }}
            </button>
          </div>

          <p class="plugins-modal-description">{{ selectedPlugin.description }}</p>

          <dl
            class="fc-list-meta"
            style="
              display: grid;
              grid-template-columns: auto 1fr;
              gap: 4px 10px;
              margin-top: 10px;
            "
          >
            <dt>{{ t("ID") }}</dt>
            <dd>{{ selectedPlugin.id }}</dd>
            <dt>{{ t("Version") }}</dt>
            <dd>{{ selectedPlugin.version }}</dd>
            <dt>{{ t("Author") }}</dt>
            <dd>{{ selectedPlugin.author ?? "—" }}</dd>
            <dt>{{ t("Path") }}</dt>
            <dd>{{ selectedPlugin.path }}</dd>
            <dt>{{ t("Tags") }}</dt>
            <dd>
              {{ selectedPlugin.tags.length > 0 ? selectedPlugin.tags.join(", ") : "—" }}
            </dd>
            <dt>{{ t("Checksum") }}</dt>
            <dd style="font-family: monospace; font-size: 0.75rem">
              {{ selectedPlugin.checksum }}
            </dd>
            <dt>{{ t("Discovered at") }}</dt>
            <dd>{{ selectedPlugin.discoveredAt }}</dd>
          </dl>

          <div class="plugins-caps" style="margin-top: 10px">
            <span
              v-for="cap in selectedPlugin.capabilities"
              :key="cap.kind + cap.name"
              class="plugins-cap-tag"
            >
              {{ cap.kind }}: {{ cap.name }}
            </span>
          </div>

          <div class="plugins-approval" style="margin-top: 14px" v-if="!selectedPlugin.isDefault">
            <Shield :size="14" />
            <label>{{ t("Approval mode") }}</label>
            <select
              :value="selectedPlugin.approvalMode"
              :disabled="pendingPluginId === selectedPlugin.id"
              @change="changeApproval(selectedPlugin!, ($event.target as HTMLSelectElement).value as PluginApprovalMode)"
            >
              <option v-for="opt in approvalOptions" :key="opt.value" :value="opt.value">
                {{ t(opt.label) }}
              </option>
            </select>
          </div>
        </div>
      </div>
    </template>
  </section>
</template>

<style scoped>
.plugins-description {
  max-width: 620px;
  white-space: normal;
  overflow-wrap: anywhere;
}

.plugins-caps {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.plugins-cap-tag {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 0.7rem;
  background: var(--fc-surface-hover);
  color: var(--fc-text-muted);
}

.plugins-state-badge {
  display: inline-block;
  padding: 1px 8px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
}
.plugins-state--enabled {
  background: #dcfce7;
  color: #166534;
}
.plugins-state--disabled {
  background: #f1f5f9;
  color: #475569;
}
.plugins-state--error {
  background: #fee2e2;
  color: #991b1b;
}
.plugins-state--discovered {
  background: #dbeafe;
  color: #1e40af;
}

.plugins-default-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  margin-left: 6px;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 500;
  background: var(--fc-surface-hover);
  color: var(--fc-text-muted);
  vertical-align: middle;
}

.plugins-approval {
  display: flex;
  align-items: center;
  gap: 8px;
}
.plugins-approval select {
  padding: 4px 8px;
  border: 1px solid var(--fc-border);
  border-radius: 6px;
  background: var(--fc-surface);
  color: var(--fc-text);
  font-size: 0.8rem;
}

.plugins-modal-wrap {
  position: fixed;
  inset: 0;
  z-index: 60;
  background: rgba(15, 23, 42, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.plugins-modal {
  width: min(760px, 100%);
  max-height: min(85vh, 760px);
  overflow: auto;
  border: 1px solid var(--fc-border);
  border-radius: 12px;
  background: var(--fc-surface);
  padding: 16px;
}

.plugins-modal-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.plugins-modal-description {
  margin-top: 10px;
  max-width: 640px;
  white-space: normal;
  overflow-wrap: anywhere;
}
</style>
