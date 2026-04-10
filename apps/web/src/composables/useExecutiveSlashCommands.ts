import { computed, nextTick, onBeforeUnmount, ref, type CSSProperties, type Ref, type WritableComputedRef, watch } from 'vue';

import { uiRuntime } from '../runtime';
import type { SlashCommandItem } from '@familyco/ui';

export interface SlashCommandSuggestion {
  command: string;
  label: string;
  description: string;
  insertValue: string;
}

export function useExecutiveSlashCommands(draftValue: WritableComputedRef<string>, agentId: Ref<string>) {
  const composerRef = ref<HTMLTextAreaElement | null>(null);
  const activeSlashIndex = ref(0);
  const slashPopoverStyle = ref<CSSProperties>({ left: '12px', top: '58px', width: '280px' });
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
  const hasResolvedSlashCommand = computed(() => draftMatchesKnownCommand());
  const isSlashPopoverVisible = computed(() => isSlashMode.value && !hasResolvedSlashCommand.value);
  const filteredSlashCommands = computed(() => {
    if (!isSlashPopoverVisible.value) {
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

  let frameId: number | null = null;

  const focusComposer = async (): Promise<void> => {
    await nextTick();
    composerRef.value?.focus();
  };

  const schedulePopoverUpdate = (): void => {
    if (typeof window === 'undefined') {
      return;
    }

    if (frameId !== null) {
      window.cancelAnimationFrame(frameId);
    }

    frameId = window.requestAnimationFrame(() => {
      frameId = null;
      updateSlashPopoverPosition();
    });
  };

  const applySlashCommand = async (command: SlashCommandSuggestion): Promise<void> => {
    draftValue.value = command.insertValue;
    activeSlashIndex.value = 0;
    schedulePopoverUpdate();
    await focusComposer();
  };

  const draftMatchesKnownCommand = (): boolean => {
    const normalized = draftValue.value.trim();
    return slashCommands.value.some((command) => {
      return normalized === command.command || normalized.startsWith(`${command.command} `);
    });
  };

  const onDraftInput = (): void => {
    schedulePopoverUpdate();
  };

  const onCaretInteraction = (): void => {
    schedulePopoverUpdate();
  };

  const onDraftKeydown = (event: KeyboardEvent, onSend: () => void): void => {
    if (isSlashMode.value && filteredSlashCommands.value.length > 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        activeSlashIndex.value = (activeSlashIndex.value + 1) % filteredSlashCommands.value.length;
        schedulePopoverUpdate();
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        activeSlashIndex.value = activeSlashIndex.value === 0
          ? filteredSlashCommands.value.length - 1
          : activeSlashIndex.value - 1;
        schedulePopoverUpdate();
        return;
      }

      if (event.key === 'Tab') {
        event.preventDefault();
        void applySlashCommand(filteredSlashCommands.value[activeSlashIndex.value]);
        return;
      }

      if (event.key === 'Enter' && !event.shiftKey && !draftMatchesKnownCommand()) {
        event.preventDefault();
        void applySlashCommand(filteredSlashCommands.value[activeSlashIndex.value]);
        return;
      }
    }

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      onSend();
    }
  };

  const updateSlashPopoverPosition = (): void => {
    const textarea = composerRef.value;
    if (!textarea || !isSlashPopoverVisible.value) {
      return;
    }

    const caretIndex = textarea.selectionStart ?? draftValue.value.length;
    const caret = getTextareaCaretPosition(textarea, caretIndex);
    const maxWidth = Math.min(320, Math.max(220, textarea.clientWidth - 24));
    const maxLeft = Math.max(12, textarea.clientWidth - maxWidth - 12);
    const left = Math.min(Math.max(12, caret.left - 14), maxLeft);
    const top = Math.max(56, caret.top + 30);

    slashPopoverStyle.value = {
      left: `${left}px`,
      top: `${top}px`,
      width: `${maxWidth}px`
    };
  };

  watch(filteredSlashCommands, (nextCommands) => {
    if (nextCommands.length === 0) {
      activeSlashIndex.value = 0;
      return;
    }

    if (activeSlashIndex.value > nextCommands.length - 1) {
      activeSlashIndex.value = 0;
    }

    schedulePopoverUpdate();
  });

  watch(draftValue, (nextMessage) => {
    if (!nextMessage.trimStart().startsWith('/') || hasResolvedSlashCommand.value) {
      activeSlashIndex.value = 0;
      return;
    }

    schedulePopoverUpdate();
  });

  watch(agentId, (nextId) => {
    void loadSlashCommands(nextId);
  }, { immediate: true });

  if (typeof window !== 'undefined') {
    window.addEventListener('resize', schedulePopoverUpdate);
  }

  onBeforeUnmount(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', schedulePopoverUpdate);
    }

    if (frameId !== null && typeof window !== 'undefined') {
      window.cancelAnimationFrame(frameId);
    }
  });

  return {
    composerRef,
    activeSlashIndex,
    isSlashMode,
    isSlashPopoverVisible,
    filteredSlashCommands,
    slashPopoverStyle,
    applySlashCommand,
    onDraftInput,
    onCaretInteraction,
    onDraftKeydown
  };
}

function getTextareaCaretPosition(textarea: HTMLTextAreaElement, selectionIndex: number): { top: number; left: number } {
  const mirror = document.createElement('div');
  const marker = document.createElement('span');
  const styles = window.getComputedStyle(textarea);

  mirror.style.position = 'absolute';
  mirror.style.visibility = 'hidden';
  mirror.style.pointerEvents = 'none';
  mirror.style.whiteSpace = 'pre-wrap';
  mirror.style.wordWrap = 'break-word';
  mirror.style.overflowWrap = 'break-word';
  mirror.style.top = '0';
  mirror.style.left = '-9999px';

  const mirroredProps = [
    'boxSizing',
    'width',
    'height',
    'overflowX',
    'overflowY',
    'borderTopWidth',
    'borderRightWidth',
    'borderBottomWidth',
    'borderLeftWidth',
    'paddingTop',
    'paddingRight',
    'paddingBottom',
    'paddingLeft',
    'fontStyle',
    'fontVariant',
    'fontWeight',
    'fontStretch',
    'fontSize',
    'fontSizeAdjust',
    'lineHeight',
    'fontFamily',
    'letterSpacing',
    'textTransform',
    'textIndent'
  ] as const;

  mirroredProps.forEach((property) => {
    mirror.style[property] = styles[property];
  });

  const beforeCaret = textarea.value.slice(0, selectionIndex).replace(/\n$/u, '\n\u200b');
  mirror.textContent = beforeCaret;
  marker.textContent = textarea.value.slice(selectionIndex) || '.';
  mirror.appendChild(marker);
  document.body.appendChild(mirror);

  const left = marker.offsetLeft - textarea.scrollLeft + parseFloat(styles.borderLeftWidth);
  const top = marker.offsetTop - textarea.scrollTop + parseFloat(styles.borderTopWidth);

  document.body.removeChild(mirror);
  return { top, left };
}

