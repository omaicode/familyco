<script setup lang="ts">
import type { AgentListItem } from '@familyco/ui';
import { Plus, ShieldCheck } from 'lucide-vue-next';

import type { CreateTemplateId } from '../../composables/agents-page.config';
import { useI18n } from '../../composables/useI18n';
import FcButton from '../FcButton.vue';
import FcCard from '../FcCard.vue';
import FcInput from '../FcInput.vue';
import FcSelect from '../FcSelect.vue';

type AgentLevel = AgentListItem['level'];

interface DraftState {
  name: string;
  role: string;
  level: AgentLevel;
  department: string;
  parentAgentId: string;
}

defineProps<{
  draft: DraftState;
  templateCards: Array<{
    id: CreateTemplateId;
    title: string;
    description: string;
  }>;
  draftManagerOptions: AgentListItem[];
  autonomyGuide: {
    label: string;
    description: string;
    note: string;
  };
  isCreating: boolean;
}>();

const emit = defineEmits<{
  (event: 'apply-template', templateId: CreateTemplateId): void;
  (event: 'create'): void;
  (event: 'close'): void;
}>();

const { t } = useI18n();
</script>

<template>
  <FcCard class="ag-create-card">
    <div class="ag-section-head">
      <div>
        <h4>{{ t('Create agent') }}</h4>
        <p>{{ t('Set up a heartbeat-based worker and place it in the right reporting line.') }}</p>
      </div>
    </div>

    <div class="ag-template-strip">
      <button
        v-for="template in templateCards"
        :key="template.id"
        class="ag-template-chip"
        type="button"
        @click="emit('apply-template', template.id)"
      >
        <strong>{{ t(template.title) }}</strong>
        <span>{{ t(template.description) }}</span>
      </button>
    </div>

    <div class="fc-form-grid">
      <div class="fc-form-group">
        <label class="fc-label">{{ t('Name') }}</label>
        <FcInput v-model="draft.name" :placeholder="t('e.g. Nora — Ops Lead')" />
      </div>

      <div class="fc-form-group">
        <label class="fc-label">{{ t('Role') }}</label>
        <FcInput v-model="draft.role" :placeholder="t('e.g. Operations Lead')" />
      </div>

      <div class="fc-form-group">
        <label class="fc-label">{{ t('Department') }}</label>
        <FcInput v-model="draft.department" :placeholder="t('e.g. Operations')" />
      </div>

      <div class="fc-form-group">
        <label class="fc-label">{{ t('Level') }}</label>
        <FcSelect v-model="draft.level">
          <option value="L0">{{ t('L0 — Executive') }}</option>
          <option value="L1">{{ t('L1 — Department lead') }}</option>
          <option value="L2">{{ t('L2 — Specialist') }}</option>
        </FcSelect>
      </div>

      <div class="fc-form-group ag-span-2">
        <label class="fc-label">{{ t('Reports to') }}</label>
        <FcSelect v-model="draft.parentAgentId" :disabled="draft.level === 'L0' || draftManagerOptions.length === 0">
          <option value="">
            {{ draft.level === 'L0' ? t('Executive agents stay at the root') : t('No manager assigned yet') }}
          </option>
          <option v-for="manager in draftManagerOptions" :key="manager.id" :value="manager.id">
            {{ manager.name }} — {{ manager.role }}
          </option>
        </FcSelect>
      </div>
    </div>

    <div class="ag-note-box">
      <div class="ag-note-head">
        <ShieldCheck :size="15" />
        <strong>{{ t(autonomyGuide.label) }}</strong>
      </div>
      <p>{{ t(autonomyGuide.description) }}</p>
      <small>{{ t(autonomyGuide.note) }}</small>
      <small class="ag-note-extra">{{ t('Agents wake up in short heartbeats, keep session state, and return to idle when the burst is done.') }}</small>
    </div>

    <div class="fc-toolbar">
      <FcButton
        variant="primary"
        :disabled="isCreating || !draft.name.trim() || !draft.role.trim() || !draft.department.trim()"
        @click="emit('create')"
      >
        <Plus :size="14" />
        {{ isCreating ? t('Creating…') : t('Create agent') }}
      </FcButton>
      <FcButton variant="ghost" @click="emit('close')">{{ t('Cancel') }}</FcButton>
    </div>
  </FcCard>
</template>

<style scoped>
.ag-create-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
}

.ag-section-head h4 {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
}

.ag-section-head p {
  margin: 4px 0 0;
  font-size: 0.8125rem;
  color: var(--fc-text-muted);
}

.ag-template-strip {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.ag-template-chip {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 10px 12px;
  border-radius: var(--fc-control-radius);
  border: 1px solid var(--fc-border-subtle);
  background: var(--fc-surface);
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}

.ag-template-chip:hover {
  border-color: color-mix(in srgb, var(--fc-primary) 35%, var(--fc-border-subtle));
  background: color-mix(in srgb, var(--fc-primary) 6%, var(--fc-surface));
}

.ag-template-chip strong {
  font-size: 0.8rem;
}

.ag-template-chip span {
  font-size: 0.72rem;
  color: var(--fc-text-muted);
  line-height: 1.4;
}

.ag-span-2 {
  grid-column: span 2;
}

.ag-note-box {
  padding: 12px 14px;
  border: 1px solid color-mix(in srgb, var(--fc-info) 26%, var(--fc-border-subtle));
  border-radius: var(--fc-card-radius);
  background: color-mix(in srgb, var(--fc-info) 6%, var(--fc-surface));
}

.ag-note-head {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 6px;
}

.ag-note-box p {
  margin: 0 0 6px;
  font-size: 0.82rem;
  color: var(--fc-text-muted);
  line-height: 1.5;
}

.ag-note-box small {
  display: block;
  font-size: 0.74rem;
  color: var(--fc-text-muted);
}

.ag-note-extra {
  margin-top: 6px;
}

@media (max-width: 720px) {
  .ag-template-strip,
  .fc-form-grid {
    grid-template-columns: 1fr;
  }

  .ag-span-2 {
    grid-column: span 1;
  }
}
</style>
