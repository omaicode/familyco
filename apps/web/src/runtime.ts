import { bootstrapFamilyCoUI, type UIBootstrap } from '@familyco/ui';
import { buildFamilyCoCssVariables } from '@familyco/ui';

const isDesktopRuntime = (): boolean =>
  typeof window !== 'undefined' && typeof window.familycoDesktop?.invoke === 'function';

const applyRuntimeMode = (): void => {
  if (typeof document === 'undefined') {
    return;
  }

  const desktopRuntime = isDesktopRuntime();
  document.documentElement.dataset.runtime = desktopRuntime ? 'desktop' : 'web';

  if (!desktopRuntime) {
    delete document.documentElement.dataset.desktopPlatform;
    return;
  }

  const desktopPlatform = window.familycoDesktopConfig?.platform?.trim();
  if (desktopPlatform) {
    document.documentElement.dataset.desktopPlatform = desktopPlatform;
  }
};

applyRuntimeMode();

const resolveApiBaseUrl = (): string => {
  if (isDesktopRuntime()) {
    return window.familycoDesktopConfig?.apiBaseUrl?.trim() || 'http://127.0.0.1:3040';
  }

  const desktopBaseUrl = window.familycoDesktopConfig?.apiBaseUrl?.trim();
  const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();

  if (desktopBaseUrl) {
    return desktopBaseUrl;
  }

  // In production, backend URL must be explicit to prevent silent misrouting.
  if (import.meta.env.PROD && !configuredBaseUrl) {
    throw new Error('VITE_API_BASE_URL is required in production builds');
  }

  return configuredBaseUrl || 'http://127.0.0.1:4000';
};

const baseURL = resolveApiBaseUrl();
const apiKey =
  (isDesktopRuntime() ? window.familycoDesktopConfig?.apiKey || 'local-dev-api-key' : undefined) ||
  import.meta.env.VITE_API_KEY;
const token = import.meta.env.VITE_BEARER_TOKEN;
const systemPrefersDark =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-color-scheme: dark)').matches;

export const uiRuntime: UIBootstrap = bootstrapFamilyCoUI({
  baseURL,
  apiKey,
  bearerToken: token,
  themePreference: 'system',
  systemPrefersDark
});

export const applyRuntimeTheme = (): void => {
  const cssVariables = buildFamilyCoCssVariables(uiRuntime.stores.app.state.theme);

  document.documentElement.dataset.theme = uiRuntime.stores.app.state.themeMode;
  document.documentElement.style.colorScheme = uiRuntime.stores.app.state.themeMode;

  for (const [key, value] of Object.entries(cssVariables)) {
    document.documentElement.style.setProperty(key, value);
  }
};
