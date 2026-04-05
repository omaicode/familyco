export type AgentLevel = 'L0' | 'L1' | 'L2';

export type TaskStatus =
  | 'pending'
  | 'in_progress'
  | 'review'
  | 'done'
  | 'blocked'
  | 'cancelled';

export interface FamilyCoColorTokens {
  background: string;
  surface: string;
  surfaceMuted: string;
  textMain: string;
  textMuted: string;
  textFaint: string;
  borderSubtle: string;
  primary: string;
  primaryHover: string;
  primaryForeground: string;
  success: string;
  warning: string;
  error: string;
  info: string;
}

export interface FamilyCoTypographyTokens {
  fontFamily: string;
  pageTitleSize: string;
  sectionTitleSize: string;
  bodySize: string;
  captionSize: string;
}

export interface FamilyCoSpacingTokens {
  pageX: string;
  pageY: string;
  sectionGap: string;
  cardPadding: string;
}

export interface FamilyCoRadiusTokens {
  card: string;
  control: string;
}

export interface FamilyCoComponentClassTokens {
  appShell: string;
  contentMain: string;
  card: string;
  buttonPrimary: string;
  buttonSecondary: string;
  tableHeader: string;
}

export interface FamilyCoUITheme {
  name: string;
  direction: 'light' | 'dark';
  colors: FamilyCoColorTokens;
  typography: FamilyCoTypographyTokens;
  spacing: FamilyCoSpacingTokens;
  radius: FamilyCoRadiusTokens;
  agentLevelColors: Record<AgentLevel, string>;
  taskStatusColors: Record<TaskStatus, string>;
  componentClasses: FamilyCoComponentClassTokens;
}

export type ThemePreference = 'system' | 'light' | 'dark';
export type ThemeMode = 'light' | 'dark';

// Neutral warm surfaces + calm teal accent. Keeps admin UI clear and friendly.
export const familyCoUILightTheme: FamilyCoUITheme = {
  name: 'FamilyCo Calm Teal',
  direction: 'light',
  colors: {
    background: '#F6F4EE',
    surface: '#FFFDF8',
    surfaceMuted: '#EFEBDF',
    textMain: '#1F2933',
    textMuted: '#52606D',
    textFaint: '#7B8794',
    borderSubtle: '#DAD4C5',
    primary: '#127A70',
    primaryHover: '#0E645C',
    primaryForeground: '#F5FFFD',
    success: '#2D8A4C',
    warning: '#B36A1E',
    error: '#C23D3D',
    info: '#2C6EA8'
  },
  typography: {
    fontFamily: '"Plus Jakarta Sans", "Manrope", "Segoe UI", sans-serif',
    pageTitleSize: '1.75rem',
    sectionTitleSize: '1.125rem',
    bodySize: '0.9375rem',
    captionSize: '0.75rem'
  },
  spacing: {
    pageX: '1.5rem',
    pageY: '1rem',
    sectionGap: '1rem',
    cardPadding: '1rem'
  },
  radius: {
    card: '0.625rem',
    control: '0.5rem'
  },
  agentLevelColors: {
    L0: '#2C6EA8',
    L1: '#127A70',
    L2: '#B36A1E'
  },
  taskStatusColors: {
    pending: '#7B8794',
    in_progress: '#2C6EA8',
    review: '#B36A1E',
    done: '#2D8A4C',
    blocked: '#C23D3D',
    cancelled: '#8A8F98'
  },
  componentClasses: {
    appShell: 'min-h-screen flex bg-[var(--fc-background)] text-[var(--fc-text-main)]',
    contentMain: 'flex-1 overflow-y-auto px-6 py-4',
    card: 'rounded-lg border bg-[var(--fc-surface)] border-[var(--fc-border-subtle)] p-4 shadow-sm',
    buttonPrimary:
      'inline-flex items-center justify-center rounded-md px-3.5 py-2 text-sm font-medium transition-colors bg-[var(--fc-primary)] text-[var(--fc-primary-foreground)] hover:bg-[var(--fc-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fc-primary)] disabled:opacity-50 disabled:cursor-not-allowed',
    buttonSecondary:
      'inline-flex items-center justify-center rounded-md px-3.5 py-2 text-sm font-medium transition-colors border border-[var(--fc-border-subtle)] bg-[var(--fc-surface)] text-[var(--fc-text-main)] hover:bg-[var(--fc-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fc-primary)] disabled:opacity-50 disabled:cursor-not-allowed',
    tableHeader: 'bg-[var(--fc-surface-muted)] text-[var(--fc-text-muted)] text-xs font-semibold'
  }
};

export const familyCoUIDarkTheme: FamilyCoUITheme = {
  name: 'FamilyCo Deep Slate',
  direction: 'dark',
  colors: {
    background: '#0F161A',
    surface: '#162027',
    surfaceMuted: '#1E2A33',
    textMain: '#EAF1F4',
    textMuted: '#AFC0CC',
    textFaint: '#8EA0AE',
    borderSubtle: '#2C3E4A',
    primary: '#36A89B',
    primaryHover: '#2F9287',
    primaryForeground: '#08231F',
    success: '#5EC58A',
    warning: '#E2A45B',
    error: '#E77878',
    info: '#6FB7F2'
  },
  typography: familyCoUILightTheme.typography,
  spacing: familyCoUILightTheme.spacing,
  radius: familyCoUILightTheme.radius,
  agentLevelColors: {
    L0: '#6FB7F2',
    L1: '#36A89B',
    L2: '#E2A45B'
  },
  taskStatusColors: {
    pending: '#8EA0AE',
    in_progress: '#6FB7F2',
    review: '#E2A45B',
    done: '#5EC58A',
    blocked: '#E77878',
    cancelled: '#6C7C89'
  },
  componentClasses: familyCoUILightTheme.componentClasses
};

export const resolveThemeMode = (
  preference: ThemePreference,
  systemPrefersDark: boolean
): ThemeMode => {
  if (preference === 'system') {
    return systemPrefersDark ? 'dark' : 'light';
  }

  return preference;
};

export const resolveFamilyCoTheme = (mode: ThemeMode): FamilyCoUITheme =>
  mode === 'dark' ? familyCoUIDarkTheme : familyCoUILightTheme;

// Backward-compat export.
export const familyCoUITheme = familyCoUILightTheme;
