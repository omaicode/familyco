import type { AppRoutePath } from '../navigation/app-sections.js';
import { familyCoUITheme, type FamilyCoUITheme } from '../theme/familyco-theme.js';

export type AccessLevel = 'L0' | 'L1' | 'L2';

export interface AppConnectionState {
  mode: 'embedded' | 'remote';
  baseURL: string;
  lastHealthCheckAt: string | null;
  isServerReachable: boolean;
}

export interface AppStoreState {
  activeRoute: AppRoutePath;
  activeLevel: AccessLevel;
  founderName: string;
  theme: FamilyCoUITheme;
  connection: AppConnectionState;
}

export class AppStore {
  state: AppStoreState;

  constructor(baseURL: string) {
    this.state = {
      activeRoute: '/dashboard',
      activeLevel: 'L0',
      founderName: 'Founder',
      theme: familyCoUITheme,
      connection: {
        mode: 'embedded',
        baseURL,
        lastHealthCheckAt: null,
        isServerReachable: false
      }
    };
  }

  setRoute(route: AppRoutePath): void {
    this.state.activeRoute = route;
  }

  setActiveLevel(level: AccessLevel): void {
    this.state.activeLevel = level;
  }

  setServerReachable(reachable: boolean, checkedAtIso: string): void {
    this.state.connection.isServerReachable = reachable;
    this.state.connection.lastHealthCheckAt = checkedAtIso;
  }

  canAccess(minLevel: AccessLevel): boolean {
    const rank: Record<AccessLevel, number> = { L0: 3, L1: 2, L2: 1 };
    return rank[this.state.activeLevel] >= rank[minLevel];
  }
}

export const createAppStore = (baseURL: string): AppStore => new AppStore(baseURL);
