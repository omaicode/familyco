import { reactive } from 'vue';

import type { SupportedLocale } from '../i18n/familyco-i18n.js';
import type { AppRoutePath } from '../navigation/app-sections.js';
import {
  familyCoUITheme,
  resolveFamilyCoTheme,
  resolveThemeMode,
  type FamilyCoUITheme,
  type ThemeMode,
  type ThemePreference
} from '../theme/familyco-theme.js';

export type AccessLevel = 'L0' | 'L1' | 'L2';

export interface AppConnectionState {
  mode: 'embedded' | 'remote';
  baseURL: string;
  lastHealthCheckAt: string | null;
  isServerReachable: boolean;
  isBrowserOnline: boolean;
  lastErrorMessage: string | null;
}

export interface AppStoreState {
  activeRoute: AppRoutePath;
  activeLevel: AccessLevel;
  founderName: string;
  locale: SupportedLocale;
  theme: FamilyCoUITheme;
  themePreference: ThemePreference;
  themeMode: ThemeMode;
  connection: AppConnectionState;
}

export class AppStore {
  state: AppStoreState;

  constructor(baseURL: string) {
    this.state = reactive({
      activeRoute: '/dashboard',
      activeLevel: 'L0',
      founderName: 'Founder',
      locale: 'en',
      theme: familyCoUITheme,
      themePreference: 'system',
      themeMode: 'light',
      connection: {
        mode: 'embedded',
        baseURL,
        lastHealthCheckAt: null,
        isServerReachable: false,
        isBrowserOnline: true,
        lastErrorMessage: null
      }
    }) as AppStoreState;
  }

  setRoute(route: AppRoutePath): void {
    this.state.activeRoute = route;
  }

  setActiveLevel(level: AccessLevel): void {
    this.state.activeLevel = level;
  }

  setLocale(locale: SupportedLocale): void {
    this.state.locale = locale;
  }

  setServerReachable(reachable: boolean, checkedAtIso: string, lastErrorMessage: string | null = null): void {
    this.state.connection.isServerReachable = reachable;
    this.state.connection.lastHealthCheckAt = checkedAtIso;
    this.state.connection.lastErrorMessage = lastErrorMessage;
  }

  setBrowserOnline(isOnline: boolean): void {
    this.state.connection.isBrowserOnline = isOnline;
  }

  applyThemePreference(preference: ThemePreference, systemPrefersDark: boolean): void {
    const mode = resolveThemeMode(preference, systemPrefersDark);
    this.state.themePreference = preference;
    this.state.themeMode = mode;
    this.state.theme = resolveFamilyCoTheme(mode);
  }

  refreshThemeFromSystem(systemPrefersDark: boolean): void {
    this.applyThemePreference(this.state.themePreference, systemPrefersDark);
  }

  canAccess(minLevel: AccessLevel): boolean {
    const rank: Record<AccessLevel, number> = { L0: 3, L1: 2, L2: 1 };
    return rank[this.state.activeLevel] >= rank[minLevel];
  }
}

export const createAppStore = (baseURL: string): AppStore => new AppStore(baseURL);
