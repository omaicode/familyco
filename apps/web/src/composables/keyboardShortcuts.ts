export type ShortcutActionId =
  | 'createTask'
  | 'goAgents'
  | 'goProjects'
  | 'goTasks'
  | 'openQuickSwitcher'
  | 'openHelp';

export type ShortcutConfig = Record<ShortcutActionId, string>;

export interface ShortcutDefinition {
  id: ShortcutActionId;
  actionLabel: string;
  actionHint: string;
}

export const SHORTCUT_SETTING_KEY = 'ui.shortcuts';

export const DEFAULT_SHORTCUT_CONFIG: ShortcutConfig = {
  createTask: 'n',
  goAgents: 'g a',
  goProjects: 'g p',
  goTasks: 'g t',
  openQuickSwitcher: 'mod+k',
  openHelp: '?'
};

export const SHORTCUT_DEFINITIONS: ShortcutDefinition[] = [
  {
    id: 'createTask',
    actionLabel: 'Create task',
    actionHint: 'Open task creation flow quickly.'
  },
  {
    id: 'goAgents',
    actionLabel: 'Go to agents',
    actionHint: 'Jump to the agents workspace.'
  },
  {
    id: 'goProjects',
    actionLabel: 'Go to projects',
    actionHint: 'Jump to the project portfolio.'
  },
  {
    id: 'goTasks',
    actionLabel: 'Go to tasks',
    actionHint: 'Jump to the delivery board.'
  },
  {
    id: 'openQuickSwitcher',
    actionLabel: 'Open quick switcher',
    actionHint: 'Open command palette style navigation.'
  },
  {
    id: 'openHelp',
    actionLabel: 'Open keyboard shortcuts help',
    actionHint: 'Show the keyboard shortcuts reference.'
  }
];

const isShortcutActionId = (value: string): value is ShortcutActionId =>
  value === 'createTask'
  || value === 'goAgents'
  || value === 'goProjects'
  || value === 'goTasks'
  || value === 'openQuickSwitcher'
  || value === 'openHelp';

const normalizeToken = (token: string): string => {
  const trimmed = token.trim().toLowerCase();
  if (!trimmed) {
    return '';
  }

  const normalized = trimmed.replace(/\s*\+\s*/gu, '+').replace(/\s+/gu, ' ');
  return normalized;
};

export const normalizeShortcutBinding = (binding: unknown): string => {
  if (typeof binding !== 'string') {
    return '';
  }

  return binding
    .split(' ')
    .map((part) => normalizeToken(part))
    .filter(Boolean)
    .join(' ')
    .slice(0, 40);
};

export const resolveShortcutConfig = (value: unknown): ShortcutConfig => {
  if (!value || typeof value !== 'object') {
    return { ...DEFAULT_SHORTCUT_CONFIG };
  }

  const next: ShortcutConfig = { ...DEFAULT_SHORTCUT_CONFIG };
  for (const [key, candidate] of Object.entries(value as Record<string, unknown>)) {
    if (!isShortcutActionId(key)) {
      continue;
    }

    const normalized = normalizeShortcutBinding(candidate);
    if (normalized) {
      next[key] = normalized;
    }
  }

  return next;
};

export const shortcutBindingTokens = (binding: string): string[] =>
  normalizeShortcutBinding(binding).split(' ').filter(Boolean);

export const displayShortcutBinding = (binding: string): string => {
  const normalized = normalizeShortcutBinding(binding);
  if (!normalized) {
    return 'Unassigned';
  }

  return normalized
    .split(' ')
    .map((part) => part.replace(/^mod\+/u, 'Ctrl/Cmd+').toUpperCase())
    .join(' then ');
};

export const keyEventToken = (event: KeyboardEvent): string | null => {
  const raw = event.key;
  if (!raw) {
    return null;
  }

  const lowered = raw.toLowerCase();
  if (lowered === 'shift' || lowered === 'control' || lowered === 'meta' || lowered === 'alt') {
    return null;
  }

  const key = lowered === ' ' ? 'space' : lowered;
  const parts: string[] = [];
  if (event.metaKey || event.ctrlKey) {
    parts.push('mod');
  }
  if (event.altKey) {
    parts.push('alt');
  }

  if (parts.length > 0) {
    return `${parts.join('+')}+${key}`;
  }

  return key;
};