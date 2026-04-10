import { computed, ref, type Ref, type WritableComputedRef, watch } from 'vue';

import { uiRuntime } from '../runtime';
import type { SlashCommandItem } from '@familyco/ui';

export interface SlashCommandSuggestion {
  command: string;
  label: string;
  description: string;
  insertValue: string;
}

export function useExecutiveSlashCommands(draftValue: WritableComputedRef<string>, agentId: Ref<string>) {
  const slashCommands = ref<SlashCommandSuggestion[]>([]);

  const loadSlashCommands = async (id: string): Promise<void> => {
    if (!id) {
      slashCommands.value = [];
      return;
    }

    try {
      const items = await uiRuntime.api.getAgentSlashCommands(id);
      slashCommands.value = items.map((item: SlashCommandItem) => ({
        command: item.command,
        label: item.label,
        description: item.description,
        insertValue: item.insertValue
      }));
    } catch {
      slashCommands.value = [];
    }
  };

  const slashDraft = computed(() => draftValue.value.trimStart());
  const isSlashMode = computed(() => slashDraft.value.startsWith('/'));
  const hasResolvedSlashCommand = computed(() => {
    const normalized = draftValue.value.trim();
    return slashCommands.value.some((command) => {
      return normalized === command.command || normalized.startsWith(`${command.command} `);
    });
  });

  const filteredSlashCommands = computed(() => {
    if (!isSlashMode.value || hasResolvedSlashCommand.value) {
      return [];
    }

    const normalized = slashDraft.value.toLowerCase();
    const query = normalized.replace(/^\//, '');
    return slashCommands.value.filter((command) => {
      return command.command.includes(normalized)
        || command.label.toLowerCase().includes(query)
        || command.description.toLowerCase().includes(query);
    });
  });

  const slashSuggestion = computed(() => filteredSlashCommands.value[0]?.insertValue ?? null);

  const applySlashSuggestion = (): void => {
    if (!slashSuggestion.value) {
      return;
    }

    draftValue.value = slashSuggestion.value;
  };

  const onDraftKeydown = (event: KeyboardEvent, onSend: () => void): void => {
    if (event.key === 'Tab' && isSlashMode.value && slashSuggestion.value && !hasResolvedSlashCommand.value) {
      event.preventDefault();
      applySlashSuggestion();
      return;
    }

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      onSend();
    }
  };

  watch(agentId, (nextId) => {
    void loadSlashCommands(nextId);
  }, { immediate: true });

  return {
    isSlashMode,
    slashSuggestion,
    applySlashSuggestion,
    onDraftKeydown
  };
}
